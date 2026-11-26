import { describe, expect, it, vi } from 'vitest';
import type { DiagramData } from '../types';
import { parseDSL } from '../parser/dsl';
import { SyncEngine } from './syncEngine';
import { UndoManager } from './undoManager';
import { MIN_SIZE, clampSize, gestureResult } from './geometry';

const SRC = `@class-diagram "D"
class A @pos(0, 0) @size(160, 100) {
}
class B @pos(300, 40) @size(160, 100) {
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
  const id = (name: string) => state.diagram!.elements.find((e) => e.properties.name === name)!.id;
  return { engine, state, history, id };
}

describe('A05.09 gesture results', () => {
  it('commits the end value of a finished gesture', () => {
    expect(gestureResult({ x: 0, y: 0 }, { x: 5, y: 0 }, false)).toEqual({ x: 5, y: 0 });
    expect(gestureResult({ width: 10, height: 10 }, { width: 10, height: 12 }, false)).toEqual({ width: 10, height: 12 });
  });

  it('commits nothing for a cancelled gesture or one that ends where it began', () => {
    expect(gestureResult({ x: 0, y: 0 }, { x: 5, y: 5 }, true)).toBeNull();
    expect(gestureResult({ x: 3, y: 4 }, { x: 3, y: 4 }, false)).toBeNull();
  });

  it('keeps a resized box between the handle minimum and the file ceiling', () => {
    expect(clampSize({ width: 1, height: -50 })).toEqual(MIN_SIZE);
    expect(clampSize({ width: 1e9, height: 200 })).toEqual({ width: 100_000, height: 200 });
    expect(clampSize({ width: Number.NaN, height: Infinity })).toEqual(MIN_SIZE);
  });
});

describe('A05.09 move and resize transactions', () => {
  it('makes one drag and one resize one undo step each', () => {
    const { engine, state, history, id } = setup();
    engine.applyCanvasChange({ type: 'element-move', elementId: id('A'), position: { x: 10, y: 20 } });
    engine.applyCanvasChange({ type: 'element-resize', elementId: id('A'), size: { width: 200, height: 120 } });
    expect(history.undoStackSize).toBe(2);
    history.undo();
    expect(state.diagram!.elements.find((e) => e.id === id('A'))!.size).toEqual({ width: 160, height: 100 });
    expect(state.diagram!.elements.find((e) => e.id === id('A'))!.position).toEqual({ x: 10, y: 20 });
    history.undo();
    expect(state.text).toBe(SRC);
  });

  it('makes an alignment batch one undo step that edits only coordinates', () => {
    const { engine, state, history, id } = setup();
    engine.applyCanvasChange({ type: 'batch', changes: [
      { type: 'element-move', elementId: id('A'), position: { x: 0, y: 40 } },
      { type: 'element-move', elementId: id('B'), position: { x: 300, y: 0 } },
    ] });
    expect(state.text).toBe(SRC.replace('@pos(0, 0)', '@pos(0, 40)').replace('@pos(300, 40)', '@pos(300, 0)'));
    expect(history.undoStackSize).toBe(1);
  });

  it('refuses a size the file format cannot hold and changes nothing', () => {
    const { engine, state, history, id } = setup();
    for (const size of [{ width: 0, height: 10 }, { width: 100_001, height: 10 }, { width: Infinity, height: 10 }]) {
      const result = engine.applyCanvasChange({ type: 'element-resize', elementId: id('A'), size });
      expect(result).toMatchObject({ ok: false, reason: 'rules', errors: [{ message: '"A" must be larger than 0 and at most 100,000 wide and high' }] });
    }
    expect(state.text).toBe(SRC);
    expect(history.undoStackSize).toBe(0);
  });

  it('refuses a move outside the coordinate ceiling', () => {
    const { engine, state, id } = setup();
    const result = engine.applyCanvasChange({ type: 'element-move', elementId: id('A'), position: { x: 1_000_001, y: 0 } });
    expect(result).toMatchObject({ ok: false, reason: 'rules', errors: [{ message: '"A" would move outside ±1,000,000' }] });
    expect(state.text).toBe(SRC);
  });
});
