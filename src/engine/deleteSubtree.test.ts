import { describe, expect, it, vi } from 'vitest';
import type { DiagramData } from '../types';
import { parseDSL } from '../parser/dsl';
import { SyncEngine } from './syncEngine';
import { UndoManager } from './undoManager';
import { deletionImpact, deletionPrompt } from './containment';

const SRC = `@state-diagram "S"
composite-state Active @pos(40, 40) @size(300, 200) {
  state Inside @pos(60, 100) @size(100, 50)
  composite-state Nested @pos(180, 100) @size(120, 80) {
    state Deep @pos(190, 130) @size(60, 30)
  }
}
state Outside @pos(400, 40) @size(100, 50)
state Apart @pos(100, 400) @size(100, 50)
Outside --> Inside : in
Deep --> Apart : out
Outside --> Apart : free
`;

function setup() {
  const state = { text: SRC, diagram: null as DiagramData | null };
  const history = new UndoManager();
  const engine = new SyncEngine({
    onDiagramUpdate: (d) => { state.diagram = d; }, onTextUpdate: (t) => { state.text = t; },
    onErrors: vi.fn(), undoManager: history, debounceMs: 0,
  });
  const parsed = parseDSL(SRC);
  if (!parsed.success) throw new Error('fixture');
  engine.setDiagram(parsed.diagram, SRC);
  state.diagram = engine.getDiagram();
  const find = (name: string) => state.diagram!.elements.find((e) => e.properties.name === name)!;
  return { engine, state, history, find };
}

describe('A05.10 deleting a container', () => {
  it('names what goes with it', () => {
    const { state, find } = setup();
    const impact = deletionImpact(state.diagram!, [find('Active').id]);
    expect(impact.owned.map((e) => e.properties.name).sort()).toEqual(['Deep', 'Inside', 'Nested']);
    expect(impact.connectors).toHaveLength(2);
    const question = deletionPrompt(state.diagram!, [find('Active').id])!;
    expect(question).toContain('"Active"');
    expect(question).toContain('3 elements inside');
    expect(question).toContain('2 connections');
    expect(deletionPrompt(state.diagram!, [find('Outside').id])).toBeNull();
  });

  it('removes the subtree and every connection to it, leaving nothing dangling', () => {
    const { engine, state, find } = setup();
    expect(engine.applyCanvasChange({ type: 'element-delete', elementId: find('Active').id })).toEqual({ ok: true });
    expect(state.diagram!.elements.map((e) => e.properties.name).sort()).toEqual(['Apart', 'Outside']);
    expect(state.diagram!.connectors.map((c) => c.label)).toEqual(['free']);
    expect(state.diagram!.elements.every((e) => e.parentId === undefined)).toBe(true);
    expect(state.text).not.toContain('Active');
    expect(parseDSL(state.text).success).toBe(true);
  });

  it('is one undo step that restores the whole subtree and its links', () => {
    const { engine, state, history, find } = setup();
    const ids = state.diagram!.elements.map((e) => e.id).sort();
    engine.applyCanvasChange({ type: 'element-delete', elementId: find('Active').id });
    history.undo();
    expect(state.text).toBe(SRC);
    expect(state.diagram!.elements.map((e) => e.id).sort()).toEqual(ids);
    expect(state.diagram!.connectors).toHaveLength(3);
    expect(find('Deep').parentId).toBe(find('Nested').id);
    expect(history.canUndo()).toBe(false);
    history.redo();
    expect(state.diagram!.elements).toHaveLength(2);
  });

  it('a batch that also lists a child of the deleted container still works', () => {
    const { engine, state, find } = setup();
    expect(engine.applyCanvasChange({ type: 'batch', changes: [
      { type: 'element-delete', elementId: find('Active').id },
      { type: 'element-delete', elementId: find('Inside').id },
    ] })).toEqual({ ok: true });
    expect(state.diagram!.elements).toHaveLength(2);
  });

  it('deleting a leaf leaves its owner and the rest in place', () => {
    const { engine, state, find } = setup();
    engine.applyCanvasChange({ type: 'element-delete', elementId: find('Deep').id });
    expect(state.diagram!.elements.map((e) => e.properties.name).sort()).toEqual(['Active', 'Apart', 'Inside', 'Nested', 'Outside']);
    expect(state.diagram!.connectors.map((c) => c.label).sort()).toEqual(['free', 'in']);
  });
});
