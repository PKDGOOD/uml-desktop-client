// =============================================================================
// DSL Parser - peggy-based runtime parser
// =============================================================================

import peggy from 'peggy';
import type { DiagramData, DSLParseResult, DSLError } from '../../types';
import type { DiagramSpans } from './sourceSpans';

// Import the grammar as a raw string
import umlGrammar from './uml.pegjs?raw';

let cachedParser: peggy.Parser | null = null;

/**
 * Get or create the peggy parser instance (cached for performance).
 */
function getParser(): peggy.Parser {
  if (!cachedParser) {
    cachedParser = peggy.generate(umlGrammar, {
      error: (stage: string, message: string, location?: peggy.LocationRange) => {
        throw new Error(`Grammar error at ${stage}: ${message}`);
      },
    } as peggy.BuildOptionsBase);
  }
  return cachedParser;
}

/**
 * Parse DSL text into a DiagramData structure using the peggy parser.
 * Supports all 5 diagram types: class, sequence, usecase, activity, state.
 *
 * @param text - DSL text to parse
 * @returns DSLParseResult with either the parsed diagram or error details
 */
export function parseDSL(text: string): DSLParseResult {
  const result = parseDSLWithSpans(text);
  return result.success ? { success: true, diagram: result.diagram } : result;
}

export type DSLParseWithSpansResult =
  | { success: true; diagram: DiagramData; spans: DiagramSpans }
  | { success: false; errors: DSLError[] };

/**
 * Parse DSL text and also return where each element, member and connector
 * sits in it (A04.01). The spans are a side table; the model has no new fields.
 */
export function parseDSLWithSpans(text: string): DSLParseWithSpansResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      success: false,
      errors: [{
        line: 1,
        column: 1,
        message: 'Empty DSL text',
      }],
    };
  }

  try {
    const parser = getParser();
    const { diagram, spans } = parser.parse(text) as { diagram: DiagramData; spans: DiagramSpans };
    // Text order is message order (A04.08).
    if (diagram.type === 'sequence') diagram.connectors.forEach((connector, index) => { connector.messageOrder = index + 1; });
    return { success: true, diagram, spans };
  } catch (err: unknown) {
    if (isPeggySyntaxError(err)) {
      const loc = err.location;
      const errors: DSLError[] = [{
        line: loc?.start?.line ?? 1,
        column: loc?.start?.column ?? 1,
        message: err.message,
        expected: err.expected?.map((e: { type: string; description?: string; text?: string }) => e.description || e.text || e.type),
      }];
      return { success: false, errors };
    }

    return {
      success: false,
      errors: [{
        line: 1,
        column: 1,
        message: err instanceof Error ? err.message : String(err),
      }],
    };
  }
}

/**
 * Reset the cached parser (useful for testing).
 */
export function resetParser(): void {
  cachedParser = null;
}

// Type guard for peggy SyntaxError
interface PeggySyntaxError extends Error {
  location?: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };
  expected?: Array<{ type: string; description?: string; text?: string }>;
  found?: string;
}

function isPeggySyntaxError(err: unknown): err is PeggySyntaxError {
  return err instanceof Error && 'location' in err;
}
