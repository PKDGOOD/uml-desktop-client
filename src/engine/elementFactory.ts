import type {
  Connector,
  ConnectorType,
  DiagramElement,
  DiagramType,
  ElementProperties,
  ElementType,
  Position,
  Size,
} from '../types';

const ELEMENT_DEFAULTS: Partial<
  Record<ElementType, { baseName: string; size: Size; properties?: Partial<ElementProperties> }>
> = {
  class: {
    baseName: 'NewClass',
    size: { width: 200, height: 150 },
    properties: { attributes: [], methods: [] },
  },
  interface: {
    baseName: 'NewInterface',
    size: { width: 200, height: 150 },
    properties: { attributes: [], methods: [] },
  },
  'abstract-class': {
    baseName: 'NewAbstractClass',
    size: { width: 200, height: 150 },
    properties: { attributes: [], methods: [] },
  },
  enum: {
    baseName: 'NewEnum',
    size: { width: 180, height: 120 },
    properties: { attributes: [], methods: [] },
  },
};

export const ELEMENT_TYPES: Record<DiagramType, ElementType[]> = {
  class: ['class', 'interface', 'abstract-class', 'enum'],
  sequence: ['lifeline'], usecase: ['actor', 'usecase', 'system-boundary'],
  activity: ['action', 'decision', 'fork', 'join', 'initial-node', 'final-node'],
  state: ['state', 'composite-state', 'initial-state', 'final-state'],
};
export const CONNECTOR_TYPES: Record<DiagramType, ConnectorType[]> = {
  class: ['association', 'directed-association', 'dependency', 'inheritance', 'realization', 'composition', 'aggregation'],
  sequence: ['sync-message', 'async-message', 'return-message'],
  usecase: ['association', 'directed-association', 'include', 'extend'],
  activity: ['transition'], state: ['transition'],
};

function nextElementName(baseName: string, elements: DiagramElement[]): string {
  const names = new Set(elements.map((element) => element.properties.name));
  if (!names.has(baseName)) return baseName;

  let suffix = 2;
  while (names.has(`${baseName}${suffix}`)) {
    suffix++;
  }
  return `${baseName}${suffix}`;
}

function createCanvasId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createCanvasElement(
  diagramType: DiagramType,
  elementType: ElementType,
  position: Position,
  existingElements: DiagramElement[],
): DiagramElement | null {
  if (!ELEMENT_TYPES[diagramType].includes(elementType)) {
    return null;
  }

  const dimensions: Partial<Record<ElementType, Size>> = {
    lifeline: { width: 120, height: 400 }, actor: { width: 70, height: 100 },
    usecase: { width: 170, height: 70 }, 'system-boundary': { width: 420, height: 320 },
    decision: { width: 90, height: 90 }, fork: { width: 180, height: 10 }, join: { width: 180, height: 10 },
    'initial-node': { width: 30, height: 30 }, 'final-node': { width: 30, height: 30 },
    'initial-state': { width: 30, height: 30 }, 'final-state': { width: 30, height: 30 },
  };
  const defaults = ELEMENT_DEFAULTS[elementType] ?? {
    baseName: elementType.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(''),
    size: dimensions[elementType] ?? { width: 180, height: 80 },
  };
  if (!defaults) return null;

  return {
    id: createCanvasId(elementType),
    type: elementType,
    position,
    size: defaults.size,
    properties: {
      name: nextElementName(defaults.baseName, existingElements),
      ...defaults.properties,
    },
  };
}

export function createCanvasConnector(
  diagramType: DiagramType,
  connectorType: ConnectorType,
  sourceId: string,
  targetId: string,
): Connector | null {
  if (
    sourceId === targetId ||
    !CONNECTOR_TYPES[diagramType].includes(connectorType)
  ) {
    return null;
  }

  return {
    id: createCanvasId(connectorType),
    type: connectorType,
    sourceId,
    targetId,
    ...(diagramType === 'sequence' ? { label: 'message()' } : {}),
    properties: {},
  };
}
