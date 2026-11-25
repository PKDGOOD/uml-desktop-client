import { describe, expect, it, vi } from 'vitest';
import { resolvePending, type PendingChoice, type PendingFormGuard } from './pendingForm';

function guard(dirty: boolean, applyResult: string | null = null) {
  const apply = vi.fn<() => string | null>(() => applyResult);
  const discard = vi.fn<() => void>();
  const value: PendingFormGuard = { label: 'Order', isDirty: () => dirty, apply, discard };
  return Object.assign(value, { apply, discard });
}
const asks = (choice: PendingChoice) => vi.fn(async () => choice);

describe('A05.02 resolving a pending form', () => {
  it('lets a clean form or no form through without asking', async () => {
    const ask = asks('cancel');
    expect(await resolvePending(null, ask)).toBe(true);
    expect(await resolvePending(guard(false), ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('Apply continues only when the apply succeeded', async () => {
    const ok = guard(true);
    expect(await resolvePending(ok, asks('apply'))).toBe(true);
    expect(ok.apply).toHaveBeenCalledOnce();
    const refused = guard(true, 'Name cannot be empty.');
    expect(await resolvePending(refused, asks('apply'))).toBe(false);
  });

  it('Discard throws the draft away and continues', async () => {
    const g = guard(true);
    expect(await resolvePending(g, asks('discard'))).toBe(true);
    expect(g.discard).toHaveBeenCalledOnce();
    expect(g.apply).not.toHaveBeenCalled();
  });

  it('Cancel changes nothing and does not continue', async () => {
    const g = guard(true);
    expect(await resolvePending(g, asks('cancel'))).toBe(false);
    expect(g.apply).not.toHaveBeenCalled();
    expect(g.discard).not.toHaveBeenCalled();
  });

  it('names the element in the question', async () => {
    const ask = asks('cancel');
    await resolvePending(guard(true), ask);
    expect(ask).toHaveBeenCalledWith('Order');
  });
});
