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

describe('A04.04 in-place property, member and layout patches', () => {
  const SRC = `@class-diagram "D"
// header note
- class Order <<entity>> @pos(40, 40) @size(260, 180) {   // aggregate root
  // identifiers
  - id: String   // internal id
  - total: int   // cents
  + cancel(reason: String): void   // cancels
}

enum Status @pos(400, 40) @size(180, 140) {
  PENDING   // initial
  DONE
}
interface Plain {
}
// tail comment
Order --> Status : has
`;

  function setup(undo?: UndoManager) {
    const ctx = engineWith(SRC, undo);
    ctx.engine.onTextChange(SRC);
    ctx.engine.flushPendingText();
    return { ...ctx, order: idOf(ctx.state.diagram, 'Order'), status: idOf(ctx.state.diagram, 'Status'), plain: idOf(ctx.state.diagram, 'Plain') };
  }
  const update = (ctx: ReturnType<typeof setup>, elementId: string, properties: Record<string, unknown>) =>
    ctx.engine.applyCanvasChange({ type: 'element-update', elementId, properties: properties as never });
  const props = (ctx: ReturnType<typeof setup>, id: string) => ctx.state.diagram!.elements.find((e) => e.id === id)!.properties;

  it('changes the stereotype and the visibility in place (F1)', () => {
    const ctx = setup();
    expect(update(ctx, ctx.order, { stereotype: 'aggregate', visibility: 'protected' })).toEqual({ ok: true });
    expect(ctx.state.text).toBe(SRC.replace('- class Order <<entity>>', '# class Order <<aggregate>>'));
    expect(update(ctx, ctx.order, { stereotype: undefined, visibility: undefined })).toEqual({ ok: true });
    expect(ctx.state.text).toBe(SRC.replace('- class Order <<entity>>', 'class Order'));
    expect(props(ctx, ctx.order).visibility).toBeUndefined();
  });

  it('adds a stereotype and a visibility to a declaration that has none', () => {
    const ctx = setup();
    update(ctx, ctx.plain, { stereotype: 'port', visibility: 'public' });
    expect(ctx.state.text).toBe(SRC.replace('interface Plain {', '+ interface Plain <<port>> {'));
  });

  it('edits one attribute and leaves the other lines and their comments alone', () => {
    const ctx = setup();
    const attributes = [...props(ctx, ctx.order).attributes!];
    attributes[1] = { ...attributes[1], type: 'long', visibility: 'private' };
    update(ctx, ctx.order, { attributes });
    expect(ctx.state.text).toBe(SRC.replace('- total: int', '- total: long'));
  });

  it('adds members before the closing brace and removes a member with its line', () => {
    const ctx = setup();
    const p = props(ctx, ctx.order);
    update(ctx, ctx.order, {
      attributes: [...p.attributes!, { name: 'note', type: 'String', visibility: 'public' }],
      methods: [...p.methods!, { name: 'ship', returnType: 'void', parameters: [{ name: 'to', type: 'String' }], visibility: 'public' }],
    });
    expect(ctx.state.text).toBe(SRC.replace('}\n\nenum', '  + note: String\n  + ship(to: String): void\n}\n\nenum'));
    update(ctx, ctx.order, { attributes: p.attributes!.slice(1), methods: [] });
    expect(ctx.state.text).not.toContain('- id: String');
    expect(ctx.state.text).not.toContain('internal id');
    expect(ctx.state.text).not.toContain('cancel');
    expect(ctx.state.text).toContain('// identifiers');
    expect(ctx.state.text).toContain('- total: int   // cents');
    expect(ctx.state.text).toContain('// aggregate root');
  });

  it('keeps the line and comment of a renamed member, and regenerates when members are reordered', () => {
    const ctx = setup();
    const attributes = [...props(ctx, ctx.order).attributes!];
    attributes[0] = { ...attributes[0], name: 'code' };
    update(ctx, ctx.order, { attributes });
    expect(ctx.state.text).toBe(SRC.replace('- id: String   // internal id', '- code: String   // internal id'));
    const reordered = [...props(ctx, ctx.order).attributes!].reverse();
    expect(update(ctx, ctx.order, { attributes: reordered })).toEqual({ ok: true });
    const parsed = parseDSL(ctx.state.text);
    expect(parsed.success && parsed.diagram.elements[0].properties.attributes?.map((a) => a.name)).toEqual(['total', 'code']);
  });

  it('edits enum values in place', () => {
    const ctx = setup();
    const attributes = [{ ...props(ctx, ctx.status).attributes![0], name: 'OPEN' }, props(ctx, ctx.status).attributes![1], { name: 'LATE', type: '', visibility: 'public' as const }];
    update(ctx, ctx.status, { attributes });
    expect(ctx.state.text).toBe(SRC.replace('PENDING   // initial', 'OPEN   // initial').replace('  DONE\n}', '  DONE\n  LATE\n}'));
  });

  it('moves and resizes by replacing only the annotation', () => {
    const ctx = setup();
    ctx.engine.applyCanvasChange({ type: 'element-move', elementId: ctx.order, position: { x: 120, y: 80 } });
    expect(ctx.state.text).toBe(SRC.replace('@pos(40, 40)', '@pos(120, 80)'));
    ctx.engine.applyCanvasChange({ type: 'element-resize', elementId: ctx.order, size: { width: 300, height: 200 } });
    expect(ctx.state.text).toBe(SRC.replace('@pos(40, 40) @size(260, 180)', '@pos(120, 80) @size(300, 200)'));
  });

  it('inserts @pos and @size where the text has none', () => {
    const ctx = setup();
    ctx.engine.applyCanvasChange({ type: 'element-move', elementId: ctx.plain, position: { x: 7, y: 9 } });
    expect(ctx.state.text).toBe(SRC.replace('interface Plain {', 'interface Plain @pos(7, 9) {'));
    ctx.engine.applyCanvasChange({ type: 'element-resize', elementId: ctx.plain, size: { width: 111, height: 66 } });
    expect(ctx.state.text).toBe(SRC.replace('interface Plain {', 'interface Plain @pos(7, 9) @size(111, 66) {'));
  });

  it('undoes a patch to the exact previous text', () => {
    const undo = new UndoManager();
    const ctx = setup(undo);
    update(ctx, ctx.order, { stereotype: 'x' });
    undo.undo();
    expect(ctx.state.text).toBe(SRC);
  });

  it('keeps the model and the text meaning the same after every patch', () => {
    const ctx = setup();
    update(ctx, ctx.order, { stereotype: 'a' });
    ctx.engine.applyCanvasChange({ type: 'element-move', elementId: ctx.status, position: { x: 1, y: 2 } });
    const reparsed = parseDSL(ctx.state.text);
    expect(reparsed.success && reparsed.diagram.elements.map((e) => [e.properties.name, e.position])).toEqual(
      ctx.state.diagram!.elements.map((e) => [e.properties.name, e.position]));
  });
});

describe('A04.05 in-place connector patches', () => {
  const SRC = `@class-diagram "D"
// start
class Order @pos(40, 40) @size(200, 100) {
}
class Item @pos(300, 40) @size(200, 100) {
}
class Other @pos(560, 40) @size(200, 100) {
}
// relations
Order "1" --* "1..*" Item : contains
// parallel pair
Order --> Item : first
Order --> Item : second
Other ..> Item
`;

  function setup() {
    const ctx = engineWith(SRC);
    ctx.engine.onTextChange(SRC);
    ctx.engine.flushPendingText();
    const d = ctx.state.diagram!;
    return { ...ctx, conn: (label?: string) => d.connectors.find((c) => c.label === label)!, d };
  }
  const update = (ctx: ReturnType<typeof setup>, id: string, changes: Record<string, unknown>) =>
    ctx.engine.applyCanvasChange({ type: 'connector-update', connectorId: id, changes });

  it('changes a label and multiplicities in place, keeping surrounding comments and identity', () => {
    const ctx = setup();
    const main = ctx.conn('contains');
    expect(update(ctx, main.id, { label: 'holds', sourceMultiplicity: '0..1', targetMultiplicity: '*' })).toEqual({ ok: true });
    expect(ctx.state.text).toBe(SRC.replace('"1" --* "1..*" Item : contains', '"0..1" --* "*" Item : holds'));
    expect(ctx.state.diagram!.connectors.find((c) => c.id === main.id)?.label).toBe('holds');
  });

  it('adds and clears a label and a multiplicity', () => {
    const ctx = setup();
    const first = ctx.conn('first');
    update(ctx, first.id, { targetMultiplicity: '2' });
    expect(ctx.state.text).toBe(SRC.replace('Order --> Item : first', 'Order "" --> "2" Item : first'));
    update(ctx, first.id, { label: undefined });
    expect(ctx.state.text).toBe(SRC.replace('Order --> Item : first', 'Order "" --> "2" Item'));
    const dep = ctx.d.connectors.find((c) => c.type === 'dependency')!;
    update(ctx, dep.id, { label: 'uses' });
    expect(ctx.state.text).toBe(SRC.replace('Order --> Item : first', 'Order "" --> "2" Item').replace('Other ..> Item', 'Other ..> Item : uses'));
  });

  it('keeps parallel connections apart when one changes', () => {
    const ctx = setup();
    const second = ctx.conn('second');
    update(ctx, second.id, { label: 'renamed' });
    expect(ctx.state.text).toBe(SRC.replace(': second', ': renamed'));
    expect(ctx.state.diagram!.connectors.map((c) => c.label)).toEqual(['contains', 'first', 'renamed', undefined]);
  });

  it('retargets an endpoint by name', () => {
    const ctx = setup();
    const dep = ctx.d.connectors.find((c) => c.type === 'dependency')!;
    const order = ctx.d.elements.find((e) => e.properties.name === 'Order')!;
    expect(update(ctx, dep.id, { sourceId: order.id })).toEqual({ ok: true });
    expect(ctx.state.text).toBe(SRC.replace('Other ..> Item', 'Order ..> Item'));
  });

  it('refuses an endpoint change that breaks a rule, without touching text or model', () => {
    const ctx = setup();
    const dep = ctx.d.connectors.find((c) => c.type === 'dependency')!;
    const before = ctx.state.text;
    const result = update(ctx, dep.id, { targetId: dep.sourceId });
    expect(result.ok).toBe(false);
    expect(ctx.state.text).toBe(before);
  });

  it('refuses a multiplicity on a relation that cannot carry one', () => {
    const ctx = setup();
    const dep = ctx.d.connectors.find((c) => c.type === 'dependency')!;
    expect(update(ctx, dep.id, { sourceMultiplicity: '1' }).ok).toBe(false);
  });
});

describe('A04.06 in-place insertion and deletion', () => {
  const SRC = `@class-diagram "D"
// first things
class Order @pos(40, 40) @size(200, 100) {   // root
  - id: String
}
class Item @pos(300, 40) @size(200, 100) {
}
// relations
Order --> Item : has   
// trailing note
`;
  const NEW = (id: string, name: string) => ({
    id, type: 'class' as const, position: { x: 9, y: 9 }, size: { width: 200, height: 100 },
    properties: { name, attributes: [], methods: [] },
  });

  function setup() {
    const ctx = engineWith(SRC);
    ctx.engine.onTextChange(SRC);
    ctx.engine.flushPendingText();
    const d = ctx.state.diagram!;
    return { ...ctx, order: idOf(d, 'Order'), item: idOf(d, 'Item') };
  }

  it('adds an element after the last declaration and leaves every comment alone', () => {
    const ctx = setup();
    expect(ctx.engine.applyCanvasChange({ type: 'element-add', element: NEW('n1', 'Invoice') })).toEqual({ ok: true });
    expect(ctx.state.text).toBe(SRC.replace('// relations', 'class Invoice @pos(9, 9) @size(200, 100) {\n}\n// relations'));
    expect(idOf(ctx.state.diagram, 'Invoice')).toBe('n1');
  });

  it('adds a connector after the last connector line', () => {
    const ctx = setup();
    ctx.engine.applyCanvasChange({ type: 'element-add', element: NEW('n1', 'Invoice') });
    const invoice = idOf(ctx.state.diagram, 'Invoice');
    expect(ctx.engine.applyCanvasChange({
      type: 'connector-add',
      connector: { id: 'c9', type: 'directed-association', sourceId: ctx.order, targetId: invoice, label: 'bills', properties: {} },
    })).toEqual({ ok: true });
    expect(ctx.state.text).toContain('Order --> Item : has   \nOrder "" --> Invoice : bills\n// trailing note');
  });

  it('deletes a connector with its line only', () => {
    const ctx = setup();
    const conn = ctx.state.diagram!.connectors[0];
    expect(ctx.engine.applyCanvasChange({ type: 'connector-delete', connectorId: conn.id })).toEqual({ ok: true });
    expect(ctx.state.text).toBe(SRC.replace('Order --> Item : has   \n', ''));
  });

  it('deletes an element with its lines and the connectors that name it', () => {
    const ctx = setup();
    expect(ctx.engine.applyCanvasChange({ type: 'element-delete', elementId: ctx.item })).toEqual({ ok: true });
    expect(ctx.state.text).toBe(SRC.replace('class Item @pos(300, 40) @size(200, 100) {\n}\n', '').replace('Order --> Item : has   \n', ''));
    expect(ctx.state.diagram!.elements.map((e) => e.properties.name)).toEqual(['Order']);
  });

  it('adds the first element to an empty diagram and survives a missing final newline', () => {
    const ctx = engineWith('@class-diagram "E"');
    ctx.engine.onTextChange('@class-diagram "E"');
    ctx.engine.flushPendingText();
    expect(ctx.engine.applyCanvasChange({ type: 'element-add', element: NEW('n1', 'A') })).toEqual({ ok: true });
    expect(ctx.state.text).toBe('@class-diagram "E"\nclass A @pos(9, 9) @size(200, 100) {\n}\n');
  });

  it('undoes an insertion and a deletion to the exact previous text', () => {
    const undo = new UndoManager();
    const ctx = engineWith(SRC, undo);
    ctx.engine.onTextChange(SRC);
    ctx.engine.flushPendingText();
    const before = ctx.state.text;
    ctx.engine.applyCanvasChange({ type: 'element-add', element: NEW('n1', 'Invoice') });
    undo.undo();
    expect(ctx.state.text).toBe(before);
    ctx.engine.applyCanvasChange({ type: 'element-delete', elementId: idOf(ctx.state.diagram, 'Item') });
    undo.undo();
    expect(ctx.state.text).toBe(before);
  });

  it('refuses a duplicate name on add without touching text or model', () => {
    const ctx = setup();
    const before = ctx.state.text;
    expect(ctx.engine.applyCanvasChange({ type: 'element-add', element: NEW('n1', 'Order') }).ok).toBe(false);
    expect(ctx.state.text).toBe(before);
  });

  it('deletes only the selected item when several share a line', () => {
    const text = '@class-diagram "D"\nclass A {\n}\nclass B {\n}\nA ..> B   B ..> A // both\n';
    const ctx = engineWith(text);
    ctx.engine.onTextChange(text);
    ctx.engine.flushPendingText();
    const first = ctx.state.diagram!.connectors[0];
    expect(ctx.engine.applyCanvasChange({ type: 'connector-delete', connectorId: first.id })).toEqual({ ok: true });
    expect(ctx.state.text).toBe('@class-diagram "D"\nclass A {\n}\nclass B {\n}\nB ..> A // both\n');
    expect(ctx.state.diagram!.connectors).toHaveLength(1);
  });

  it('writes a new transition after the last top-level declaration, not inside a composite state', () => {
    const text = '@state-diagram "S"\ncomposite-state C {\n  state A\n  state B\n  A --> B\n}\nstate Z\n';
    const ctx = engineWith(text);
    ctx.engine.onTextChange(text);
    ctx.engine.flushPendingText();
    const d = ctx.state.diagram!;
    const z = idOf(d, 'Z');
    const c = idOf(d, 'C');
    expect(ctx.engine.applyCanvasChange({
      type: 'connector-add', connector: { id: 'cz', type: 'transition', sourceId: z, targetId: c, properties: {} },
    })).toEqual({ ok: true });
    expect(ctx.state.text).toBe(`${text}Z --> C\n`);
  });
});
