import type { DiagramData, DiagramType, ProjectData, ProjectTreeNode, CanvasChange } from '../types';
import { SyncEngine } from './syncEngine';
import { UndoManager } from './undoManager';
import { serializeDSL } from '../parser/dsl/serializer';

interface DiagramSession {
  sync: SyncEngine;
  history: UndoManager;
}

/** Owns drafts and history independently of which tab is currently visible. */
export class ProjectSession {
  project: ProjectData;
  revision = 0;
  private savedRevision = 0;
  private sessions = new Map<string, DiagramSession>();

  constructor(project: ProjectData, private readonly onChange: () => void) {
    this.project = structuredClone(project);
  }

  get dirty(): boolean {
    return this.revision !== this.savedRevision;
  }

  markUnsaved(): void {
    this.touch();
  }

  getSession(id: string): DiagramSession | undefined {
    const existing = this.sessions.get(id);
    if (existing) return existing;
    if (!Object.prototype.hasOwnProperty.call(this.project.diagrams, id)) return undefined;
    const diagram = this.project.diagrams[id];
    if (!diagram) return undefined;

    const history = new UndoManager();
    const sync = new SyncEngine({
      undoManager: history,
      onDiagramUpdate: (updated) => {
        this.updateDiagram(id, updated);
        this.onChange();
      },
      onTextUpdate: (text) => {
        this.storeText(id, text);
        this.onChange();
      },
      onErrors: () => this.onChange(),
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
    if (!this.getSession(id)?.sync.onCanvasChange(change)) return false;
    this.touch();
    return true;
  }

  undo(id: string): void {
    const session = this.getSession(id);
    if (!session?.sync.flushPendingText() || !session.history.canUndo()) return;
    session.history.undo();
    this.touch();
  }

  redo(id: string): void {
    const session = this.getSession(id);
    if (!session?.sync.flushPendingText() || !session.history.canRedo()) return;
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
    this.touch();
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

  markSaved(revision: number, updatedAt: string): void {
    this.savedRevision = revision;
    this.project = { ...this.project, metadata: { ...this.project.metadata, updatedAt } };
    this.onChange();
  }

  dispose(): void {
    for (const { sync } of this.sessions.values()) sync.dispose();
    this.sessions.clear();
  }

  private touch(): void {
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
