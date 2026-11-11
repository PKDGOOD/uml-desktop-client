// =============================================================================
// DSL string and identifier escaping (A04.03, ADR 0002 §4)
//
// The one place that decides how a name is written and which names can be
// written bare. The grammar's `Identifier` rule in `uml.pegjs` must stay in
// step with IDENTIFIER_PATTERN; escaping.test.ts round-trips names to prove it.
// =============================================================================

/** The characters of `Identifier` in `uml.pegjs`. */
export const IDENTIFIER_PATTERN = /^[a-zA-Z_À-ɏ가-힯][a-zA-Z0-9_À-ɏ가-힯]*$/;

/** True when `value` can be written without quotes. Member, parameter and enum-value names must be this. */
export function isBareIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER_PATTERN.test(value);
}

/** A double-quoted string literal, JSON rules (`\"`, `\\`, `\uXXXX`), as the grammar's `QuotedString` reads it. */
export function quoteString(value: string): string {
  return JSON.stringify(value);
}

/** An element or diagram name: bare when it is an identifier, quoted otherwise. */
export function formatName(name: string): string {
  return isBareIdentifier(name) ? name : quoteString(name);
}
