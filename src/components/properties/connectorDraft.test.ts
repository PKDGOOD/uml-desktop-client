import { describe, expect, it } from 'vitest';
import type { Connector } from '../../types';
import {
  connectorChanges, connectorDraftFrom, describeConnector, isConnectorDirty, multiplicityProblems, swapEnds,
} from './connectorDraft';

const connector: Connector = { id: 'c', type: 'directed-association', sourceId: 'a', targetId: 'b', label: 'places', properties: {} };
const names: Record<string, string> = { a: 'Customer', b: 'Order', c: 'Item' };

describe('A05.04 connector form', () => {
  it('a fresh draft is clean', () => {
    expect(isConnectorDirty(connector, connectorDraftFrom(connector))).toBe(false);
    expect(connectorChanges(connector, connectorDraftFrom(connector))).toEqual({});
  });

  it('reports only the fields that changed', () => {
    const draft = { ...connectorDraftFrom(connector), targetId: 'c', label: 'contains' };
    expect(connectorChanges(connector, draft)).toEqual({ targetId: 'c', label: 'contains' });
  });

  it('an emptied label clears it, and an absent label stays absent', () => {
    const cleared = connectorChanges(connector, { ...connectorDraftFrom(connector), label: '' });
    expect('label' in cleared && cleared.label === undefined).toBe(true);
    const bare: Connector = { ...connector, label: undefined };
    expect(connectorChanges(bare, connectorDraftFrom(bare))).toEqual({});
  });

  it('swapping the ends changes both and swapping twice is clean again', () => {
    const swapped = swapEnds(connectorDraftFrom(connector));
    expect(connectorChanges(connector, swapped)).toEqual({ sourceId: 'b', targetId: 'a' });
    expect(isConnectorDirty(connector, swapEnds(swapped))).toBe(false);
  });

  it('describes the direction with element names', () => {
    expect(describeConnector(connector, (id) => names[id])).toBe('Customer → Order (directed association)');
  });
});

describe('A05.05 multiplicity fields', () => {
  it('reports changed ends and clears an emptied one', () => {
    const withMult: Connector = { ...connector, sourceMultiplicity: '1', targetMultiplicity: '*' };
    const draft = { ...connectorDraftFrom(withMult), sourceMultiplicity: ' 0..1 ', targetMultiplicity: '' };
    const changes = connectorChanges(withMult, draft);
    expect(changes.sourceMultiplicity).toBe('0..1');
    expect('targetMultiplicity' in changes && changes.targetMultiplicity === undefined).toBe(true);
    expect(isConnectorDirty(withMult, connectorDraftFrom(withMult))).toBe(false);
  });

  it('names an invalid range and the end it is on', () => {
    const draft = { ...connectorDraftFrom(connector), sourceMultiplicity: '3..1', targetMultiplicity: 'many' };
    const problems = multiplicityProblems(draft);
    expect(problems.sourceMultiplicity).toMatch(/^From multiplicity: .*lower bound 3 is above the upper bound 1/);
    expect(problems.targetMultiplicity).toMatch(/^To multiplicity: use n, \*, n\.\.m or n\.\.\*/);
    expect(multiplicityProblems({ ...draft, sourceMultiplicity: '0..*', targetMultiplicity: '' })).toEqual({});
  });
});
