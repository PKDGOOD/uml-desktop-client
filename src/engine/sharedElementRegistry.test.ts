import { describe, it, expect } from 'vitest';
import { SharedElementRegistry } from './sharedElementRegistry';
import type { DiagramElement } from '../types';

function makeElement(overrides: Partial<DiagramElement> = {}): DiagramElement {
  return {
    id: overrides.id ?? 'elem-1',
    type: overrides.type ?? 'class',
    position: overrides.position ?? { x: 0, y: 0 },
    size: overrides.size ?? { width: 100, height: 80 },
    properties: overrides.properties ?? { name: 'MyClass' },
  };
}

describe('SharedElementRegistry', () => {
  // --- Register and retrieve ---

  it('registers an element and returns a ref with a refId', () => {
    const registry = new SharedElementRegistry();
    const ref = registry.register(makeElement(), 'diagram-1');
    expect(ref.refId).toBeTruthy();
    expect(ref.element.sharedRefId).toBe(ref.refId);
  });

  it('retrieves a registered element by refId', () => {
    const registry = new SharedElementRegistry();
    const ref = registry.register(makeElement({ id: 'e1' }), 'diagram-1');
    const retrieved = registry.get(ref.refId);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe('e1');
    expect(retrieved!.properties.name).toBe('MyClass');
  });

  it('returns undefined for non-existent refId', () => {
    const registry = new SharedElementRegistry();
    expect(registry.get('no-such-id')).toBeUndefined();
  });

  // --- Update propagation ---

  it('updates element properties via update()', () => {
    const registry = new SharedElementRegistry();
    const ref = registry.register(makeElement(), 'diagram-1');
    registry.update(ref.refId, { name: 'UpdatedClass' });
    const updated = registry.get(ref.refId);
    expect(updated!.properties.name).toBe('UpdatedClass');
  });

  it('update on non-existent refId is a no-op', () => {
    const registry = new SharedElementRegistry();
    // should not throw
    registry.update('no-such-id', { name: 'X' });
  });

  it('all references see the updated properties (single instance)', () => {
    const registry = new SharedElementRegistry();
    const ref = registry.register(makeElement(), 'diagram-1');
    registry.addReference(ref.refId, 'diagram-2');
    registry.addReference(ref.refId, 'diagram-3');

    registry.update(ref.refId, { name: 'SharedUpdated', stereotype: '<<entity>>' });

    // get() returns the single shared instance — all diagrams see this
    const elem = registry.get(ref.refId);
    expect(elem!.properties.name).toBe('SharedUpdated');
    expect(elem!.properties.stereotype).toBe('<<entity>>');
  });

  // --- Add / remove references ---

  it('tracks the initial diagram reference on register', () => {
    const registry = new SharedElementRegistry();
    const ref = registry.register(makeElement(), 'diagram-1');
    expect(registry.getReferencingDiagrams(ref.refId)).toEqual(['diagram-1']);
  });

  it('addReference adds a diagram to the referencing list', () => {
    const registry = new SharedElementRegistry();
    const ref = registry.register(makeElement(), 'diagram-1');
    registry.addReference(ref.refId, 'diagram-2');
    const diagrams = registry.getReferencingDiagrams(ref.refId);
    expect(diagrams).toContain('diagram-1');
    expect(diagrams).toContain('diagram-2');
    expect(diagrams).toHaveLength(2);
  });

  it('addReference is idempotent (no duplicates)', () => {
    const registry = new SharedElementRegistry();
    const ref = registry.register(makeElement(), 'diagram-1');
    registry.addReference(ref.refId, 'diagram-1');
    expect(registry.getReferencingDiagrams(ref.refId)).toHaveLength(1);
  });

  it('removeReference removes a diagram from the referencing list', () => {
    const registry = new SharedElementRegistry();
    const ref = registry.register(makeElement(), 'diagram-1');
    registry.addReference(ref.refId, 'diagram-2');
    registry.removeReference(ref.refId, 'diagram-1');
    expect(registry.getReferencingDiagrams(ref.refId)).toEqual(['diagram-2']);
  });

  // --- Reference independence ---

  it('removing one diagram reference does not affect the element', () => {
    const registry = new SharedElementRegistry();
    const ref = registry.register(makeElement(), 'diagram-1');
    registry.addReference(ref.refId, 'diagram-2');
    registry.addReference(ref.refId, 'diagram-3');

    registry.removeReference(ref.refId, 'diagram-2');

    // Element still exists and is accessible
    expect(registry.get(ref.refId)).toBeDefined();
    expect(registry.get(ref.refId)!.properties.name).toBe('MyClass');
    // Other references remain
    const remaining = registry.getReferencingDiagrams(ref.refId);
    expect(remaining).toContain('diagram-1');
    expect(remaining).toContain('diagram-3');
    expect(remaining).not.toContain('diagram-2');
  });

  it('removing all references does not delete the element itself', () => {
    const registry = new SharedElementRegistry();
    const ref = registry.register(makeElement(), 'diagram-1');
    registry.removeReference(ref.refId, 'diagram-1');
    // Element still exists even with no references
    expect(registry.get(ref.refId)).toBeDefined();
    expect(registry.getReferencingDiagrams(ref.refId)).toHaveLength(0);
  });

  // --- Delete ---

  it('delete removes the element and all references', () => {
    const registry = new SharedElementRegistry();
    const ref = registry.register(makeElement(), 'diagram-1');
    registry.addReference(ref.refId, 'diagram-2');
    registry.delete(ref.refId);
    expect(registry.get(ref.refId)).toBeUndefined();
    expect(registry.getReferencingDiagrams(ref.refId)).toEqual([]);
  });

  // --- Edge cases ---

  it('removeReference on non-existent refId is a no-op', () => {
    const registry = new SharedElementRegistry();
    registry.removeReference('no-such-id', 'diagram-1'); // should not throw
  });

  it('removeReference for a diagram not in the list is a no-op', () => {
    const registry = new SharedElementRegistry();
    const ref = registry.register(makeElement(), 'diagram-1');
    registry.removeReference(ref.refId, 'diagram-999');
    expect(registry.getReferencingDiagrams(ref.refId)).toEqual(['diagram-1']);
  });

  it('addReference on non-existent refId is a no-op', () => {
    const registry = new SharedElementRegistry();
    registry.addReference('no-such-id', 'diagram-1'); // should not throw
  });

  it('getReferencingDiagrams returns empty array for non-existent refId', () => {
    const registry = new SharedElementRegistry();
    expect(registry.getReferencingDiagrams('no-such-id')).toEqual([]);
  });

  it('delete on non-existent refId is a no-op', () => {
    const registry = new SharedElementRegistry();
    registry.delete('no-such-id'); // should not throw
  });

  it('register without diagramId creates entry with no references', () => {
    const registry = new SharedElementRegistry();
    const ref = registry.register(makeElement());
    expect(registry.getReferencingDiagrams(ref.refId)).toHaveLength(0);
    expect(registry.get(ref.refId)).toBeDefined();
  });

  it('each register call produces a unique refId', () => {
    const registry = new SharedElementRegistry();
    const ref1 = registry.register(makeElement({ id: 'a' }));
    const ref2 = registry.register(makeElement({ id: 'b' }));
    expect(ref1.refId).not.toBe(ref2.refId);
  });
});
