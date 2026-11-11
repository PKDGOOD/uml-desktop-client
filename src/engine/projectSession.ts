import type {
  CanvasChange, DSLError, DiagramData, DiagramDocument, DiagramType, ProjectData, ProjectDocument, ProjectTreeNode,
} from '../types';
import { parseCheckedDSL } from './diagramRules';
import { SyncEngine, type CanvasChangeResult } from './syncEngine';
import { UndoManager } from './undoManager';
import { serializeDSL } from '../parser/dsl/serializer';
import { renameDiagramHeader } from '../parser/dsl/diagramHeader';

interface DiagramSession {
  sync: SyncEngine;
  history: UndoManager;
}

/**
 * Everything a save needs, captured at one revision (A02.05): per diagram the raw
 * editor text, the last valid model and whether the text parses, plus the parse
 * diagnostics of every invalid draft. Fully detached from the live session.
 */
export interface SessionSnapshot {
  document: ProjectDocument;
  diagnostics: Record<string, DSLError[]>;
  revision: number;
}

export interface ProjectSessionOptions {
  /** The durable project ID (ADR 0001 §3). A new session gets a fresh one. */
  projectId?: string;
}


function collectNames(nodes: ProjectTreeNode[], result = new Map<string, string>()): Map<string, string> {
  for (const node of nodes) {
    if (node.type === 'diagram') result.set(node.id, node.name);
    if (node.children) collectNames(node.children, result);
  }
  return result;
}

/** Owns drafts and history independently of which tab is currently visible. */
export class ProjectSession {
  project: ProjectData;
  readonly projectId: string;
  revision = 0;
  private savedRevision = 0;
  private sessions = new Map<string, DiagramSession>();
  private disposed = false;

  constructor(project: ProjectData, private readonly onChange: () => void, options: ProjectSessionOptions = {}) {
    this.project = structuredClone(project);
    this.projectId = options.projectId ?? crypto.randomUUID();
  }

  /** Syntax and rule errors of a diagram's current text; empty when the text is valid. */
  diagnostics(id: string): DSLError[] {
    const open = this.sessions.get(id);
    if (open) {
      open.sync.flushPendingText();
      return [...open.sync.getErrors()];
    }
    const model = this.project.diagrams[id];
    if (!model) return [];
    // An unopened diagram without stored text is saved as generated text, which must parse too.
    const parsed = parseCheckedDSL(this.text(id));
    return parsed.success ? [] : parsed.errors;
  }

  get dirty(): boolean {
    return this.revision !== this.savedRevision;
  }

  markUnsaved(): void {
    this.touch();
  }

  getSession(id: string): DiagramSession | undefined {
    if (this.disposed) return undefined;
    const existing = this.sessions.get(id);
    if (existing) return existing;
    if (!Object.prototype.hasOwnProperty.call(this.project.diagrams, id)) return undefined;
    const diagram = this.project.diagrams[id];
    if (!diagram) return undefined;

    const history = new UndoManager();
    const sync = new SyncEngine({
      undoManager: history,
      onDiagramUpdate: (updated) => {
        if (this.disposed) return;
        this.updateDiagram(id, updated);
        this.onChange();
      },
      onTextUpdate: (text) => {
        if (this.disposed) return;
        this.storeText(id, text);
        this.onChange();
      },
      onErrors: () => { if (!this.disposed) this.onChange(); },
    });
    sync.setDiagram(diagram, this.project.diagramTexts?.[id]);
    const session = { sync, history };
    this.sessions.set(id, session);
    return session;
  }

  text(id: string): string {
    return this.project.diagramTexts?.[id] ?? serializeDSL(this.project.diagrams[id]);
  }

  editText(id: string, text: string): void {
    const session = this.getSession(id);
    if (!session || text === this.text(id)) return;
    this.storeText(id, text);
    session.sync.onTextChange(text);
    this.touch();
  }

  editCanvas(id: string, change: CanvasChange): boolean {
    return this.tryEditCanvas(id, change).ok;
  }

  /** Apply a canvas or inspector command; a refusal leaves the revision unchanged. */
  tryEditCanvas(id: string, change: CanvasChange): CanvasChangeResult {
    const session = this.getSession(id);
    if (!session) return { ok: false, reason: 'busy', errors: [] };
    const result = session.sync.applyCanvasChange(change);
    if (result.ok) this.touch();
    return result;
  }

  undo(id: string): void {
    const session = this.getSession(id);
    if (!session) return;
    session.sync.flushPendingText(); // an invalid draft is an undo step of its own
    if (!session.history.canUndo()) return;
    session.history.undo();
    this.touch();
  }

  redo(id: string): void {
    const session = this.getSession(id);
    if (!session) return;
    session.sync.flushPendingText();
    if (!session.history.canRedo()) return;
    session.history.redo();
    this.touch();
  }

  setTree(tree: ProjectTreeNode[]): void {
    const collect = (nodes: ProjectTreeNode[], parent = '', result = new Map<string, string>()) => {
      for (const node of nodes) {
        if (node.type === 'diagram') result.set(node.id, parent);
        if (node.children) collect(node.children, node.id, result);
      }
      return result;
    };
    const before = collect(this.project.tree);
    const after = collect(tree);
    const diagrams = { ...this.project.diagrams };
    const diagramTexts = { ...this.project.diagramTexts };
    const diagramIndex = { ...this.project.metadata.diagramIndex };
    for (const id of before.keys()) {
      if (after.has(id)) continue;
      this.sessions.get(id)?.sync.dispose();
      this.sessions.delete(id);
      delete diagrams[id];
      delete diagramTexts[id];
      delete diagramIndex[id];
    }
    for (const [id, parentFolderId] of after) {
      if (diagrams[id]) diagramIndex[id] = { id, name: diagrams[id].name, type: diagrams[id].type, parentFolderId };
    }
    this.project = { ...this.project, tree, diagrams, diagramTexts, metadata: { ...this.project.metadata, diagramIndex } };
    // A diagram renamed in the tree is renamed everywhere: model, DSL header and index.
    for (const [id, name] of collectNames(tree)) {
      if (this.project.diagrams[id] && this.project.diagrams[id].name !== name) this.renameDiagram(id, name);
    }
    this.touch();
  }

  private renameDiagram(id: string, name: string): void {
    const text = this.text(id);
    const renamed = renameDiagramHeader(text, name);
    const session = this.sessions.get(id);
    if (renamed !== text) {
      this.storeText(id, renamed);
      if (session) {
        session.sync.onTextChange(renamed);
        // A valid draft updates the model, tree and index through onDiagramUpdate.
        if (session.sync.flushPendingText()) return;
      }
    }
    // Invalid draft, no header to rewrite, or no open session: rename the stored model directly.
    this.updateDiagram(id, { ...this.project.diagrams[id], name });
  }

  addDiagram(name: string, type: DiagramType, parentFolderId = ''): string {
    const id = crypto.randomUUID();
    const diagram: DiagramData = {
      id, name: name.trim() || 'Untitled Diagram', type,
      elements: [], connectors: [], viewport: { x: 0, y: 0, zoom: 1 },
    };
    const node: ProjectTreeNode = { id, name: diagram.name, type: 'diagram', diagramType: type };
    let inserted = false;
    const insert = (nodes: ProjectTreeNode[]): ProjectTreeNode[] => nodes.map((folder) => {
      if (folder.type === 'folder' && folder.id === parentFolderId) {
        inserted = true;
        return { ...folder, expanded: true, children: [...(folder.children ?? []), node] };
      }
      return folder.children ? { ...folder, children: insert(folder.children) } : folder;
    });
    let tree = insert(this.project.tree);
    if (!inserted) { tree = [...tree, node]; parentFolderId = ''; }
    this.project = {
      ...this.project, tree, diagrams: { ...this.project.diagrams, [id]: diagram },
      metadata: { ...this.project.metadata, diagramIndex: { ...this.project.metadata.diagramIndex,
        [id]: { id, name: diagram.name, type, parentFolderId } } },
    };
    this.touch();
    return id;
  }

  /** Detached snapshot: later edits cannot mutate a save already in flight. */
  snapshot(): { project: ProjectData; revision: number } {
    for (const { sync } of this.sessions.values()) sync.flushPendingText();
    const project = structuredClone(this.project);
    project.metadata.updatedAt = new Date().toISOString();
    return { project, revision: this.revision };
  }

  /**
   * Schema-2 view of the session at the current revision. An invalid draft is
   * kept verbatim next to its last valid model, so saving never loses either.
   */
  documentSnapshot(): SessionSnapshot {
    const { project, revision } = this.snapshot();
    const diagrams: Record<string, DiagramDocument> = {};
    const diagnostics: Record<string, DSLError[]> = {};
    for (const [id, model] of Object.entries(project.diagrams)) {
      const errors = this.diagnostics(id);
      if (errors.length > 0) diagnostics[id] = structuredClone(errors);
      diagrams[id] = {
        model,
        text: project.diagramTexts?.[id] ?? serializeDSL(model),
        textStatus: errors.length > 0 ? 'invalid' : 'in-sync',
      };
    }
    return {
      document: {
        project: {
          id: this.projectId,
          name: project.metadata.name,
          createdAt: project.metadata.createdAt,
          updatedAt: project.metadata.updatedAt,
        },
        tree: project.tree,
        diagrams,
        sharedElements: project.sharedElements,
      },
      diagnostics,
      revision,
    };
  }

  markSaved(revision: number, updatedAt: string): void {
    this.savedRevision = revision;
    this.project = { ...this.project, metadata: { ...this.project.metadata, updatedAt } };
    this.onChange();
  }

  /** After this the session ignores late timers and callbacks, and refuses every edit. */
  dispose(): void {
    this.disposed = true;
    for (const { sync } of this.sessions.values()) sync.dispose();
    this.sessions.clear();
  }

  private touch(): void {
    if (this.disposed) return;
    this.revision++;
    this.onChange();
  }

  private storeText(id: string, text: string): void {
    this.project = {
      ...this.project,
      diagramTexts: { ...this.project.diagramTexts, [id]: text },
    };
  }

  private updateDiagram(id: string, diagram: DiagramData): void {
    const updateTree = (nodes: ProjectTreeNode[]): ProjectTreeNode[] => nodes.map((node) => {
      if (node.type === 'diagram' && node.id === id) {
        return { ...node, name: diagram.name, diagramType: diagram.type };
      }
      return node.children ? { ...node, children: updateTree(node.children) } : node;
    });
    const meta = this.project.metadata.diagramIndex[id];
    this.project = {
      ...this.project,
      diagrams: { ...this.project.diagrams, [id]: diagram },
      tree: updateTree(this.project.tree),
      metadata: {
        ...this.project.metadata,
        diagramIndex: {
          ...this.project.metadata.diagramIndex,
          [id]: { ...meta, id, name: diagram.name, type: diagram.type, parentFolderId: meta?.parentFolderId ?? '' },
        },
      },
    };
  }
}
