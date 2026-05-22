import type {
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

const CLASS_DIAGRAM_TOOLS = new Set<ElementType>([
  'class',
  'interface',
  'abstract-class',
  'enum',
]);

function nextElementName(baseName: string, elements: DiagramElement[]): string {
  const names = new Set(elements.map((element) => element.properties.name));
  if (!names.has(baseName)) return baseName;

  let suffix = 2;
  while (names.has(`${baseName}${suffix}`)) {
    suffix++;
  }
  return `${baseName}${suffix}`;
}

function createElementId(type: ElementType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createCanvasElement(
  diagramType: DiagramType,
  elementType: ElementType,
  position: Position,
  existingElements: DiagramElement[],
): DiagramElement | null {
  if (diagramType !== 'class' || !CLASS_DIAGRAM_TOOLS.has(elementType)) {
    return null;
  }

  const defaults = ELEMENT_DEFAULTS[elementType];
  if (!defaults) return null;

  return {
    id: createElementId(elementType),
    type: elementType,
    position,
    size: defaults.size,
    properties: {
      name: nextElementName(defaults.baseName, existingElements),
      ...defaults.properties,
    },
  };
}
