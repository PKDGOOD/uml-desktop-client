// =============================================================================
// DSL Recursive Descent Parser - Parses tokens into DiagramData
// =============================================================================

import type {
  DiagramData, DiagramType, DiagramElement, Connector,
  ElementType, ConnectorType, Attribute, Method, Parameter,
  Position, Size, ElementProperties, ConnectorProperties,
  DSLError,
} from '../../types';
import type { Token, TokenType } from './tokenizer';

// --- ID generation ---
let idCounter = 0;
function makeId(prefix: string): string {
  idCounter++;
  return `${prefix}_${idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

// --- Default sizes per element type ---
function defaultSize(type: ElementType): Size {
  switch (type) {
    case 'class': case 'interface': case 'abstract-class': case 'enum':
      return { width: 200, height: 150 };
    case 'actor':
      return { width: 60, height: 100 };
    case 'usecase':
      return { width: 160, height: 80 };
    case 'system-boundary':
      return { width: 400, height: 300 };
    case 'lifeline':
      return { width: 120, height: 400 };
    case 'action':
      return { width: 160, height: 60 };
    case 'decision':
      return { width: 80, height: 80 };
    case 'fork': case 'join':
      return { width: 200, height: 10 };
    case 'initial-node': case 'final-node':
    case 'initial-state': case 'final-state':
      return { width: 30, height: 30 };
    case 'state': case 'composite-state':
      return { width: 200, height: 120 };
    default:
      return { width: 150, height: 100 };
  }
}

function defaultPosition(index: number): Position {
  return { x: 50 + (index % 4) * 250, y: 50 + Math.floor(index / 4) * 200 };
}

// --- Arrow to ConnectorType mapping ---
const ARROW_MAP: Record<string, ConnectorType> = {
  '<|..': 'realization',
  '..|>': 'realization',
  '<|--': 'inheritance',
  '--|>': 'inheritance',
  'o--': 'aggregation',
  '--o': 'aggregation',
  '*--': 'composition',
  '--*': 'composition',
  '->>': 'async-message',
  '..>': 'dependency',
  '-->': 'directed-association',
  '->': 'sync-message',
  '..': 'dependency',
  '--': 'association',
};

function resolveArrowType(arrow: string, diagramType: DiagramType): ConnectorType | undefined {
  // Context-dependent arrow resolution
  if (arrow === '-->') {
    switch (diagramType) {
      case 'sequence': return 'return-message';
      case 'activity': case 'state': return 'transition';
      default: return 'directed-association';
    }
  }
  if (arrow === '->') {
    switch (diagramType) {
      case 'sequence': return 'sync-message';
      case 'usecase': return 'directed-association';
      default: return 'sync-message';
    }
  }
  if (arrow === '->>') {
    return 'async-message';
  }
  return ARROW_MAP[arrow];
}

// --- Header to DiagramType mapping ---
const HEADER_MAP: Record<string, DiagramType> = {
  '@class-diagram': 'class',
  '@sequence-diagram': 'sequence',
  '@usecase-diagram': 'usecase',
  '@activity-diagram': 'activity',
  '@state-diagram': 'state',
};

// --- Visibility marker mapping ---
const VISIBILITY_MAP: Record<string, 'public' | 'private' | 'protected' | 'package'> = {
  '+': 'public',
  '-': 'private',
  '#': 'protected',
  '~': 'package',
};

// --- Intermediate parse node types ---
interface ParsedElement {
  kind: 'element';
  type: ElementType;
  properties: ElementProperties;
  position?: Position;
  size?: Size;
  children?: ParsedElement[];
}

interface ParsedConnector {
  kind: 'connector';
  type: ConnectorType;
  sourceName: string;
  targetName: string;
  label?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
}

type ParsedItem = ParsedElement | ParsedConnector;

// =============================================================================
// Parser class
// =============================================================================

export class DSLParser {
  private tokens: Token[] = [];
  private pos: number = 0;
  private errors: DSLError[] = [];

  parse(tokens: Token[]): { diagram?: DiagramData; errors: DSLError[] } {
    this.tokens = tokens;
    this.pos = 0;
    this.errors = [];
    resetIdCounter();

    this.skipNewlines();

    // Parse header
    const header = this.parseHeader();
    if (!header) {
      return { errors: this.errors.length > 0 ? this.errors : [this.makeError('Expected diagram header (e.g., @class-diagram "name")')] };
    }

    this.skipNewlines();

    // Parse body items
    const items = this.parseBody(header.type);

    // Build DiagramData
    const diagram = this.buildDiagram(header.type, header.name, items);

    if (this.errors.length > 0) {
      return { errors: this.errors };
    }

    return { diagram, errors: [] };
  }

  // --- Header parsing ---
  private parseHeader(): { type: DiagramType; name: string } | null {
    const tok = this.current();
    if (tok.type !== 'HEADER') {
      this.addError('Expected diagram header (@class-diagram, @sequence-diagram, etc.)');
      return null;
    }
    const diagramType = HEADER_MAP[tok.value];
    if (!diagramType) {
      this.addError(`Unknown diagram header: ${tok.value}`);
      return null;
    }
    this.advance();

    // Expect quoted name
    const nameTok = this.current();
    if (nameTok.type !== 'STRING') {
      this.addError('Expected quoted diagram name after header');
      return null;
    }
    this.advance();

    return { type: diagramType, name: nameTok.value };
  }

  // --- Body parsing ---
  private parseBody(diagramType: DiagramType): ParsedItem[] {
    const items: ParsedItem[] = [];

    while (!this.isAtEnd()) {
      this.skipNewlines();
      if (this.isAtEnd()) break;

      const item = this.parseBodyItem(diagramType);
      if (item) {
        items.push(item);
      } else {
        // Skip to next line on error
        this.skipToNextLine();
      }
    }

    return items;
  }

  private parseBodyItem(diagramType: DiagramType): ParsedItem | null {
    const tok = this.current();

    if (tok.type === 'KEYWORD') {
      switch (tok.value) {
        // Class diagram elements
        case 'class': return this.parseClassDef('class');
        case 'abstract class': return this.parseClassDef('abstract-class');
        case 'interface': return this.parseClassDef('interface');
        case 'enum': return this.parseEnumDef();
        // Sequence diagram elements
        case 'lifeline': return this.parseSimpleElement('lifeline');
        // Usecase diagram elements
        case 'actor': return this.parseSimpleElement('actor');
        case 'usecase': return this.parseSimpleElement('usecase');
        case 'system-boundary': return this.parseContainerElement('system-boundary');
        // Activity diagram elements
        case 'action': return this.parseSimpleElement('action');
        case 'decision': return this.parseSimpleElement('decision');
        case 'fork': return this.parseSimpleElement('fork');
        case 'join': return this.parseSimpleElement('join');
        case 'initial-node': return this.parseSimpleElement('initial-node');
        case 'final-node': return this.parseSimpleElement('final-node');
        // State diagram elements
        case 'state': return this.parseSimpleElement('state');
        case 'composite-state': return this.parseContainerElement('composite-state');
        case 'initial-state': return this.parseSimpleElement('initial-state');
        case 'final-state': return this.parseSimpleElement('final-state');
        default:
          this.addError(`Unexpected keyword: ${tok.value}`);
          return null;
      }
    }

    // Try to parse as a relation/connector (starts with identifier or string)
    if (tok.type === 'IDENTIFIER' || tok.type === 'STRING') {
      return this.parseRelation(diagramType);
    }

    this.addError(`Unexpected token: ${tok.value || tok.type}`);
    return null;
  }

  // --- Class/Interface/AbstractClass definition ---
  private parseClassDef(elementType: ElementType): ParsedElement {
    this.advance(); // skip keyword

    const name = this.expectName();
    const annotations = this.parseAnnotations();

    const attributes: Attribute[] = [];
    const methods: Method[] = [];

    if (this.check('LBRACE')) {
      this.advance(); // skip {
      this.skipNewlines();

      while (!this.check('RBRACE') && !this.isAtEnd()) {
        if (this.check('NEWLINE')) {
          this.skipNewlines();
          continue;
        }

        if (this.check('VISIBILITY')) {
          const member = this.parseClassMember();
          if (member) {
            if ('returnType' in member) {
              methods.push(member as Method);
            } else {
              attributes.push(member as Attribute);
            }
          }
        } else if (this.check('RBRACE')) {
          break;
        } else {
          this.skipToNextLine();
        }
        this.skipNewlines();
      }

      if (this.check('RBRACE')) {
        this.advance(); // skip }
      } else {
        this.addError('Expected closing }');
      }
    }

    return {
      kind: 'element',
      type: elementType,
      properties: { name, attributes, methods },
      position: annotations.position ?? undefined,
      size: annotations.size ?? undefined,
    };
  }

  // --- Enum definition ---
  private parseEnumDef(): ParsedElement {
    this.advance(); // skip 'enum'

    const name = this.expectName();
    const annotations = this.parseAnnotations();

    const values: string[] = [];

    if (this.check('LBRACE')) {
      this.advance(); // skip {
      this.skipNewlines();

      while (!this.check('RBRACE') && !this.isAtEnd()) {
        if (this.check('NEWLINE')) {
          this.skipNewlines();
          continue;
        }
        if (this.check('IDENTIFIER')) {
          values.push(this.current().value);
          this.advance();
        } else if (this.check('RBRACE')) {
          break;
        } else {
          this.skipToNextLine();
        }
        this.skipNewlines();
      }

      if (this.check('RBRACE')) {
        this.advance();
      } else {
        this.addError('Expected closing }');
      }
    }

    return {
      kind: 'element',
      type: 'enum',
      properties: {
        name,
        attributes: values.map(v => ({ name: v, type: '', visibility: 'public' as const })),
        methods: [],
      },
      position: annotations.position ?? undefined,
      size: annotations.size ?? undefined,
    };
  }

  // --- Class member (attribute or method) ---
  private parseClassMember(): Attribute | Method | null {
    const visTok = this.current();
    if (visTok.type !== 'VISIBILITY') return null;
    const visibility = VISIBILITY_MAP[visTok.value];
    this.advance();

    const nameTok = this.current();
    if (nameTok.type !== 'IDENTIFIER') {
      this.addError('Expected member name');
      this.skipToNextLine();
      return null;
    }
    const name = nameTok.value;
    this.advance();

    // Check if it's a method (has parentheses)
    if (this.check('LPAREN')) {
      return this.parseMethodRest(name, visibility);
    }

    // It's an attribute: expect : type
    if (!this.check('COLON')) {
      this.addError('Expected : after attribute name');
      this.skipToNextLine();
      return null;
    }
    this.advance(); // skip :

    const type = this.readTypeExpression();

    return { name, type, visibility };
  }

  private parseMethodRest(name: string, visibility: 'public' | 'private' | 'protected' | 'package'): Method {
    this.advance(); // skip (

    const parameters: Parameter[] = [];
    while (!this.check('RPAREN') && !this.isAtEnd() && !this.check('NEWLINE')) {
      if (parameters.length > 0) {
        if (this.check('COMMA')) {
          this.advance();
        }
      }
      const param = this.parseParameter();
      if (param) {
        parameters.push(param);
      } else {
        break;
      }
    }

    if (this.check('RPAREN')) {
      this.advance();
    }

    let returnType = 'void';
    if (this.check('COLON')) {
      this.advance();
      returnType = this.readTypeExpression();
    }

    return { name, returnType, parameters, visibility };
  }

  private parseParameter(): Parameter | null {
    if (!this.check('IDENTIFIER')) return null;
    const name = this.current().value;
    this.advance();

    if (!this.check('COLON')) {
      return { name, type: 'any' };
    }
    this.advance();

    const type = this.readTypeExpression();
    return { name, type };
  }

  private readTypeExpression(): string {
    let type = '';
    // Read type tokens until we hit a newline, comma, rparen, or other delimiter
    while (!this.isAtEnd()) {
      const tok = this.current();
      if (tok.type === 'NEWLINE' || tok.type === 'RBRACE' || tok.type === 'EOF') break;
      if (tok.type === 'COMMA' || tok.type === 'RPAREN') break;

      if (tok.type === 'IDENTIFIER' || tok.type === 'NUMBER') {
        type += tok.value;
        this.advance();
      } else if (tok.value === '[' || tok.value === ']' || tok.value === '<' || tok.value === '>' || tok.value === '.') {
        type += tok.value;
        this.advance();
      } else {
        // Read raw characters for type expressions like OrderItem[]
        break;
      }
    }
    return type.trim() || 'any';
  }

  // --- Simple element (lifeline, actor, usecase, action, state, etc.) ---
  private parseSimpleElement(elementType: ElementType): ParsedElement {
    this.advance(); // skip keyword

    const name = this.expectName();
    const annotations = this.parseAnnotations();

    return {
      kind: 'element',
      type: elementType,
      properties: { name },
      position: annotations.position ?? undefined,
      size: annotations.size ?? undefined,
    };
  }

  // --- Container element (system-boundary, composite-state) ---
  private parseContainerElement(elementType: ElementType): ParsedElement {
    this.advance(); // skip keyword

    const name = this.expectName();
    const annotations = this.parseAnnotations();

    const children: ParsedElement[] = [];

    if (this.check('LBRACE')) {
      this.advance(); // skip {
      this.skipNewlines();

      const childDiagramType: DiagramType = elementType === 'system-boundary' ? 'usecase' : 'state';

      while (!this.check('RBRACE') && !this.isAtEnd()) {
        if (this.check('NEWLINE')) {
          this.skipNewlines();
          continue;
        }

        const item = this.parseBodyItem(childDiagramType);
        if (item) {
          if (item.kind === 'element') {
            children.push(item);
          }
          // Connectors inside containers are also valid (transitions in composite-state)
        }
        this.skipNewlines();
      }

      if (this.check('RBRACE')) {
        this.advance();
      } else {
        this.addError('Expected closing }');
      }
    }

    return {
      kind: 'element',
      type: elementType,
      properties: { name },
      position: annotations.position ?? undefined,
      size: annotations.size ?? undefined,
      children,
    };
  }

  // --- Relation/Connector parsing ---
  // Format: Source [multiplicity] arrow [multiplicity] Target [: label]
  // Also handles sequence messages: Source -> Target : label
  private parseRelation(diagramType: DiagramType): ParsedConnector | null {
    const sourceName = this.expectName();

    // Optional source multiplicity (quoted string between source name and arrow)
    // A STRING here is multiplicity only if followed by an ARROW
    let sourceMultiplicity: string | undefined;
    if (this.check('STRING')) {
      // Look ahead: if next token is ARROW, this string is a multiplicity
      const nextIdx = this.pos + 1;
      const nextTok = nextIdx < this.tokens.length ? this.tokens[nextIdx] : null;
      if (nextTok && nextTok.type === 'ARROW') {
        sourceMultiplicity = this.current().value;
        this.advance();
      }
      // Otherwise it might be something else — don't consume
    }

    // Arrow
    if (!this.check('ARROW')) {
      this.addError('Expected arrow (-->, ->, etc.)');
      this.skipToNextLine();
      return null;
    }
    const arrowTok = this.current();
    const connectorType = resolveArrowType(arrowTok.value, diagramType);
    if (!connectorType) {
      this.addError(`Unknown arrow type: ${arrowTok.value}`);
      this.skipToNextLine();
      return null;
    }
    this.advance();

    // Optional target multiplicity
    // A STRING after the arrow could be either a multiplicity or the target name.
    // It's a multiplicity only if followed by another IDENTIFIER/STRING (the actual target).
    let targetMultiplicity: string | undefined;
    if (this.check('STRING')) {
      // Look ahead: if next token after this string is IDENTIFIER or STRING, this is multiplicity
      const nextIdx = this.pos + 1;
      const nextTok = nextIdx < this.tokens.length ? this.tokens[nextIdx] : null;
      if (nextTok && (nextTok.type === 'IDENTIFIER' || nextTok.type === 'STRING')) {
        targetMultiplicity = this.current().value;
        this.advance();
      }
      // Otherwise, the STRING is the target name — don't consume it here
    }

    // Target name
    const targetName = this.expectName();

    // Optional label after :
    let label: string | undefined;
    if (this.check('COLON')) {
      this.advance();
      label = this.readLabelText();
    }

    return {
      kind: 'connector',
      type: connectorType,
      sourceName,
      targetName,
      label,
      sourceMultiplicity,
      targetMultiplicity,
    };
  }

  // --- Annotations (@position, @size) ---
  private parseAnnotations(): { position: Position | null; size: Size | null } {
    let position: Position | null = null;
    let size: Size | null = null;

    while (this.check('ANNOTATION')) {
      const ann = this.current().value;
      this.advance();

      if (ann === '@position') {
        position = this.parsePositionArgs();
      } else if (ann === '@size') {
        size = this.parseSizeArgs();
      }
    }

    return { position, size };
  }

  private parsePositionArgs(): Position | null {
    if (!this.check('LPAREN')) return null;
    this.advance();

    const x = this.expectNumber();
    if (this.check('COMMA')) this.advance();
    const y = this.expectNumber();

    if (this.check('RPAREN')) this.advance();

    return { x, y };
  }

  private parseSizeArgs(): Size | null {
    if (!this.check('LPAREN')) return null;
    this.advance();

    const width = this.expectNumber();
    if (this.check('COMMA')) this.advance();
    const height = this.expectNumber();

    if (this.check('RPAREN')) this.advance();

    return { width, height };
  }

  // --- Build final DiagramData ---
  private buildDiagram(type: DiagramType, name: string, items: ParsedItem[]): DiagramData {
    const elements: DiagramElement[] = [];
    const connectors: Connector[] = [];
    const nameToId: Record<string, string> = {};
    let elementIndex = 0;

    // First pass: create elements
    for (const item of items) {
      if (item.kind === 'element') {
        this.addElement(item, elements, nameToId, elementIndex);
        elementIndex++;
      }
    }

    // Second pass: create connectors with resolved IDs
    for (const item of items) {
      if (item.kind === 'connector') {
        const sourceId = nameToId[item.sourceName] || item.sourceName;
        const targetId = nameToId[item.targetName] || item.targetName;

        const connector: Connector = {
          id: makeId('conn'),
          type: item.type,
          sourceId,
          targetId,
          label: item.label,
          sourceMultiplicity: item.sourceMultiplicity,
          targetMultiplicity: item.targetMultiplicity,
          properties: {} as ConnectorProperties,
        };
        connectors.push(connector);
      }
    }

    return {
      id: makeId('diagram'),
      name,
      type,
      elements,
      connectors,
      viewport: { x: 0, y: 0, zoom: 1.0 },
    };
  }

  private addElement(
    parsed: ParsedElement,
    elements: DiagramElement[],
    nameToId: Record<string, string>,
    index: number,
  ): void {
    const id = makeId(parsed.type);
    nameToId[parsed.properties.name] = id;

    const element: DiagramElement = {
      id,
      type: parsed.type,
      position: parsed.position || defaultPosition(index),
      size: parsed.size || defaultSize(parsed.type),
      properties: parsed.properties,
    };
    elements.push(element);

    // Add children as separate elements (for system-boundary, composite-state)
    if (parsed.children) {
      for (const child of parsed.children) {
        this.addElement(child, elements, nameToId, elements.length);
      }
    }
  }

  // --- Utility methods ---
  private expectName(): string {
    const tok = this.current();
    if (tok.type === 'STRING') {
      this.advance();
      return tok.value;
    }
    if (tok.type === 'IDENTIFIER') {
      this.advance();
      return tok.value;
    }
    this.addError('Expected name (identifier or quoted string)');
    return 'unnamed';
  }

  private expectNumber(): number {
    const tok = this.current();
    if (tok.type === 'NUMBER') {
      this.advance();
      return parseInt(tok.value, 10);
    }
    this.addError('Expected number');
    return 0;
  }

  private readLabelText(): string {
    let text = '';
    while (!this.isAtEnd() && !this.check('NEWLINE') && !this.check('EOF')) {
      text += this.current().value;
      if (this.current().type === 'COLON') text += ':';
      this.advance();
    }
    return text.trim();
  }

  private current(): Token {
    if (this.pos >= this.tokens.length) {
      return { type: 'EOF', value: '', line: 0, column: 0 };
    }
    return this.tokens[this.pos];
  }

  private advance(): void {
    if (this.pos < this.tokens.length) {
      this.pos++;
    }
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private isAtEnd(): boolean {
    return this.current().type === 'EOF';
  }

  private skipNewlines(): void {
    while (this.check('NEWLINE')) {
      this.advance();
    }
  }

  private skipToNextLine(): void {
    while (!this.isAtEnd() && !this.check('NEWLINE')) {
      this.advance();
    }
    this.skipNewlines();
  }

  private addError(message: string): void {
    const tok = this.current();
    this.errors.push({
      line: tok.line,
      column: tok.column,
      message,
    });
  }

  private makeError(message: string): DSLError {
    const tok = this.current();
    return {
      line: tok.line || 1,
      column: tok.column || 1,
      message,
    };
  }
}
