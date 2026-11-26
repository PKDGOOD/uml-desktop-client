import { describe, expect, it, vi } from 'vitest';
import type { DiagramData, DiagramElement } from '../types';
import { parseDSL } from '../parser/dsl';
import { SyncEngine } from './syncEngine';
import { UndoManager } from './undoManager';
import { descendantIds, parentCandidates, reparentChange, reparentProblem } from './containment';

const SRC = `@state-diagram "Machine"
composite-state Active @pos(0, 0) @size(400, 300) {
  state Idle @pos(20, 40) @size(120, 60)
  composite-state Inner @pos(180, 40) @size(200, 200) {
    state Deep @pos(200, 80) @size(120, 60)
  }
}
state Outside @pos(600, 0) @size(120, 60)
composite-state Spare @pos(600, 200) @size(300, 200) {
}
Idle --> Outside
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
  const find = (name: string): DiagramElement => state.diagram!.elements.find((e) => e.properties.name === name)!;
  const parentName = (name: string) => state.diagram!.elements.find((e) => e.id === find(name).parentId)?.properties.name ?? null;
  return { engine, state, history, find, parentName };
}

describe('A05.07 explicit parent selection', () => {
  it('lists only containers of the right kind that are not the element or inside it', () => {
    const { state, find } = setup();
    const names = (name: string) => parentCandidates(state.diagram!, find(name).id).map((e) => e.properties.name);
    expect(names('Outside')).toEqual(['Active', 'Inner', 'Spare']);
    expect(names('Active')).toEqual(['Spare']);
    expect(names('Inner')).toEqual(['Active', 'Spare']);
  });

  it('moves a state into a container, changing parent and layout in one undo step', () => {
    const { engine, state, history, find, parentName } = setup();
    const outside = find('Outside');
    expect(engine.applyCanvasChange(reparentChange(state.diagram!, outside.id, find('Spare').id))).toEqual({ ok: true });
    expect(parentName('Outside')).toBe('Spare');
    expect(find('Outside').position).toEqual({ x: 620, y: 240 });
    expect(find('Outside').id).toBe(outside.id);
    expect(state.text).toMatch(/composite-state Spare[^\n]*\{\n\s+state Outside @pos\(620, 240\)/);
    expect(history.undoStackSize).toBe(1);

    history.undo();
    expect(parentName('Outside')).toBeNull();
    expect(find('Outside').position).toEqual({ x: 600, y: 0 });
    expect(state.text).toBe(SRC);
  });

  it('moves a container together with everything inside it', () => {
    const { engine, state, find, parentName } = setup();
    const inner = find('Inner');
    engine.applyCanvasChange(reparentChange(state.diagram!, inner.id, find('Spare').id));
    expect(parentName('Inner')).toBe('Spare');
    expect(parentName('Deep')).toBe('Inner');
    expect(find('Inner').position).toEqual({ x: 620, y: 240 });
    expect(find('Deep').position).toEqual({ x: 640, y: 280 });
  });

  it('takes an element out to the top level beside its outermost old container', () => {
    const { engine, state, find, parentName } = setup();
    engine.applyCanvasChange(reparentChange(state.diagram!, find('Deep').id, undefined));
    expect(parentName('Deep')).toBeNull();
    expect(find('Deep').position).toEqual({ x: 440, y: 80 });
    expect(state.text).toMatch(/^state Deep @pos\(440, 80\)/m);
  });

  it('keeps the position when the element already lies inside the new parent', () => {
    const { state, find } = setup();
    // Deep (200, 80, 120×60) already lies inside Active (0, 0, 400×300); Idle does not lie inside Inner.
    expect(reparentChange(state.diagram!, find('Idle').id, find('Inner').id)).toMatchObject({ position: { x: 200, y: 80 } });
    const deepIntoActive = reparentChange(state.diagram!, find('Deep').id, find('Active').id);
    expect(deepIntoActive).toMatchObject({ position: { x: 200, y: 80 } });
  });

  it('refuses a cycle with the reason and changes nothing', () => {
    const { engine, state, history, find } = setup();
    const result = engine.applyCanvasChange({ type: 'element-reparent', elementId: find('Active').id, parentId: find('Inner').id, position: { x: 0, y: 0 } });
    expect(result).toMatchObject({ ok: false, reason: 'rules', errors: [{ message: '"Active" cannot be placed inside itself' }] });
    expect(state.text).toBe(SRC);
    expect(history.undoStackSize).toBe(0);
  });

  it('refuses a parent of the wrong kind', () => {
    const { engine, state, find } = setup();
    const result = engine.applyCanvasChange({ type: 'element-reparent', elementId: find('Idle').id, parentId: find('Outside').id, position: { x: 0, y: 0 } });
    expect(result).toMatchObject({ ok: false, errors: [{ message: 'A state cannot contain a state' }] });
    expect(state.text).toBe(SRC);
  });

  it('reports a missing element or parent', () => {
    const { state, find } = setup();
    expect(reparentProblem(state.diagram!, 'nope', undefined)).toBe('Element nope does not exist');
    expect(reparentProblem(state.diagram!, find('Idle').id, 'nope')).toBe('Element nope does not exist');
  });

  it('finds descendants at any depth', () => {
    const { state, find } = setup();
    expect([...descendantIds(state.diagram!, find('Active').id)].map((id) => state.diagram!.elements.find((e) => e.id === id)!.properties.name).sort())
      .toEqual(['Deep', 'Idle', 'Inner']);
  });

  it('puts a use case inside a system boundary', () => {
    const src = `@usecase-diagram "Shop"
actor Buyer @pos(0, 0) @size(60, 100)
system-boundary Store @pos(200, 0) @size(300, 300) {
}
usecase Pay @pos(600, 0) @size(120, 60)
Buyer --> Pay
`;
    const state = { text: src, diagram: null as DiagramData | null };
    const engine = new SyncEngine({ onDiagramUpdate: (d) => { state.diagram = d; }, onTextUpdate: (t) => { state.text = t; }, onErrors: vi.fn(), debounceMs: 0 });
    const parsed = parseDSL(src);
    if (!parsed.success) throw new Error(JSON.stringify(parsed.errors));
    engine.setDiagram(parsed.diagram, src);
    const d = engine.getDiagram()!;
    const id = (name: string) => d.elements.find((e) => e.properties.name === name)!.id;
    expect(parentCandidates(d, id('Buyer'))).toEqual([]);
    expect(engine.applyCanvasChange(reparentChange(d, id('Pay'), id('Store')))).toEqual({ ok: true });
    expect(state.text).toMatch(/system-boundary Store[^\n]*\{\n\s+usecase Pay/);
  });
});
