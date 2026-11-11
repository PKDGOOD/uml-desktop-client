import { describe, it, expect, beforeEach } from 'vitest';
import { serializeDSL } from './serializer';
import { parseDSL, resetParser } from './peggyParser';
import type { DiagramData, DiagramElement, Connector } from '../../types';

beforeEach(() => {
  resetParser();
});

// Helper to create a minimal DiagramData
function makeDiagram(
  overrides: Partial<DiagramData> & Pick<DiagramData, 'type' | 'name'>,
): DiagramData {
  return {
    id: 'diag_1',
    elements: [],
    connectors: [],
    viewport: { x: 0, y: 0, zoom: 1.0 },
    ...overrides,
  };
}

function makeElement(overrides: Partial<DiagramElement> & Pick<DiagramElement, 'type'>): DiagramElement {
  return {
    id: 'el_' + Math.random().toString(36).slice(2, 6),
    position: { x: 100, y: 200 },
    size: { width: 200, height: 150 },
    properties: { name: 'Unnamed' },
    ...overrides,
  };
}

// =============================================================================
// Class Diagram Serialization
// =============================================================================

describe('serializeDSL - class diagram', () => {
  it('serializes a class with attributes and methods', () => {
    const diagram = makeDiagram({
      type: 'class',
      name: '주문 시스템',
      elements: [
        makeElement({
          id: 'el_1',
          type: 'class',
          properties: {
            name: 'Order',
            attributes: [
              { name: 'id', type: 'string', visibility: 'private' },
              { name: 'items', type: 'OrderItem[]', visibility: 'private' },
            ],
            methods: [
              { name: 'addItem', returnType: 'void', parameters: [{ name: 'item', type: 'OrderItem' }], visibility: 'public' },
              { name: 'calculateTotal', returnType: 'number', parameters: [], visibility: 'public' },
            ],
          },
        }),
      ],
    });

    const dsl = serializeDSL(diagram);
    expect(dsl).toContain('@class-diagram "주문 시스템"');
    expect(dsl).toContain('class Order');
    expect(dsl).toContain('- id: string');
    expect(dsl).toContain('+ addItem(item: OrderItem): void');
    expect(dsl).toContain('+ calculateTotal(): number');
  });

  it('serializes interface, abstract class, and enum', () => {
    const diagram = makeDiagram({
      type: 'class',
      name: 'Types',
      elements: [
        makeElement({
          id: 'el_1',
          type: 'interface',
          properties: {
            name: 'Printable',
            attributes: [],
            methods: [{ name: 'print', returnType: 'void', parameters: [], visibility: 'public' }],
          },
        }),
        makeElement({
          id: 'el_2',
          type: 'abstract-class',
          properties: {
            name: 'Shape',
            attributes: [{ name: 'color', type: 'string', visibility: 'protected' }],
            methods: [{ name: 'draw', returnType: 'void', parameters: [], visibility: 'public' }],
          },
        }),
        makeElement({
          id: 'el_3',
          type: 'enum',
          properties: {
            name: 'Color',
            attributes: [
              { name: 'RED', type: '', visibility: 'public' },
              { name: 'GREEN', type: '', visibility: 'public' },
              { name: 'BLUE', type: '', visibility: 'public' },
            ],
            methods: [],
          },
        }),
      ],
    });

    const dsl = serializeDSL(diagram);
    expect(dsl).toContain('interface Printable');
    expect(dsl).toContain('abstract class Shape');
    expect(dsl).toContain('# color: string');
    expect(dsl).toContain('enum Color');
    expect(dsl).toContain('  RED');
    expect(dsl).toContain('  GREEN');
  });

  it('serializes relationships with multiplicities and labels', () => {
    const diagram = makeDiagram({
      type: 'class',
      name: 'Relations',
      elements: [
        makeElement({ id: 'el_1', type: 'class', properties: { name: 'Order', attributes: [{ name: 'id', type: 'string', visibility: 'private' }], methods: [] } }),
        makeElement({ id: 'el_2', type: 'class', properties: { name: 'OrderItem', attributes: [{ name: 'qty', type: 'number', visibility: 'private' }], methods: [] } }),
      ],
      connectors: [
        {
          id: 'conn_1',
          type: 'directed-association',
          sourceId: 'el_1',
          targetId: 'el_2',
          sourceMultiplicity: '1',
          targetMultiplicity: '*',
          label: 'contains',
          properties: {},
        },
      ],
    });

    const dsl = serializeDSL(diagram);
    expect(dsl).toContain('Order "1" --> "*" OrderItem : contains');
  });

  it('serializes inheritance and realization', () => {
    const diagram = makeDiagram({
      type: 'class',
      name: 'Hierarchy',
      elements: [
        makeElement({ id: 'el_1', type: 'class', properties: { name: 'Dog', attributes: [], methods: [] } }),
        makeElement({ id: 'el_2', type: 'class', properties: { name: 'Animal', attributes: [], methods: [] } }),
        makeElement({ id: 'el_3', type: 'class', properties: { name: 'MyClass', attributes: [], methods: [] } }),
        makeElement({ id: 'el_4', type: 'interface', properties: { name: 'MyInterface', attributes: [], methods: [] } }),
      ],
      connectors: [
        { id: 'c1', type: 'inheritance', sourceId: 'el_1', targetId: 'el_2', properties: {} },
        { id: 'c2', type: 'realization', sourceId: 'el_3', targetId: 'el_4', properties: {} },
      ],
    });

    const dsl = serializeDSL(diagram);
    expect(dsl).toContain('Dog --|> Animal');
    expect(dsl).toContain('MyClass ..|> MyInterface');
  });

  it('serializes aggregation and composition', () => {
    const diagram = makeDiagram({
      type: 'class',
      name: 'Agg',
      elements: [
        makeElement({ id: 'a', type: 'class', properties: { name: 'A', attributes: [{ name: 'x', type: 'int', visibility: 'public' }], methods: [] } }),
        makeElement({ id: 'b', type: 'class', properties: { name: 'B', attributes: [{ name: 'y', type: 'int', visibility: 'public' }], methods: [] } }),
        makeElement({ id: 'c', type: 'class', properties: { name: 'C', attributes: [{ name: 'z', type: 'int', visibility: 'public' }], methods: [] } }),
      ],
      connectors: [
        { id: 'c1', type: 'aggregation', sourceId: 'a', targetId: 'b', properties: {} },
        { id: 'c2', type: 'composition', sourceId: 'a', targetId: 'c', properties: {} },
      ],
    });

    const dsl = serializeDSL(diagram);
    expect(dsl).toContain('A --o B');
    expect(dsl).toContain('A --* C');
  });
});

// =============================================================================
// Sequence Diagram Serialization
// =============================================================================

describe('serializeDSL - sequence diagram', () => {
  it('serializes lifelines and messages', () => {
    const diagram = makeDiagram({
      type: 'sequence',
      name: 'Login Flow',
      elements: [
        makeElement({ id: 'el_1', type: 'lifeline', properties: { name: 'User' } }),
        makeElement({ id: 'el_2', type: 'lifeline', properties: { name: 'Server' } }),
      ],
      connectors: [
        { id: 'c1', type: 'sync-message', sourceId: 'el_1', targetId: 'el_2', label: 'login(credentials)', properties: {} },
        { id: 'c2', type: 'return-message', sourceId: 'el_2', targetId: 'el_1', label: 'loginResult', properties: {} },
      ],
    });

    const dsl = serializeDSL(diagram);
    expect(dsl).toContain('@sequence-diagram "Login Flow"');
    expect(dsl).toContain('lifeline User');
    expect(dsl).toContain('lifeline Server');
    expect(dsl).toContain('User -> Server : login(credentials)');
    expect(dsl).toContain('Server <-- User : loginResult');
  });

  it('serializes async messages', () => {
    const diagram = makeDiagram({
      type: 'sequence',
      name: 'Async',
      elements: [
        makeElement({ id: 'a', type: 'lifeline', properties: { name: 'A' } }),
        makeElement({ id: 'b', type: 'lifeline', properties: { name: 'B' } }),
      ],
      connectors: [
        { id: 'c1', type: 'async-message', sourceId: 'a', targetId: 'b', label: 'asyncCall', properties: {} },
      ],
    });

    const dsl = serializeDSL(diagram);
    expect(dsl).toContain('A ->> B : asyncCall');
  });
});

// =============================================================================
// Usecase Diagram Serialization
// =============================================================================

describe('serializeDSL - usecase diagram', () => {
  it('serializes actors and usecases', () => {
    const diagram = makeDiagram({
      type: 'usecase',
      name: 'Shopping',
      elements: [
        makeElement({ id: 'el_1', type: 'actor', properties: { name: 'Customer' } }),
        makeElement({ id: 'el_2', type: 'usecase', properties: { name: 'Browse Products' } }),
        makeElement({ id: 'el_3', type: 'usecase', properties: { name: 'Place Order' } }),
      ],
      connectors: [
        { id: 'c1', type: 'directed-association', sourceId: 'el_1', targetId: 'el_2', properties: {} },
        { id: 'c2', type: 'directed-association', sourceId: 'el_1', targetId: 'el_3', properties: {} },
      ],
    });

    const dsl = serializeDSL(diagram);
    expect(dsl).toContain('actor Customer');
    expect(dsl).toContain('usecase "Browse Products"');
    expect(dsl).toContain('Customer --> "Browse Products"');
  });

  it('serializes include/extend stereotypes', () => {
    const diagram = makeDiagram({
      type: 'usecase',
      name: 'Stereotypes',
      elements: [
        makeElement({ id: 'el_1', type: 'usecase', properties: { name: 'Place Order' } }),
        makeElement({ id: 'el_2', type: 'usecase', properties: { name: 'Validate Payment' } }),
        makeElement({ id: 'el_3', type: 'usecase', properties: { name: 'Apply Discount' } }),
      ],
      connectors: [
        { id: 'c1', type: 'include', sourceId: 'el_1', targetId: 'el_2', properties: {} },
        { id: 'c2', type: 'extend', sourceId: 'el_1', targetId: 'el_3', properties: {} },
      ],
    });

    const dsl = serializeDSL(diagram);
    expect(dsl).toContain('"Place Order" ..> "Validate Payment" <<include>>');
    expect(dsl).toContain('"Place Order" ..> "Apply Discount" <<extend>>');
  });
});

// =============================================================================
// Activity Diagram Serialization
// =============================================================================

describe('serializeDSL - activity diagram', () => {
  it('serializes actions and transitions', () => {
    const diagram = makeDiagram({
      type: 'activity',
      name: 'Order Process',
      elements: [
        makeElement({ id: 'el_1', type: 'initial-node', properties: { name: 'start' } }),
        makeElement({ id: 'el_2', type: 'action', properties: { name: 'Receive Order' } }),
        makeElement({ id: 'el_3', type: 'decision', properties: { name: 'Payment OK?' } }),
        makeElement({ id: 'el_4', type: 'final-node', properties: { name: 'end' } }),
      ],
      connectors: [
        { id: 'c1', type: 'transition', sourceId: 'el_1', targetId: 'el_2', properties: {} },
        { id: 'c2', type: 'transition', sourceId: 'el_2', targetId: 'el_3', properties: {} },
        { id: 'c3', type: 'transition', sourceId: 'el_3', targetId: 'el_4', label: '[yes]', properties: {} },
      ],
    });

    const dsl = serializeDSL(diagram);
    expect(dsl).toContain('initial-node start');
    expect(dsl).toContain('action "Receive Order"');
    expect(dsl).toContain('decision "Payment OK?"');
    expect(dsl).toContain('final-node end');
    expect(dsl).toContain('start --> "Receive Order"');
    expect(dsl).toContain('"Payment OK?" --> end : [yes]');
  });

  it('serializes fork and join', () => {
    const diagram = makeDiagram({
      type: 'activity',
      name: 'Parallel',
      elements: [
        makeElement({ id: 'a', type: 'action', properties: { name: 'A' } }),
        makeElement({ id: 'f', type: 'fork', properties: { name: 'F1' } }),
        makeElement({ id: 'j', type: 'join', properties: { name: 'J1' } }),
      ],
      connectors: [
        { id: 'c1', type: 'transition', sourceId: 'a', targetId: 'f', properties: {} },
        { id: 'c2', type: 'transition', sourceId: 'j', targetId: 'a', properties: {} },
      ],
    });

    const dsl = serializeDSL(diagram);
    expect(dsl).toContain('fork F1');
    expect(dsl).toContain('join J1');
    expect(dsl).toContain('A --> F1');
  });
});

// =============================================================================
// State Diagram Serialization
// =============================================================================

describe('serializeDSL - state diagram', () => {
  it('serializes states and transitions', () => {
    const diagram = makeDiagram({
      type: 'state',
      name: 'Order States',
      elements: [
        makeElement({ id: 'el_1', type: 'initial-state', properties: { name: 'init' } }),
        makeElement({ id: 'el_2', type: 'state', properties: { name: 'Pending' } }),
        makeElement({ id: 'el_3', type: 'state', properties: { name: 'Processing' } }),
        makeElement({ id: 'el_4', type: 'final-state', properties: { name: 'done' } }),
      ],
      connectors: [
        { id: 'c1', type: 'transition', sourceId: 'el_1', targetId: 'el_2', properties: {} },
        { id: 'c2', type: 'transition', sourceId: 'el_2', targetId: 'el_3', label: 'pay', properties: {} },
        { id: 'c3', type: 'transition', sourceId: 'el_3', targetId: 'el_4', properties: {} },
      ],
    });

    const dsl = serializeDSL(diagram);
    expect(dsl).toContain('initial-state init');
    expect(dsl).toContain('state Pending');
    expect(dsl).toContain('state Processing');
    expect(dsl).toContain('final-state done');
    expect(dsl).toContain('Pending --> Processing : pay');
  });
});

// =============================================================================
// Layout Annotations
// =============================================================================

describe('serializeDSL - layout annotations', () => {
  it('includes @pos and @size annotations', () => {
    const diagram = makeDiagram({
      type: 'class',
      name: 'Layout',
      elements: [
        makeElement({
          id: 'el_1',
          type: 'class',
          position: { x: 100, y: 200 },
          size: { width: 300, height: 150 },
          properties: { name: 'MyClass', attributes: [{ name: 'x', type: 'int', visibility: 'public' }], methods: [] },
        }),
      ],
    });

    const dsl = serializeDSL(diagram);
    expect(dsl).toContain('@pos(100, 200)');
    expect(dsl).toContain('@size(300, 150)');
  });
});

// =============================================================================
// Roundtrip: serialize → parse
// =============================================================================

describe('serializeDSL - roundtrip', () => {
  it('class diagram roundtrip: serialize → parse preserves structure', () => {
    const original = makeDiagram({
      type: 'class',
      name: 'Roundtrip',
      elements: [
        makeElement({
          id: 'el_1',
          type: 'class',
          position: { x: 50, y: 50 },
          size: { width: 200, height: 150 },
          properties: {
            name: 'Order',
            attributes: [
              { name: 'id', type: 'string', visibility: 'private' },
            ],
            methods: [
              { name: 'getTotal', returnType: 'number', parameters: [], visibility: 'public' },
            ],
          },
        }),
        makeElement({
          id: 'el_2',
          type: 'class',
          position: { x: 300, y: 50 },
          size: { width: 200, height: 150 },
          properties: {
            name: 'Item',
            attributes: [
              { name: 'qty', type: 'number', visibility: 'public' },
            ],
            methods: [],
          },
        }),
      ],
      connectors: [
        {
          id: 'c1',
          type: 'directed-association',
          sourceId: 'el_1',
          targetId: 'el_2',
          label: 'has',
          properties: {},
        },
      ],
    });

    const dsl = serializeDSL(original);
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.type).toBe('class');
    expect(result.diagram.name).toBe('Roundtrip');
    expect(result.diagram.elements).toHaveLength(2);
    expect(result.diagram.connectors).toHaveLength(1);

    const order = result.diagram.elements.find(e => e.properties.name === 'Order')!;
    expect(order.properties.attributes).toHaveLength(1);
    expect(order.properties.methods).toHaveLength(1);
    expect(order.position).toEqual({ x: 50, y: 50 });

    const conn = result.diagram.connectors[0];
    expect(conn.type).toBe('directed-association');
    expect(conn.label).toBe('has');
  });

  it('class diagram roundtrip preserves element stereotype and visibility', () => {
    const elements: DiagramElement[] = (['class', 'abstract-class', 'interface', 'enum'] as const).map((type, index) =>
      makeElement({
        id: `el_${index}`,
        type,
        position: { x: 50 + index * 250, y: 50 },
        properties: {
          name: `Item${index}`,
          stereotype: 'entity',
          visibility: (['public', 'private', 'protected', 'package'] as const)[index],
          attributes: type === 'enum' ? [{ name: 'A', type: '', visibility: 'public' }] : [],
          methods: [],
        },
      }),
    );
    const dsl = serializeDSL(makeDiagram({ type: 'class', name: 'Meta', elements }));
    expect(dsl).toContain('- abstract class Item1 <<entity>> @pos(300, 50)');

    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.diagram.elements.map((e) => [e.type, e.properties.stereotype, e.properties.visibility])).toEqual([
      ['class', 'entity', 'public'],
      ['abstract-class', 'entity', 'private'],
      ['interface', 'entity', 'protected'],
      ['enum', 'entity', 'package'],
    ]);
    expect(serializeDSL(result.diagram)).toBe(dsl);
  });

  it('omits unset or unknown stereotype and visibility from class declarations', () => {
    const dsl = serializeDSL(makeDiagram({
      type: 'class',
      name: 'Plain',
      elements: [makeElement({ type: 'class', properties: { name: 'Order', stereotype: '  ', visibility: 'internal' as never } })],
    }));
    expect(parseDSL(dsl).success).toBe(true);
    expect(dsl).toContain('class Order @pos(100, 200)');
    expect(dsl).not.toContain('<<');
  });

  it('sequence diagram roundtrip', () => {
    const original = makeDiagram({
      type: 'sequence',
      name: 'SeqRT',
      elements: [
        makeElement({ id: 'a', type: 'lifeline', position: { x: 50, y: 50 }, size: { width: 120, height: 400 }, properties: { name: 'A' } }),
        makeElement({ id: 'b', type: 'lifeline', position: { x: 250, y: 50 }, size: { width: 120, height: 400 }, properties: { name: 'B' } }),
      ],
      connectors: [
        { id: 'c1', type: 'sync-message', sourceId: 'a', targetId: 'b', label: 'call', properties: {} },
      ],
    });

    const dsl = serializeDSL(original);
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.type).toBe('sequence');
    expect(result.diagram.elements).toHaveLength(2);
    expect(result.diagram.connectors).toHaveLength(1);
    expect(result.diagram.connectors[0].type).toBe('sync-message');
    expect(result.diagram.connectors[0].label).toBe('call');
  });

  it('activity diagram roundtrip', () => {
    const original = makeDiagram({
      type: 'activity',
      name: 'ActRT',
      elements: [
        makeElement({ id: 'i', type: 'initial-node', properties: { name: 'start' } }),
        makeElement({ id: 'a', type: 'action', properties: { name: 'DoWork' } }),
        makeElement({ id: 'f', type: 'final-node', properties: { name: 'end' } }),
      ],
      connectors: [
        { id: 'c1', type: 'transition', sourceId: 'i', targetId: 'a', properties: {} },
        { id: 'c2', type: 'transition', sourceId: 'a', targetId: 'f', properties: {} },
      ],
    });

    const dsl = serializeDSL(original);
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.type).toBe('activity');
    expect(result.diagram.elements).toHaveLength(3);
    expect(result.diagram.connectors).toHaveLength(2);
  });

  it('state diagram roundtrip', () => {
    const original = makeDiagram({
      type: 'state',
      name: 'StateRT',
      elements: [
        makeElement({ id: 'i', type: 'initial-state', properties: { name: 'init' } }),
        makeElement({ id: 's1', type: 'state', properties: { name: 'Active' } }),
        makeElement({ id: 'f', type: 'final-state', properties: { name: 'done' } }),
      ],
      connectors: [
        { id: 'c1', type: 'transition', sourceId: 'i', targetId: 's1', properties: {} },
        { id: 'c2', type: 'transition', sourceId: 's1', targetId: 'f', label: 'finish', properties: {} },
      ],
    });

    const dsl = serializeDSL(original);
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.type).toBe('state');
    expect(result.diagram.elements).toHaveLength(3);
    expect(result.diagram.connectors).toHaveLength(2);
    expect(result.diagram.connectors[1].label).toBe('finish');
  });

  it('usecase diagram roundtrip', () => {
    const original = makeDiagram({
      type: 'usecase',
      name: 'UCRT',
      elements: [
        makeElement({ id: 'a1', type: 'actor', properties: { name: 'User' } }),
        makeElement({ id: 'uc1', type: 'usecase', properties: { name: 'Login' } }),
        makeElement({ id: 'uc2', type: 'usecase', properties: { name: 'Register' } }),
      ],
      connectors: [
        { id: 'c1', type: 'include', sourceId: 'uc1', targetId: 'uc2', properties: {} },
      ],
    });

    const dsl = serializeDSL(original);
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.type).toBe('usecase');
    expect(result.diagram.elements).toHaveLength(3);
    expect(result.diagram.connectors).toHaveLength(1);
    expect(result.diagram.connectors[0].type).toBe('include');
  });
});

describe('serializeDSL - explicit containment', () => {
  function parentNames(diagram: DiagramData): Record<string, string | null> {
    const byId = new Map(diagram.elements.map((el) => [el.id, el.properties.name]));
    return Object.fromEntries(diagram.elements.map((el) => [el.properties.name, el.parentId ? byId.get(el.parentId) ?? null : null]));
  }

  it('keeps a top-level state outside a composite state even when it follows the children', () => {
    const elements = [
      makeElement({ id: 'a', type: 'composite-state', properties: { name: 'Active' } }),
      makeElement({ id: 'i', type: 'state', parentId: 'a', properties: { name: 'Inside' } }),
      makeElement({ id: 'o', type: 'state', properties: { name: 'Outside' } }),
    ];
    const connectors: Connector[] = [{ id: 't', type: 'transition', sourceId: 'i', targetId: 'o', properties: {} }];
    const dsl = serializeDSL(makeDiagram({ type: 'state', name: 'S', elements, connectors }));
    expect(dsl.split('\n').some((line) => line.startsWith('state Outside '))).toBe(true);

    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(parentNames(result.diagram)).toEqual({ Active: null, Inside: 'Active', Outside: null });
    expect(result.diagram.connectors).toHaveLength(1);
  });

  it('nests children by parentId regardless of array order', () => {
    const elements = [
      makeElement({ id: 'i', type: 'state', parentId: 'a', properties: { name: 'Inside' } }),
      makeElement({ id: 'o', type: 'state', properties: { name: 'Outside' } }),
      makeElement({ id: 'a', type: 'composite-state', properties: { name: 'Active' } }),
      makeElement({ id: 'j', type: 'state', parentId: 'a', properties: { name: 'Second' } }),
    ];
    const connectors: Connector[] = [{ id: 't', type: 'transition', sourceId: 'i', targetId: 'j', label: 'next', properties: {} }];
    const result = parseDSL(serializeDSL(makeDiagram({ type: 'state', name: 'S', elements, connectors })));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(parentNames(result.diagram)).toEqual({ Outside: null, Active: null, Inside: 'Active', Second: 'Active' });
    expect(result.diagram.connectors.map((c) => c.label)).toEqual(['next']);
  });

  it('keeps a use case listed right after a boundary outside it', () => {
    const elements = [
      makeElement({ id: 'b', type: 'system-boundary', properties: { name: 'Shop' } }),
      makeElement({ id: 'x', type: 'usecase', properties: { name: 'Support' } }),
      makeElement({ id: 'y', type: 'usecase', parentId: 'b', properties: { name: 'Cancel' } }),
    ];
    const result = parseDSL(serializeDSL(makeDiagram({ type: 'usecase', name: 'U', elements })));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(parentNames(result.diagram)).toEqual({ Shop: null, Cancel: 'Shop', Support: null });
  });

  it('falls back to flattened order for diagrams without any parentId', () => {
    const elements = [
      makeElement({ id: 'a', type: 'composite-state', properties: { name: 'Active' } }),
      makeElement({ id: 'i', type: 'state', properties: { name: 'Inside' } }),
    ];
    const result = parseDSL(serializeDSL(makeDiagram({ type: 'state', name: 'S', elements })));
    expect(result.success).toBe(true);
    if (result.success) expect(parentNames(result.diagram)).toEqual({ Active: null, Inside: 'Active' });
  });
});
