// =============================================================================
// Input ceilings and closed key sets for project files (A03.01)
// Budgets come from the A01.10 baseline (docs/reviews/2026-09-27-execution-baseline.md).
// The byte check runs before JSON.parse; the rest runs before any DSL parsing.
// =============================================================================

import type { ProjectFileParseError } from './projectFileParser';

const MIB = 1024 * 1024;

export const PROJECT_LIMITS = {
  fileBytes: 16 * MIB,
  diagrams: 20,
  textBytesPerDiagram: 1 * MIB,
  elementsPerDiagram: 1_000,
  connectorsPerDiagram: 2_000,
  elementsPerProject: 4_000,
  connectorsPerProject: 6_000,
  folderDepth: 8,
  coordinate: 1_000_000,
  extent: 100_000,
  minZoom: 0.25,
  maxZoom: 4,
} as const;

const utf8 = new TextEncoder();
const byteLength = (text: string) => utf8.encode(text).length;

/** Refuses oversized input before it is parsed as JSON. */
export function checkFileSize(content: string): ProjectFileParseError | undefined {
  // A UTF-16 code unit encodes to at most 3 UTF-8 bytes; skip encoding small files.
  if (content.length * 3 <= PROJECT_LIMITS.fileBytes) return undefined;
  const bytes = byteLength(content);
  if (bytes <= PROJECT_LIMITS.fileBytes) return undefined;
  return { message: `File is larger than 16 MiB (${(bytes / MIB).toFixed(1)} MiB)` };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Count, depth, text-size and geometry ceilings on a parsed file of either
 * schema. Tolerates missing or malformed parts: shape errors are reported by
 * the shape checks that run afterwards.
 */
export function checkProjectLimits(file: Record<string, unknown>, legacy: boolean): ProjectFileParseError[] {
  const errors: ProjectFileParseError[] = [];
  const diagrams = isRecord(file.diagrams) ? Object.entries(file.diagrams) : [];
  if (diagrams.length > PROJECT_LIMITS.diagrams) {
    errors.push({ message: `A project can have at most ${PROJECT_LIMITS.diagrams} diagrams (this file has ${diagrams.length})`, path: 'diagrams' });
  }

  const legacyTexts = legacy && isRecord(file.diagramTexts) ? file.diagramTexts : {};
  let elementTotal = 0;
  let connectorTotal = 0;
  for (const [id, entry] of diagrams) {
    if (!isRecord(entry)) continue;
    const modelPath = legacy ? `diagrams.${id}` : `diagrams.${id}.model`;
    const model = legacy ? entry : entry.model;
    const text = legacy ? legacyTexts[id] : entry.text;
    const textPath = legacy ? `diagramTexts.${id}` : `diagrams.${id}.text`;
    if (typeof text === 'string' && text.length > PROJECT_LIMITS.textBytesPerDiagram / 3
      && byteLength(text) > PROJECT_LIMITS.textBytesPerDiagram) {
      errors.push({ message: 'Diagram text is larger than 1 MiB', path: textPath });
    }
    if (!isRecord(model)) continue;
    const elements = Array.isArray(model.elements) ? model.elements : [];
    const connectors = Array.isArray(model.connectors) ? model.connectors : [];
    elementTotal += elements.length;
    connectorTotal += connectors.length;
    if (elements.length > PROJECT_LIMITS.elementsPerDiagram) {
      errors.push({ message: `A diagram can have at most ${PROJECT_LIMITS.elementsPerDiagram} elements`, path: `${modelPath}.elements` });
    }
    if (connectors.length > PROJECT_LIMITS.connectorsPerDiagram) {
      errors.push({ message: `A diagram can have at most ${PROJECT_LIMITS.connectorsPerDiagram} connectors`, path: `${modelPath}.connectors` });
    }
    errors.push(...checkGeometry(model, elements, connectors, modelPath));
  }
  if (elementTotal > PROJECT_LIMITS.elementsPerProject) {
    errors.push({ message: `A project can have at most ${PROJECT_LIMITS.elementsPerProject} elements`, path: 'diagrams' });
  }
  if (connectorTotal > PROJECT_LIMITS.connectorsPerProject) {
    errors.push({ message: `A project can have at most ${PROJECT_LIMITS.connectorsPerProject} connectors`, path: 'diagrams' });
  }
  errors.push(...checkTreeDepth(file.tree));
  return errors;
}

function checkGeometry(model: Record<string, unknown>, elements: unknown[], connectors: unknown[], path: string): ProjectFileParseError[] {
  const errors: ProjectFileParseError[] = [];
  const coordinate = (value: unknown) => typeof value !== 'number' || (Number.isFinite(value) && Math.abs(value) <= PROJECT_LIMITS.coordinate);
  const extent = (value: unknown) => typeof value !== 'number' || (Number.isFinite(value) && value > 0 && value <= PROJECT_LIMITS.extent);
  const point = (value: unknown, at: string) => {
    if (isRecord(value) && (!coordinate(value.x) || !coordinate(value.y))) {
      errors.push({ message: `Coordinates must be finite and within ±${PROJECT_LIMITS.coordinate.toLocaleString('en-US')}`, path: at });
    }
  };

  const viewport = model.viewport;
  point(viewport, `${path}.viewport`);
  if (isRecord(viewport) && typeof viewport.zoom === 'number'
    && !(viewport.zoom >= PROJECT_LIMITS.minZoom && viewport.zoom <= PROJECT_LIMITS.maxZoom)) {
    errors.push({ message: `Zoom must be between ${PROJECT_LIMITS.minZoom} and ${PROJECT_LIMITS.maxZoom}`, path: `${path}.viewport.zoom` });
  }
  elements.forEach((element, index) => {
    if (!isRecord(element)) return;
    point(element.position, `${path}.elements[${index}].position`);
    const size = element.size;
    if (isRecord(size) && (!extent(size.width) || !extent(size.height))) {
      errors.push({ message: `Sizes must be positive and at most ${PROJECT_LIMITS.extent.toLocaleString('en-US')}`, path: `${path}.elements[${index}].size` });
    }
  });
  connectors.forEach((connector, index) => {
    if (!isRecord(connector) || !Array.isArray(connector.waypoints)) return;
    connector.waypoints.forEach((waypoint, at) => point(waypoint, `${path}.connectors[${index}].waypoints[${at}]`));
  });
  return errors;
}

/** Folders nest at most 8 levels below the top level (depth 0). */
function checkTreeDepth(tree: unknown): ProjectFileParseError[] {
  const errors: ProjectFileParseError[] = [];
  const walk = (nodes: unknown, depth: number, path: string): void => {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((node, index) => {
      if (!isRecord(node) || node.type !== 'folder') return;
      const nodePath = `${path}[${index}]`;
      if (depth > PROJECT_LIMITS.folderDepth) {
        errors.push({ message: `Folders can be nested at most ${PROJECT_LIMITS.folderDepth} levels deep`, path: nodePath });
        return;
      }
      walk(node.children, depth + 1, `${nodePath}.children`);
    });
  };
  walk(tree, 0, 'tree');
  return errors;
}

// -----------------------------------------------------------------------------
// Closed key sets (ADR 0001 §2). Open `properties` bags are not checked. Legacy
// files are held to the same element/connector/tree keys, because whatever is
// migrated is written back as schema 2 and must open again.
// -----------------------------------------------------------------------------

const KEYS = {
  envelope: ['format', 'schemaVersion', 'writer', 'project', 'tree', 'diagrams', 'sharedElements'],
  legacyEnvelope: ['metadata', 'tree', 'sharedElements', 'diagrams', 'diagramTexts'],
  legacyMetadata: ['name', 'version', 'createdAt', 'updatedAt', 'diagramIndex'],
  writer: ['app', 'version'],
  project: ['id', 'name', 'createdAt', 'updatedAt'],
  treeNode: ['id', 'name', 'type', 'diagramType', 'children', 'expanded'],
  document: ['model', 'text', 'textStatus'],
  model: ['id', 'name', 'type', 'elements', 'connectors', 'viewport'],
  viewport: ['x', 'y', 'zoom'],
  point: ['x', 'y'],
  size: ['width', 'height'],
  element: ['id', 'type', 'position', 'size', 'properties', 'sharedRefId', 'parentId'],
  connector: ['id', 'type', 'sourceId', 'targetId', 'waypoints', 'label', 'sourceMultiplicity', 'targetMultiplicity', 'messageOrder', 'properties'],
} as const;

/** Unknown keys mean a damaged file or a writer bug, so they are refused. */
export function checkUnknownKeys(file: Record<string, unknown>, legacy: boolean): ProjectFileParseError[] {
  const errors: ProjectFileParseError[] = [];
  const check = (value: unknown, allowed: readonly string[], path: string) => {
    if (!isRecord(value)) return;
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) errors.push({ message: `Unknown field: ${key}`, path: path ? `${path}.${key}` : key });
    }
  };
  const element = (value: unknown, path: string) => {
    check(value, KEYS.element, path);
    if (!isRecord(value)) return;
    check(value.position, KEYS.point, `${path}.position`);
    check(value.size, KEYS.size, `${path}.size`);
  };

  if (legacy) {
    check(file, KEYS.legacyEnvelope, '');
    check(file.metadata, KEYS.legacyMetadata, 'metadata');
  } else {
    check(file, KEYS.envelope, '');
    check(file.writer, KEYS.writer, 'writer');
    check(file.project, KEYS.project, 'project');
  }
  const walk = (nodes: unknown, path: string): void => {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((node, index) => {
      check(node, KEYS.treeNode, `${path}[${index}]`);
      if (isRecord(node)) walk(node.children, `${path}[${index}].children`);
    });
  };
  walk(file.tree, 'tree');
  if (isRecord(file.sharedElements)) {
    for (const [id, shared] of Object.entries(file.sharedElements)) element(shared, `sharedElements.${id}`);
  }
  if (isRecord(file.diagrams)) {
    for (const [id, document] of Object.entries(file.diagrams)) {
      if (!legacy) check(document, KEYS.document, `diagrams.${id}`);
      const model = legacy ? document : isRecord(document) ? document.model : undefined;
      if (!isRecord(model)) continue;
      const path = legacy ? `diagrams.${id}` : `diagrams.${id}.model`;
      check(model, KEYS.model, path);
      check(model.viewport, KEYS.viewport, `${path}.viewport`);
      if (Array.isArray(model.elements)) model.elements.forEach((value, index) => element(value, `${path}.elements[${index}]`));
      if (Array.isArray(model.connectors)) {
        model.connectors.forEach((value, index) => {
          check(value, KEYS.connector, `${path}.connectors[${index}]`);
          if (isRecord(value) && Array.isArray(value.waypoints)) {
            value.waypoints.forEach((waypoint, at) => check(waypoint, KEYS.point, `${path}.connectors[${index}].waypoints[${at}]`));
          }
        });
      }
    }
  }
  return errors;
}
