// =============================================================================
// Diagram rules (A03.03, A03.04)
//
// Shared semantic checks for one diagram model. They accept only what the DSL
// can write and read back unchanged, so the file reader, the DSL pipeline and
// the inspector reject the same values. Nothing is repaired or trimmed here.
// =============================================================================

import type { Connector, ConnectorType, DiagramData, DiagramElement, DiagramType, DSLError, DSLParseResult, ElementType } from '../types';
import { parseDSL } from '../parser/dsl/peggyParser';
import { CONNECTOR_TYPES, ELEMENT_TYPES } from './elementFactory';

export interface DiagramRuleError {
  message: string;
  /** Path inside the diagram, such as `elements[2].properties.attributes[0].name`. */
  path: string;
}

/** Same character classes as `Identifier` in `uml.pegjs`. */
const IDENTIFIER = /^[a-zA-Z_À-ɏ가-힯][a-zA-Z0-9_À-ɏ가-힯]*$/;
/** `TypeExpr` characters; the parser trims the result, so edges cannot be spaces. */
const TYPE_EXPR = /^[a-zA-Z0-9_[\]<>,.À-ɏ가-힯 ]+$/;
const VISIBILITIES = new Set(['public', 'private', 'protected', 'package']);
const CLASSIFIERS = new Set<ElementType>(['class', 'interface', 'abstract-class', 'enum']);
/** Class relations whose ends carry a multiplicity (D-01). */
const MULTIPLICITY_RELATIONS = new Set<ConnectorType>(['association', 'directed-association', 'aggregation', 'composition']);
/** Kinds whose DSL line has no label. */
const UNLABELED = new Set<ConnectorType>(['include', 'extend']);
const MESSAGES = new Set<ConnectorType>(['sync-message', 'async-message', 'return-message']);

export function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value);
}

/** A type the DSL reads back as written. Parameter types also cannot hold a comma. */
export function isTypeExpression(value: unknown, inParameterList = false): value is string {
  return typeof value === 'string' && TYPE_EXPR.test(value) && value.trim() === value
    && !(inParameterList && value.includes(','));
}

/**
 * One multiplicity end: `n`, `*`, `n..m` or `n..*`, with n ≤ m. Returns a
 * reason when the value is invalid, otherwise undefined.
 */
export function multiplicityProblem(value: string): string | undefined {
  const match = /^(?:(\d+)|\*|(\d+)\.\.(\d+|\*))$/.exec(value);
  if (!match) return 'use n, *, n..m or n..*';
  const [, , lower, upper] = match;
  if (lower !== undefined && upper !== '*' && Number(lower) > Number(upper)) {
    return `the lower bound ${lower} is above the upper bound ${upper}`;
  }
  return undefined;
}

/** A label the DSL keeps as written: one line with no leading or trailing space. */
function labelProblem(label: string): string | undefined {
  if (/[\r\n]/.test(label)) return 'must fit on one line';
  if (label.trim() !== label) return 'cannot start or end with a space';
  if (label === '') return 'cannot be empty';
  return undefined;
}

function describe(element: DiagramElement): string {
  return `${element.type} ${JSON.stringify(element.properties.name)}`;
}

// -----------------------------------------------------------------------------
// A03.03: names, members and multiplicity
// -----------------------------------------------------------------------------

export function validateDiagramProperties(diagram: DiagramData): DiagramRuleError[] {
  const errors: DiagramRuleError[] = [];
  const names = new Map<string, number>();

  diagram.elements.forEach((element, i) => {
    const path = `elements[${i}].properties`;
    const { name, stereotype, visibility, attributes, methods } = element.properties;
    if (typeof name !== 'string' || name.trim() === '') {
      errors.push({ message: `Element ${element.id} needs a name`, path: `${path}.name` });
    } else if (names.has(name)) {
      errors.push({
        message: `Two elements in this diagram are named ${JSON.stringify(name)}; connections could not tell them apart`,
        path: `${path}.name`,
      });
    } else {
      names.set(name, i);
    }

    const classifier = CLASSIFIERS.has(element.type);
    if (stereotype !== undefined) {
      if (!classifier) {
        errors.push({ message: `A ${element.type} cannot have a stereotype`, path: `${path}.stereotype` });
      } else if (typeof stereotype !== 'string' || stereotype.trim() === '' || stereotype.trim() !== stereotype || /[<>\r\n]/.test(stereotype)) {
        errors.push({ message: `Stereotype of ${describe(element)} must be text without <, >, line breaks or surrounding spaces`, path: `${path}.stereotype` });
      }
    }
    if (visibility !== undefined) {
      if (!classifier) {
        errors.push({ message: `A ${element.type} cannot have a visibility`, path: `${path}.visibility` });
      } else if (!VISIBILITIES.has(visibility)) {
        errors.push({ message: `Unknown visibility ${JSON.stringify(visibility)} on ${describe(element)}`, path: `${path}.visibility` });
      }
    }

    if (!classifier) {
      if (attributes !== undefined && attributes.length > 0) {
        errors.push({ message: `A ${element.type} cannot have attributes`, path: `${path}.attributes` });
      }
      if (methods !== undefined && methods.length > 0) {
        errors.push({ message: `A ${element.type} cannot have methods`, path: `${path}.methods` });
      }
      return;
    }

    if (element.type === 'enum') {
      attributes?.forEach((value, j) => {
        if (!isIdentifier(value.name)) {
          errors.push({ message: `Enum value ${JSON.stringify(value.name)} in ${describe(element)} must be an identifier`, path: `${path}.attributes[${j}].name` });
        }
        // The DSL writes only the value name; it reads back an empty type and public visibility.
        if (value.type !== '') {
          errors.push({ message: `Enum value ${JSON.stringify(value.name)} in ${describe(element)} cannot have a type`, path: `${path}.attributes[${j}].type` });
        }
        if (value.visibility !== 'public') {
          errors.push({ message: `Enum value ${JSON.stringify(value.name)} in ${describe(element)} cannot have a visibility`, path: `${path}.attributes[${j}].visibility` });
        }
      });
      if (methods !== undefined && methods.length > 0) {
        errors.push({ message: `Enum ${JSON.stringify(name)} cannot have methods`, path: `${path}.methods` });
      }
      return;
    }

    attributes?.forEach((attribute, j) => {
      const at = `${path}.attributes[${j}]`;
      if (!isIdentifier(attribute.name)) {
        errors.push({ message: `Attribute name ${JSON.stringify(attribute.name)} in ${describe(element)} must be an identifier (letters, digits, _; not starting with a digit)`, path: `${at}.name` });
      }
      if (!isTypeExpression(attribute.type)) {
        errors.push({ message: `Attribute ${JSON.stringify(attribute.name)} in ${describe(element)} has a type the DSL cannot hold`, path: `${at}.type` });
      }
      if (!VISIBILITIES.has(attribute.visibility)) {
        errors.push({ message: `Unknown visibility on attribute ${JSON.stringify(attribute.name)}`, path: `${at}.visibility` });
      }
    });
    methods?.forEach((method, j) => {
      const at = `${path}.methods[${j}]`;
      if (!isIdentifier(method.name)) {
        errors.push({ message: `Method name ${JSON.stringify(method.name)} in ${describe(element)} must be an identifier (letters, digits, _; not starting with a digit)`, path: `${at}.name` });
      }
      if (!isTypeExpression(method.returnType)) {
        errors.push({ message: `Method ${JSON.stringify(method.name)} in ${describe(element)} has a return type the DSL cannot hold`, path: `${at}.returnType` });
      }
      if (!VISIBILITIES.has(method.visibility)) {
        errors.push({ message: `Unknown visibility on method ${JSON.stringify(method.name)}`, path: `${at}.visibility` });
      }
      const seen = new Set<string>();
      method.parameters.forEach((parameter, k) => {
        const pt = `${at}.parameters[${k}]`;
        if (!isIdentifier(parameter.name)) {
          errors.push({ message: `Parameter name ${JSON.stringify(parameter.name)} of ${JSON.stringify(method.name)} must be an identifier`, path: `${pt}.name` });
        } else if (seen.has(parameter.name)) {
          errors.push({ message: `Method ${JSON.stringify(method.name)} has two parameters named ${JSON.stringify(parameter.name)}`, path: `${pt}.name` });
        }
        seen.add(parameter.name);
        if (!isTypeExpression(parameter.type, true)) {
          errors.push({ message: `Parameter ${JSON.stringify(parameter.name)} of ${JSON.stringify(method.name)} has a type the DSL cannot hold (commas end the parameter)`, path: `${pt}.type` });
        }
      });
    });
  });

  diagram.connectors.forEach((connector, i) => {
    const path = `connectors[${i}]`;
    for (const end of ['sourceMultiplicity', 'targetMultiplicity'] as const) {
      const value = connector[end];
      if (value === undefined) continue;
      if (diagram.type !== 'class' || !MULTIPLICITY_RELATIONS.has(connector.type)) {
        errors.push({ message: `A ${connector.type} in a ${diagram.type} diagram has no multiplicity`, path: `${path}.${end}` });
        continue;
      }
      const problem = typeof value === 'string' ? multiplicityProblem(value) : 'it must be text';
      if (problem) {
        errors.push({ message: `Multiplicity ${JSON.stringify(value)} on connector ${connector.id} is invalid: ${problem}`, path: `${path}.${end}` });
      }
    }

    if (connector.label !== undefined) {
      if (UNLABELED.has(connector.type)) {
        errors.push({ message: `An ${connector.type} relation has no label`, path: `${path}.label` });
      } else {
        const problem = typeof connector.label === 'string' ? labelProblem(connector.label) : 'must be text';
        if (problem) errors.push({ message: `Label of connector ${connector.id} ${problem}`, path: `${path}.label` });
      }
    } else if (MESSAGES.has(connector.type)) {
      errors.push({ message: `Message ${connector.id} needs a label`, path: `${path}.label` });
    }
  });

  return errors;
}

// -----------------------------------------------------------------------------
// A03.04: element kinds and connector ends (D-01–D-05)
// -----------------------------------------------------------------------------

type EndCheck = (source: DiagramElement, target: DiagramElement) => string | undefined;

const CLASS_BASE = new Set<ElementType>(['class', 'abstract-class']);
const ACTIVITY_NODES = new Set<ElementType>(ELEMENT_TYPES.activity);
const STATE_NODES = new Set<ElementType>(ELEMENT_TYPES.state);

function classEnds(type: ConnectorType): EndCheck {
  return (source, target) => {
    if (!CLASSIFIERS.has(source.type) || !CLASSIFIERS.has(target.type)) return 'both ends must be classes, interfaces or enums';
    if (type === 'inheritance') {
      const sameFamily = (CLASS_BASE.has(source.type) && CLASS_BASE.has(target.type))
        || (source.type === 'interface' && target.type === 'interface');
      if (!sameFamily) return 'a class extends a class, and an interface extends an interface';
    }
    if (type === 'realization' && (target.type !== 'interface' || source.type === 'interface')) {
      return 'a class or enum realizes an interface';
    }
    return undefined;
  };
}

function flowEnds(nodes: Set<ElementType>, start: ElementType, finish: ElementType): EndCheck {
  return (source, target) => {
    if (!nodes.has(source.type) || !nodes.has(target.type)) return 'both ends must be nodes of this diagram';
    if (target.type === start) return `nothing can enter the ${start}`;
    if (source.type === finish) return `nothing can leave the ${finish}`;
    return undefined;
  };
}

const usecaseAssociation: EndCheck = (source, target) => {
  const kinds = new Set([source.type, target.type]);
  return kinds.size === 2 && kinds.has('actor') && kinds.has('usecase')
    ? undefined : 'it connects an actor and a use case';
};
const usecasePair: EndCheck = (source, target) => (
  source.type === 'usecase' && target.type === 'usecase' ? undefined : 'it connects two use cases'
);
const lifelines: EndCheck = (source, target) => (
  source.type === 'lifeline' && target.type === 'lifeline' ? undefined : 'messages connect lifelines'
);

function endRule(diagramType: DiagramType, type: ConnectorType): EndCheck {
  switch (diagramType) {
    case 'class': return classEnds(type);
    case 'sequence': return lifelines;
    case 'usecase': return type === 'include' || type === 'extend' ? usecasePair : usecaseAssociation;
    case 'activity': return flowEnds(ACTIVITY_NODES, 'initial-node', 'final-node');
    case 'state': return flowEnds(STATE_NODES, 'initial-state', 'final-state');
  }
}

export function validateDiagramConnections(diagram: DiagramData): DiagramRuleError[] {
  const errors: DiagramRuleError[] = [];
  const allowedElements = ELEMENT_TYPES[diagram.type];
  const allowedConnectors = CONNECTOR_TYPES[diagram.type];
  const elements = new Map(diagram.elements.map((element) => [element.id, element]));

  diagram.elements.forEach((element, i) => {
    if (!allowedElements.includes(element.type)) {
      errors.push({ message: `A ${diagram.type} diagram cannot hold a ${element.type} (element ${element.id})`, path: `elements[${i}].type` });
    }
  });

  diagram.connectors.forEach((connector: Connector, i) => {
    const path = `connectors[${i}]`;
    if (!allowedConnectors.includes(connector.type)) {
      errors.push({ message: `A ${diagram.type} diagram cannot hold a ${connector.type} (connector ${connector.id})`, path: `${path}.type` });
      return;
    }
    if (connector.sourceId === connector.targetId) {
      errors.push({ message: `Connector ${connector.id} starts and ends on the same element; self-links are not supported`, path: `${path}.targetId` });
      return;
    }
    const source = elements.get(connector.sourceId);
    const target = elements.get(connector.targetId);
    if (!source || !target) return; // Missing ends are reported by the reference rules.
    const problem = endRule(diagram.type, connector.type)(source, target);
    if (problem) {
      errors.push({
        message: `A ${connector.type} from ${describe(source)} to ${describe(target)} is not allowed: ${problem}`,
        path,
      });
    }
  });

  return errors;
}

/** All A03.03 and A03.04 rules for one diagram. */
export function validateDiagramRules(diagram: DiagramData): DiagramRuleError[] {
  return [...validateDiagramConnections(diagram), ...validateDiagramProperties(diagram)];
}

// -----------------------------------------------------------------------------
// A03.06: the same rules after DSL parsing
// -----------------------------------------------------------------------------

/** Any relation or message arrow of the grammar. */
const ARROW = /--|\.\.|->|<-/;

function nameTokens(name: string): string[] {
  return IDENTIFIER.test(name) ? [name] : [JSON.stringify(name)];
}

/** Best-effort source line of a rule error: the line that names the element or both connector ends. */
function locate(diagram: DiagramData, error: DiagramRuleError, lines: string[]): number {
  const match = /^(elements|connectors)\[(\d+)\]/.exec(error.path);
  if (!match) return 1;
  const names = new Map(diagram.elements.map((element) => [element.id, element.properties.name]));
  const wanted: string[][] = [];
  if (match[1] === 'elements') {
    const name = diagram.elements[Number(match[2])]?.properties.name;
    if (typeof name === 'string') wanted.push(nameTokens(name));
  } else {
    const connector = diagram.connectors[Number(match[2])];
    for (const end of connector ? [connector.sourceId, connector.targetId] : []) {
      const name = names.get(end);
      if (typeof name === 'string') wanted.push(nameTokens(name));
    }
  }
  if (wanted.length === 0) return 1;
  const part = /[a-zA-Z0-9_\u00C0-\u024F\uAC00-\uD7AF]/;
  const wordCount = (line: string, token: string) => {
    let count = 0;
    for (let at = line.indexOf(token); at >= 0; at = line.indexOf(token, at + token.length)) {
      const before = line[at - 1];
      const after = line[at + token.length];
      if (!(before && part.test(before)) && !(after && part.test(after))) count++;
    }
    return count;
  };
  const isWord = (line: string, token: string) => wordCount(line, token) > 0;
  const index = Number(match[2]);
  if (match[1] === 'connectors') {
    // Connector lines are in model order, so the n-th connector between the same two
    // elements sits on the n-th relation line that names both of them.
    const hits = lines.flatMap((line, i) => (
      ARROW.test(line) && wanted.every((tokens) => tokens.some((token) => isWord(line, token)))
        // A self-link names its element twice.
        && (wanted.length < 2 || wanted[0][0] !== wanted[1][0] || wordCount(line, wanted[0][0]) >= 2) ? [i + 1] : []
    ));
    const pair = (connector: Connector) => [names.get(connector.sourceId), names.get(connector.targetId)].sort().join('\u0000');
    const key = pair(diagram.connectors[index]);
    const earlier = diagram.connectors.slice(0, index).filter((connector) => pair(connector) === key).length;
    return hits[earlier] ?? hits[hits.length - 1] ?? 1;
  }
  const hits = lines.flatMap((line, i) => (
    wanted.every((tokens) => tokens.some((token) => isWord(line, token))) ? [i + 1] : []
  ));
  // The n-th element with this name is declared on the n-th line that names it.
  const name = diagram.elements[index].properties.name;
  const earlier = diagram.elements.slice(0, index).filter((element) => element.properties.name === name).length;
  return hits[earlier] ?? hits[0] ?? 1;
}

/** Rule errors for a parsed diagram, as editor diagnostics on the line that caused them. */
export function ruleDiagnostics(diagram: DiagramData, text: string): DSLError[] {
  const lines = text.split(/\r\n|\n|\r/);
  return validateDiagramRules(diagram).map((error) => ({ line: locate(diagram, error, lines), column: 1, message: error.message }));
}

/** Parse DSL text and apply the diagram rules; rule errors fail the parse like syntax errors. */
export function parseCheckedDSL(text: string): DSLParseResult {
  const result = parseDSL(text);
  if (!result.success) return result;
  const errors = ruleDiagnostics(result.diagram, text);
  return errors.length > 0 ? { success: false, errors } : result;
}
