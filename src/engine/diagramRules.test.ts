import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Connector, DiagramData, DiagramElement, DiagramType, ElementType } from '../types';
import { nestedStateDiagram, reorderedSequenceDiagram, usecaseBoundaryDiagram } from '../types/structureFixtures';
import { parseDSL, serializeDSL } from '../parser/dsl';
import {
  isIdentifier,
  isTypeExpression,
  multiplicityProblem,
  parseCheckedDSL,
  validateDiagramConnections,
  validateDiagramProperties,
  validateDiagramRules,
} from './diagramRules';

function el(id: string, type: ElementType, properties: Partial<DiagramElement['properties']> = {}): DiagramElement {
  return { id, type, position: { x: 0, y: 0 }, size: { width: 100, height: 60 }, properties: { name: id, ...properties } };
}

function link(type: Connector['type'], sourceId: string, targetId: string, extra: Partial<Connector> = {}): Connector {
  return { id: `${sourceId}-${targetId}`, type, sourceId, targetId, properties: {}, ...extra };
}

function diagram(type: DiagramType, elements: DiagramElement[], connectors: Connector[] = []): DiagramData {
  return { id: 'd', name: 'D', type, elements, connectors, viewport: { x: 0, y: 0, zoom: 1 } };
}

function paths(errors: { path: string }[]): string[] {
  return errors.map((error) => error.path);
}

describe('accepted corpus', () => {
  const examples = readdirSync(new URL('../../examples/', import.meta.url)).filter((name) => name.endsWith('.uml'));

  it.each(examples)('%s satisfies every diagram rule', (file) => {
    const result = parseDSL(readFileSync(new URL(`../../examples/${file}`, import.meta.url), 'utf8'));
    if (!result.success) throw new Error(JSON.stringify(result.errors));
    expect(validateDiagramRules(result.diagram)).toEqual([]);
  });

  it.each([nestedStateDiagram, usecaseBoundaryDiagram, reorderedSequenceDiagram])('fixture $name satisfies every diagram rule', (fixture) => {
    expect(validateDiagramRules(fixture)).toEqual([]);
  });
});

describe('A03.03 names, members and multiplicity', () => {
  it('matches the DSL identifier and type grammar', () => {
    expect(['order', '_id', 'Größe', '주문번호', 'a1'].map(isIdentifier)).toEqual([true, true, true, true, true]);
    expect(['', '1st', 'two words', 'a-b', 'x:'].map(isIdentifier)).toEqual([false, false, false, false, false]);
    expect(isTypeExpression('Map<String, int>')).toBe(true);
    expect(isTypeExpression('Map<String, int>', true)).toBe(false);
    expect(isTypeExpression(' int')).toBe(false);
    expect(isTypeExpression('int?')).toBe(false);
    expect(isTypeExpression('')).toBe(false);
  });

  it('accepts multiplicity ranges and explains bad ones', () => {
    for (const value of ['1', '*', '0..1', '1..*', '2..10']) expect(multiplicityProblem(value)).toBeUndefined();
    expect(multiplicityProblem('3..1')).toMatch(/lower bound 3 is above the upper bound 1/);
    for (const value of ['', 'many', '1..', '..3', '1 .. 2', '-1']) expect(multiplicityProblem(value)).toMatch(/n\.\.m/);
  });

  it('keeps quoted Unicode display names with spaces and punctuation', () => {
    const model = diagram('class', [el('a', 'class', { name: '주문 "Order" / v2' }), el('b', 'class')]);
    expect(validateDiagramProperties(model)).toEqual([]);
    const reparsed = parseDSL(serializeDSL(model));
    if (!reparsed.success) throw new Error(JSON.stringify(reparsed.errors));
    expect(reparsed.diagram.elements[0].properties.name).toBe('주문 "Order" / v2');
  });

  it('rejects blank and duplicate element names', () => {
    const model = diagram('class', [el('a', 'class', { name: '  ' }), el('b', 'class', { name: 'Order' }), el('c', 'enum', { name: 'Order' })]);
    expect(paths(validateDiagramProperties(model))).toEqual(['elements[0].properties.name', 'elements[2].properties.name']);
  });

  it('rejects member names, types and parameters the DSL cannot read back', () => {
    const model = diagram('class', [el('a', 'class', {
      attributes: [
        { name: 'total amount', type: 'int', visibility: 'public' },
        { name: 'ok', type: 'int ', visibility: 'private' },
        { name: 'flag', type: 'bool', visibility: 'secret' as never },
      ],
      methods: [{
        name: '1run', returnType: 'void', visibility: 'public',
        parameters: [{ name: 'a', type: 'Map<K, V>' }, { name: 'a', type: 'int' }],
      }],
    })]);
    expect(paths(validateDiagramProperties(model))).toEqual([
      'elements[0].properties.attributes[0].name',
      'elements[0].properties.attributes[1].type',
      'elements[0].properties.attributes[2].visibility',
      'elements[0].properties.methods[0].name',
      'elements[0].properties.methods[0].parameters[0].type',
      'elements[0].properties.methods[0].parameters[1].name',
    ]);
  });

  it('rejects enum values that are not identifiers and enum methods', () => {
    const model = diagram('class', [el('e', 'enum', {
      attributes: [
        { name: 'RED', type: '', visibility: 'public' },
        { name: 'light blue', type: '', visibility: 'public' },
        { name: 'GREEN', type: 'string', visibility: 'private' },
      ],
      methods: [{ name: 'f', returnType: 'void', parameters: [], visibility: 'public' }],
    })]);
    expect(paths(validateDiagramProperties(model))).toEqual([
      'elements[0].properties.attributes[1].name',
      'elements[0].properties.attributes[2].type',
      'elements[0].properties.attributes[2].visibility',
      'elements[0].properties.methods',
    ]);
  });

  it('rejects stereotypes and members on elements that cannot show them', () => {
    const model = diagram('class', [
      el('a', 'class', { stereotype: 'a>b' }),
      el('b', 'class', { stereotype: 'entity', visibility: 'package' }),
    ]);
    expect(paths(validateDiagramProperties(model))).toEqual(['elements[0].properties.stereotype']);
    const actor = diagram('usecase', [el('x', 'actor', { stereotype: 'human', attributes: [{ name: 'a', type: 'int', visibility: 'public' }] })]);
    expect(paths(validateDiagramProperties(actor))).toEqual(['elements[0].properties.stereotype', 'elements[0].properties.attributes']);
  });

  it('checks multiplicity only where a class relation carries it', () => {
    const model = diagram('class', [el('a', 'class'), el('b', 'class'), el('i', 'interface')], [
      link('association', 'a', 'b', { sourceMultiplicity: '1', targetMultiplicity: '0..*' }),
      link('composition', 'b', 'a', { targetMultiplicity: '5..2' }),
      link('inheritance', 'a', 'b', { sourceMultiplicity: '1' }),
    ]);
    expect(paths(validateDiagramProperties(model))).toEqual(['connectors[1].targetMultiplicity', 'connectors[2].sourceMultiplicity']);
  });

  it('rejects labels the DSL would change or drop', () => {
    const model = diagram('usecase', [el('a', 'actor'), el('u', 'usecase'), el('v', 'usecase')], [
      link('association', 'a', 'u', { label: 'uses\nit' }),
      link('include', 'u', 'v', { label: 'always' }),
      link('association', 'a', 'v', { label: ' padded' }),
    ]);
    expect(paths(validateDiagramProperties(model))).toEqual(['connectors[0].label', 'connectors[1].label', 'connectors[2].label']);
    const messages = diagram('sequence', [el('a', 'lifeline'), el('b', 'lifeline')], [link('sync-message', 'a', 'b')]);
    expect(validateDiagramProperties(messages)[0]).toMatchObject({ path: 'connectors[0].label', message: expect.stringMatching(/needs a label/) });
  });
});

describe('A03.04 connector and element compatibility', () => {
  it('rejects elements and connectors from another diagram kind or unsupported notation', () => {
    const model = diagram('class', [el('a', 'class'), el('b', 'class'), el('x', 'actor'), el('n', 'note')], [
      link('transition', 'a', 'b'),
      link('usage', 'a', 'b'),
    ]);
    expect(paths(validateDiagramConnections(model))).toEqual(['elements[2].type', 'elements[3].type', 'connectors[0].type', 'connectors[1].type']);
  });

  it('rejects self-links in every diagram kind', () => {
    const cases: [DiagramType, ElementType, Connector['type']][] = [
      ['class', 'class', 'association'], ['sequence', 'lifeline', 'sync-message'],
      ['usecase', 'usecase', 'include'], ['activity', 'action', 'transition'], ['state', 'state', 'transition'],
    ];
    for (const [kind, type, connector] of cases) {
      const errors = validateDiagramConnections(diagram(kind, [el('a', type)], [link(connector, 'a', 'a')]));
      expect(errors).toEqual([{ path: 'connectors[0].targetId', message: expect.stringMatching(/self-links are not supported/) }]);
    }
  });

  it('enforces class relationship ends', () => {
    const model = diagram('class', [el('c', 'class'), el('k', 'abstract-class'), el('i', 'interface'), el('j', 'interface'), el('e', 'enum')], [
      link('inheritance', 'c', 'k'),
      link('inheritance', 'i', 'j'),
      link('realization', 'c', 'i'),
      link('realization', 'e', 'i'),
      link('dependency', 'e', 'c'),
      link('inheritance', 'c', 'i'),
      link('inheritance', 'e', 'c'),
      link('realization', 'i', 'j'),
      link('realization', 'c', 'k'),
    ]);
    const errors = validateDiagramConnections(model);
    expect(paths(errors)).toEqual(['connectors[5]', 'connectors[6]', 'connectors[7]', 'connectors[8]']);
    expect(errors[0].message).toBe('A inheritance from class "c" to interface "i" is not allowed: a class extends a class, and an interface extends an interface');
  });

  it('enforces use case ends', () => {
    const model = diagram('usecase', [el('a', 'actor'), el('b', 'actor'), el('u', 'usecase'), el('v', 'usecase'), el('s', 'system-boundary')], [
      link('association', 'a', 'u'),
      link('directed-association', 'u', 'a'),
      link('include', 'u', 'v'),
      link('association', 'a', 'b'),
      link('association', 'u', 'v'),
      link('extend', 'a', 'u'),
      link('association', 'a', 's'),
    ]);
    expect(paths(validateDiagramConnections(model))).toEqual(['connectors[3]', 'connectors[4]', 'connectors[5]', 'connectors[6]']);
  });

  it('keeps initial nodes as sources and final nodes as targets', () => {
    const activity = diagram('activity', [el('i', 'initial-node'), el('a', 'action'), el('d', 'decision'), el('f', 'final-node')], [
      link('transition', 'i', 'a'),
      link('transition', 'a', 'd'),
      link('transition', 'd', 'f'),
      link('transition', 'a', 'i'),
      link('transition', 'f', 'a'),
    ]);
    expect(paths(validateDiagramConnections(activity))).toEqual(['connectors[3]', 'connectors[4]']);
    const state = diagram('state', [el('i', 'initial-state'), el('c', 'composite-state'), el('f', 'final-state')], [
      link('transition', 'i', 'c'),
      link('transition', 'c', 'f'),
      link('transition', 'c', 'i'),
      link('transition', 'f', 'c'),
    ]);
    expect(paths(validateDiagramConnections(state))).toEqual(['connectors[2]', 'connectors[3]']);
  });

  it('only lets messages connect lifelines', () => {
    const model = diagram('sequence', [el('a', 'lifeline'), el('b', 'lifeline'), el('x', 'actor')], [
      link('sync-message', 'a', 'b', { label: 'go', messageOrder: 1 }),
      link('return-message', 'b', 'x', { label: 'done', messageOrder: 2 }),
    ]);
    expect(paths(validateDiagramConnections(model))).toEqual(['elements[2].type', 'connectors[1]']);
  });
});

describe('A03.06 parseCheckedDSL', () => {
  it('fails a parsed draft that breaks a rule, pointing at the line that caused it', () => {
    const text = [
      '@usecase-diagram "Shop"',
      'actor 고객',
      'usecase "Place order"',
      'usecase Pay',
      '고객 --> "Place order"',
      '"Place order" ..> Pay <<include>>',
      '고객 ..> Pay <<extend>>',
    ].join('\n');
    const result = parseCheckedDSL(text);
    expect(result).toEqual({ success: false, errors: [
      { line: 7, column: 1, message: 'A extend from actor "고객" to usecase "Pay" is not allowed: it connects two use cases' },
    ] });
    expect(parseCheckedDSL(text.split('\n').slice(0, 6).join('\n')).success).toBe(true);
  });

  it('points each connector error at its own line when two relations join the same elements', () => {
    const text = '@class-diagram "Test"\n\nclass A {\n}\n\ninterface I {\n}\n\nA ..> I\nA --|> I\nI ..> A\n';
    expect(parseCheckedDSL(text)).toMatchObject({ success: false, errors: [{ line: 10, message: expect.stringMatching(/class extends a class/) }] });
    const selfLink = '@class-diagram "Test"\n\nclass A {\n}\n\nclass B {\n}\n\nA --> B\nA --> A\n';
    expect(parseCheckedDSL(selfLink)).toMatchObject({ success: false, errors: [{ line: 10 }] });
  });

  it('points a duplicate name at the line that declares it again', () => {
    const result = parseCheckedDSL('@activity-diagram "Flow"\naction Pay\ndecision Paid\naction Pay\n');
    expect(result).toMatchObject({ success: false, errors: [{ line: 4, message: expect.stringMatching(/Two elements/) }] });
  });
});

describe('ADR 0002 name rules', () => {
  it('rejects element and diagram names with control characters', () => {
    const model = { ...diagram('class', [el('a', 'class', { name: 'a\nb' }), el('b', 'class', { name: 'tab\there' })]), name: 'Line\rbreak' };
    expect(paths(validateDiagramProperties(model))).toEqual(['name', 'elements[0].properties.name', 'elements[1].properties.name']);
    expect(validateDiagramProperties(diagram('class', [el('a', 'class', { name: '구매 "주문"' })]))).toEqual([]);
  });

  it('reports a connector to an undeclared element on its line', () => {
    const text = '@class-diagram "Test"\n\nclass Customer {\n}\n\nCustomer --> Order : places\n"Order Item" --* Customer\n';
    expect(parseCheckedDSL(text)).toEqual({ success: false, errors: [
      { line: 6, column: 1, message: expect.stringMatching(/^Unknown element "Order"; .*Rename in the inspector/) },
      { line: 7, column: 1, message: expect.stringMatching(/^Unknown element "Order Item"/) },
    ] });
  });
});
