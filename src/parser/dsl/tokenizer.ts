// =============================================================================
// DSL Tokenizer - Lexer for UML DSL text
// =============================================================================

export type TokenType =
  | 'HEADER'          // @class-diagram, @sequence-diagram, etc.
  | 'KEYWORD'         // class, interface, enum, abstract, lifeline, actor, etc.
  | 'IDENTIFIER'      // names (alphanumeric + unicode)
  | 'STRING'          // "quoted string"
  | 'VISIBILITY'      // +, -, #, ~
  | 'LBRACE'          // {
  | 'RBRACE'          // }
  | 'LPAREN'          // (
  | 'RPAREN'          // )
  | 'COLON'           // :
  | 'COMMA'           // ,
  | 'ARROW'           // -->, -->, ->>, ->, <|--, --|>, etc.
  | 'ANNOTATION'      // @position, @size
  | 'NUMBER'          // integer
  | 'MULTIPLICITY'    // "1", "*", "0..1" etc. (quoted)
  | 'NEWLINE'         // \n
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

const HEADERS = [
  '@class-diagram',
  '@sequence-diagram',
  '@usecase-diagram',
  '@activity-diagram',
  '@state-diagram',
];

const KEYWORDS = new Set([
  'class', 'interface', 'abstract', 'enum',
  'lifeline',
  'actor', 'usecase', 'system-boundary',
  'action', 'decision', 'fork', 'join', 'initial-node', 'final-node',
  'state', 'composite-state', 'initial-state', 'final-state',
  'note', 'package',
]);

const ANNOTATIONS = ['@position', '@size'];

// Arrow patterns ordered by length (longest first for greedy matching)
const ARROW_PATTERNS = [
  '<|..',  // realization (left)
  '..|>',  // realization (right)
  '<|--',  // inheritance (left)
  '--|>',  // inheritance (right)
  'o--',   // aggregation (left)
  '--o',   // aggregation (right)
  '*--',   // composition (left)
  '--*',   // composition (right)
  '->>',   // async-message
  '..>',   // dependency
  '-->',   // directed-association / return-message / transition
  '->',    // sync-message
  '..',    // dependency (no arrow)
  '--',    // association
];

export class Tokenizer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    this.tokens = [];
    while (this.pos < this.input.length) {
      this.skipSpacesAndTabs();
      if (this.pos >= this.input.length) break;

      const ch = this.input[this.pos];

      // Comments (// to end of line)
      if (ch === '/' && this.peek(1) === '/') {
        this.skipLineComment();
        continue;
      }

      // Newlines
      if (ch === '\n' || ch === '\r') {
        this.consumeNewline();
        continue;
      }

      // Headers (@class-diagram etc.)
      if (ch === '@') {
        if (this.tryHeader()) continue;
        if (this.tryAnnotation()) continue;
        // Unknown @ token - produce identifier
        this.addToken('IDENTIFIER', this.readWord());
        continue;
      }

      // Quoted strings
      if (ch === '"') {
        this.readString();
        continue;
      }

      // Braces and brackets
      if (ch === '{') { this.addToken('LBRACE', '{'); this.advance(); continue; }
      if (ch === '}') { this.addToken('RBRACE', '}'); this.advance(); continue; }
      if (ch === '(') { this.addToken('LPAREN', '('); this.advance(); continue; }
      if (ch === ')') { this.addToken('RPAREN', ')'); this.advance(); continue; }
      if (ch === '[') { this.addToken('IDENTIFIER', '['); this.advance(); continue; }
      if (ch === ']') { this.addToken('IDENTIFIER', ']'); this.advance(); continue; }
      if (ch === '<') { this.addToken('IDENTIFIER', '<'); this.advance(); continue; }
      if (ch === '>') { this.addToken('IDENTIFIER', '>'); this.advance(); continue; }
      if (ch === ',') { this.addToken('COMMA', ','); this.advance(); continue; }
      if (ch === ':') { this.addToken('COLON', ':'); this.advance(); continue; }

      // Visibility markers (only at start of member line context)
      if ((ch === '+' || ch === '-' || ch === '#' || ch === '~') && this.isVisibilityContext()) {
        this.addToken('VISIBILITY', ch);
        this.advance();
        continue;
      }

      // Arrows (must check before identifiers since some start with - or .)
      if (this.tryArrow()) continue;

      // Numbers
      if (this.isDigit(ch)) {
        this.readNumber();
        continue;
      }

      // Identifiers / Keywords
      if (this.isIdentStart(ch)) {
        this.readIdentifierOrKeyword();
        continue;
      }

      // Skip unknown characters
      this.advance();
    }

    this.addToken('EOF', '');
    return this.tokens;
  }

  private skipSpacesAndTabs(): void {
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === ' ' || ch === '\t') {
        this.advance();
      } else {
        break;
      }
    }
  }

  private skipLineComment(): void {
    while (this.pos < this.input.length && this.input[this.pos] !== '\n' && this.input[this.pos] !== '\r') {
      this.advance();
    }
  }

  private consumeNewline(): void {
    const ch = this.input[this.pos];
    if (ch === '\r' && this.peek(1) === '\n') {
      this.addToken('NEWLINE', '\n');
      this.pos += 2;
      this.line++;
      this.column = 1;
    } else {
      this.addToken('NEWLINE', '\n');
      this.pos++;
      this.line++;
      this.column = 1;
    }
  }

  private tryHeader(): boolean {
    for (const header of HEADERS) {
      if (this.input.startsWith(header, this.pos)) {
        const afterIdx = this.pos + header.length;
        if (afterIdx >= this.input.length || !this.isIdentPart(this.input[afterIdx])) {
          this.addToken('HEADER', header);
          this.pos += header.length;
          this.column += header.length;
          return true;
        }
      }
    }
    return false;
  }

  private tryAnnotation(): boolean {
    for (const ann of ANNOTATIONS) {
      if (this.input.startsWith(ann, this.pos)) {
        const afterIdx = this.pos + ann.length;
        if (afterIdx >= this.input.length || !this.isIdentPart(this.input[afterIdx])) {
          this.addToken('ANNOTATION', ann);
          this.pos += ann.length;
          this.column += ann.length;
          return true;
        }
      }
    }
    return false;
  }

  private tryArrow(): boolean {
    for (const arrow of ARROW_PATTERNS) {
      if (this.input.startsWith(arrow, this.pos)) {
        // Make sure it's not part of a longer identifier
        const afterIdx = this.pos + arrow.length;
        const charAfter = afterIdx < this.input.length ? this.input[afterIdx] : '';
        // Arrows ending with letters shouldn't match if followed by letters
        // But most arrows end with >, -, . so this is fine
        this.addToken('ARROW', arrow);
        this.pos += arrow.length;
        this.column += arrow.length;
        return true;
      }
    }
    return false;
  }

  private isVisibilityContext(): boolean {
    const ch = this.input[this.pos];
    // + - # ~ are visibility markers when followed by a space then identifier
    if (ch === '+' || ch === '#' || ch === '~') return true;
    // For '-', check it's not part of an arrow
    if (ch === '-') {
      const next = this.peek(1);
      // If next char is -, >, it's an arrow
      if (next === '-' || next === '>') return false;
      return true;
    }
    return false;
  }

  private readString(): void {
    const startLine = this.line;
    const startCol = this.column;
    this.advance(); // skip opening "
    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      if (this.input[this.pos] === '\\' && this.pos + 1 < this.input.length) {
        this.advance();
        value += this.input[this.pos];
      } else {
        value += this.input[this.pos];
      }
      this.advance();
    }
    if (this.pos < this.input.length) {
      this.advance(); // skip closing "
    }
    this.tokens.push({ type: 'STRING', value, line: startLine, column: startCol });
  }

  private readNumber(): void {
    const startLine = this.line;
    const startCol = this.column;
    let value = '';
    while (this.pos < this.input.length && this.isDigit(this.input[this.pos])) {
      value += this.input[this.pos];
      this.advance();
    }
    this.tokens.push({ type: 'NUMBER', value, line: startLine, column: startCol });
  }

  private readIdentifierOrKeyword(): void {
    const word = this.readWord();
    // Check for compound keywords
    if (word === 'abstract') {
      // Look ahead for 'class'
      const savedPos = this.pos;
      const savedLine = this.line;
      const savedCol = this.column;
      this.skipSpacesAndTabs();
      if (this.input.startsWith('class', this.pos) && !this.isIdentPart(this.input[this.pos + 5])) {
        // It's "abstract class" - emit as single keyword
        this.pos += 5;
        this.column += 5;
        this.tokens[this.tokens.length - 1] = {
          ...this.tokens[this.tokens.length - 1],
          type: 'KEYWORD',
          value: 'abstract class',
        };
        return;
      }
      // Restore position
      this.pos = savedPos;
      this.line = savedLine;
      this.column = savedCol;
    }

    // Check compound keywords with hyphens (already read as part of identifier)
    if (KEYWORDS.has(word)) {
      this.tokens[this.tokens.length - 1].type = 'KEYWORD';
    }
  }

  private readWord(): string {
    const startLine = this.line;
    const startCol = this.column;
    let value = '';
    while (this.pos < this.input.length && this.isIdentPart(this.input[this.pos])) {
      value += this.input[this.pos];
      this.advance();
    }
    this.tokens.push({ type: 'IDENTIFIER', value, line: startLine, column: startCol });
    return value;
  }

  private addToken(type: TokenType, value: string): void {
    this.tokens.push({ type, value, line: this.line, column: this.column });
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }

  private peek(offset: number): string {
    const idx = this.pos + offset;
    return idx < this.input.length ? this.input[idx] : '';
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isIdentStart(ch: string): boolean {
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') return true;
    // Unicode: Latin Extended, Korean
    const code = ch.charCodeAt(0);
    return (code >= 0x00C0 && code <= 0x024F) || (code >= 0xAC00 && code <= 0xD7AF);
  }

  private isIdentPart(ch: string): boolean {
    return this.isIdentStart(ch) || this.isDigit(ch) || ch === '-';
  }
}
