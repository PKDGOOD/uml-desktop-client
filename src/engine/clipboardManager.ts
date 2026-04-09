import type { DiagramElement, Connector, Position } from '../types';

let idCounter = 0;

function generateId(): string {
  return `paste-${Date.now()}-${++idCounter}`;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

interface ClipboardData {
  elements: DiagramElement[];
  connectors: Connector[];
}

export class ClipboardManager {
  private clipboard: ClipboardData | null = null;
  private cutElements: DiagramElement[] | null = null;

  copy(elements: DiagramElement[], connectors: Connector[]): void {
    this.clipboard = {
      elements: deepClone(elements),
      connectors: deepClone(connectors),
    };
    this.cutElements = null;
  }

  cut(elements: DiagramElement[], connectors: Connector[]): DiagramElement[] {
    this.clipboard = {
      elements: deepClone(elements),
      connectors: deepClone(connectors),
    };
    this.cutElements = elements;
    return elements;
  }

  paste(targetPosition: Position): { elements: DiagramElement[]; connectors: Connector[] } {
    if (!this.clipboard) {
      return { elements: [], connectors: [] };
    }

    const { elements: storedElements, connectors: storedConnectors } = this.clipboard;

    // Build old ID → new ID mapping
    const idMap = new Map<string, string>();
    for (const el of storedElements) {
      idMap.set(el.id, generateId());
    }

    // Compute bounding box of stored elements to calculate offset
    let minX = Infinity;
    let minY = Infinity;
    for (const el of storedElements) {
      if (el.position.x < minX) minX = el.position.x;
      if (el.position.y < minY) minY = el.position.y;
    }

    const offsetX = targetPosition.x - minX;
    const offsetY = targetPosition.y - minY;

    // Create new elements with new IDs and offset positions
    const newElements: DiagramElement[] = storedElements.map((el) => {
      const cloned = deepClone(el);
      cloned.id = idMap.get(el.id)!;
      cloned.position = {
        x: el.position.x + offsetX,
        y: el.position.y + offsetY,
      };
      return cloned;
    });

    // Create new connectors with new IDs and remapped source/target
    const newConnectors: Connector[] = [];
    for (const conn of storedConnectors) {
      const newSourceId = idMap.get(conn.sourceId);
      const newTargetId = idMap.get(conn.targetId);
      // Only include connectors where both endpoints are in the pasted set
      if (newSourceId && newTargetId) {
        const cloned = deepClone(conn);
        cloned.id = generateId();
        cloned.sourceId = newSourceId;
        cloned.targetId = newTargetId;
        newConnectors.push(cloned);
      }
    }

    return { elements: newElements, connectors: newConnectors };
  }

  hasContent(): boolean {
    return this.clipboard !== null && this.clipboard.elements.length > 0;
  }

  getCutElements(): DiagramElement[] | null {
    return this.cutElements;
  }
}
