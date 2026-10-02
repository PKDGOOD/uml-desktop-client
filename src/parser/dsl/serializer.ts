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

    switch (el.type) {
      case 'class':
        lines.push(`class ${name}${ann} {`);
        serializeClassBody(el, lines);
        lines.push('}');
        break;
      case 'abstract-class':
        lines.push(`abstract class ${name}${ann} {`);
        serializeClassBody(el, lines);
        lines.push('}');
        break;
      case 'interface':
        lines.push(`interface ${name}${ann} {`);
        serializeClassBody(el, lines);
        lines.push('}');
        break;
      case 'enum':
        lines.push(`enum ${name}${ann} {`);
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
  // The parser flattens: boundary, then its child usecases appear right after it.
  // We reconstruct by walking the elements array.
  let i = 0;
  const standaloneUsecases: DiagramElement[] = [];

  while (i < elements.length) {
    const el = elements[i];
    if (el.type === 'actor') {
      // Already serialized above
      i++;
      continue;
    }
    if (el.type === 'system-boundary') {
      lines.push('');
      lines.push(`system-boundary ${formatName(el.properties.name)}${formatAnnotations(el)} {`);
      i++;
      // Collect child usecases
      while (i < elements.length && elements[i].type === 'usecase') {
        lines.push(`  usecase ${formatName(elements[i].properties.name)}${formatAnnotations(elements[i])}`);
        i++;
      }
      lines.push('}');
      continue;
    }
    if (el.type === 'usecase') {
      standaloneUsecases.push(el);
    }
    i++;
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
  // Separate composite states and their children
  // The parser flattens composite-state children into the elements array.
  // We reconstruct by walking the elements array.
  let i = 0;
  while (i < elements.length) {
    const el = elements[i];
    const name = formatName(el.properties.name);
    const ann = formatAnnotations(el);

    switch (el.type) {
      case 'initial-state':
        lines.push(`initial-state ${name}${ann}`);
        break;
      case 'final-state':
        lines.push(`final-state ${name}${ann}`);
        break;
      case 'state':
        lines.push(`state ${name}${ann}`);
        break;
      case 'composite-state': {
        lines.push(`composite-state ${name}${ann} {`);
        i++;
        // Collect children: states, initial-state, final-state until we hit
        // something that's not a child type or we run out
        const childTypes = new Set(['state', 'initial-state', 'final-state']);
        const childConnectors: Connector[] = [];
        const childIds = new Set<string>();

        // Gather child element IDs
        const startIdx = i;
        while (i < elements.length && childTypes.has(elements[i].type)) {
          childIds.add(elements[i].id);
          i++;
        }

        // Serialize child elements
        for (let j = startIdx; j < i; j++) {
          const child = elements[j];
          const cName = formatName(child.properties.name);
          const cAnn = formatAnnotations(child);
          switch (child.type) {
            case 'initial-state':
              lines.push(`  initial-state ${cName}${cAnn}`);
              break;
            case 'final-state':
              lines.push(`  final-state ${cName}${cAnn}`);
              break;
            case 'state':
              lines.push(`  state ${cName}${cAnn}`);
              break;
          }
        }

        // Find connectors between child elements
        for (const conn of connectors) {
          if (childIds.has(conn.sourceId) && childIds.has(conn.targetId)) {
            childConnectors.push(conn);
          }
        }

        // Serialize child transitions
        for (const conn of childConnectors) {
          const src = formatName(idToName.get(conn.sourceId) ?? conn.sourceId);
          const tgt = formatName(idToName.get(conn.targetId) ?? conn.targetId);
          let line = `  ${src} --> ${tgt}`;
          if (conn.label) {
            line += ` : ${conn.label}`;
          }
          lines.push(line);
        }

        lines.push('}');
        continue; // skip the i++ at the end
      }
    }
    i++;
  }
  lines.push('');

  // Top-level transitions (exclude those already serialized inside composite states)
  const compositeChildIds = getCompositeChildIds(elements);
  const topLevelConnectors = connectors.filter(
    c => !(compositeChildIds.has(c.sourceId) && compositeChildIds.has(c.targetId)),
  );
  serializeTransitions(topLevelConnectors, idToName, lines);
}

/** Get IDs of elements that are children of composite states */
function getCompositeChildIds(elements: DiagramElement[]): Set<string> {
  const childIds = new Set<string>();
  const childTypes = new Set(['state', 'initial-state', 'final-state']);
  let i = 0;
  while (i < elements.length) {
    if (elements[i].type === 'composite-state') {
      i++;
      while (i < elements.length && childTypes.has(elements[i].type)) {
        childIds.add(elements[i].id);
        i++;
      }
    } else {
      i++;
    }
  }
  return childIds;
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
