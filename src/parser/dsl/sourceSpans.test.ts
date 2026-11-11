import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import expectations from '../../../examples/alpha-expectations.json';
import { parseDSL, parseDSLWithSpans } from './peggyParser';
import type { SourceSpan } from './sourceSpans';

function spans(text: string) {
  const result = parseDSLWithSpans(text);
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  return result;
}
const at = (text: string, span: SourceSpan) => text.slice(span.start, span.end);

describe('A04.01 source spans', () => {
  it('locates elements, names, annotations, members and the closing brace', () => {
    const text = '@class-diagram "D"\n// note\n- class Order <<entity>> @pos(40, 40) @size(260, 180) {  // root\n  - id: String\n  + cancel(reason: String): void  \n}\n';
    const { diagram, spans: s } = spans(text);
    const el = s.elements[0];
    expect(at(text, s.header)).toBe('@class-diagram "D"');
    expect(at(text, s.headerName)).toBe('"D"');
    expect(at(text, el.declaration)).toBe(text.slice(text.indexOf('- class'), text.indexOf('}') + 1));
    expect(at(text, el.name)).toBe('Order');
    expect(at(text, el.pos!)).toBe('@pos(40, 40)');
    expect(at(text, el.size!)).toBe('@size(260, 180)');
    expect(el.closeBrace).toBe(text.indexOf('}'));
    expect(el.members!.map((m) => [m.kind, m.index, at(text, m.span)])).toEqual([
      ['attribute', 0, '- id: String'],
      ['method', 0, '+ cancel(reason: String): void'],
    ]);
    expect(diagram.elements[0].properties.methods?.[0].name).toBe('cancel');
  });

  it('gives an insertion point where @pos and @size are absent', () => {
    const text = '@class-diagram "D"\nclass A <<s>> {\n}\nclass B @pos(1, 2) {\n}\n';
    const { elements } = spans(text).spans;
    expect(elements[0].pos).toBeUndefined();
    expect(elements[0].size).toBeUndefined();
    expect(text.slice(0, elements[0].posInsertAt)).toMatch(/class A <<s>>$/);
    expect(elements[1].sizeInsertAt).toBe(elements[1].pos!.end);
  });

  it('locates connector lines, endpoints, multiplicities and trimmed labels', () => {
    const text = '@class-diagram "D"\nclass "Order Item" {\n}\nclass B {\n}\n"Order Item" "1" --* "1..*" B :   has them  \n';
    const { connectors } = spans(text).spans;
    const c = connectors[0];
    expect(at(text, c.line)).toBe('"Order Item" "1" --* "1..*" B :   has them');
    expect(at(text, c.source)).toBe('"Order Item"');
    expect(at(text, c.target)).toBe('B');
    expect(at(text, c.sourceMultiplicity!)).toBe('"1"');
    expect(at(text, c.targetMultiplicity!)).toBe('"1..*"');
    expect(at(text, c.label!)).toBe('has them');
  });

  it('does not treat the serializer placeholder "" as a multiplicity', () => {
    const { diagram, spans: s } = spans('@class-diagram "D"\nclass A {\n}\nclass B {\n}\nA "" --> B\n');
    expect(diagram.connectors[0].sourceMultiplicity).toBeUndefined();
    expect(s.connectors[0].sourceMultiplicity).toBeDefined();
  });

  it('counts UTF-16 units with Unicode, escapes, CRLF and nested children', () => {
    const text = '@usecase-diagram "주문"\r\nactor "고객 \\"VIP\\" 😀" @pos(1, 2)\r\nsystem-boundary Shop {\r\n  usecase 주문하기\r\n}\r\n"고객 \\"VIP\\" 😀" --> 주문하기\r\n';
    const { diagram, spans: s } = spans(text);
    expect(s.lineEnding).toBe('\r\n');
    expect(diagram.elements.map((e) => e.properties.name)).toEqual(['고객 "VIP" 😀', 'Shop', '주문하기']);
    expect(at(text, s.elements[0].name)).toBe('"고객 \\"VIP\\" 😀"');
    expect(at(text, s.elements[2].name)).toBe('주문하기');
    expect(at(text, s.elements[1].declaration)).toBe('system-boundary Shop {\r\n  usecase 주문하기\r\n}');
    expect(at(text, s.connectors[0].source)).toBe('"고객 \\"VIP\\" 😀"');
    expect(at(text, s.connectors[0].target)).toBe('주문하기');
  });

  it('reports the first line ending in source order, even when the text mixes styles', () => {
    expect(spans('@class-diagram "D"\rclass A {\r\n}\r\n').spans.lineEnding).toBe('\r');
    expect(spans('@class-diagram "D"\nclass A {\r\n}\r\n').spans.lineEnding).toBe('\n');
    expect(spans('@class-diagram "D"').spans.lineEnding).toBe('\n');
  });

  it('locates enum values and state/sequence nodes', () => {
    const e = '@class-diagram "D"\nenum S {\n  A\n  B // x\n}\n';
    const es = spans(e).spans.elements[0];
    expect(es.members!.map((m) => at(e, m.span))).toEqual(['A', 'B']);
    const q = '@sequence-diagram "Q"\nlifeline X\nlifeline Y\nX ->> Y : go now\n';
    const qs = spans(q).spans;
    expect(at(q, qs.connectors[0].line)).toBe('X ->> Y : go now');
    expect(at(q, qs.connectors[0].label!)).toBe('go now');
    const st = '@state-diagram "T"\ncomposite-state C {\n  state A\n  A --> A : loop\n}\n';
    const ss = spans(st);
    expect(ss.diagram.elements.map((x) => x.properties.name)).toEqual(['C', 'A']);
    expect(at(st, ss.spans.elements[1].name)).toBe('A');
    expect(at(st, ss.spans.connectors[0].label!)).toBe('loop');
  });

  it('keeps one span entry per model element and connector in the example corpus', () => {
    const files = [...new Set([...(expectations as { file: string }[]).map((f) => f.file), 'order-system.uml'])];
    expect(files.length).toBeGreaterThan(1);
    for (const file of files) {
      const text = readFileSync(new URL(`../../../examples/${file}`, import.meta.url), 'utf8');
      const { diagram, spans: s } = spans(text);
      expect(s.elements).toHaveLength(diagram.elements.length);
      expect(s.connectors).toHaveLength(diagram.connectors.length);
      diagram.elements.forEach((el, i) => {
        const name = at(text, s.elements[i].name);
        expect(name === el.properties.name || JSON.parse(name) === el.properties.name).toBe(true);
        expect(text.slice(s.elements[i].declaration.start, s.elements[i].name.start)).not.toContain('\n');
      });
    }
  });

  it('leaves parseDSL and the model shape unchanged', () => {
    const text = '@class-diagram "D"\nclass A {\n}\n';
    const plain = parseDSL(text);
    expect(plain.success && Object.keys(plain)).toEqual(['success', 'diagram']);
    expect(JSON.stringify(Object.keys(spans(text).diagram))).toBe(JSON.stringify(Object.keys((plain as { diagram: object }).diagram)));
  });
});
