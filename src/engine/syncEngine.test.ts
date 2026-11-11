// =============================================================================
// SyncEngine Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncEngine, SyncEngineOptions } from './syncEngine';
import { UndoManager } from './undoManager';
import { serializeDSL } from '../parser/dsl/serializer';
import type {
  DiagramData,
  DSLError,
  CanvasChange,
  DiagramElement,
  Connector,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDiagram(overrides?: Partial<DiagramData>): DiagramData {
  return {
    id: 'diag-1',
    name: 'Test',
    type: 'class',
    elements: [],
    connectors: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    ...overrides,
  };
}

function makeElement(id: string, name: string): DiagramElement {
  return {
    id,
    type: 'class',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 60 },
    properties: { name },
  };
}

function makeConnector(id: string, sourceId: string, targetId: string): Connector {
  return {
    id,
    type: 'directed-association',
    sourceId,
    targetId,
    properties: {},
  };
}

function createEngine(opts?: Partial<SyncEngineOptions>) {
  const onDiagramUpdate = vi.fn();
  const onTextUpdate = vi.fn();
  const onErrors = vi.fn();

  const engine = new SyncEngine({
    onDiagramUpdate,
    onTextUpdate,
    onErrors,
    debounceMs: 300,
    ...opts,
  });

  return { engine, onDiagramUpdate, onTextUpdate, onErrors };
}

// Valid DSL text for a simple class diagram
const VALID_CLASS_DSL = `@class-diagram "Test"

class Order {
  - id: string
  + addItem(item: OrderItem): void
}
`;

const INVALID_DSL = `@class-diagram "Test"\n\nclass {{{ invalid`;

describe('SyncEngine draft safety', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('remaps both connector endpoints to preserved IDs after a text edit', () => {
    const { engine } = createEngine();
    const diagram = makeDiagram({
      elements: [makeElement('existing-a', 'A'), makeElement('existing-b', 'B')],
      connectors: [{ ...makeConnector('existing-link', 'existing-a', 'existing-b'),
        waypoints: [{ x: 50, y: 75 }] }],
    });
    diagram.elements[0].sharedRefId = 'shared-a';
    engine.setDiagram(diagram);
    engine.onTextChange(serializeDSL(diagram).replace('"Test"', '"Renamed"'));
    engine.flushPendingText();
    expect(engine.getDiagram()?.connectors[0]).toMatchObject({
      id: 'existing-link', sourceId: 'existing-a', targetId: 'existing-b', waypoints: [{ x: 50, y: 75 }],
    });
    expect(engine.getDiagram()?.elements[0].sharedRefId).toBe('shared-a');
  });

  it('does not reuse an ID for multiple parallel connectors', () => {
    const { engine } = createEngine();
    const diagram = makeDiagram({
      elements: [makeElement('a', 'A'), makeElement('b', 'B')],
      connectors: [{ ...makeConnector('first', 'a', 'b'), label: 'one' },
        { ...makeConnector('second', 'a', 'b'), label: 'two' }],
    });
    engine.setDiagram(diagram);
    engine.onTextChange(serializeDSL({ ...diagram, connectors: [...diagram.connectors].reverse() }));
    engine.flushPendingText();
    expect(engine.getDiagram()?.connectors.map((c) => c.id)).toEqual(['second', 'first']);
  });

  it('cancels a pending edit when a different diagram is set', () => {
    const { engine, onDiagramUpdate } = createEngine();
    engine.setDiagram(makeDiagram());
    engine.onTextChange(VALID_CLASS_DSL);
    engine.setDiagram(makeDiagram({ id: 'other', name: 'Other' }));
    vi.runAllTimers();
    expect(onDiagramUpdate).not.toHaveBeenCalled();
    expect(engine.getDiagram()?.id).toBe('other');
  });

  it('flushes a text edit before applying a canvas edit', () => {
    const { engine } = createEngine();
    engine.setDiagram(makeDiagram({ elements: [makeElement('order', 'Order')] }));
    engine.onTextChange(VALID_CLASS_DSL);
    engine.onCanvasChange({ type: 'element-move', elementId: 'order', position: { x: 99, y: 88 } });
    vi.runAllTimers();
    expect(engine.getDiagram()?.elements[0]).toMatchObject({
      position: { x: 99, y: 88 }, properties: { attributes: [{ name: 'id', type: 'string', visibility: 'private' }] },
    });
  });

  it('does not overwrite an invalid draft with a canvas change', () => {
    const { engine, onTextUpdate } = createEngine();
    engine.setDiagram(makeDiagram({ elements: [makeElement('order', 'Order')] }));
    engine.onTextChange(INVALID_DSL);
    expect(engine.onCanvasChange({ type: 'element-delete', elementId: 'order' })).toBe(false);
    expect(engine.getText()).toBe(INVALID_DSL);
    expect(engine.getDiagram()?.elements).toHaveLength(1);
    expect(onTextUpdate).not.toHaveBeenCalled();
  });

  it('updates the editor as well as the canvas when redoing a text edit', () => {
    const history = new UndoManager();
    const { engine, onTextUpdate } = createEngine({ undoManager: history });
    engine.setDiagram(makeDiagram());
    engine.onTextChange(VALID_CLASS_DSL);
    engine.flushPendingText();
    history.undo();
    history.redo();
    expect(onTextUpdate).toHaveBeenLastCalledWith(VALID_CLASS_DSL);
    expect(engine.getText()).toBe(VALID_CLASS_DSL);
  });

  it('keeps parentId pointing at preserved element IDs after a text edit', () => {
    const { engine } = createEngine();
    engine.setDiagram(makeDiagram({ type: 'state', elements: [] }), '@state-diagram "S"\n');
    engine.onTextChange('@state-diagram "S"\ncomposite-state Active {\n  state Inside\n}\nstate Outside\n');
    engine.flushPendingText();
    const before = engine.getDiagram()!;
    const activeId = before.elements.find((e) => e.properties.name === 'Active')!.id;

    engine.onTextChange(`${engine.getText()}\n`);
    engine.flushPendingText();
    const after = engine.getDiagram()!;
    expect(after.elements.find((e) => e.properties.name === 'Active')!.id).toBe(activeId);
    expect(after.elements.find((e) => e.properties.name === 'Inside')!.parentId).toBe(activeId);
    expect(after.elements.find((e) => e.properties.name === 'Outside')!.parentId).toBeUndefined();
  });

  it('rejects a canvas command the DSL cannot represent without changing state or history', () => {
    const history = new UndoManager();
    const { engine, onDiagramUpdate, onTextUpdate } = createEngine({ undoManager: history });
    engine.setDiagram(makeDiagram({ elements: [makeElement('el-1', 'Order')] }));
    const before = { diagram: engine.getDiagram(), text: engine.getText() };

    const accepted = engine.onCanvasChange({ type: 'element-update', elementId: 'el-1',
      properties: { attributes: [{ name: 'bad name', type: 'String', visibility: 'private' }] } });

    expect(accepted).toBe(false);
    expect(engine.getDiagram()).toEqual(before.diagram);
    expect(engine.getText()).toBe(before.text);
    expect(history.canUndo()).toBe(false);
    expect(onDiagramUpdate).not.toHaveBeenCalled();
    expect(onTextUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Task 10.1: Bidirectional Sync Engine
// ---------------------------------------------------------------------------

describe('SyncEngine - Task 10.1: Bidirectional Sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('onTextChange: valid DSL → diagram update callback', () => {
    const { engine, onDiagramUpdate, onErrors } = createEngine();

    engine.onTextChange(VALID_CLASS_DSL);
    vi.advanceTimersByTime(300);

    expect(onDiagramUpdate).toHaveBeenCalledTimes(1);
    const diagram = onDiagramUpdate.mock.calls[0][0] as DiagramData;
    expect(diagram.name).toBe('Test');
    expect(diagram.type).toBe('class');
    expect(diagram.elements.length).toBeGreaterThan(0);
    expect(onErrors).toHaveBeenCalledWith([]);
  });

  it('onCanvasChange: element-add → text update callback', () => {
    const { engine, onTextUpdate, onDiagramUpdate } = createEngine();

    const diagram = makeDiagram({
      elements: [makeElement('e1', 'MyClass')],
    });
    engine.setDiagram(diagram);

    const newElement = makeElement('e2', 'NewClass');
    const change: CanvasChange = { type: 'element-add', element: newElement };
    engine.onCanvasChange(change);

    expect(onDiagramUpdate).toHaveBeenCalledTimes(1);
    const updatedDiagram = onDiagramUpdate.mock.calls[0][0] as DiagramData;
    expect(updatedDiagram.elements).toHaveLength(2);

    expect(onTextUpdate).toHaveBeenCalledTimes(1);
    const text = onTextUpdate.mock.calls[0][0] as string;
    expect(text).toContain('NewClass');
  });

  it('onCanvasChange: element-move → text update with new position', () => {
    const { engine, onDiagramUpdate, onTextUpdate } = createEngine();

    const diagram = makeDiagram({
      elements: [makeElement('e1', 'MyClass')],
    });
    engine.setDiagram(diagram);

    const change: CanvasChange = {
      type: 'element-move',
      elementId: 'e1',
      position: { x: 200, y: 300 },
    };
    engine.onCanvasChange(change);

    const updatedDiagram = onDiagramUpdate.mock.calls[0][0] as DiagramData;
    const movedEl = updatedDiagram.elements.find(e => e.id === 'e1');
    expect(movedEl?.position).toEqual({ x: 200, y: 300 });
    expect(onTextUpdate).toHaveBeenCalled();
  });

  it('onCanvasChange: element-delete → removes element and connected connectors', () => {
    const { engine, onDiagramUpdate } = createEngine();

    const diagram = makeDiagram({
      elements: [makeElement('e1', 'A'), makeElement('e2', 'B')],
      connectors: [makeConnector('c1', 'e1', 'e2')],
    });
    engine.setDiagram(diagram);

    const change: CanvasChange = { type: 'element-delete', elementId: 'e1' };
    engine.onCanvasChange(change);

    const updatedDiagram = onDiagramUpdate.mock.calls[0][0] as DiagramData;
    expect(updatedDiagram.elements).toHaveLength(1);
    expect(updatedDiagram.connectors).toHaveLength(0);
  });

  it('onCanvasChange: connector-add → text update includes connector', () => {
    const { engine, onDiagramUpdate, onTextUpdate } = createEngine();

    const diagram = makeDiagram({
      elements: [makeElement('e1', 'A'), makeElement('e2', 'B')],
    });
    engine.setDiagram(diagram);

    const connector = makeConnector('c1', 'e1', 'e2');
    const change: CanvasChange = { type: 'connector-add', connector };
    engine.onCanvasChange(change);

    const updatedDiagram = onDiagramUpdate.mock.calls[0][0] as DiagramData;
    expect(updatedDiagram.connectors).toHaveLength(1);
    expect(onTextUpdate).toHaveBeenCalled();
  });

  it('debouncing: text changes within 300ms are coalesced', () => {
    const { engine, onDiagramUpdate } = createEngine();

    engine.onTextChange(VALID_CLASS_DSL);
    vi.advanceTimersByTime(100);
    engine.onTextChange(VALID_CLASS_DSL);
    vi.advanceTimersByTime(100);
    engine.onTextChange(VALID_CLASS_DSL);
    vi.advanceTimersByTime(300);

    // Only the last change should fire
    expect(onDiagramUpdate).toHaveBeenCalledTimes(1);
  });

  it('debouncing: canvas changes are immediate (no debounce)', () => {
    const { engine, onDiagramUpdate } = createEngine();

    const diagram = makeDiagram({
      elements: [makeElement('e1', 'A')],
    });
    engine.setDiagram(diagram);

    const change: CanvasChange = {
      type: 'element-move',
      elementId: 'e1',
      position: { x: 50, y: 50 },
    };
    engine.onCanvasChange(change);

    // Should fire immediately without needing timer advance
    expect(onDiagramUpdate).toHaveBeenCalledTimes(1);
  });

  it('pause() stops processing text changes', () => {
    const { engine, onDiagramUpdate } = createEngine();

    engine.pause();
    engine.onTextChange(VALID_CLASS_DSL);
    vi.advanceTimersByTime(500);

    expect(onDiagramUpdate).not.toHaveBeenCalled();
  });

  it('pause() stops processing canvas changes', () => {
    const { engine, onDiagramUpdate } = createEngine();

    const diagram = makeDiagram({ elements: [makeElement('e1', 'A')] });
    engine.setDiagram(diagram);

    engine.pause();
    engine.onCanvasChange({ type: 'element-move', elementId: 'e1', position: { x: 1, y: 1 } });

    expect(onDiagramUpdate).not.toHaveBeenCalled();
  });

  it('resume() re-enables sync after pause', () => {
    const { engine, onDiagramUpdate } = createEngine();

    const diagram = makeDiagram({ elements: [makeElement('e1', 'A')] });
    engine.setDiagram(diagram);

    engine.pause();
    expect(engine.isPaused()).toBe(true);

    engine.resume();
    expect(engine.isPaused()).toBe(false);

    engine.onCanvasChange({ type: 'element-move', elementId: 'e1', position: { x: 1, y: 1 } });
    expect(onDiagramUpdate).toHaveBeenCalledTimes(1);
  });

  it('pause() cancels pending debounced text change', () => {
    const { engine, onDiagramUpdate } = createEngine();

    engine.onTextChange(VALID_CLASS_DSL);
    vi.advanceTimersByTime(100);
    engine.pause();
    vi.advanceTimersByTime(500);

    expect(onDiagramUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Task 10.2: Error Handling
// ---------------------------------------------------------------------------

describe('SyncEngine - Task 10.2: Error Handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parse error → last valid state preserved, errors reported', () => {
    const { engine, onDiagramUpdate, onErrors } = createEngine();

    // First, set a valid diagram
    engine.onTextChange(VALID_CLASS_DSL);
    vi.advanceTimersByTime(300);

    expect(onDiagramUpdate).toHaveBeenCalledTimes(1);
    const validDiagram = onDiagramUpdate.mock.calls[0][0] as DiagramData;

    onDiagramUpdate.mockClear();
    onErrors.mockClear();

    // Now send invalid DSL
    engine.onTextChange(INVALID_DSL);
    vi.advanceTimersByTime(300);

    // Diagram update should NOT be called (last valid state preserved)
    expect(onDiagramUpdate).not.toHaveBeenCalled();

    // Errors should be reported
    expect(onErrors).toHaveBeenCalledTimes(1);
    const errors = onErrors.mock.calls[0][0] as DSLError[];
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toHaveProperty('line');
    expect(errors[0]).toHaveProperty('column');
    expect(errors[0]).toHaveProperty('message');

    // Internal diagram should still be the valid one
    const currentDiagram = engine.getDiagram();
    expect(currentDiagram?.name).toBe(validDiagram.name);
  });

  it('errors cleared when valid DSL follows invalid DSL', () => {
    const { engine, onDiagramUpdate, onErrors } = createEngine();

    // Valid → Invalid → Valid
    engine.onTextChange(VALID_CLASS_DSL);
    vi.advanceTimersByTime(300);
    onErrors.mockClear();

    engine.onTextChange(INVALID_DSL);
    vi.advanceTimersByTime(300);
    expect(onErrors).toHaveBeenCalledTimes(1);

    onErrors.mockClear();
    onDiagramUpdate.mockClear();

    engine.onTextChange(VALID_CLASS_DSL);
    vi.advanceTimersByTime(300);

    expect(onDiagramUpdate).toHaveBeenCalledTimes(1);
    expect(onErrors).toHaveBeenCalledWith([]);
  });

  it('sync does not block user input (non-blocking)', () => {
    const { engine, onDiagramUpdate } = createEngine();

    // onTextChange returns immediately (debounced), not blocking
    const start = Date.now();
    engine.onTextChange(VALID_CLASS_DSL);
    const elapsed = Date.now() - start;

    // Should return nearly instantly (debounced)
    expect(elapsed).toBeLessThan(50);
    expect(onDiagramUpdate).not.toHaveBeenCalled(); // Not yet fired

    vi.advanceTimersByTime(300);
    expect(onDiagramUpdate).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Task 10.3: UndoManager Integration
// ---------------------------------------------------------------------------

describe('SyncEngine - Task 10.3: UndoManager Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('text change creates undoable command', () => {
    const undoManager = new UndoManager();
    const { engine, onDiagramUpdate } = createEngine({ undoManager });

    engine.onTextChange(VALID_CLASS_DSL);
    vi.advanceTimersByTime(300);

    expect(undoManager.canUndo()).toBe(true);
    expect(onDiagramUpdate).toHaveBeenCalledTimes(1);
  });

  it('canvas change creates undoable command', () => {
    const undoManager = new UndoManager();
    const { engine, onDiagramUpdate } = createEngine({ undoManager });

    const diagram = makeDiagram({ elements: [makeElement('e1', 'A')] });
    engine.setDiagram(diagram);

    engine.onCanvasChange({
      type: 'element-move',
      elementId: 'e1',
      position: { x: 100, y: 100 },
    });

    expect(undoManager.canUndo()).toBe(true);
    expect(onDiagramUpdate).toHaveBeenCalledTimes(1);
  });

  it('undo after text change restores previous diagram and text', () => {
    const undoManager = new UndoManager();
    const { engine, onDiagramUpdate, onTextUpdate } = createEngine({ undoManager });

    // Set initial diagram
    const initialDiagram = makeDiagram({ elements: [makeElement('e1', 'Original')] });
    engine.setDiagram(initialDiagram);

    // Make a text change
    engine.onTextChange(VALID_CLASS_DSL);
    vi.advanceTimersByTime(300);

    onDiagramUpdate.mockClear();
    onTextUpdate.mockClear();

    // Undo
    undoManager.undo();

    // Should restore the original diagram
    expect(onDiagramUpdate).toHaveBeenCalledTimes(1);
    const restored = onDiagramUpdate.mock.calls[0][0] as DiagramData;
    expect(restored.elements).toHaveLength(1);
    expect(restored.elements[0].properties.name).toBe('Original');

    // Should also update text editor
    expect(onTextUpdate).toHaveBeenCalledTimes(1);
  });

  it('undo after canvas change restores previous state', () => {
    const undoManager = new UndoManager();
    const { engine, onDiagramUpdate, onTextUpdate } = createEngine({ undoManager });

    const diagram = makeDiagram({ elements: [makeElement('e1', 'A')] });
    engine.setDiagram(diagram);

    // Canvas change
    engine.onCanvasChange({
      type: 'element-move',
      elementId: 'e1',
      position: { x: 999, y: 999 },
    });

    onDiagramUpdate.mockClear();
    onTextUpdate.mockClear();

    // Undo
    undoManager.undo();

    expect(onDiagramUpdate).toHaveBeenCalledTimes(1);
    const restored = onDiagramUpdate.mock.calls[0][0] as DiagramData;
    const el = restored.elements.find(e => e.id === 'e1');
    expect(el?.position).toEqual({ x: 0, y: 0 });
  });

  it('redo after undo re-applies the change', () => {
    const undoManager = new UndoManager();
    const { engine, onDiagramUpdate } = createEngine({ undoManager });

    const diagram = makeDiagram({ elements: [makeElement('e1', 'A')] });
    engine.setDiagram(diagram);

    engine.onCanvasChange({
      type: 'element-move',
      elementId: 'e1',
      position: { x: 500, y: 500 },
    });

    undoManager.undo();
    onDiagramUpdate.mockClear();

    undoManager.redo();

    expect(onDiagramUpdate).toHaveBeenCalledTimes(1);
    const redone = onDiagramUpdate.mock.calls[0][0] as DiagramData;
    const el = redone.elements.find(e => e.id === 'e1');
    expect(el?.position).toEqual({ x: 500, y: 500 });
  });

  it('text and canvas changes share unified undo history', () => {
    const undoManager = new UndoManager();
    const { engine, onDiagramUpdate } = createEngine({ undoManager });

    // Text change
    engine.onTextChange(VALID_CLASS_DSL);
    vi.advanceTimersByTime(300);

    // Canvas change on the resulting diagram
    const diagramAfterText = onDiagramUpdate.mock.calls[0][0] as DiagramData;
    engine.setDiagram(diagramAfterText);

    if (diagramAfterText.elements.length > 0) {
      engine.onCanvasChange({
        type: 'element-move',
        elementId: diagramAfterText.elements[0].id,
        position: { x: 42, y: 42 },
      });
    }

    // Should have 2 undoable operations
    expect(undoManager.undoStackSize).toBe(2);

    // Undo canvas change
    undoManager.undo();
    expect(undoManager.undoStackSize).toBe(1);

    // Undo text change
    undoManager.undo();
    expect(undoManager.undoStackSize).toBe(0);
    expect(undoManager.canUndo()).toBe(false);
  });
});
