// =============================================================================
// Sync Engine - Bidirectional synchronization between Text Editor and Canvas
// =============================================================================

import type {
  DiagramData,
  CanvasChange,
  DSLError,
  Command,
  DiagramElement,
  Connector,
  Position,
  Size,
  ElementProperties,
} from '../types';
import { parseDSL } from '../parser/dsl';
import { serializeDSL } from '../parser/dsl/serializer';
import { UndoManager } from './undoManager';
import { parseCheckedDSL, validateDiagramRules, type DiagramRuleError } from './diagramRules';
import { renameElementInText } from './textEdits';

export interface SyncEngineOptions {
  onDiagramUpdate: (diagram: DiagramData) => void;
  onTextUpdate: (text: string) => void;
  onErrors: (errors: DSLError[]) => void;
  undoManager?: UndoManager;
  debounceMs?: number;
}

/**
 * Outcome of a canvas or inspector command (A03.07). A refused command changes
 * neither the model, the text nor the undo history.
 */
export type CanvasChangeResult =
  | { ok: true }
  | {
    ok: false;
    /** `busy`: no diagram, paused or mid-sync; `draft`: the text has errors; `rules`: a diagram rule; `dsl`: the DSL cannot write it. */
    reason: 'busy' | 'draft' | 'rules' | 'dsl';
    errors: DiagramRuleError[];
  };

export class SyncEngine {
  private currentDiagram: DiagramData | null = null;
  private lastValidDiagram: DiagramData | null = null;
  private paused = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs: number;
  private syncing = false;
  private pendingText: string | null = null;
  private currentText = '';
  private currentErrors: DSLError[] = [];

  private readonly onDiagramUpdate: (diagram: DiagramData) => void;
  private readonly onTextUpdate: (text: string) => void;
  private readonly onErrors: (errors: DSLError[]) => void;
  private readonly undoManager?: UndoManager;

  constructor(options: SyncEngineOptions) {
    this.onDiagramUpdate = options.onDiagramUpdate;
    this.onTextUpdate = options.onTextUpdate;
    this.onErrors = options.onErrors;
    this.undoManager = options.undoManager;
    this.debounceMs = options.debounceMs ?? 300;
  }

  /**
   * Set the current diagram directly (e.g. when loading a diagram).
   */
  setDiagram(diagram: DiagramData, text = serializeDSL(diagram)): void {
    this.cancelPendingText();
    this.currentDiagram = deepClone(diagram);
    this.lastValidDiagram = deepClone(diagram);
    this.currentText = text;
    const result = parseCheckedDSL(text);
    this.currentErrors = result.success ? [] : result.errors;
  }

  getDiagram(): DiagramData | null {
    return this.currentDiagram;
  }

  getText(): string {
    return this.currentText;
  }

  getErrors(): DSLError[] {
    return this.currentErrors;
  }

  /** Commit the latest keystroke before saving, switching tabs or editing the canvas. */
  flushPendingText(): boolean {
    const text = this.pendingText;
    this.cancelPendingText();
    if (text !== null) this.processTextChange(text);
    return this.currentErrors.length === 0;
  }

  private cancelPendingText(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
    this.pendingText = null;
  }

  dispose(): void {
    this.cancelPendingText();
    this.paused = true;
  }

  private reportErrors(errors: DSLError[]): void {
    this.currentErrors = errors;
    this.onErrors(errors);
  }

  private restore(diagram: DiagramData, text: string): void {
    this.cancelPendingText();
    this.currentDiagram = deepClone(diagram);
    this.lastValidDiagram = deepClone(diagram);
    this.currentText = text;
    this.onDiagramUpdate(deepClone(diagram));
    this.onTextUpdate(text);
    this.reportErrors([]);
  }

  /**
   * Text Editor changed → parse DSL → update model → notify Canvas.
   * Debounced by default (300ms).
   */
  onTextChange(newText: string): void {
    if (this.paused) return;

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.pendingText = newText;
    this.debounceTimer = setTimeout(() => {
      this.flushPendingText();
    }, this.debounceMs);
  }

  private processTextChange(newText: string): void {
    if (this.syncing) return;
    this.syncing = true;

    try {
      // Syntax and rule errors both keep the raw text and the last valid model (A03.06).
      const result = parseCheckedDSL(newText);
      const oldText = this.currentText;
      this.currentText = newText;

      if (result.success) {
        const oldDiagram = this.currentDiagram ? deepClone(this.currentDiagram) : null;
        const newDiagram = result.diagram;

        // Preserve IDs from current diagram where element names match
        if (this.currentDiagram) {
          preserveIds(this.currentDiagram, newDiagram);
        }

        if (this.undoManager) {
          const diagramForUndo = deepClone(newDiagram);
          const command: Command = {
            description: 'Text edit',
            execute: () => this.restore(diagramForUndo, newText),
            undo: () => {
              if (oldDiagram) {
                // An invalid draft has no corresponding canvas state to restore.
                const previous = parseCheckedDSL(oldText);
                this.restore(oldDiagram, previous.success ? oldText : serializeDSL(oldDiagram));
              }
            },
          };
          this.undoManager.execute(command);
        } else {
          this.currentDiagram = newDiagram;
          this.lastValidDiagram = deepClone(newDiagram);
          this.onDiagramUpdate(deepClone(newDiagram));
        }

        // Clear errors on success
        this.reportErrors([]);
      } else {
        // Syntax or rule error: keep last valid state, report errors
        this.reportErrors(result.errors);
      }
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Canvas changed → update model → serialize to DSL → notify Text Editor.
   * Canvas changes are applied immediately (no debouncing).
   */
  onCanvasChange(change: CanvasChange): boolean {
    return this.applyCanvasChange(change).ok;
  }

  /** Like `onCanvasChange`, but says why a command was refused. */
  applyCanvasChange(change: CanvasChange): CanvasChangeResult {
    const refuse = (reason: 'busy' | 'draft' | 'rules' | 'dsl', errors: DiagramRuleError[] = []): CanvasChangeResult => (
      { ok: false, reason, errors }
    );
    if (this.paused || this.syncing || !this.currentDiagram) return refuse('busy');
    // Keep an invalid draft intact instead of replacing it with generated text.
    if (!this.flushPendingText()) return refuse('draft');

    this.syncing = true;

    try {
      const oldDiagram = deepClone(this.currentDiagram);
      const oldText = this.currentText;

      const applyChange = (diagram: DiagramData, ch: CanvasChange): DiagramData => {
        const d = deepClone(diagram);
        switch (ch.type) {
          case 'batch':
            return ch.changes.reduce((current, item) => applyChange(current, item), d);
          case 'element-add':
            d.elements.push(deepClone(ch.element));
            break;
          case 'element-move': {
            const el = d.elements.find(e => e.id === ch.elementId);
            if (el) el.position = { ...ch.position };
            break;
          }
          case 'element-resize': {
            const el = d.elements.find(e => e.id === ch.elementId);
            if (el) el.size = { ...ch.size };
            break;
          }
          case 'element-delete':
            d.elements = d.elements.filter(e => e.id !== ch.elementId);
            d.connectors = d.connectors.filter(
              c => c.sourceId !== ch.elementId && c.targetId !== ch.elementId,
            );
            break;
          case 'element-update': {
            const el = d.elements.find(e => e.id === ch.elementId);
            if (el) {
              el.properties = { ...el.properties, ...ch.properties };
            }
            break;
          }
          case 'connector-add':
            d.connectors.push(deepClone(ch.connector));
            break;
          case 'connector-delete':
            d.connectors = d.connectors.filter(c => c.id !== ch.connectorId);
            break;
          case 'connector-waypoint': {
            const conn = d.connectors.find(c => c.id === ch.connectorId);
            if (conn) conn.waypoints = ch.waypoints.map(w => ({ ...w }));
            break;
          }
        }
        return d;
      };

      const newDiagram = applyChange(this.currentDiagram, change);
      // Reject commands that break a diagram rule the model did not already break,
      // before touching state or history (A03.07).
      const before = new Set(validateDiagramRules(oldDiagram).map((error) => error.message));
      const added = validateDiagramRules(newDiagram).filter((error) => !before.has(error.message));
      if (added.length > 0) return refuse('rules', added);
      // Then anything else the DSL cannot write and read back.
      const newText = this.renamedText(change, oldDiagram, oldText, newDiagram) ?? serializeDSL(newDiagram);
      if (!parseDSL(newText).success) return refuse('dsl');

      if (this.undoManager) {
        const diagramForUndo = deepClone(newDiagram);
        const oldDiagramCopy = deepClone(oldDiagram);
        const command: Command = {
          description: `Canvas: ${change.type}`,
          execute: () => this.restore(diagramForUndo, newText),
          undo: () => this.restore(oldDiagramCopy, oldText),
        };
        this.undoManager.execute(command);
      } else {
        this.restore(newDiagram, newText);
      }
      return { ok: true };
    } finally {
      this.syncing = false;
    }
  }

  /**
   * An inspector rename edits only the name tokens in the current text
   * (ADR 0002 §3), so comments and spacing survive. Used only when the patched
   * text means exactly what the new model says; otherwise null, and the caller
   * regenerates the text.
   */
  private renamedText(change: CanvasChange, oldDiagram: DiagramData, oldText: string, newDiagram: DiagramData): string | null {
    if (change.type !== 'element-update' || typeof change.properties.name !== 'string') return null;
    const before = oldDiagram.elements.find((element) => element.id === change.elementId);
    if (!before || before.properties.name === change.properties.name) return null;
    const patched = renameElementInText(oldText, oldDiagram, change.elementId, change.properties.name);
    if (patched === null) return null;
    const check = parseCheckedDSL(patched);
    if (!check.success) return null;
    preserveIds(newDiagram, check.diagram);
    check.diagram.name = newDiagram.name;
    return serializeDSL(check.diagram) === serializeDSL(newDiagram) ? patched : null;
  }

  /**
   * Pause synchronization (for bulk operations like paste).
   */
  pause(): void {
    this.paused = true;
    this.cancelPendingText();
  }

  /**
   * Resume synchronization.
   */
  resume(): void {
    this.paused = false;
  }

  isPaused(): boolean {
    return this.paused;
  }
}

// =============================================================================
// Helpers
// =============================================================================

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Preserve element/connector IDs from the old diagram when names match,
 * so that canvas changes don't lose identity after a text edit round-trip.
 */
export function preserveIds(oldDiagram: DiagramData, newDiagram: DiagramData): void {
  // Preserve diagram-level fields
  newDiagram.id = oldDiagram.id;
  newDiagram.viewport = oldDiagram.viewport;

  const oldByName = new Map<string, DiagramElement[]>();
  for (const el of oldDiagram.elements) {
    const key = `${el.type}:${el.properties.name}`;
    oldByName.set(key, [...(oldByName.get(key) ?? []), el]);
  }

  const idMap = new Map<string, string>();
  for (const el of newDiagram.elements) {
    const old = oldByName.get(`${el.type}:${el.properties.name}`)?.shift();
    if (old) {
      idMap.set(el.id, old.id);
      el.id = old.id;
      el.sharedRefId = old.sharedRefId;
    }
  }

  for (const el of newDiagram.elements) {
    if (el.parentId) el.parentId = idMap.get(el.parentId) ?? el.parentId;
  }

  // Remap endpoints before matching connectors, including parallel sequence messages.
  const remaining = [...oldDiagram.connectors];
  for (const connector of newDiagram.connectors) {
    connector.sourceId = idMap.get(connector.sourceId) ?? connector.sourceId;
    connector.targetId = idMap.get(connector.targetId) ?? connector.targetId;
    const matches = (old: Connector) => old.type === connector.type
      && old.sourceId === connector.sourceId && old.targetId === connector.targetId;
    let index = remaining.findIndex((old) => matches(old) && old.label === connector.label);
    if (index < 0) index = remaining.findIndex(matches);
    if (index >= 0) {
      const [old] = remaining.splice(index, 1);
      connector.id = old.id;
      connector.waypoints = old.waypoints;
      connector.properties = { ...old.properties, ...connector.properties };
    }
  }
}
