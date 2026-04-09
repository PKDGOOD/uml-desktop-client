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

export interface SyncEngineOptions {
  onDiagramUpdate: (diagram: DiagramData) => void;
  onTextUpdate: (text: string) => void;
  onErrors: (errors: DSLError[]) => void;
  undoManager?: UndoManager;
  debounceMs?: number;
}

export class SyncEngine {
  private currentDiagram: DiagramData | null = null;
  private lastValidDiagram: DiagramData | null = null;
  private paused = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs: number;
  private syncing = false;

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
  setDiagram(diagram: DiagramData): void {
    this.currentDiagram = deepClone(diagram);
    this.lastValidDiagram = deepClone(diagram);
  }

  getDiagram(): DiagramData | null {
    return this.currentDiagram;
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

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.processTextChange(newText);
    }, this.debounceMs);
  }

  private processTextChange(newText: string): void {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const result = parseDSL(newText);

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
            execute: () => {
              this.currentDiagram = deepClone(diagramForUndo);
              this.lastValidDiagram = deepClone(diagramForUndo);
              this.onDiagramUpdate(deepClone(diagramForUndo));
            },
            undo: () => {
              if (oldDiagram) {
                this.currentDiagram = deepClone(oldDiagram);
                this.lastValidDiagram = deepClone(oldDiagram);
                this.onDiagramUpdate(deepClone(oldDiagram));
                const text = serializeDSL(oldDiagram);
                this.onTextUpdate(text);
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
        this.onErrors([]);
      } else {
        // Parse error: keep last valid state, report errors
        this.onErrors(result.errors);
      }
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Canvas changed → update model → serialize to DSL → notify Text Editor.
   * Canvas changes are applied immediately (no debouncing).
   */
  onCanvasChange(change: CanvasChange): void {
    if (this.paused) return;
    if (this.syncing) return;
    if (!this.currentDiagram) return;

    this.syncing = true;

    try {
      const oldDiagram = deepClone(this.currentDiagram);

      const applyChange = (diagram: DiagramData, ch: CanvasChange): DiagramData => {
        const d = deepClone(diagram);
        switch (ch.type) {
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

      if (this.undoManager) {
        const diagramForUndo = deepClone(newDiagram);
        const oldDiagramCopy = deepClone(oldDiagram);
        const command: Command = {
          description: `Canvas: ${change.type}`,
          execute: () => {
            this.currentDiagram = deepClone(diagramForUndo);
            this.lastValidDiagram = deepClone(diagramForUndo);
            this.onDiagramUpdate(deepClone(diagramForUndo));
            const text = serializeDSL(diagramForUndo);
            this.onTextUpdate(text);
          },
          undo: () => {
            this.currentDiagram = deepClone(oldDiagramCopy);
            this.lastValidDiagram = deepClone(oldDiagramCopy);
            this.onDiagramUpdate(deepClone(oldDiagramCopy));
            const text = serializeDSL(oldDiagramCopy);
            this.onTextUpdate(text);
          },
        };
        this.undoManager.execute(command);
      } else {
        this.currentDiagram = newDiagram;
        this.lastValidDiagram = deepClone(newDiagram);
        this.onDiagramUpdate(deepClone(newDiagram));
        const text = serializeDSL(newDiagram);
        this.onTextUpdate(text);
      }
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Pause synchronization (for bulk operations like paste).
   */
  pause(): void {
    this.paused = true;
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
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
function preserveIds(oldDiagram: DiagramData, newDiagram: DiagramData): void {
  // Preserve diagram-level fields
  newDiagram.id = oldDiagram.id;
  newDiagram.viewport = oldDiagram.viewport;

  const oldByName = new Map<string, DiagramElement>();
  for (const el of oldDiagram.elements) {
    oldByName.set(el.properties.name, el);
  }

  for (const el of newDiagram.elements) {
    const old = oldByName.get(el.properties.name);
    if (old) {
      el.id = old.id;
    }
  }
}
