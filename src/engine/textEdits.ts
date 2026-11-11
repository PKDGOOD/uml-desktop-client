// =============================================================================
// Targeted text edits (A04.02, ADR 0002 §3 and §5)
//
// An inspector rename changes the name token of one declaration and of every
// connector endpoint that referred to it, and nothing else: comments, blank
// lines, spacing and unrelated lines stay byte for byte.
// =============================================================================

import type { DiagramData } from '../types';
import { parseDSLWithSpans } from '../parser/dsl';
import { formatName } from '../parser/dsl/serializer';
import type { SourceSpan } from '../parser/dsl/sourceSpans';
import { preserveIds } from './syncEngine';

export interface TextEdit {
  span: SourceSpan;
  text: string;
}

/** Apply non-overlapping replacements to `text`. Overlapping edits are a bug, so they throw. */
export function applyTextEdits(text: string, edits: TextEdit[]): string {
  const ordered = [...edits].sort((a, b) => a.span.start - b.span.start);
  let result = '';
  let cursor = 0;
  for (const { span, text: replacement } of ordered) {
    if (span.start < cursor || span.end < span.start || span.end > text.length) {
      throw new Error('Overlapping or out-of-range text edit');
    }
    result += text.slice(cursor, span.start) + replacement;
    cursor = span.end;
  }
  return result + text.slice(cursor);
}

/**
 * The text after renaming one element: its declaration name token and every
 * connector endpoint token that referred to it. `model` is the diagram the
 * text currently describes; its IDs say which element is meant. Returns null
 * when the text cannot be mapped to the model unambiguously, so the caller
 * keeps the text unchanged or regenerates it.
 */
export function renameElementInText(text: string, model: DiagramData, elementId: string, newName: string): string | null {
  const parsed = parseDSLWithSpans(text);
  if (!parsed.success) return null;
  const { diagram, spans } = parsed;
  if (diagram.elements.length !== model.elements.length || diagram.connectors.length !== model.connectors.length) return null;
  // Same matching the text editor uses (ADR 0002 §2, §6), so IDs line up with the model.
  preserveIds(model, diagram);
  const index = diagram.elements.findIndex((element) => element.id === elementId);
  if (index < 0) return null;

  const token = formatName(newName);
  const edits: TextEdit[] = [{ span: spans.elements[index].name, text: token }];
  diagram.connectors.forEach((connector, i) => {
    if (connector.sourceId === elementId) edits.push({ span: spans.connectors[i].source, text: token });
    if (connector.targetId === elementId) edits.push({ span: spans.connectors[i].target, text: token });
  });
  return applyTextEdits(text, edits);
}
