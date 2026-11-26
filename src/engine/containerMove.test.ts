import { describe, expect, it, vi } from 'vitest';
import type { DiagramData } from '../types';
import { parseDSL } from '../parser/dsl';
import { SyncEngine } from './syncEngine';
import { UndoManager } from './undoManager';
import { moveWithDescendants } from './containment';

const SRC = `@state-diagram "Machine"
// the main block
composite-state Active @pos(0, 0) @size(400, 300) {
  state Idle @pos(20, 40) @size(120, 60)   // waiting
  composite-state Inner @pos(180, 40) @size(200, 200) {
    state Deep @pos(200, 80) @size(120, 60)
  }
}
state Outside @pos(600, 0) @size(120, 60)
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
  const find = (name: string) => state.diagram!.elements.find((e) => e.properties.name === name)!;
  return { engine, state, history, find };
}

describe('A05.08 moving a container with its descendants', () => {
  it('moves every descendant by the same delta in one undo step and leaves siblings alone', () => {
    const { engine, state, history, find } = setup();
    expect(engine.applyCanvasChange(moveWithDescendants(state.diagram!, find('Active').id, { x: 100, y: 50 }))).toEqual({ ok: true });

    expect(find('Active').position).toEqual({ x: 100, y: 50 });
    expect(find('Idle').position).toEqual({ x: 120, y: 90 });
    expect(find('Inner').position).toEqual({ x: 280, y: 90 });
    expect(find('Deep').position).toEqual({ x: 300, y: 130 });
    expect(find('Outside').position).toEqual({ x: 600, y: 0 });
    expect(history.undoStackSize).toBe(1);

    history.undo();
    expect(state.text).toBe(SRC);
    expect(find('Deep').position).toEqual({ x: 200, y: 80 });
  });

  it('edits only the coordinates in the text, keeping comments', () => {
    const { engine, state, find } = setup();
    engine.applyCanvasChange(moveWithDescendants(state.diagram!, find('Active').id, { x: 100, y: 50 }));
    expect(state.text).toBe(SRC
      .replace('@pos(0, 0)', '@pos(100, 50)')
      .replace('@pos(20, 40)', '@pos(120, 90)')
      .replace('@pos(180, 40)', '@pos(280, 90)')
      .replace('@pos(200, 80)', '@pos(300, 130)'));
  });

  it('moves a nested container with only its own contents', () => {
    const { engine, state, find } = setup();
    engine.applyCanvasChange(moveWithDescendants(state.diagram!, find('Inner').id, { x: 190, y: 60 }));
    expect(find('Deep').position).toEqual({ x: 210, y: 100 });
    expect(find('Idle').position).toEqual({ x: 20, y: 40 });
    expect(find('Active').position).toEqual({ x: 0, y: 0 });
  });

  it('is a plain move for an element without contents', () => {
    const { state, find } = setup();
    expect(moveWithDescendants(state.diagram!, find('Outside').id, { x: 1, y: 2 }))
      .toEqual({ type: 'element-move', elementId: find('Outside').id, position: { x: 1, y: 2 } });
  });

  it('does not reparent an element dragged across its parent border', () => {
    const { engine, state, find } = setup();
    const activeId = find('Active').id;
    engine.applyCanvasChange(moveWithDescendants(state.diagram!, find('Idle').id, { x: 900, y: 900 }));
    expect(find('Idle').parentId).toBe(activeId);
    expect(find('Idle').position).toEqual({ x: 900, y: 900 });
    expect(state.text).toContain('  state Idle @pos(900, 900) @size(120, 60)   // waiting');
  });
});
