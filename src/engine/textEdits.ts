// =============================================================================
// Targeted text edits (A04.02, ADR 0002 §3 and §5)
//
// An inspector rename changes the name token of one declaration and of every
// connector endpoint that referred to it, and nothing else: comments, blank
// lines, spacing and unrelated lines stay byte for byte.
// =============================================================================

import type { DiagramData } from '../types';
import { parseDSLWithSpans } from '../parser/dsl';
import { formatName, formatPosition, formatSize, formatStereotype, serializeAttribute, serializeMethod, visibilityMarker } from '../parser/dsl/serializer';
import type { DiagramElement } from '../types';
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

type Parsed = Extract<ReturnType<typeof parseDSLWithSpans>, { success: true }>;

/** The text parsed with spans and its IDs matched to `model`, or null when it does not line up one to one. */
function mapToModel(text: string, model: DiagramData): Parsed | null {
  const parsed = parseDSLWithSpans(text);
  if (!parsed.success) return null;
  const { diagram } = parsed;
  if (diagram.elements.length !== model.elements.length || diagram.connectors.length !== model.connectors.length) return null;
  preserveIds(model, diagram);
  return parsed;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Start of the line holding `offset`. */
function lineStart(text: string, offset: number): number {
  return Math.max(text.lastIndexOf('\n', offset - 1), text.lastIndexOf('\r', offset - 1)) + 1;
}

/** End of the line holding `offset`, including its line ending. */
function lineEndWithBreak(text: string, offset: number): number {
  const m = /\r\n|\r|\n/.exec(text.slice(offset));
  return m ? offset + m.index + m[0].length : text.length;
}

/**
 * The text after changing one element to `after` (A04.04, ADR 0002 §5): name
 * (with the connector ends that name it), stereotype, element visibility,
 * `@pos`, `@size` and classifier members are edited in place. Comments, blank
 * lines, spacing and the lines of members that did not change stay as they
 * are. Returns null when the element cannot be mapped or the change needs more
 * than these edits; the caller then regenerates the text.
 */
export function patchElementInText(text: string, model: DiagramData, after: DiagramElement): string | null {
  const parsed = mapToModel(text, model);
  if (!parsed) return null;
  const { diagram, spans } = parsed;
  const index = diagram.elements.findIndex((element) => element.id === after.id);
  const before = model.elements[model.elements.findIndex((element) => element.id === after.id)];
  if (index < 0 || !before || before.type !== after.type || before.parentId !== after.parentId) return null;
  const s = spans.elements[index];
  const edits: TextEdit[] = [];
  const bp = before.properties;
  const ap = after.properties;

  if (bp.name !== ap.name) {
    const token = formatName(ap.name);
    edits.push({ span: s.name, text: token });
    diagram.connectors.forEach((connector, i) => {
      if (connector.sourceId === after.id) edits.push({ span: spans.connectors[i].source, text: token });
      if (connector.targetId === after.id) edits.push({ span: spans.connectors[i].target, text: token });
    });
  }
  if (bp.stereotype !== ap.stereotype) {
    // Between the name and the annotations there is only the stereotype.
    edits.push({ span: { start: s.name.end, end: s.posInsertAt }, text: formatStereotype(ap.stereotype) });
  }
  if (bp.visibility !== ap.visibility) {
    const prefix = /^[+\-#~][ \t]+/.exec(text.slice(s.declaration.start));
    const marker = ap.visibility ? visibilityMarker[ap.visibility] : undefined;
    const replacement = marker ? `${marker} ` : '';
    if (prefix) edits.push({ span: { start: s.declaration.start, end: s.declaration.start + prefix[0].length }, text: replacement });
    else if (replacement) edits.push({ span: { start: s.declaration.start, end: s.declaration.start }, text: replacement });
  }

  const posChanged = !same(before.position, after.position);
  const sizeChanged = !same(before.size, after.size);
  if (posChanged || sizeChanged) {
    if (s.pos && posChanged) edits.push({ span: s.pos, text: formatPosition(after.position) });
    if (s.size && sizeChanged) edits.push({ span: s.size, text: formatSize(after.size) });
    const inserted: string[] = [];
    if (!s.pos && posChanged) inserted.push(formatPosition(after.position));
    if (!s.size && sizeChanged && !s.pos) inserted.push(formatSize(after.size));
    if (inserted.length > 0) edits.push({ span: { start: s.posInsertAt, end: s.posInsertAt }, text: ` ${inserted.join(' ')}` });
    if (!s.size && sizeChanged && s.pos) edits.push({ span: { start: s.sizeInsertAt, end: s.sizeInsertAt }, text: ` ${formatSize(after.size)}` });
  }

  const memberEdits = patchMembers(text, spans.lineEnding, s, before, after);
  if (memberEdits === null) return null;
  edits.push(...memberEdits);

  return applyTextEdits(text, edits);
}

function patchMembers(text: string, eol: string, s: ElementSpansLike, before: DiagramElement, after: DiagramElement): TextEdit[] | null {
  const lists = (['attribute', 'method'] as const).map((kind) => ({
    kind,
    old: (kind === 'attribute' ? before.properties.attributes : before.properties.methods) ?? [],
    next: (kind === 'attribute' ? after.properties.attributes : after.properties.methods) ?? [],
  }));
  if (lists.every((l) => same(l.old, l.next))) return [];
  if (!s.members || s.closeBrace === undefined) return null;
  const isEnum = after.type === 'enum';
  const line = (kind: 'attribute' | 'method', member: unknown) => {
    if (isEnum) return (member as { name: string }).name;
    return (kind === 'attribute' ? serializeAttribute(member as never) : serializeMethod(member as never)).trimStart();
  };

  const edits: TextEdit[] = [];
  const appended: string[] = [];
  for (const { kind, old, next } of lists) {
    const placed = s.members.filter((m) => m.kind === kind);
    if (placed.length !== old.length) return null;
    // Match members by name first, then pair what is left in order, so a rename
    // keeps its line (and comment) while a removal takes only its own line.
    const pairs = new Map<number, number>();
    const usedNew = new Set<number>();
    old.forEach((member, i) => {
      const j = next.findIndex((candidate, k) => !usedNew.has(k) && candidate.name === member.name);
      if (j >= 0) { pairs.set(i, j); usedNew.add(j); }
    });
    const leftoverOld = old.map((_, i) => i).filter((i) => !pairs.has(i));
    const leftoverNew = next.map((_, k) => k).filter((k) => !usedNew.has(k));
    leftoverOld.forEach((i, n) => { if (n < leftoverNew.length) pairs.set(i, leftoverNew[n]); });
    const pairedNew = new Set(pairs.values());
    old.forEach((member, i) => {
      const j = pairs.get(i);
      if (j === undefined) {
        // A removed member takes its whole line, trailing comment included.
        edits.push({ span: { start: lineStart(text, placed[i].span.start), end: lineEndWithBreak(text, placed[i].span.start) }, text: '' });
      } else if (!same(member, next[j])) {
        edits.push({ span: placed[i].span, text: line(kind, next[j]) });
      }
    });
    next.forEach((member, k) => {
      if (!pairedNew.has(k)) appended.push(`  ${line(kind, member)}`);
    });
  }
  if (appended.length > 0) {
    const close = lineStart(text, s.closeBrace);
    if (text.slice(close, s.closeBrace).trim() !== '') return null;
    edits.push({ span: { start: close, end: close }, text: appended.map((l) => l + eol).join('') });
  }
  return edits;
}

type ElementSpansLike = import('../parser/dsl/sourceSpans').ElementSpans;
