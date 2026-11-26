import { describe, expect, it, vi } from 'vitest';
import type { DiagramData } from '../types';
import { parseDSL } from '../parser/dsl';
import { parseCheckedDSL } from './diagramRules';
import { SyncEngine } from './syncEngine';
import { UndoManager } from './undoManager';
import { canContain, parentCandidates, reparentProblem } from './containment';

const SRC = `@state-diagram "S"
composite-state Active @pos(40, 40) @size(300, 200) {
  state Inside @pos(60, 100) @size(100, 50)
  composite-state Nested @pos(180, 100) @size(120, 80) {
    state Deep @pos(190, 130) @size(60, 30)
  }
}
composite-state Other @pos(500, 40) @size(200, 150) {
}
state Outside @pos(100, 400) @size(100, 50)
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
  const parentName = (name: string) => state.diagram!.elements.find((e) => e.id === find(name).parentId)?.properties.name ?? null;
  return { engine, state, history, find, parentName };
}

describe('A05.07 choosing the owner', () => {
  it('knows which kinds may own which', () => {
    expect(canContain('composite-state', 'state')).toBe(true);
    expect(canContain('system-boundary', 'usecase')).toBe(true);
    expect(canContain('state', 'state')).toBe(false);
    expect(canContain('composite-state', 'usecase')).toBe(false);
  });

  it('offers only owners that would be valid, never the element or anything below it', () => {
    const { state, find } = setup();
    const names = (n: string) => parentCandidates(state.diagram!, find(n).id).map((e) => e.properties.name).sort();
    expect(names('Outside')).toEqual(['Active', 'Nested', 'Other']);
    expect(names('Active')).toEqual(['Other']);
    expect(names('Nested')).toEqual(['Active', 'Other']); // its current owner stays a choice
  });

  it('refuses a loop, a wrong kind and a missing owner by name', () => {
    const { state, find } = setup();
    const d = state.diagram!;
    expect(reparentProblem(d, find('Active').id, find('Nested').id)).toMatch(/loop/);
    expect(reparentProblem(d, find('Active').id, find('Active').id)).toMatch(/cannot contain itself/);
    expect(reparentProblem(d, find('Outside').id, find('Inside').id)).toMatch(/A state cannot contain a state/);
    expect(reparentProblem(d, find('Outside').id, 'nope')).toMatch(/no longer exists/);
    expect(reparentProblem(d, find('Outside').id, null)).toBeNull();
  });
});

describe('A05.07 reparenting through the engine', () => {
  it('changes ownership and layout together, and one undo restores both', () => {
    const { engine, state, history, find, parentName } = setup();
    const outside = find('Outside');
    expect(engine.applyCanvasChange({ type: 'element-reparent', elementId: outside.id, parentId: find('Other').id })).toEqual({ ok: true });
    expect(parentName('Outside')).toBe('Other');
    expect(find('Outside').id).toBe(outside.id);
    const other = find('Other');
    const moved = find('Outside');
    expect(moved.position.x).toBeGreaterThanOrEqual(other.position.x);
    expect(moved.position.y).toBeGreaterThanOrEqual(other.position.y);
    expect(moved.position.x + moved.size.width).toBeLessThanOrEqual(other.position.x + other.size.width);
    expect(moved.position.y + moved.size.height).toBeLessThanOrEqual(other.position.y + other.size.height);
    const reread = parseCheckedDSL(state.text);
    expect(reread.success).toBe(true);

    history.undo();
    expect(state.text).toBe(SRC);
    expect(parentName('Outside')).toBeNull();
    expect(find('Outside').position).toEqual({ x: 100, y: 400 });
    history.redo();
    expect(parentName('Outside')).toBe('Other');
  });

  it('carries the subtree with the element', () => {
    const { engine, find, parentName } = setup();
    const deepBefore = find('Deep').position;
    const nestedBefore = find('Nested').position;
    expect(engine.applyCanvasChange({ type: 'element-reparent', elementId: find('Nested').id, parentId: find('Other').id })).toEqual({ ok: true });
    expect(parentName('Nested')).toBe('Other');
    expect(parentName('Deep')).toBe('Nested');
    const dx = find('Nested').position.x - nestedBefore.x;
    const dy = find('Nested').position.y - nestedBefore.y;
    expect(find('Deep').position).toEqual({ x: deepBefore.x + dx, y: deepBefore.y + dy });
  });

  it('grows the owner when the element does not fit', () => {
    const { engine, find } = setup();
    expect(engine.applyCanvasChange({ type: 'element-reparent', elementId: find('Active').id, parentId: find('Other').id })).toEqual({ ok: true });
    const other = find('Other');
    const active = find('Active');
    expect(other.size.width).toBeGreaterThanOrEqual(active.size.width + 32);
    expect(other.size.height).toBeGreaterThanOrEqual(active.size.height + 32);
  });

  it('moves an element out to the top level, clear of its old owner', () => {
    const { engine, find, parentName } = setup();
    expect(engine.applyCanvasChange({ type: 'element-reparent', elementId: find('Inside').id, parentId: null })).toEqual({ ok: true });
    expect(parentName('Inside')).toBeNull();
    const active = find('Active');
    expect(find('Inside').position.x).toBeGreaterThanOrEqual(active.position.x + active.size.width);
  });

  it('refuses a cycle or a wrong kind and leaves model, text and history alone', () => {
    const { engine, state, history, find, parentName } = setup();
    const cycle = engine.applyCanvasChange({ type: 'element-reparent', elementId: find('Active').id, parentId: find('Deep').id });
    expect(cycle).toMatchObject({ ok: false, reason: 'rules' });
    const wrong = engine.applyCanvasChange({ type: 'element-reparent', elementId: find('Outside').id, parentId: find('Inside').id });
    expect(wrong).toMatchObject({ ok: false, reason: 'rules' });
    expect(state.text).toBe(SRC);
    expect(parentName('Outside')).toBeNull();
    expect(history.canUndo()).toBe(false);
  });
});
