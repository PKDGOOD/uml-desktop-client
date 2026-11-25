/** What the element form offers the rest of the app so pending input is never lost silently (A05.02). */
export interface PendingFormGuard {
  /** Name shown in the question, for example the element's name. */
  label: string;
  isDirty(): boolean;
  /** Applies the draft; returns why it was refused, or null when applied. */
  apply(): string | null;
  discard(): void;
}

export type PendingChoice = 'apply' | 'discard' | 'cancel';

/**
 * Settle a dirty form before something else (a selection change, Save, a tab
 * switch) goes ahead. True means the caller may continue: the form was clean,
 * applied, or discarded. False means stay where you are: the user cancelled, or
 * Apply was refused and the form shows why, so invalid input never slips past.
 */
export async function resolvePending(
  guard: PendingFormGuard | null,
  ask: (label: string) => Promise<PendingChoice>,
): Promise<boolean> {
  if (!guard || !guard.isDirty()) return true;
  const choice = await ask(guard.label);
  if (choice === 'cancel') return false;
  if (choice === 'discard') {
    guard.discard();
    return true;
  }
  return guard.apply() === null;
}
