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
import { isMessage, renumberMessages } from '../parser/dsl/messageOrder';
import { serializeDSL } from '../parser/dsl/serializer';
import { UndoManager } from './undoManager';
import { parseCheckedDSL, validateDiagramRules, type DiagramRuleError } from './diagramRules';
import {
  patchAddConnectorInText, patchAddElementInText, patchConnectorInText, patchDeleteConnectorInText, patchDeleteElementInText, patchElementInText, patchMessageOrderInText,
} from './textEdits';

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
    // The text may be an invalid draft that an undo step brings back (A04.10).
    const parsed = parseCheckedDSL(text);
    this.reportErrors(parsed.success ? [] : parsed.errors);
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
            undo: () => { if (oldDiagram) this.restore(oldDiagram, oldText); },
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
        // Syntax or rule error: keep last valid state, report errors. The draft is an undo step
        // too, so a bad paste can be taken back without first being fixed (A04.10).
        const lastValid = this.currentDiagram ? deepClone(this.currentDiagram) : null;
        if (this.undoManager && lastValid && newText !== oldText) {
          const command: Command = {
            description: 'Text edit (invalid)',
            execute: () => this.restore(lastValid, newText),
            undo: () => this.restore(lastValid, oldText),
          };
          this.undoManager.record(command);
        }
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
          case 'connector-add': {
            const added = deepClone(ch.connector);
            d.connectors.push(added);
            if (isMessage(added) && added.messageOrder !== undefined) renumberMessages(d, { id: added.id, to: added.messageOrder });
            break;
          }
          case 'connector-delete':
            d.connectors = d.connectors.filter(c => c.id !== ch.connectorId);
            break;
          case 'connector-update': {
            const conn = d.connectors.find(c => c.id === ch.connectorId);
            if (conn) {
              // A key present with `undefined` clears the value; an absent key keeps it.
              const { messageOrder, ...fields } = ch.changes;
              for (const key of Object.keys(fields) as Array<keyof typeof fields>) {
                const value = fields[key];
                if (value === undefined) delete conn[key];
                else conn[key] = value;
              }
              if (messageOrder !== undefined && isMessage(conn)) renumberMessages(d, { id: conn.id, to: messageOrder });
            }
            break;
          }
          case 'connector-waypoint': {
            const conn = d.connectors.find(c => c.id === ch.connectorId);
            if (conn) conn.waypoints = ch.waypoints.map(w => ({ ...w }));
            break;
          }
        }
        return d;
      };

      const newDiagram = applyChange(this.currentDiagram, change);
      renumberMessages(newDiagram);
      // Reject commands that break a diagram rule the model did not already break,
      // before touching state or history (A03.07).
      const before = new Set(validateDiagramRules(oldDiagram).map((error) => error.message));
      const added = validateDiagramRules(newDiagram).filter((error) => !before.has(error.message));
      if (added.length > 0) return refuse('rules', added);
      // Then anything else the DSL cannot write and read back.
      const newText = this.patchedText(change, oldDiagram, oldText, newDiagram) ?? serializeDSL(newDiagram);
      const written = parseDSL(newText);
      if (!written.success) return refuse('dsl');
      // The text must also put every element under the parent the model says (ADR 0001 §6, F2).
      if (!sameContainment(newDiagram, written.diagram)) return refuse('dsl');

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
   * A change to one element or connector (rename, properties, members, move, resize, add, delete) edits
   * only the affected tokens of the current text (ADR 0002 §5), so comments and
   * spacing survive. Used only when the patched text means exactly what the new
   * model says; otherwise null, and the caller regenerates the text.
   */
  private patchedText(change: CanvasChange, oldDiagram: DiagramData, oldText: string, newDiagram: DiagramData): string | null {
    let patched: string | null = null;
    if (change.type === 'element-update' || change.type === 'element-move' || change.type === 'element-resize') {
      const after = newDiagram.elements.find((element) => element.id === change.elementId);
      if (after) patched = patchElementInText(oldText, oldDiagram, after);
    } else if (change.type === 'element-add') {
      const added = newDiagram.elements.find((element) => element.id === change.element.id);
      if (added) patched = patchAddElementInText(oldText, oldDiagram, added);
    } else if (change.type === 'element-delete') {
      patched = patchDeleteElementInText(oldText, oldDiagram, change.elementId);
    } else if (change.type === 'connector-add') {
      const added = newDiagram.connectors.find((connector) => connector.id === change.connector.id);
      if (added) patched = patchAddConnectorInText(oldText, oldDiagram, added, newDiagram);
    } else if (change.type === 'connector-delete') {
      patched = patchDeleteConnectorInText(oldText, oldDiagram, change.connectorId);
    } else if (change.type === 'connector-update') {
      const after = newDiagram.connectors.find((connector) => connector.id === change.connectorId);
      if (after) {
        const keys = Object.keys(change.changes);
        patched = keys.length === 1 && keys[0] === 'messageOrder'
          ? patchMessageOrderInText(oldText, oldDiagram, after, newDiagram)
          : keys.includes('messageOrder') ? null : patchConnectorInText(oldText, oldDiagram, after, newDiagram);
      }
    }
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

/** True when both diagrams give every named element the same parent name. */
function sameContainment(a: DiagramData, b: DiagramData): boolean {
  const parents = (d: DiagramData) => new Map(d.elements.map((element) => [
    element.properties.name, d.elements.find((candidate) => candidate.id === element.parentId)?.properties.name ?? null,
  ]));
  const left = parents(a);
  const right = parents(b);
  return left.size === right.size && [...left].every(([name, parent]) => right.get(name) === parent);
}

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
