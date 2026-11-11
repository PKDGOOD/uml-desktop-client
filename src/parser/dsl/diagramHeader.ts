/** The `@<type>-diagram "Name"` header, possibly preceded by blank lines and comments. */
const DIAGRAM_HEADER = /^((?:\s*\/\/[^\n]*\n)*\s*)(@[a-z]+-diagram)[ \t]*"(?:\\.|[^"\\])*"/;

/**
 * Rewrites the diagram name in a DSL header and leaves the rest of the text,
 * including comments and invalid drafts, untouched. Text without a header is
 * returned unchanged.
 */
export function renameDiagramHeader(text: string, name: string): string {
  return text.replace(DIAGRAM_HEADER, (_match, prefix: string, keyword: string) => `${prefix}${keyword} ${JSON.stringify(name)}`);
}
