import { describe, expect, it, vi } from 'vitest';
import type { DiagramData } from '../types';
import { parseDSL } from '../parser/dsl';
import { SyncEngine } from './syncEngine';
import { UndoManager } from './undoManager';

const SRC = `@class-diagram "D"
class Animal @pos(40, 40) @size(160, 100) {
}
class Dog @pos(300, 40) @size(160, 100) {
}
interface Pet @pos(560, 40) @size(160, 100) {
}
Dog --|> Animal
Dog --> Pet : owns
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
  const conn = (type: string) => state.diagram!.connectors.find((c) => c.type === type)!;
  return { engine, state, history, id, conn };
}

describe('A05.04 connector endpoints and label', () => {
  it('re-points an endpoint and relabels in place, and undo restores both', () => {
    const { engine, state, history, id, conn } = setup();
    const owns = conn('directed-association');
    expect(engine.applyCanvasChange({ type: 'connector-update', connectorId: owns.id, changes: { targetId: id('Animal'), label: 'chases' } })).toEqual({ ok: true });
    expect(state.text).toContain('Dog --> Animal : chases');
    history.undo();
    expect(state.text).toBe(SRC);
  });

  it('swaps the direction of a relationship', () => {
    const { engine, state, id, conn } = setup();
    const owns = conn('directed-association');
    engine.applyCanvasChange({ type: 'connector-update', connectorId: owns.id, changes: { sourceId: owns.targetId, targetId: owns.sourceId } });
    expect(state.text).toContain('Pet --> Dog : owns');
    expect(state.diagram!.connectors.find((c) => c.id === owns.id)!.sourceId).toBe(id('Pet'));
  });

  it('refuses an incompatible endpoint and keeps the original connection', () => {
    const { engine, state, id, conn } = setup();
    const inheritance = conn('inheritance');
    const result = engine.applyCanvasChange({ type: 'connector-update', connectorId: inheritance.id, changes: { targetId: id('Pet') } });
    expect(result.ok).toBe(false);
    expect(state.text).toBe(SRC);
    expect(conn('inheritance').targetId).toBe(id('Animal'));
  });

  it('refuses a self-link', () => {
    const { engine, state, id, conn } = setup();
    const owns = conn('directed-association');
    const result = engine.applyCanvasChange({ type: 'connector-update', connectorId: owns.id, changes: { targetId: id('Dog') } });
    expect(result.ok).toBe(false);
    expect(state.text).toBe(SRC);
  });
});
