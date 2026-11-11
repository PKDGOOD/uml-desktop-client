import { describe, expect, it } from 'vitest';
import type { DiagramData, DiagramElement } from '../../types';
import { parseCheckedDSL } from '../../engine/diagramRules';
import { serializeDSL } from './serializer';

const el = (id: string, type: DiagramElement['type'], name: string, parentId?: string): DiagramElement => ({
  id, type, position: { x: 1, y: 2 }, size: { width: 100, height: 60 }, properties: { name }, ...(parentId ? { parentId } : {}),
});

const parentsByName = (d: DiagramData) => Object.fromEntries(d.elements.map((e) => [
  e.properties.name, d.elements.find((p) => p.id === e.parentId)?.properties.name ?? null,
]));

function roundTrip(d: DiagramData): DiagramData {
  const parsed = parseCheckedDSL(serializeDSL(d));
  if (!parsed.success) throw new Error(`${JSON.stringify(parsed.errors)}\n${serializeDSL(d)}`);
  return parsed.diagram;
}

const state = (elements: DiagramElement[], connectors: DiagramData['connectors'] = []): DiagramData => (
  { id: 'd', name: 'S', type: 'state', viewport: { x: 0, y: 0, zoom: 1 }, elements, connectors }
);

describe('A04.07 explicit containment round trip', () => {
  const full = [
    el('c1', 'composite-state', 'Active'), el('a', 'state', 'Idle', 'c1'), el('b', 'state', 'Busy', 'c1'),
    el('out', 'state', 'Outside'), el('c2', 'composite-state', 'Error'), el('e', 'state', 'Fatal', 'c2'),
  ];
  const expected = { Active: null, Idle: 'Active', Busy: 'Active', Outside: null, Error: null, Fatal: 'Error' };

  it('keeps every parent when the array lists children first, last or interleaved', () => {
    const orders = [full, [...full].reverse(), [full[1], full[3], full[0], full[5], full[2], full[4]]];
    for (const elements of orders) {
      expect(parentsByName(roundTrip(state(elements)))).toEqual(expected);
    }
  });

  it('does not move an element into a container because it sits next to it in the array', () => {
    const d = state([el('c', 'composite-state', 'Box'), el('x', 'state', 'Stray'), el('y', 'state', 'Also')]);
    expect(parentsByName(roundTrip(d))).toEqual({ Box: null, Stray: null, Also: null });
  });

  it('keeps transitions inside a container and across it', () => {
    const d = state(full, [
      { id: 't1', type: 'transition', sourceId: 'a', targetId: 'b', label: 'go', properties: {} },
      { id: 't2', type: 'transition', sourceId: 'b', targetId: 'out', properties: {} },
    ]);
    const back = roundTrip(d);
    expect(back.connectors.map((c) => [c.label, back.elements.find((e) => e.id === c.sourceId)?.properties.name,
      back.elements.find((e) => e.id === c.targetId)?.properties.name])).toEqual([
      ['go', 'Idle', 'Busy'], [undefined, 'Busy', 'Outside']]);
  });

  it('keeps a composite state inside a composite state, to the depth the file format allows', () => {
    const d = state([
      el('o', 'composite-state', 'Outer'), el('m', 'composite-state', 'Middle', 'o'),
      el('i', 'composite-state', 'Inner', 'm'), el('leaf', 'state', 'Leaf', 'i'), el('top', 'state', 'Top', 'o'),
    ]);
    expect(parentsByName(roundTrip(d))).toEqual({ Outer: null, Middle: 'Outer', Inner: 'Middle', Leaf: 'Inner', Top: 'Outer' });
  });

  it('keeps use cases in their own boundary, in any array order', () => {
    const elements = [
      el('u3', 'usecase', 'Free'), el('b2', 'system-boundary', 'Back'), el('u2', 'usecase', 'Audit', 'b2'),
      el('u1', 'usecase', 'Order', 'b1'), el('b1', 'system-boundary', 'Shop'), el('actor', 'actor', 'Customer'),
    ];
    const d: DiagramData = { id: 'd', name: 'U', type: 'usecase', viewport: { x: 0, y: 0, zoom: 1 }, elements, connectors: [] };
    const expectedUc = { Free: null, Back: null, Audit: 'Back', Order: 'Shop', Shop: null, Customer: null };
    expect(parentsByName(roundTrip(d))).toEqual(expectedUc);
    expect(parentsByName(roundTrip({ ...d, elements: [...elements].reverse() }))).toEqual(expectedUc);
  });
});

describe('A04.07 hand-written nesting', () => {
  it('reads nested blocks, with a transition inside the inner block', () => {
    const parsed = parseCheckedDSL(`@state-diagram "S"
composite-state Outer {
  state Top
  composite-state Inner {
    state Leaf
    state Other
    Leaf --> Other : next
  }
}
state Free
Free --> Top
`);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parentsByName(parsed.diagram)).toEqual({ Outer: null, Top: 'Outer', Inner: 'Outer', Leaf: 'Inner', Other: 'Inner', Free: null });
    expect(parsed.diagram.connectors).toHaveLength(2);
    const again = roundTrip(parsed.diagram);
    expect(parentsByName(again)).toEqual(parentsByName(parsed.diagram));
  });
});

describe('A04.07 canvas changes cannot silently reparent', () => {
  it('refuses an added element whose parent the DSL cannot express, leaving text and model alone', async () => {
    const { SyncEngine } = await import('../../engine/syncEngine');
    let text = '';
    const engine = new SyncEngine({ onDiagramUpdate: () => {}, onTextUpdate: (t) => { text = t; }, onErrors: () => {}, debounceMs: 0 });
    const d = state([el('s', 'state', 'Plain')]);
    engine.setDiagram(d);
    text = serializeDSL(d);
    const before = text;
    // A state cannot contain a state; writing it would drop the parent without telling anyone.
    const result = engine.applyCanvasChange({ type: 'element-add', element: el('k', 'state', 'Kid', 's') });
    expect(result.ok).toBe(false);
    expect(text).toBe(before);
    expect(engine.getDiagram()?.elements).toHaveLength(1);
  });

  it('accepts an added child of a composite state and writes it inside the block', async () => {
    const { SyncEngine } = await import('../../engine/syncEngine');
    let text = '';
    const engine = new SyncEngine({ onDiagramUpdate: () => {}, onTextUpdate: (t) => { text = t; }, onErrors: () => {}, debounceMs: 0 });
    const d = state([el('c', 'composite-state', 'Box')]);
    engine.setDiagram(d);
    expect(engine.applyCanvasChange({ type: 'element-add', element: el('k', 'state', 'Kid', 'c') })).toEqual({ ok: true });
    expect(text).toContain('composite-state Box');
    expect(parentsByName(roundTrip(engine.getDiagram()!))).toEqual({ Box: null, Kid: 'Box' });
    expect(text.indexOf('state Kid')).toBeGreaterThan(text.indexOf('composite-state Box'));
    expect(text.indexOf('state Kid')).toBeLessThan(text.indexOf('}'));
  });
});
