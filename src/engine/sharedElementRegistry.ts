import type { DiagramElement, ElementProperties } from '../types';

export interface SharedElementRef {
  refId: string;
  element: DiagramElement;
}

interface SharedEntry {
  element: DiagramElement;
  referencingDiagrams: Set<string>;
}

export class SharedElementRegistry {
  private entries = new Map<string, SharedEntry>();
  private nextId = 1;

  /** Register an element as shared. Optionally provide a diagramId for the initial reference. */
  register(element: DiagramElement, diagramId?: string): SharedElementRef {
    const refId = `shared-${this.nextId++}`;
    const referencingDiagrams = new Set<string>();
    if (diagramId) {
      referencingDiagrams.add(diagramId);
    }
    this.entries.set(refId, {
      element: { ...element, sharedRefId: refId },
      referencingDiagrams,
    });
    return { refId, element: this.entries.get(refId)!.element };
  }

  /** Retrieve a shared element by reference ID. */
  get(refId: string): DiagramElement | undefined {
    return this.entries.get(refId)?.element;
  }

  /** Update properties of a shared element. All referencing diagrams see the change. */
  update(refId: string, properties: Partial<ElementProperties>): void {
    const entry = this.entries.get(refId);
    if (!entry) return;
    entry.element = {
      ...entry.element,
      properties: { ...entry.element.properties, ...properties },
    };
  }

  /** Add a diagram reference to a shared element. */
  addReference(refId: string, diagramId: string): void {
    const entry = this.entries.get(refId);
    if (!entry) return;
    entry.referencingDiagrams.add(diagramId);
  }

  /** Remove a diagram's reference to a shared element (doesn't delete the element). */
  removeReference(refId: string, diagramId: string): void {
    const entry = this.entries.get(refId);
    if (!entry) return;
    entry.referencingDiagrams.delete(diagramId);
  }

  /** Return list of diagram IDs that reference this shared element. */
  getReferencingDiagrams(refId: string): string[] {
    const entry = this.entries.get(refId);
    if (!entry) return [];
    return [...entry.referencingDiagrams];
  }

  /** Completely remove a shared element and all its references. */
  delete(refId: string): void {
    this.entries.delete(refId);
  }
}
