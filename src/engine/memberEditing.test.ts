import { describe, expect, it, vi } from 'vitest';
import type { DiagramData, Method } from '../types';
import { parseDSL } from '../parser/dsl';
import { serializeDSL } from '../parser/dsl/serializer';
import { SyncEngine } from './syncEngine';
import { UndoManager } from './undoManager';

const SRC = `@class-diagram "D"
class Order @pos(40, 40) @size(260, 200) {
  - id: String
  - total: int
  + place(customer: String, note: String): void
  # audit(): bool
}
enum Status @pos(400, 40) @size(160, 120) {
  NEW
  PAID
}
`;

function setup() {
  const state = { text: SRC, diagram: null as DiagramData | null };
  const history = new UndoManager();
  const engine = new SyncEngine({
    onDiagramUpdate: (d) => { state.diagram = d; },
    onTextUpdate: (t) => { state.text = t; },
    onErrors: vi.fn(),
    undoManager: history,
    debounceMs: 0,
  });
  const parsed = parseDSL(SRC);
  if (!parsed.success) throw new Error('fixture');
  engine.setDiagram(parsed.diagram, SRC);
  state.diagram = engine.getDiagram();
  const byName = (name: string) => state.diagram!.elements.find((e) => e.properties.name === name)!;
  return { engine, state, history, byName };
}

const reopen = (diagram: DiagramData) => {
  const parsed = parseDSL(serializeDSL(diagram));
  if (!parsed.success) throw new Error('reopen failed');
  return parsed.diagram;
};

describe('A05.03 class member editing round trips', () => {
  it('adds, edits and removes parameters and changes visibility without losing a signature', () => {
    const { engine, state, byName } = setup();
    const order = byName('Order');
    const methods: Method[] = structuredClone(order.properties.methods!);
    methods[0].parameters = [{ name: 'customer', type: 'Customer' }, { name: 'qty', type: 'int' }];
    methods[0].visibility = 'protected';
    methods[1].parameters = [{ name: 'by', type: 'String' }];
    expect(engine.applyCanvasChange({ type: 'element-update', elementId: order.id, properties: { methods } })).toEqual({ ok: true });
    expect(state.text).toContain('# place(customer: Customer, qty: int): void');
    expect(state.text).toContain('# audit(by: String): bool');
    expect(state.text).toContain("  - id: String");
    const back = reopen(state.diagram!);
    expect(back.elements.find((e) => e.properties.name === 'Order')!.properties.methods).toEqual(methods.map((m) => ({ ...m })));
  });

  it('reorders attributes and methods in the text and the model together', () => {
    const { engine, state, byName } = setup();
    const order = byName('Order');
    const attributes = [...order.properties.attributes!].reverse();
    const methods = [...order.properties.methods!].reverse();
    expect(engine.applyCanvasChange({ type: 'element-update', elementId: order.id, properties: { attributes, methods } })).toEqual({ ok: true });
    expect(state.text.indexOf('- total: int')).toBeLessThan(state.text.indexOf('- id: String'));
    expect(state.text.indexOf('# audit()')).toBeLessThan(state.text.indexOf('+ place('));
    const names = reopen(state.diagram!).elements.find((e) => e.properties.name === 'Order')!.properties;
    expect(names.attributes!.map((a) => a.name)).toEqual(['total', 'id']);
    expect(names.methods!.map((m) => m.name)).toEqual(['audit', 'place']);
  });

  it('edits enum values and keeps the order', () => {
    const { engine, state, byName } = setup();
    const status = byName('Status');
    const attributes = [{ ...status.properties.attributes![1] }, { ...status.properties.attributes![0], name: 'CREATED' }];
    engine.applyCanvasChange({ type: 'element-update', elementId: status.id, properties: { attributes } });
    const back = reopen(state.diagram!).elements.find((e) => e.properties.name === 'Status')!;
    expect(back.properties.attributes!.map((a) => a.name)).toEqual(['PAID', 'CREATED']);
  });

  it('undo restores the earlier signature and text', () => {
    const { engine, state, history, byName } = setup();
    const order = byName('Order');
    const methods = structuredClone(order.properties.methods!);
    methods[0].parameters = [];
    engine.applyCanvasChange({ type: 'element-update', elementId: order.id, properties: { methods } });
    expect(state.text).toContain('+ place(): void');
    history.undo();
    expect(state.text).toBe(SRC);
    expect(byName('Order').properties.methods![0].parameters).toHaveLength(2);
  });

  it('refuses a member name the DSL cannot write and changes nothing', () => {
    const { engine, state, byName } = setup();
    const order = byName('Order');
    const attributes = structuredClone(order.properties.attributes!);
    attributes[0].name = 'not valid';
    const result = engine.applyCanvasChange({ type: 'element-update', elementId: order.id, properties: { attributes } });
    expect(result.ok).toBe(false);
    expect(state.text).toBe(SRC);
    expect(byName('Order').properties.attributes![0].name).toBe('id');
  });
});

describe('A05.03 member types in the grammar', () => {
  const members = (text: string) => {
    const parsed = parseDSL(`@class-diagram "D"\nclass C {\n${text}\n}\n`);
    if (!parsed.success) throw new Error(JSON.stringify(parsed.errors));
    return parsed.diagram.elements[0].properties;
  };

  it('reads methods with several parameters', () => {
    const { methods } = members('  + move(x: int, y: int, label: String): void');
    expect(methods![0].parameters).toEqual([{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }, { name: 'label', type: 'String' }]);
  });

  it('keeps commas inside generic types but splits parameters outside them', () => {
    const { methods, attributes } = members('  + put(key: String, value: Map<String, List<int>>): Map<String, int>\n  - cache: Map<String, int>');
    expect(methods![0].parameters).toEqual([{ name: 'key', type: 'String' }, { name: 'value', type: 'Map<String, List<int>>' }]);
    expect(methods![0].returnType).toBe('Map<String, int>');
    expect(attributes![0].type).toBe('Map<String, int>');
  });

  it('round-trips a multi-parameter signature through the serializer', () => {
    const before = members('  + put(key: String, value: Map<String, int>): void');
    const text = serializeDSL({ id: 'x', name: 'D', type: 'class', viewport: { x: 0, y: 0, zoom: 1 }, connectors: [],
      elements: [{ id: 'e', type: 'class', position: { x: 0, y: 0 }, size: { width: 100, height: 100 }, properties: before }] });
    expect(members(text.split('\n').filter((l) => l.startsWith('  ')).join('\n')).methods).toEqual(before.methods);
  });
});
