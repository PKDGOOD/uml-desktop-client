// =============================================================================
// DSL Serializer - DiagramData → DSL text
// =============================================================================

import type {
  DiagramData,
  DiagramElement,
  Connector,
  Attribute,
  Method,
  ConnectorType,
} from '../../types';

// Visibility → DSL marker
const visibilityMarker: Record<string, string> = {
  public: '+',
  private: '-',
  protected: '#',
  package: '~',
};

/**
 * Serialize a DiagramData structure into a valid DSL text string
 * that can be parsed back by the peggy parser.
 */
export function serializeDSL(diagram: DiagramData): string {
  const lines: string[] = [];

  // Header
  lines.push(`@${diagram.type}-diagram ${JSON.stringify(diagram.name)}`);
  lines.push('');

  // Build reverse lookup: element ID → element name
  const idToName = new Map<string, string>();
  for (const el of diagram.elements) {
    idToName.set(el.id, el.properties.name);
  }

  // Serialize elements based on diagram type
  switch (diagram.type) {
    case 'class':
      serializeClassElements(diagram.elements, diagram.connectors, idToName, lines);
      break;
    case 'sequence':
      serializeSequenceElements(diagram.elements, diagram.connectors, idToName, lines);
      break;
    case 'usecase':
      serializeUsecaseElements(diagram.elements, diagram.connectors, idToName, lines);
      break;
    case 'activity':
      serializeActivityElements(diagram.elements, diagram.connectors, idToName, lines);
      break;
    case 'state':
      serializeStateElements(diagram.elements, diagram.connectors, idToName, lines);
      break;
  }

  return lines.join('\n') + '\n';
}

// =============================================================================
// Helpers
// =============================================================================

/** Format a name: quote it if it contains spaces or special chars, otherwise bare identifier */
function formatName(name: string): string {
  if (/^[a-zA-Z_\u00C0-\u024F\uAC00-\uD7AF][a-zA-Z0-9_\u00C0-\u024F\uAC00-\uD7AF]*$/.test(name)) {
    return name;
  }
  return JSON.stringify(name);
}

/** Format a stereotype as ` <<name>>`; empty or unrepresentable values are omitted */
function formatStereotype(stereotype: string | undefined): string {
  const value = stereotype?.trim();
  if (!value || /[<>\r\n]/.test(value)) return '';
  return ` <<${value}>>`;
}

/** Format @pos and @size annotations */
function formatAnnotations(el: DiagramElement): string {
  const parts: string[] = [];
  if (el.position) {
    parts.push(`@pos(${el.position.x}, ${el.position.y})`);
  }
  if (el.size) {
    parts.push(`@size(${el.size.width}, ${el.size.height})`);
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

/** Serialize a single attribute line */
function serializeAttribute(attr: Attribute): string {
  const vis = visibilityMarker[attr.visibility] || '+';
  return `  ${vis} ${attr.name}: ${attr.type}`;
}

/** Serialize a single method line */
function serializeMethod(method: Method): string {
  const vis = visibilityMarker[method.visibility] || '+';
  const params = method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
  return `  ${vis} ${method.name}(${params}): ${method.returnType}`;
}

// =============================================================================
// Class Diagram Serialization
// =============================================================================

function serializeClassElements(
  elements: DiagramElement[],
  connectors: Connector[],
  idToName: Map<string, string>,
  lines: string[],
): void {
  for (const el of elements) {
    const name = formatName(el.properties.name);
    const ann = formatAnnotations(el);
    const visMarker = el.properties.visibility ? visibilityMarker[el.properties.visibility] : undefined;
    const vis = visMarker ? `${visMarker} ` : '';
    const stereo = formatStereotype(el.properties.stereotype);

    switch (el.type) {
      case 'class':
        lines.push(`${vis}class ${name}${stereo}${ann} {`);
        serializeClassBody(el, lines);
        lines.push('}');
        break;
      case 'abstract-class':
        lines.push(`${vis}abstract class ${name}${stereo}${ann} {`);
        serializeClassBody(el, lines);
        lines.push('}');
        break;
      case 'interface':
        lines.push(`${vis}interface ${name}${stereo}${ann} {`);
        serializeClassBody(el, lines);
        lines.push('}');
        break;
      case 'enum':
        lines.push(`${vis}enum ${name}${stereo}${ann} {`);
        if (el.properties.attributes) {
          for (const attr of el.properties.attributes) {
            lines.push(`  ${attr.name}`);
          }
        }
        lines.push('}');
        break;
    }
    lines.push('');
  }

  // Connectors
  serializeClassConnectors(connectors, idToName, lines);
}

function serializeClassBody(el: DiagramElement, lines: string[]): void {
  if (el.properties.attributes) {
    for (const attr of el.properties.attributes) {
      lines.push(serializeAttribute(attr));
    }
  }
  if (el.properties.methods) {
    for (const method of el.properties.methods) {
      lines.push(serializeMethod(method));
    }
  }
}

/** Map ConnectorType → DSL arrow syntax for class diagrams */
const classRelationSyntax: Partial<Record<ConnectorType, string>> = {
  'association': '--',
  'directed-association': '-->',
  'aggregation': '--o',
  'composition': '--*',
  'inheritance': '--|>',
  'realization': '..|>',
  'dependency': '..>',
};

function serializeClassConnectors(
  connectors: Connector[],
  idToName: Map<string, string>,
  lines: string[],
): void {
  // Arrows that overlap with TransitionDef's "-->" pattern.
  // When no multiplicities are present, we add empty "" multiplicity
  // so the parser matches RelationDef instead of TransitionDef.
  const ambiguousArrows = new Set(['-->']);

  for (const conn of connectors) {
    const src = formatName(idToName.get(conn.sourceId) ?? conn.sourceId);
    const tgt = formatName(idToName.get(conn.targetId) ?? conn.targetId);
    const arrow = classRelationSyntax[conn.type] || '-->';

    const needsDisambiguation =
      ambiguousArrows.has(arrow) && !conn.sourceMultiplicity && !conn.targetMultiplicity;

    let line = '';
    if (conn.sourceMultiplicity) {
      line += `${src} "${conn.sourceMultiplicity}" ${arrow} `;
    } else if (needsDisambiguation) {
      line += `${src} "" ${arrow} `;
    } else {
      line += `${src} ${arrow} `;
    }
    if (conn.targetMultiplicity) {
      line += `"${conn.targetMultiplicity}" ${tgt}`;
    } else {
      line += tgt;
    }
    if (conn.label) {
      line += ` : ${conn.label}`;
    }
    lines.push(line);
  }
}

// =============================================================================
// Sequence Diagram Serialization
// =============================================================================

function serializeSequenceElements(
  elements: DiagramElement[],
  connectors: Connector[],
  idToName: Map<string, string>,
  lines: string[],
): void {
  for (const el of elements) {
    if (el.type === 'lifeline') {
      lines.push(`lifeline ${formatName(el.properties.name)}${formatAnnotations(el)}`);
    }
  }
  lines.push('');

  // Messages
  const messageSyntax: Partial<Record<ConnectorType, string>> = {
    'sync-message': '->',
    'async-message': '->>',
    'return-message': '<--',
  };

  for (const conn of connectors) {
    const src = formatName(idToName.get(conn.sourceId) ?? conn.sourceId);
    const tgt = formatName(idToName.get(conn.targetId) ?? conn.targetId);
    const arrow = messageSyntax[conn.type] || '->';
    const label = conn.label ?? '';
    lines.push(`${src} ${arrow} ${tgt} : ${label}`);
  }
}

// =============================================================================
// Usecase Diagram Serialization
// =============================================================================

function serializeUsecaseElements(
  elements: DiagramElement[],
  connectors: Connector[],
  idToName: Map<string, string>,
  lines: string[],
): void {
  // Separate elements by type for proper ordering
  const actors: DiagramElement[] = [];
  const usecases: DiagramElement[] = [];
  const boundaries: DiagramElement[] = [];

  for (const el of elements) {
    switch (el.type) {
      case 'actor': actors.push(el); break;
      case 'usecase': usecases.push(el); break;
      case 'system-boundary': boundaries.push(el); break;
    }
  }

  for (const el of actors) {
    lines.push(`actor ${formatName(el.properties.name)}${formatAnnotations(el)}`);
  }

  // Standalone usecases (not inside a boundary)
  // We track which usecases are children of boundaries by checking if they
  // appear right after a boundary in the elements array. Since the parser
  // flattens children, we need a heuristic. For simplicity, if there are
  // boundaries, we assume usecases that appear after a boundary (until the
  // next non-usecase) are its children. But a cleaner approach: if there are
  // no boundaries, all usecases are standalone.
  if (boundaries.length === 0) {
    for (const el of usecases) {
      lines.push(`usecase ${formatName(el.properties.name)}${formatAnnotations(el)}`);
    }
  } else {
    // Reconstruct boundary → children mapping from element order
    serializeUsecaseBoundaries(elements, lines);
  }

  lines.push('');

  // Connectors
  for (const conn of connectors) {
    const src = formatName(idToName.get(conn.sourceId) ?? conn.sourceId);
    const tgt = formatName(idToName.get(conn.targetId) ?? conn.targetId);

    if (conn.type === 'include' || conn.type === 'extend') {
      const stereotype = conn.type === 'include' ? '<<include>>' : '<<extend>>';
      lines.push(`${src} ..> ${tgt} ${stereotype}`);
    } else {
      lines.push(`${src} ${conn.type === 'association' ? '--' : '-->'} ${tgt}${conn.label ? ` : ${conn.label}` : ''}`);
    }
  }
}

function serializeUsecaseBoundaries(elements: DiagramElement[], lines: string[]): void {
  const parents = resolveParents(elements, 'system-boundary', new Set(['usecase']));
  const standaloneUsecases: DiagramElement[] = [];

  for (const el of elements) {
    if (el.type === 'system-boundary') {
      lines.push('');
      lines.push(`system-boundary ${formatName(el.properties.name)}${formatAnnotations(el)} {`);
      for (const child of elements) {
        if (parents.get(child.id) === el.id) {
          lines.push(`  usecase ${formatName(child.properties.name)}${formatAnnotations(child)}`);
        }
      }
      lines.push('}');
    } else if (el.type === 'usecase' && !parents.has(el.id)) {
      standaloneUsecases.push(el);
    }
  }

  for (const uc of standaloneUsecases) {
    lines.push(`usecase ${formatName(uc.properties.name)}${formatAnnotations(uc)}`);
  }
}

// =============================================================================
// Activity Diagram Serialization
// =============================================================================

function serializeActivityElements(
  elements: DiagramElement[],
  connectors: Connector[],
  idToName: Map<string, string>,
  lines: string[],
): void {
  for (const el of elements) {
    const name = formatName(el.properties.name);
    const ann = formatAnnotations(el);
    switch (el.type) {
      case 'initial-node':
        lines.push(`initial-node ${name}${ann}`);
        break;
      case 'final-node':
        lines.push(`final-node ${name}${ann}`);
        break;
      case 'action':
        lines.push(`action ${name}${ann}`);
        break;
      case 'decision':
        lines.push(`decision ${name}${ann}`);
        break;
      case 'fork':
        lines.push(`fork ${name}${ann}`);
        break;
      case 'join':
        lines.push(`join ${name}${ann}`);
        break;
    }
  }
  lines.push('');

  // Transitions
  serializeTransitions(connectors, idToName, lines);
}

// =============================================================================
// State Diagram Serialization
// =============================================================================

function serializeStateElements(
  elements: DiagramElement[],
  connectors: Connector[],
  idToName: Map<string, string>,
  lines: string[],
): void {
  const stateLine = (el: DiagramElement, indent: string): string | null => {
    const name = formatName(el.properties.name);
    const ann = formatAnnotations(el);
    switch (el.type) {
      case 'initial-state': return `${indent}initial-state ${name}${ann}`;
      case 'final-state': return `${indent}final-state ${name}${ann}`;
      case 'state': return `${indent}state ${name}${ann}`;
      default: return null;
    }
  };
  const parents = resolveParents(elements, 'composite-state', new Set(['state', 'initial-state', 'final-state']));

  for (const el of elements) {
    if (parents.has(el.id)) continue;
    if (el.type !== 'composite-state') {
      const line = stateLine(el, '');
      if (line) lines.push(line);
      continue;
    }

    lines.push(`composite-state ${formatName(el.properties.name)}${formatAnnotations(el)} {`);
    for (const child of elements) {
      if (parents.get(child.id) !== el.id) continue;
      const line = stateLine(child, '  ');
      if (line) lines.push(line);
    }
    // Transitions between two children of this composite state
    for (const conn of connectors) {
      if (parents.get(conn.sourceId) !== el.id || parents.get(conn.targetId) !== el.id) continue;
      const src = formatName(idToName.get(conn.sourceId) ?? conn.sourceId);
      const tgt = formatName(idToName.get(conn.targetId) ?? conn.targetId);
      lines.push(`  ${src} --> ${tgt}${conn.label ? ` : ${conn.label}` : ''}`);
    }
    lines.push('}');
  }
  lines.push('');

  // Top-level transitions (exclude those already serialized inside composite states)
  const topLevelConnectors = connectors.filter((c) => {
    const parent = parents.get(c.sourceId);
    return !parent || parent !== parents.get(c.targetId);
  });
  serializeTransitions(topLevelConnectors, idToName, lines);
}

/**
 * Map child element IDs to their container. Uses explicit `parentId` when the diagram has any;
 * diagrams saved before `parentId` existed fall back to the old flattened order
 * (children directly follow their container).
 */
function resolveParents(
  elements: DiagramElement[],
  containerType: DiagramElement['type'],
  childTypes: Set<string>,
): Map<string, string> {
  const parents = new Map<string, string>();
  const containers = new Set(elements.filter((el) => el.type === containerType).map((el) => el.id));
  if (elements.some((el) => el.parentId !== undefined)) {
    for (const el of elements) {
      if (el.parentId && containers.has(el.parentId) && childTypes.has(el.type)) parents.set(el.id, el.parentId);
    }
    return parents;
  }
  let current: string | undefined;
  for (const el of elements) {
    if (el.type === containerType) current = el.id;
    else if (current && childTypes.has(el.type)) parents.set(el.id, current);
    else current = undefined;
  }
  return parents;
}

// =============================================================================
// Shared: Transition serialization
// =============================================================================

function serializeTransitions(
  connectors: Connector[],
  idToName: Map<string, string>,
  lines: string[],
): void {
  for (const conn of connectors) {
    const src = formatName(idToName.get(conn.sourceId) ?? conn.sourceId);
    const tgt = formatName(idToName.get(conn.targetId) ?? conn.targetId);
    let line = `${src} --> ${tgt}`;
    if (conn.label) {
      line += ` : ${conn.label}`;
    }
    lines.push(line);
  }
}
