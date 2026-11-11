import { describe, expect, it, vi } from 'vitest';
import type { DiagramData } from '../types';
import { parseCheckedDSL } from './diagramRules';
import { parseDSL } from '../parser/dsl';
import { serializeDSL } from '../parser/dsl/serializer';
import { SyncEngine } from './syncEngine';

const SRC = `@sequence-diagram "Checkout"
lifeline Client
lifeline Order
lifeline Payment

Client -> Order : place   // first
Order ->> Payment : charge
Payment <-- Order : receipt
Order -> Client : confirm
`;

function setup(text = SRC) {
  const state = { text, diagram: null as DiagramData | null };
  const engine = new SyncEngine({
    onDiagramUpdate: (d) => { state.diagram = d; },
    onTextUpdate: (t) => { state.text = t; },
    onErrors: vi.fn(),
    debounceMs: 0,
  });
  const parsed = parseDSL(text);
  if (!parsed.success) throw new Error('bad fixture');
  engine.setDiagram(parsed.diagram);
  state.diagram = engine.getDiagram();
  return { engine, state };
}

const labels = (d: DiagramData) => [...d.connectors].sort((a, b) => a.messageOrder! - b.messageOrder!).map((c) => c.label);

describe('A04.08 message order', () => {
  it('numbers parsed messages 1..n in text order', () => {
    const parsed = parseDSL(SRC);
    if (!parsed.success) throw new Error('parse');
    expect(parsed.diagram.connectors.map((c) => c.messageOrder)).toEqual([1, 2, 3, 4]);
  });

  it('writes messages in messageOrder, not array order', () => {
    const parsed = parseDSL(SRC);
    if (!parsed.success) throw new Error('parse');
    const d = parsed.diagram;
    d.connectors = [d.connectors[3], d.connectors[1], d.connectors[0], d.connectors[2]];
    const again = parseDSL(serializeDSL(d));
    if (!again.success) throw new Error('parse');
    expect(again.diagram.connectors.map((c) => c.label)).toEqual(['place   // first', 'charge', 'receipt', 'confirm']);
  });

  it('moves one message line in place, keeping its comment, id and label', () => {
    const { engine, state } = setup();
    engine.onTextChange(SRC);
    engine.flushPendingText();
    const before = state.diagram!;
    const confirm = before.connectors.find((c) => c.label === 'confirm')!;
    expect(engine.applyCanvasChange({ type: 'connector-update', connectorId: confirm.id, changes: { messageOrder: 1 } })).toEqual({ ok: true });
    expect(state.text).toBe(SRC.replace('Order -> Client : confirm\n', '').replace('Client -> Order : place', 'Order -> Client : confirm\nClient -> Order : place'));
    expect(labels(state.diagram!)).toEqual(['confirm', 'place   // first', 'charge', 'receipt']);
    expect(state.diagram!.connectors.find((c) => c.label === 'confirm')!.id).toBe(confirm.id);
    expect(state.diagram!.connectors.map((c) => c.messageOrder).sort()).toEqual([1, 2, 3, 4]);
  });

  it('moves a message down to the end and clamps out-of-range positions', () => {
    const { engine, state } = setup();
    engine.onTextChange(SRC);
    engine.flushPendingText();
    const place = state.diagram!.connectors.find((c) => c.label?.startsWith('place'))!;
    expect(engine.applyCanvasChange({ type: 'connector-update', connectorId: place.id, changes: { messageOrder: 99 } })).toEqual({ ok: true });
    expect(state.text).toBe(SRC.replace('Client -> Order : place   // first\n', '') + 'Client -> Order : place   // first\n');
    const parsed = parseCheckedDSL(state.text);
    expect(parsed.success && parsed.diagram.connectors.map((c) => c.label)).toEqual(['charge', 'receipt', 'confirm', 'place   // first']);
  });

  it('renumbers after a message is deleted', () => {
    const { engine, state } = setup();
    engine.onTextChange(SRC);
    engine.flushPendingText();
    const charge = state.diagram!.connectors.find((c) => c.label === 'charge')!;
    engine.applyCanvasChange({ type: 'connector-delete', connectorId: charge.id });
    expect(state.diagram!.connectors.map((c) => c.messageOrder).sort()).toEqual([1, 2, 3]);
    expect(labels(state.diagram!)).toEqual(['place   // first', 'receipt', 'confirm']);
  });

  it('inserts an added message at its order and shifts the rest', () => {
    const { engine, state } = setup();
    engine.onTextChange(SRC);
    engine.flushPendingText();
    const d = state.diagram!;
    const [client, order] = [d.elements[0], d.elements[1]];
    engine.applyCanvasChange({
      type: 'connector-add',
      connector: { id: 'new', type: 'sync-message', sourceId: order.id, targetId: client.id, label: 'ping', messageOrder: 2, properties: {} },
    });
    expect(labels(state.diagram!)).toEqual(['place   // first', 'ping', 'charge', 'receipt', 'confirm']);
    const parsed = parseCheckedDSL(state.text);
    expect(parsed.success && parsed.diagram.connectors.map((c) => c.label)).toEqual(['place   // first', 'ping', 'charge', 'receipt', 'confirm']);
  });
});
