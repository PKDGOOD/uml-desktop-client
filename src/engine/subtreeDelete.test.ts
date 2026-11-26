import { describe, expect, it, vi } from 'vitest';
import type { DiagramData } from '../types';
import { parseDSL } from '../parser/dsl';
import { SyncEngine } from './syncEngine';
import { UndoManager } from './undoManager';
import { deleteConfirmation, deleteImpact } from './containment';
import { checkProjectData } from '../parser/project/projectFileIO';
import { createProject } from './projectFactory';

const SRC = `@state-diagram "Machine"
// the main block
composite-state Active @pos(0, 0) @size(400, 300) {
  state Idle @pos(20, 40) @size(120, 60)
  composite-state Inner @pos(180, 40) @size(200, 200) {
    state Deep @pos(200, 80) @size(120, 60)
  }
  Idle --> Inner
}
state Outside @pos(600, 0) @size(120, 60)   // kept
state Other @pos(600, 200) @size(120, 60)
Deep --> Outside : escape
Outside --> Other   // kept too
`;

function setup() {
  const state = { text: SRC, diagram: null as DiagramData | null };
  const history = new UndoManager();
  const engine = new SyncEngine({
    onDiagramUpdate: (d) => { state.diagram = d; }, onTextUpdate: (t) => { state.text = t; },
    onErrors: vi.fn(), undoManager: history, debounceMs: 0,
  });
  const parsed = parseDSL(SRC);
  if (!parsed.success) throw new Error(JSON.stringify(parsed.errors));
  engine.setDiagram(parsed.diagram, SRC);
  state.diagram = engine.getDiagram();
  const id = (name: string) => state.diagram!.elements.find((e) => e.properties.name === name)!.id;
  const names = () => state.diagram!.elements.map((e) => e.properties.name).sort();
  return { engine, state, history, id, names };
}

const AFTER = `@state-diagram "Machine"
// the main block
state Outside @pos(600, 0) @size(120, 60)   // kept
state Other @pos(600, 200) @size(120, 60)
Outside --> Other   // kept too
`;

describe('A05.10 deleting a container', () => {
  it('removes the whole subtree and every link that touches it, as one undo step', () => {
    const { engine, state, history, id, names } = setup();
    expect(engine.applyCanvasChange({ type: 'element-delete', elementId: id('Active') })).toEqual({ ok: true });
    expect(names()).toEqual(['Other', 'Outside']);
    expect(state.diagram!.connectors.map((c) => c.label ?? '')).toEqual(['']);
    expect(state.text).toBe(AFTER);
    expect(history.undoStackSize).toBe(1);
  });

  it('leaves no element pointing at a deleted parent, so the project still opens', () => {
    const { engine, state, id } = setup();
    engine.applyCanvasChange({ type: 'element-delete', elementId: id('Inner') });
    expect(state.diagram!.elements.every((e) => e.parentId === undefined || state.diagram!.elements.some((p) => p.id === e.parentId))).toBe(true);
    const project = createProject('P');
    const diagramId = 'd1';
    project.diagrams[diagramId] = { ...state.diagram!, id: diagramId };
    project.tree = [{ id: diagramId, name: 'Machine', type: 'diagram', diagramType: 'state' }];
    project.metadata.diagramIndex = { [diagramId]: { id: diagramId, name: 'Machine', type: 'state', parentFolderId: '' } };
    expect(checkProjectData(project)).toMatchObject({ success: true });
  });

  it('restores the complete subtree, its links, IDs and the exact text on undo', () => {
    const { engine, state, history, id } = setup();
    const before = structuredClone(state.diagram!);
    engine.applyCanvasChange({ type: 'element-delete', elementId: id('Active') });
    history.undo();
    expect(state.text).toBe(SRC);
    expect(state.diagram).toEqual(before);
  });

  it('deletes a selection that holds a container and something inside it without deleting twice', () => {
    const { engine, state, history, id, names } = setup();
    expect(engine.applyCanvasChange({ type: 'batch', changes: [
      { type: 'element-delete', elementId: id('Active') },
      { type: 'element-delete', elementId: id('Deep') },
    ] })).toEqual({ ok: true });
    expect(names()).toEqual(['Other', 'Outside']);
    expect(state.text).toBe(AFTER);
    expect(history.undoStackSize).toBe(1);
  });

  it('reports what goes with a container and asks only when contents go too', () => {
    const { state, id } = setup();
    const impact = deleteImpact(state.diagram!, [id('Inner')]);
    expect(impact.inside.map((e) => e.properties.name)).toEqual(['Deep']);
    expect(impact.connectors.map((c) => c.label ?? '')).toEqual(['', 'escape']);
    expect(deleteConfirmation(state.diagram!, [id('Inner')])).toBe('Delete "Inner" with 1 element inside ("Deep") and 2 connections? Undo restores them.');
    expect(deleteConfirmation(state.diagram!, [id('Outside')])).toBeNull();
  });
});
