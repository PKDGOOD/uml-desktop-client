import { describe, expect, it, vi } from 'vitest';
import type { DiagramData } from '../types';
import { parseDSL } from '../parser/dsl';
import { SyncEngine } from './syncEngine';
import { UndoManager } from './undoManager';

const SRC = `@class-diagram "G"
class A @pos(40, 40) @size(160, 100) {
}
class B @pos(300, 40) @size(160, 100) {
}
class C @pos(560, 40) @size(160, 100) {
}
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

describe('A05.09 one gesture, one undo step', () => {
  it('a resize is a single step that undo reverses', () => {
    const { engine, state, history, find } = setup();
    expect(engine.applyCanvasChange({ type: 'element-resize', elementId: find('A').id, size: { width: 220, height: 120 } })).toEqual({ ok: true });
    expect(find('A').size).toEqual({ width: 220, height: 120 });
    expect(find('A').position).toEqual({ x: 40, y: 40 });
    history.undo();
    expect(state.text).toBe(SRC);
    expect(history.canUndo()).toBe(false);
  });

  it('aligning several elements is a single step', () => {
    const { engine, state, history, find } = setup();
    const moves = ['A', 'C'].map((n) => ({ type: 'element-move' as const, elementId: find(n).id, position: { x: find(n).position.x, y: 200 } }));
    expect(engine.applyCanvasChange({ type: 'batch', changes: moves })).toEqual({ ok: true });
    expect(find('A').position.y).toBe(200);
    expect(find('C').position.y).toBe(200);
    history.undo();
    expect(state.text).toBe(SRC);
    expect(history.canUndo()).toBe(false);
  });
});

describe('A05.09 comments survive an aligned batch', () => {
  it('edits only the moved positions', () => {
    const text = SRC.replace('class A', '// first\nclass A');
    const state = { text, diagram: null as DiagramData | null };
    const engine = new SyncEngine({ onDiagramUpdate: (d) => { state.diagram = d; }, onTextUpdate: (t) => { state.text = t; }, onErrors: vi.fn(), undoManager: new UndoManager(), debounceMs: 0 });
    const parsed = parseDSL(text);
    if (!parsed.success) throw new Error('fixture');
    engine.setDiagram(parsed.diagram, text);
    state.diagram = engine.getDiagram();
    const moves = ['A', 'C'].map((n) => {
      const e = state.diagram!.elements.find((x) => x.properties.name === n)!;
      return { type: 'element-move' as const, elementId: e.id, position: { x: e.position.x, y: 200 } };
    });
    expect(engine.applyCanvasChange({ type: 'batch', changes: moves })).toEqual({ ok: true });
    expect(state.text).toBe(text.replace('@pos(40, 40)', '@pos(40, 200)').replace('@pos(560, 40)', '@pos(560, 200)'));
  });
});

describe('A05.09 geometry limits', () => {
  const refused = (make: (id: string) => Parameters<SyncEngine['applyCanvasChange']>[0]) => {
    const { engine, state, history, find } = setup();
    expect(engine.applyCanvasChange(make(find('A').id))).toMatchObject({ ok: false, reason: 'rules' });
    expect(state.text).toBe(SRC);
    expect(history.canUndo()).toBe(false);
  };

  it('refuses sizes that are not finite, not positive or too large', () => {
    refused((id) => ({ type: 'element-resize', elementId: id, size: { width: Number.NaN, height: 50 } }));
    refused((id) => ({ type: 'element-resize', elementId: id, size: { width: 100, height: Number.POSITIVE_INFINITY } }));
    refused((id) => ({ type: 'element-resize', elementId: id, size: { width: 0, height: 50 } }));
    refused((id) => ({ type: 'element-resize', elementId: id, size: { width: -5, height: 50 } }));
    refused((id) => ({ type: 'element-resize', elementId: id, size: { width: 100_001, height: 50 } }));
  });

  it('refuses positions that are not finite or outside the canvas range', () => {
    refused((id) => ({ type: 'element-move', elementId: id, position: { x: Number.NaN, y: 0 } }));
    refused((id) => ({ type: 'element-move', elementId: id, position: { x: 0, y: Number.NEGATIVE_INFINITY } }));
    refused((id) => ({ type: 'element-move', elementId: id, position: { x: 1_000_001, y: 0 } }));
  });

  it('accepts the largest allowed values', () => {
    const { engine, find } = setup();
    expect(engine.applyCanvasChange({ type: 'element-resize', elementId: find('A').id, size: { width: 100_000, height: 100_000 } })).toEqual({ ok: true });
    expect(engine.applyCanvasChange({ type: 'element-move', elementId: find('B').id, position: { x: -1_000_000, y: 1_000_000 } })).toEqual({ ok: true });
  });
});

describe('A05.09 whole-number geometry', () => {
  it('rounds a dropped fractional position and keeps negative ones', () => {
    const { engine, state, find } = setup();
    expect(engine.applyCanvasChange({ type: 'element-move', elementId: find('A').id, position: { x: 40.4, y: -12.6 } })).toEqual({ ok: true });
    expect(find('A').position).toEqual({ x: 40, y: -13 });
    expect(state.text).toContain('@pos(40, -13)');
  });

  it('rounds a fractional size', () => {
    const { engine, find } = setup();
    expect(engine.applyCanvasChange({ type: 'element-resize', elementId: find('A').id, size: { width: 200.6, height: 80.2 } })).toEqual({ ok: true });
    expect(find('A').size).toEqual({ width: 201, height: 80 });
  });
});
