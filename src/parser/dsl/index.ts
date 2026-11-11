// =============================================================================
// DSL Parser / Serializer - Public API (peggy-based)
// =============================================================================

export { parseDSL, parseDSLWithSpans, resetParser } from './peggyParser';
export type { DSLParseWithSpansResult } from './peggyParser';
export type { ConnectorSpans, DiagramSpans, ElementSpans, MemberSpan, SourceSpan } from './sourceSpans';
export { serializeDSL } from './serializer';
