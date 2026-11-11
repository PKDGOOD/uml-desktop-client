import { describe, expect, it, vi } from 'vitest';
import type { DiagramData } from '../types';
import { parseDSL } from '../parser/dsl';
import { SyncEngine } from './syncEngine';
import { UndoManager } from './undoManager';
import { applyTextEdits, renameElementInText } from './textEdits';

const TEXT = `@class-diagram "D"
// keep this header comment
class Order @pos(40, 40) @size(260, 180) {   // aggregate root
  - id: String   // internal
}

class Customer @pos(380, 40) @size(200, 120) {
}
// keep this comment
Customer "1" --> "*" Order : places
Order --> Customer : belongs to
`;

function engineWith(text: string, undoManager?: UndoManager) {
  const state = { text, diagram: null as DiagramData | null };
  const engine = new SyncEngine({
    onDiagramUpdate: (d) => { state.diagram = d; },
    onTextUpdate: (t) => { state.text = t; },
    onErrors: vi.fn(),
    undoManager,
    debounceMs: 0,
  });
  const parsed = parseDSL(text);
  if (!parsed.success) throw new Error('bad fixture');
  engine.setDiagram(parsed.diagram);
  state.diagram = engine.getDiagram();
  return { engine, state };
}

const idOf = (d: DiagramData | null, name: string) => d!.elements.find((e) => e.properties.name === name)!.id;

describe('A04.02 targeted rename', () => {
  it('applies edits only to the given spans and rejects overlaps', () => {
    expect(applyTextEdits('abcdef', [{ span: { start: 4, end: 6 }, text: 'Z' }, { span: { start: 0, end: 1 }, text: 'XY' }])).toBe('XYbcdZ');
    expect(() => applyTextEdits('abcdef', [{ span: { start: 0, end: 3 }, text: '' }, { span: { start: 2, end: 4 }, text: '' }])).toThrow();
  });

  it('renames the declaration and every endpoint, leaving all else byte for byte', () => {
    const { engine, state } = engineWith(TEXT);
    // The engine needs the text it was given; serialization would drop the comments.
    engine.onTextChange(TEXT);
    engine.flushPendingText();
    const before = state.diagram!;
    const orderId = idOf(before, 'Order');

    expect(engine.applyCanvasChange({ type: 'element-update', elementId: orderId, properties: { name: '구매 주문' } })).toEqual({ ok: true });

    expect(state.text).toBe(TEXT
      .replace('class Order @pos', 'class "구매 주문" @pos')
      .replace('"*" Order : places', '"*" "구매 주문" : places')
      .replace('Order --> Customer', '"구매 주문" --> Customer'));
    // Identity and references survive: same ID, both connectors still point at it.
    expect(idOf(state.diagram, '구매 주문')).toBe(orderId);
    expect(state.diagram!.connectors.every((c) => c.sourceId === orderId || c.targetId === orderId)).toBe(true);
    const reparsed = parseDSL(state.text);
    expect(reparsed.success && reparsed.diagram.connectors.length).toBe(2);
  });

  it('keeps ID, model-only data and the edit undoable to the exact old text', () => {
    const undo = new UndoManager();
    const { engine, state } = engineWith(TEXT, undo);
    engine.onTextChange(TEXT);
    engine.flushPendingText();
    const orderId = idOf(state.diagram, 'Order');
    engine.applyCanvasChange({ type: 'connector-waypoint', connectorId: state.diagram!.connectors[0].id, waypoints: [{ x: 5, y: 6 }] });
    const afterWaypoint = state.text;

    engine.applyCanvasChange({ type: 'element-update', elementId: orderId, properties: { name: 'PurchaseOrder' } });
    expect(state.text).toContain('class PurchaseOrder @pos');
    expect(state.diagram!.connectors[0].waypoints).toEqual([{ x: 5, y: 6 }]);

    undo.undo();
    expect(state.text).toBe(afterWaypoint);
    expect(idOf(state.diagram, 'Order')).toBe(orderId);
  });

  it('falls back to regenerated text when the patched text would not match the model', () => {
    const { engine, state } = engineWith(TEXT);
    engine.onTextChange(TEXT);
    engine.flushPendingText();
    const orderId = idOf(state.diagram, 'Order');
    // A rename together with another change cannot be a pure token edit.
    engine.applyCanvasChange({ type: 'element-update', elementId: orderId, properties: { name: 'Sale', stereotype: 'entity' } });
    expect(state.text).toContain('class Sale <<entity>>');
    expect(idOf(state.diagram, 'Sale')).toBe(orderId);
  });

  it('refuses a rename onto an existing name without touching text or model', () => {
    const { engine, state } = engineWith(TEXT);
    engine.onTextChange(TEXT);
    engine.flushPendingText();
    const textBefore = state.text;
    const result = engine.applyCanvasChange({ type: 'element-update', elementId: idOf(state.diagram, 'Order'), properties: { name: 'Customer' } });
    expect(result.ok).toBe(false);
    expect(state.text).toBe(textBefore);
    expect(state.diagram!.elements.map((e) => e.properties.name)).toEqual(['Order', 'Customer']);
  });

  it('returns null when text and model cannot be mapped', () => {
    const { state } = engineWith(TEXT);
    expect(renameElementInText('class {{{', state.diagram!, state.diagram!.elements[0].id, 'X')).toBeNull();
    expect(renameElementInText(TEXT, state.diagram!, 'missing', 'X')).toBeNull();
    const other = { ...state.diagram!, elements: state.diagram!.elements.slice(1) };
    expect(renameElementInText(TEXT, other, other.elements[0].id, 'X')).toBeNull();
  });

  it('a rename typed in the text editor is a new element and the old name is diagnosed', () => {
    const { engine, state } = engineWith(TEXT);
    const orderId = idOf(state.diagram, 'Order');
    const errors: unknown[] = [];
    const eng = new SyncEngine({ onDiagramUpdate: (d) => { state.diagram = d; }, onTextUpdate: () => {}, onErrors: (e) => errors.push(...e), debounceMs: 0 });
    eng.setDiagram(engine.getDiagram()!);
    eng.onTextChange(TEXT.replace('class Order @pos', 'class Sale @pos'));
    eng.flushPendingText();
    expect(JSON.stringify(errors)).toMatch(/Unknown element \\"Order\\".*Rename in the inspector/);
    expect(idOf(eng.getDiagram(), 'Customer')).toBeDefined();
    expect(eng.getDiagram()!.elements.some((e) => e.id === orderId)).toBe(true);
  });
});
