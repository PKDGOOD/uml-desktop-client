import type {
  ProjectData,
  ProjectMetadata,
  ProjectTreeNode,
  DiagramData,
  DiagramElement,
} from '@/types';

export interface ProjectFileParseError {
  message: string;
  position?: { line: number; column: number; offset: number };
  path?: string;
}

export type ProjectFileParseResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ProjectFileParseError[] };

/**
 * Parses JSON position info from a SyntaxError message.
 * JSON.parse errors typically include "at position N" in the message.
 */
function extractJsonErrorPosition(
  content: string,
  error: unknown,
): { line: number; column: number; offset: number } | undefined {
  if (!(error instanceof SyntaxError)) return undefined;

  // Try "at position N" format (older Node / some engines)
  let match = error.message.match(/position\s+(\d+)/i);
  if (!match) {
    // Try "at line N column M" format
    const lineColMatch = error.message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    if (lineColMatch) {
      return {
        line: parseInt(lineColMatch[1], 10),
        column: parseInt(lineColMatch[2], 10),
        offset: 0,
      };
    }
    // Fallback: find the problematic token in the content
    const tokenMatch = error.message.match(/Unexpected token '(.)'|Unexpected token (.)/);
    if (tokenMatch) {
      const token = tokenMatch[1] || tokenMatch[2];
      // Find first occurrence of unexpected token that's not inside a string
      const idx = findUnexpectedTokenPosition(content, token);
      if (idx >= 0) {
        return offsetToPosition(content, idx);
      }
    }
    return undefined;
  }

  const offset = parseInt(match[1], 10);
  return offsetToPosition(content, offset);
}

function offsetToPosition(
  content: string,
  offset: number,
): { line: number; column: number; offset: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column, offset };
}

function findUnexpectedTokenPosition(content: string, token: string): number {
  // Simple heuristic: scan for the token outside of string literals
  let inString = false;
  let escape = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString && ch === token) {
      return i;
    }
  }
  return -1;
}

export function tryParseJson(content: string): ProjectFileParseResult<unknown> {
  try {
    const data: unknown = JSON.parse(content);
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return { success: false, errors: [{ message: 'Project must be a JSON object' }] };
    }
    return { success: true, data };
  } catch (err) {
    const position = extractJsonErrorPosition(content, err);
    const message =
      err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON';
    return { success: false, errors: [{ message, position }] };
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validPoint(value: unknown): boolean {
  return isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function validMembers(properties: Record<string, unknown>): boolean {
  const attributes = properties.attributes;
  const methods = properties.methods;
  return (attributes === undefined || (Array.isArray(attributes) && attributes.every((attribute) =>
    isRecord(attribute) && typeof attribute.name === 'string' && typeof attribute.type === 'string')))
    && (methods === undefined || (Array.isArray(methods) && methods.every((method) =>
      isRecord(method) && typeof method.name === 'string' && typeof method.returnType === 'string'
      && Array.isArray(method.parameters) && method.parameters.every((parameter) =>
        isRecord(parameter) && typeof parameter.name === 'string' && typeof parameter.type === 'string'))));
}

export function validateDiagram(value: unknown, id: string): boolean {
  if (!isRecord(value) || value.id !== id || typeof value.name !== 'string'
    || !['class', 'sequence', 'usecase', 'activity', 'state'].includes(String(value.type))
    || !Array.isArray(value.elements) || !Array.isArray(value.connectors)
    || !validPoint(value.viewport) || !isRecord(value.viewport)
    || !Number.isFinite(value.viewport.zoom) || Number(value.viewport.zoom) <= 0) return false;
  return value.elements.every((element) => isRecord(element)
    && typeof element.id === 'string' && typeof element.type === 'string'
    && validPoint(element.position) && isRecord(element.size)
    && Number.isFinite(element.size.width) && Number(element.size.width) > 0
    && Number.isFinite(element.size.height) && Number(element.size.height) > 0
    && isRecord(element.properties) && typeof element.properties.name === 'string'
    && validMembers(element.properties))
    && value.connectors.every((connector) => isRecord(connector)
      && typeof connector.id === 'string' && typeof connector.type === 'string'
      && typeof connector.sourceId === 'string' && typeof connector.targetId === 'string'
      && isRecord(connector.properties)
      && (connector.waypoints === undefined || (Array.isArray(connector.waypoints) && connector.waypoints.every(validPoint)))
      && (connector.label === undefined || typeof connector.label === 'string'));
}

export function validTree(nodes: unknown): boolean {
  return Array.isArray(nodes) && nodes.every((node) => isRecord(node)
    && typeof node.id === 'string' && typeof node.name === 'string'
    && (node.type === 'folder' || node.type === 'diagram')
    && (node.children === undefined || validTree(node.children)));
}

function validateMetadata(
  obj: Record<string, unknown>,
): ProjectFileParseError[] {
  const errors: ProjectFileParseError[] = [];
  if (!isRecord(obj.metadata)) {
    errors.push({ message: 'Missing required field: metadata', path: 'metadata' });
  } else {
    const meta = obj.metadata as Record<string, unknown>;
    if (typeof meta.name !== 'string')
      errors.push({ message: 'Missing required field: metadata.name', path: 'metadata.name' });
    if (typeof meta.version !== 'string')
      errors.push({ message: 'Missing required field: metadata.version', path: 'metadata.version' });
    if (typeof meta.createdAt !== 'string')
      errors.push({ message: 'Missing required field: metadata.createdAt', path: 'metadata.createdAt' });
    if (typeof meta.updatedAt !== 'string')
      errors.push({ message: 'Missing required field: metadata.updatedAt', path: 'metadata.updatedAt' });
    if (!isRecord(meta.diagramIndex))
      errors.push({ message: 'Missing required field: metadata.diagramIndex', path: 'metadata.diagramIndex' });
  }
  if (!validTree(obj.tree)) {
    errors.push({ message: 'Missing required field: tree', path: 'tree' });
  }
  if (!isRecord(obj.sharedElements)) {
    errors.push({ message: 'Missing required field: sharedElements', path: 'sharedElements' });
  }
  return errors;
}

/** Schema-1 files carry a semver `metadata.version`; only major version 1 is understood. */
const SUPPORTED_MAJOR_VERSION = 1;

/**
 * Reference rules from ADR 0001 §4 that shape checks cannot express:
 * known version, unique IDs, existing endpoints/parents and a tree that agrees with the index.
 * Assumes the shape checks passed.
 */
function validateReferences(project: ProjectData): ProjectFileParseError[] {
  const errors: ProjectFileParseError[] = [];
  const major = /^(\d+)(?:\.|$)/.exec(project.metadata.version)?.[1];
  if (Number(major) !== SUPPORTED_MAJOR_VERSION) {
    errors.push({
      message: `Unsupported file version ${project.metadata.version}: it was saved by a newer or unknown version of the app`,
      path: 'metadata.version',
    });
    return errors;
  }

  const treeIds = new Set<string>();
  const treeDiagrams = new Map<string, ProjectTreeNode>();
  const walk = (nodes: ProjectTreeNode[], path: string): void => nodes.forEach((node, index) => {
    const nodePath = `${path}[${index}]`;
    if (treeIds.has(node.id)) errors.push({ message: `Duplicate tree node ID: ${node.id}`, path: `${nodePath}.id` });
    treeIds.add(node.id);
    if (node.type === 'diagram') treeDiagrams.set(node.id, node);
    if (node.children) walk(node.children, `${nodePath}.children`);
  });
  walk(project.tree, 'tree');

  const index = project.metadata.diagramIndex;
  for (const [id, node] of treeDiagrams) {
    const diagram = project.diagrams[id];
    if (!diagram) errors.push({ message: `Diagram in the tree has no data: ${id}`, path: `diagrams.${id}` });
    else if (node.diagramType !== undefined && node.diagramType !== diagram.type) {
      errors.push({ message: `Tree says ${node.diagramType} but diagram ${id} is ${diagram.type}`, path: `diagrams.${id}.type` });
    }
    if (!index[id]) errors.push({ message: `Diagram ${id} is missing from metadata.diagramIndex`, path: `metadata.diagramIndex.${id}` });
    else if (diagram && index[id].type !== diagram.type) {
      errors.push({ message: `metadata.diagramIndex says ${index[id].type} but diagram ${id} is ${diagram.type}`, path: `metadata.diagramIndex.${id}.type` });
    }
  }
  for (const id of Object.keys(project.diagrams)) {
    if (!treeDiagrams.has(id)) errors.push({ message: `Diagram ${id} is not in the tree`, path: `diagrams.${id}` });
  }
  for (const id of Object.keys(index)) {
    if (!treeDiagrams.has(id)) errors.push({ message: `metadata.diagramIndex lists ${id}, which is not in the tree`, path: `metadata.diagramIndex.${id}` });
  }

  for (const [id, diagram] of Object.entries(project.diagrams)) {
    const ids = new Set<string>();
    const elementIds = new Set(diagram.elements.map((element) => element.id));
    const claim = (itemId: string, path: string) => {
      if (ids.has(itemId)) errors.push({ message: `Duplicate ID ${itemId} in diagram ${id}`, path });
      ids.add(itemId);
    };
    diagram.elements.forEach((element, i) => {
      const path = `diagrams.${id}.elements[${i}]`;
      claim(element.id, `${path}.id`);
      if (element.parentId !== undefined && (element.parentId === element.id || !elementIds.has(element.parentId))) {
        errors.push({ message: `Element ${element.id} has an unknown parent ${element.parentId}`, path: `${path}.parentId` });
      }
    });
    diagram.connectors.forEach((connector, i) => {
      const path = `diagrams.${id}.connectors[${i}]`;
      claim(connector.id, `${path}.id`);
      for (const end of ['sourceId', 'targetId'] as const) {
        if (!elementIds.has(connector[end])) {
          errors.push({ message: `Connector ${connector.id} points to a missing element ${connector[end]}`, path: `${path}.${end}` });
        }
      }
    });
  }
  return errors;
}

export const ProjectFileParser = {
  /**
   * Parse only metadata, tree, and sharedElements (for lazy loading).
   * Does NOT parse diagrams.
   */
  parseMetadata(
    content: string,
  ): ProjectFileParseResult<{
    metadata: ProjectMetadata;
    tree: ProjectTreeNode[];
    sharedElements: Record<string, DiagramElement>;
  }> {
    const jsonResult = tryParseJson(content);
    if (!jsonResult.success) return jsonResult;

    const obj = jsonResult.data as Record<string, unknown>;
    const validationErrors = validateMetadata(obj);
    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors };
    }

    return {
      success: true,
      data: {
        metadata: obj.metadata as ProjectMetadata,
        tree: obj.tree as ProjectTreeNode[],
        sharedElements: obj.sharedElements as Record<string, DiagramElement>,
      },
    };
  },

  /**
   * Parse a specific diagram from the diagrams section.
   */
  parseDiagram(
    content: string,
    diagramId: string,
  ): ProjectFileParseResult<DiagramData> {
    const jsonResult = tryParseJson(content);
    if (!jsonResult.success) return jsonResult;

    const obj = jsonResult.data as Record<string, unknown>;
    if (!isRecord(obj.diagrams)) {
      return {
        success: false,
        errors: [{ message: 'Missing required field: diagrams', path: 'diagrams' }],
      };
    }

    const diagrams = obj.diagrams as Record<string, unknown>;
    if (!(diagramId in diagrams)) {
      return {
        success: false,
        errors: [
          {
            message: `Diagram not found: "${diagramId}"`,
            path: `diagrams.${diagramId}`,
          },
        ],
      };
    }

    return { success: true, data: diagrams[diagramId] as DiagramData };
  },

  /**
   * Parse the entire project file.
   */
  parseAll(content: string): ProjectFileParseResult<ProjectData> {
    const jsonResult = tryParseJson(content);
    if (!jsonResult.success) return jsonResult;

    const obj = jsonResult.data as Record<string, unknown>;
    const validationErrors = validateMetadata(obj);

    if (!isRecord(obj.diagrams)) {
      validationErrors.push({
        message: 'Missing required field: diagrams',
        path: 'diagrams',
      });
    }

    if (isRecord(obj.diagrams)) {
      for (const [id, diagram] of Object.entries(obj.diagrams)) {
        if (!validateDiagram(diagram, id)) {
          validationErrors.push({ message: `Invalid diagram: ${id}`, path: `diagrams.${id}` });
        }
      }
    }

    if (obj.diagramTexts !== undefined && (
      obj.diagramTexts === null || typeof obj.diagramTexts !== 'object'
      || Array.isArray(obj.diagramTexts)
      || Object.values(obj.diagramTexts).some((text) => typeof text !== 'string')
    )) {
      validationErrors.push({ message: 'diagramTexts must contain text drafts', path: 'diagramTexts' });
    }

    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors };
    }

    const project: ProjectData = {
      metadata: obj.metadata as ProjectMetadata,
      tree: obj.tree as ProjectTreeNode[],
      sharedElements: obj.sharedElements as Record<string, DiagramElement>,
      diagrams: obj.diagrams as Record<string, DiagramData>,
      ...(obj.diagramTexts !== undefined ? { diagramTexts: obj.diagramTexts as Record<string, string> } : {}),
    };
    const referenceErrors = validateReferences(project);
    if (referenceErrors.length > 0) {
      return { success: false, errors: referenceErrors };
    }

    return { success: true, data: project };
  },
};
