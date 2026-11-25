import { describe, expect, it } from 'vitest';
import type { ElementProperties } from '../../types';
import { changesFrom, draftFrom, isDirty, localProblem } from './formDraft';

const saved: ElementProperties = {
  name: 'Order', stereotype: 'entity', visibility: 'public',
  attributes: [{ name: 'id', type: 'String', visibility: 'private' }],
  methods: [{ name: 'total', returnType: 'int', parameters: [], visibility: 'public' }],
};

describe('A05.01 buffered element form', () => {
  it('a fresh draft is clean and sends nothing', () => {
    const draft = draftFrom(saved);
    expect(isDirty(saved, draft)).toBe(false);
    expect(changesFrom(saved, draft)).toEqual({});
  });

  it('typing builds one change set with only the edited fields', () => {
    const draft = { ...draftFrom(saved), name: 'Purchase', visibility: 'private' as const };
    expect(changesFrom(saved, draft)).toEqual({ name: 'Purchase', visibility: 'private' });
  });

  it('trims the stereotype and clears it when emptied', () => {
    expect(changesFrom(saved, { ...draftFrom(saved), stereotype: '  value object ' })).toEqual({ stereotype: 'value object' });
    const cleared = changesFrom(saved, { ...draftFrom(saved), stereotype: '   ' });
    expect('stereotype' in cleared && cleared.stereotype === undefined).toBe(true);
    expect(isDirty(saved, { ...draftFrom(saved), stereotype: ' entity ' })).toBe(false);
  });

  it('detects member edits and Cancel (a fresh draft) discards them', () => {
    const edited = draftFrom(saved);
    edited.attributes[0].name = 'orderId';
    expect(changesFrom(saved, edited)).toEqual({ attributes: [{ name: 'orderId', type: 'String', visibility: 'private' }] });
    expect(isDirty(saved, draftFrom(saved))).toBe(false);
  });

  it('does not alias the saved element', () => {
    const draft = draftFrom(saved);
    draft.attributes.push({ name: 'x', type: 'int', visibility: 'private' });
    expect(saved.attributes).toHaveLength(1);
  });

  it('refuses an empty name locally', () => {
    expect(localProblem({ ...draftFrom(saved), name: '  ' })).toEqual({ field: 'name', message: 'Name cannot be empty.' });
    expect(localProblem(draftFrom(saved))).toBeNull();
  });
});

describe('A05.03 moving members', () => {
  it('moves an item by one place and clamps at the ends', async () => {
    const { moveItem } = await import('./formDraft');
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['c', 'b', 'a'].reverse().length ? ['b', 'c', 'a'] : []);
  });

  it('a reorder alone is a change', () => {
    const base: ElementProperties = {
      name: 'C',
      attributes: [{ name: 'a', type: 'int', visibility: 'private' }, { name: 'b', type: 'int', visibility: 'private' }],
    };
    const draft = draftFrom(base);
    draft.attributes.reverse();
    expect(changesFrom(base, draft).attributes?.map((a) => a.name)).toEqual(['b', 'a']);
  });
});
