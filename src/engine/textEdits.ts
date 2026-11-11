// =============================================================================
// Targeted text edits (A04.02, ADR 0002 §3 and §5)
//
// An inspector rename changes the name token of one declaration and of every
// connector endpoint that referred to it, and nothing else: comments, blank
// lines, spacing and unrelated lines stay byte for byte.
// =============================================================================

import type { DiagramData } from '../types';
import { parseDSLWithSpans } from '../parser/dsl';
import { formatName, formatPosition, serializeDSL, formatSize, formatStereotype, serializeAttribute, serializeMethod, visibilityMarker } from '../parser/dsl/serializer';
import type { Connector, DiagramElement } from '../types';
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

/**
 * The text after changing one connector (A04.05): its endpoint names, label and
 * multiplicities are edited in place; the rest of the line and everything
 * around it stay. A change of relation type needs a different arrow, so it
 * returns null and the caller regenerates. `after` is the connector in
 * `afterDiagram`, whose elements give the new endpoint names.
 */
export function patchConnectorInText(text: string, model: DiagramData, after: Connector, afterDiagram: DiagramData): string | null {
  const parsed = mapToModel(text, model);
  if (!parsed) return null;
  const { diagram, spans } = parsed;
  const index = diagram.connectors.findIndex((connector) => connector.id === after.id);
  const before = model.connectors.find((connector) => connector.id === after.id);
  if (index < 0 || !before || before.type !== after.type) return null;
  const s = spans.connectors[index];
  const nameOf = (id: string) => afterDiagram.elements.find((element) => element.id === id)?.properties.name;
  const edits: TextEdit[] = [];

  if (before.sourceId !== after.sourceId) {
    const name = nameOf(after.sourceId);
    if (name === undefined) return null;
    edits.push({ span: s.source, text: formatName(name) });
  }
  if (before.targetId !== after.targetId) {
    const name = nameOf(after.targetId);
    if (name === undefined) return null;
    edits.push({ span: s.target, text: formatName(name) });
  }

  const label = (value: string | undefined) => (value === undefined || value === '' ? undefined : value);
  if (label(before.label) !== label(after.label)) {
    const next = label(after.label);
    if (s.label && next !== undefined) edits.push({ span: s.label, text: next });
    else if (s.label) edits.push({ span: { start: s.target.end, end: s.label.end }, text: '' });
    else if (next !== undefined) edits.push({ span: { start: s.target.end, end: s.target.end }, text: ` : ${next}` });
  }

  const multiplicity = (
    side: 'source' | 'target',
    old: string | undefined,
    next: string | undefined,
  ) => {
    if ((old || undefined) === (next || undefined)) return;
    const existing = side === 'source' ? s.sourceMultiplicity : s.targetMultiplicity;
    if (existing && next) edits.push({ span: existing, text: `"${next}"` });
    else if (existing) edits.push({ span: existing, text: '""' });
    else if (next) {
      edits.push(side === 'source'
        ? { span: { start: s.source.end, end: s.source.end }, text: ` "${next}"` }
        : { span: { start: s.target.start, end: s.target.start }, text: `"${next}" ` });
      // `A --> "2" B` would read as a transition to a node named "2": keep the empty source placeholder.
      if (side === 'target' && after.type === 'directed-association' && !s.sourceMultiplicity && !after.sourceMultiplicity) {
        edits.push({ span: { start: s.source.end, end: s.source.end }, text: ' ""' });
      }
    }
  };
  multiplicity('source', before.sourceMultiplicity, after.sourceMultiplicity);
  multiplicity('target', before.targetMultiplicity, after.targetMultiplicity);

  return applyTextEdits(text, edits);
}

// ---- Insertion and deletion (A04.06) ----

type Span = SourceSpan;

/** Indexes of the elements that are not inside another element's block. */
function topLevel(spans: Array<{ declaration: Span }>): number[] {
  return spans.map((_, i) => i).filter((i) => !spans.some((other, j) => (
    j !== i && other.declaration.start < spans[i].declaration.start && spans[i].declaration.end <= other.declaration.end
  )));
}

/** Insert `block` as its own lines at `offset` (a line start, or the end of the text). */
function insertLines(text: string, offset: number, block: string, eol: string): TextEdit {
  const atEnd = offset >= text.length;
  const needsBreak = atEnd && text.length > 0 && !/[\r\n]$/.test(text);
  return { span: { start: offset, end: offset }, text: `${needsBreak ? eol : ''}${block}${eol}` };
}

/**
 * Remove one body item. When it is alone on its line (a trailing comment counts as
 * nothing), the whole line goes; when other items share the line, only the item
 * and the spaces before it go, so its neighbours stay.
 */
function removeItem(text: string, span: Span): TextEdit {
  const start = lineStart(text, span.start);
  const end = lineEndWithBreak(text, Math.max(span.start, span.end - 1));
  const before = text.slice(start, span.start);
  const after = text.slice(span.end, end).replace(/(?:\r\n|\r|\n)$/, '');
  if (before.trim() === '' && (after.trim() === '' || after.trim().startsWith('//'))) {
    return { span: { start, end }, text: '' };
  }
  if (before.trim() === '') {
    // First on its line: take the spaces after it, keep the indentation.
    return { span: { start: span.start, end: span.end + /^[ \t]*/.exec(after)![0].length }, text: '' };
  }
  const lead = /[ \t]*$/.exec(before)![0].length;
  return { span: { start: span.start - lead, end: span.end }, text: '' };
}

/** Whether `span` lies inside any element's block. */
const nested = (span: Span, elements: Array<{ declaration: Span }>) => elements.some((e) => (
  e.declaration.start < span.start && span.end <= e.declaration.end
));

const shell = (model: DiagramData): DiagramData => ({ ...model, elements: [], connectors: [] });

/** The DSL lines a new element is written as, without header or blank lines. */
function elementLines(model: DiagramData, element: DiagramElement, eol: string): string {
  const lines = serializeDSL({ ...shell(model), elements: [element] }).split('\n').slice(2);
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join(eol);
}

/**
 * The text after adding a top-level element: its declaration goes on the lines
 * after the last top-level declaration (or after the header when there is
 * none). A nested element needs its parent's block, so it returns null.
 */
export function patchAddElementInText(text: string, model: DiagramData, element: DiagramElement): string | null {
  if (element.parentId) return null;
  const parsed = mapToModel(text, model);
  if (!parsed) return null;
  const { spans } = parsed;
  const tops = topLevel(spans.elements);
  const anchor = tops.length > 0
    ? Math.max(...tops.map((i) => spans.elements[i].declaration.end))
    : spans.header.end;
  const at = lineEndWithBreak(text, anchor);
  return applyTextEdits(text, [insertLines(text, at, elementLines(model, element, spans.lineEnding), spans.lineEnding)]);
}

/**
 * The text after deleting an element: its declaration lines and every
 * connector line that refers to it, comments on those lines included. An
 * element that contains others returns null (the caller decides what happens to
 * the children).
 */
export function patchDeleteElementInText(text: string, model: DiagramData, elementId: string): string | null {
  const parsed = mapToModel(text, model);
  if (!parsed) return null;
  const { diagram, spans } = parsed;
  const index = diagram.elements.findIndex((element) => element.id === elementId);
  if (index < 0 || diagram.elements.some((element) => element.parentId === elementId)) return null;
  const edits = [removeItem(text, spans.elements[index].declaration)];
  diagram.connectors.forEach((connector, i) => {
    if (connector.sourceId === elementId || connector.targetId === elementId) edits.push(removeItem(text, spans.connectors[i].line));
  });
  return applyTextEdits(text, edits);
}

/** The DSL line a new connector is written as. */
function connectorLine(afterDiagram: DiagramData, connector: Connector): string | null {
  const base = serializeDSL({ ...afterDiagram, connectors: [] });
  const full = serializeDSL({ ...afterDiagram, connectors: [connector] });
  if (!full.startsWith(base)) return null;
  const tail = full.slice(base.length).trim();
  return tail === '' || tail.includes('\n') ? null : tail;
}

/** The text after adding a connector: its line follows the last connector line, or the last declaration. */
export function patchAddConnectorInText(text: string, model: DiagramData, connector: Connector, afterDiagram: DiagramData): string | null {
  const parsed = mapToModel(text, model);
  if (!parsed) return null;
  const line = connectorLine(afterDiagram, connector);
  if (line === null) return null;
  const { spans } = parsed;
  // Anchor outside every block: after the last top-level connector, else the last top-level declaration.
  const topConnectors = spans.connectors.filter((c) => !nested(c.line, spans.elements));
  const tops = topLevel(spans.elements);
  const anchor = topConnectors.length > 0
    ? Math.max(...topConnectors.map((c) => c.line.end))
    : Math.max(spans.header.end, ...tops.map((i) => spans.elements[i].declaration.end));
  return applyTextEdits(text, [insertLines(text, lineEndWithBreak(text, anchor), line, spans.lineEnding)]);
}

/** The text after deleting a connector: its line, comment included. */
export function patchDeleteConnectorInText(text: string, model: DiagramData, connectorId: string): string | null {
  const parsed = mapToModel(text, model);
  if (!parsed) return null;
  const index = parsed.diagram.connectors.findIndex((connector) => connector.id === connectorId);
  if (index < 0) return null;
  return applyTextEdits(text, [removeItem(text, parsed.spans.connectors[index].line)]);
}
