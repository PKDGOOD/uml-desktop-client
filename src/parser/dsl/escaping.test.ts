import { describe, expect, it } from 'vitest';
import type { DiagramData, DiagramElement } from '../../types';
import { parseCheckedDSL } from '../../engine/diagramRules';
import { SyncEngine } from '../../engine/syncEngine';
import { serializeDSL } from './serializer';

const NAMES = [
  'Order', '주문', '注文', 'Order Item', 'say "hi"', 'back\\slash', 'a/b', 'a // b', '@pos(1, 2)', '{brace}', '--> arrow',
  'tab nbsp', '😀 emoji', 'é combining', 'line sep', 'para sep', '\uD800lone', '  spaced  ', 'class', '<<x>>',
];

function el(id: string, type: DiagramElement['type'], name: string): DiagramElement {
  return { id, type, position: { x: 1, y: 2 }, size: { width: 100, height: 60 }, properties: { name } };
}

function roundTrip(diagram: DiagramData) {
  const text = serializeDSL(diagram);
  const parsed = parseCheckedDSL(text);
  if (!parsed.success) throw new Error(`${JSON.stringify(parsed.errors)}\n${text}`);
  return parsed.diagram;
}

describe('A04.03 DSL string escaping', () => {
  const kinds: Array<[DiagramData['type'], DiagramElement['type'], DiagramElement['type']]> = [
    ['class', 'class', 'interface'],
    ['usecase', 'actor', 'usecase'],
    ['sequence', 'lifeline', 'lifeline'],
    ['activity', 'action', 'decision'],
    ['state', 'state', 'state'],
  ];

  for (const [diagramType, a, b] of kinds) {
    it.each(NAMES)(`${diagramType} diagram: element name %j and a connector survive a round trip`, (name) => {
      const second = name === 'Other' ? 'Other2' : 'Other';
      const diagram: DiagramData = {
        id: 'd', name, type: diagramType, viewport: { x: 0, y: 0, zoom: 1 },
        elements: [el('e1', a, name), el('e2', b, second)],
        connectors: [{
          id: 'c1',
          type: diagramType === 'sequence' ? 'sync-message' : diagramType === 'class' ? 'directed-association'
            : diagramType === 'usecase' ? 'association' : 'transition',
          sourceId: 'e1', targetId: 'e2', ...(diagramType === 'sequence' ? { label: 'go()' } : {}), properties: {},
        }],
      };
      const back = roundTrip(diagram);
      expect(back.name).toBe(name);
      expect(back.elements.map((e) => e.properties.name)).toEqual([name, second]);
      expect(back.connectors).toHaveLength(1);
      expect(back.connectors[0].sourceId).toBe(back.elements[0].id);
      expect(back.connectors[0].targetId).toBe(back.elements[1].id);
    });
  }

  it('keeps labels with quotes, slashes and Unicode', () => {
    const diagram: DiagramData = {
      id: 'd', name: 'D', type: 'sequence', viewport: { x: 0, y: 0, zoom: 1 },
      elements: [el('e1', 'lifeline', 'A'), el('e2', 'lifeline', 'B')],
      connectors: [{ id: 'c', type: 'sync-message', sourceId: 'e1', targetId: 'e2', label: 'say "hi" \\ 주문 😀', properties: {} }],
      };
    expect(roundTrip(diagram).connectors[0].label).toBe('say "hi" \\ 주문 😀');
  });
});

describe('A04.03 unsupported member names fail before serialization', () => {
  const base = (): DiagramData => ({
    id: 'd', name: 'D', type: 'class', viewport: { x: 0, y: 0, zoom: 1 },
    elements: [{ ...el('e1', 'class', 'Order'), properties: { name: 'Order', attributes: [], methods: [] } }],
    connectors: [],
  });

  it.each(['has space', '"quoted"', '', '1st', 'a-b', 'a.b', '주문 항목', 'a\nb'])('refuses attribute name %j without changing text or model', (name) => {
    let text = '';
    let model: DiagramData | null = null;
    const engine = new SyncEngine({ onDiagramUpdate: (d) => { model = d; }, onTextUpdate: (t) => { text = t; }, onErrors: () => {}, debounceMs: 0 });
    engine.setDiagram(base());
    text = serializeDSL(base());
    const before = text;
    const result = engine.applyCanvasChange({
      type: 'element-update', elementId: 'e1',
      properties: { attributes: [{ name, type: 'int', visibility: 'private' }] },
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('rules');
    expect(text).toBe(before);
    expect(model).toBeNull();
    expect(engine.getDiagram()?.elements[0].properties.attributes).toEqual([]);
  });

  it.each(['count', '주문', '_x', 'a1', 'Ünï'])('accepts and round-trips attribute name %j', (name) => {
    const diagram = base();
    diagram.elements[0].properties.attributes = [{ name, type: 'int', visibility: 'private' }];
    expect(roundTrip(diagram).elements[0].properties.attributes?.[0].name).toBe(name);
  });
});
