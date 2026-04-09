import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { useProjectStore, ProjectMetadata } from './projectStore';

describe('projectStore', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('should initialize with default state', () => {
    const state = useProjectStore.getState();
    expect(state.metadata).toBeNull();
    expect(state.tree).toEqual([]);
    expect(state.openDiagramIds).toEqual([]);
    expect(state.activeDiagramId).toBeNull();
    expect(state.dirty).toBe(false);
  });

  it('should set metadata', () => {
    const metadata: ProjectMetadata = {
      name: 'Test Project',
      version: '1.0.0',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      diagramIndex: {},
    };
    useProjectStore.getState().setMetadata(metadata);
    expect(useProjectStore.getState().metadata).toEqual(metadata);
  });

  it('should open a diagram and set it as active', () => {
    useProjectStore.getState().openDiagram('d1');
    const state = useProjectStore.getState();
    expect(state.openDiagramIds).toEqual(['d1']);
    expect(state.activeDiagramId).toBe('d1');
  });

  it('should not duplicate diagram when opening already-open diagram', () => {
    useProjectStore.getState().openDiagram('d1');
    useProjectStore.getState().openDiagram('d2');
    useProjectStore.getState().openDiagram('d1');
    const state = useProjectStore.getState();
    expect(state.openDiagramIds).toEqual(['d1', 'd2']);
    expect(state.activeDiagramId).toBe('d1');
  });

  it('should close a diagram and activate the last remaining tab', () => {
    useProjectStore.getState().openDiagram('d1');
    useProjectStore.getState().openDiagram('d2');
    useProjectStore.getState().openDiagram('d3');
    useProjectStore.getState().setActiveDiagram('d2');
    useProjectStore.getState().closeDiagram('d2');
    const state = useProjectStore.getState();
    expect(state.openDiagramIds).toEqual(['d1', 'd3']);
    expect(state.activeDiagramId).toBe('d3');
  });

  it('should set dirty flag', () => {
    useProjectStore.getState().setDirty(true);
    expect(useProjectStore.getState().dirty).toBe(true);
    useProjectStore.getState().setDirty(false);
    expect(useProjectStore.getState().dirty).toBe(false);
  });

  it('should reset to initial state', () => {
    useProjectStore.getState().openDiagram('d1');
    useProjectStore.getState().setDirty(true);
    useProjectStore.getState().reset();
    const state = useProjectStore.getState();
    expect(state.metadata).toBeNull();
    expect(state.openDiagramIds).toEqual([]);
    expect(state.activeDiagramId).toBeNull();
    expect(state.dirty).toBe(false);
  });

  // Property-based test: opening any diagram always makes it active
  it('property: opening a diagram always sets it as active', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 20 }), (diagramId) => {
        useProjectStore.getState().reset();
        useProjectStore.getState().openDiagram(diagramId);
        expect(useProjectStore.getState().activeDiagramId).toBe(diagramId);
      }),
    );
  });

  // Property-based test: closing all diagrams results in null active
  it('property: closing all open diagrams results in null activeDiagramId', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
        (ids) => {
          useProjectStore.getState().reset();
          for (const id of ids) {
            useProjectStore.getState().openDiagram(id);
          }
          for (const id of ids) {
            useProjectStore.getState().closeDiagram(id);
          }
          expect(useProjectStore.getState().openDiagramIds).toEqual([]);
          expect(useProjectStore.getState().activeDiagramId).toBeNull();
        },
      ),
    );
  });
});
