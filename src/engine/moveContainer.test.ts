import { describe, expect, it, vi } from 'vitest';
import type { DiagramData } from '../types';
import { parseDSL } from '../parser/dsl';
import { SyncEngine } from './syncEngine';
import { UndoManager } from './undoManager';
import { withoutSelectedOwners } from './containment';

const SRC = `@state-diagram "S"
// the owner
composite-state Active @pos(40, 40) @size(300, 200) {
  state Inside @pos(60, 100) @size(100, 50)   // keep me
  composite-state Nested @pos(180, 100) @size(120, 80) {
    state Deep @pos(190, 130) @size(60, 30)
  }
}
state Outside @pos(400, 40) @size(100, 50)
state Apart @pos(100, 400) @size(100, 50)
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

describe('A05.08 moving a container', () => {
  it('moves every descendant by the same delta, and nothing else', () => {
    const { engine, find } = setup();
    const before = Object.fromEntries(['Active', 'Inside', 'Nested', 'Deep', 'Outside', 'Apart'].map((n) => [n, find(n).position]));
    expect(engine.applyCanvasChange({ type: 'element-move', elementId: find('Active').id, position: { x: 70, y: 25 } })).toEqual({ ok: true });
    for (const name of ['Active', 'Inside', 'Nested', 'Deep']) {
      expect(find(name).position).toEqual({ x: before[name].x + 30, y: before[name].y - 15 });
    }
    expect(find('Outside').position).toEqual(before.Outside);
    expect(find('Apart').position).toEqual(before.Apart);
  });

  it('never changes ownership, even when the container is dropped over another element', () => {
    const { engine, find, state } = setup();
    engine.applyCanvasChange({ type: 'element-move', elementId: find('Active').id, position: { x: 380, y: 30 } });
    const owner = (name: string) => state.diagram!.elements.find((e) => e.id === find(name).parentId)?.properties.name ?? null;
    expect(owner('Inside')).toBe('Active');
    expect(owner('Nested')).toBe('Active');
    expect(owner('Deep')).toBe('Nested');
    expect(owner('Outside')).toBeNull();
  });

  it('is one undo step and keeps the comments in the text', () => {
    const { engine, state, history, find } = setup();
    engine.applyCanvasChange({ type: 'element-move', elementId: find('Active').id, position: { x: 70, y: 25 } });
    expect(state.text).toContain('// the owner');
    expect(state.text).toContain('// keep me');
    expect(state.text).toContain('@pos(70, 25)');
    expect(state.text).toContain('@pos(90, 85)');
    history.undo();
    expect(state.text).toBe(SRC);
    expect(find('Deep').position).toEqual({ x: 190, y: 130 });
    expect(history.canUndo()).toBe(false);
  });

  it('moves a leaf alone', () => {
    const { engine, find } = setup();
    engine.applyCanvasChange({ type: 'element-move', elementId: find('Inside').id, position: { x: 61, y: 101 } });
    expect(find('Inside').position).toEqual({ x: 61, y: 101 });
    expect(find('Nested').position).toEqual({ x: 180, y: 100 });
  });
});

describe('A05.08 aligning a selection', () => {
  it('leaves out elements whose owner is also selected', () => {
    const { state, find } = setup();
    const all = state.diagram!.elements;
    const picked = [find('Active'), find('Deep'), find('Outside')];
    expect(withoutSelectedOwners(all, picked).map((e) => e.properties.name)).toEqual(['Active', 'Outside']);
  });
});
