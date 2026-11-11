// =============================================================================
// DSL source spans (A04.01, ADR 0002 §5)
//
// Where each parsed node sits in the text, so later edits (A04.02–A04.08) can
// replace only what changed and leave comments, blank lines and spacing alone.
// Offsets are UTF-16 code units, half-open [start, end), as editors use.
// =============================================================================

export interface SourceSpan {
  start: number;
  end: number;
}

export interface MemberSpan {
  /** Where the member lands in the model: `properties.attributes` or `properties.methods`. Enum values are attributes. */
  kind: 'attribute' | 'method';
  index: number;
  /** From the visibility marker (or the value name) to the end of the type, without the newline. */
  span: SourceSpan;
}

export interface ElementSpans {
  /** From the keyword (or element visibility) to the end of the annotations, or to the closing `}` of a block. */
  declaration: SourceSpan;
  /** The bare or quoted name, quotes included. */
  name: SourceSpan;
  pos?: SourceSpan;
  size?: SourceSpan;
  /** Where a missing `@pos` goes: after the name, or after the stereotype the grammar requires to come first. */
  posInsertAt: number;
  /** Where a missing `@size` goes: after `@pos` if present, else at `posInsertAt`. */
  sizeInsertAt: number;
  /** Members in source order (classifiers and enums only). */
  members?: MemberSpan[];
  /** Offset of the closing `}` of a block declaration. */
  closeBrace?: number;
}

export interface ConnectorSpans {
  /** The line content without leading indentation, trailing whitespace, comment or newline. */
  line: SourceSpan;
  source: SourceSpan;
  target: SourceSpan;
  label?: SourceSpan;
  sourceMultiplicity?: SourceSpan;
  targetMultiplicity?: SourceSpan;
}

export interface DiagramSpans {
  /** The `@<type>-diagram "<name>"` header. */
  header: SourceSpan;
  headerName: SourceSpan;
  /** The first line ending style in the text, for inserted lines. */
  lineEnding: '\n' | '\r\n' | '\r';
  /** `elements[i]` describes `diagram.elements[i]`; it stays valid when IDs are re-matched. */
  elements: ElementSpans[];
  /** `connectors[i]` describes `diagram.connectors[i]`. */
  connectors: ConnectorSpans[];
}
