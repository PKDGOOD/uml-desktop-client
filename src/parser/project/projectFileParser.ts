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

function tryParseJson(content: string): ProjectFileParseResult<unknown> {
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

function isRecord(value: unknown): value is Record<string, unknown> {
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

function validateDiagram(value: unknown, id: string): boolean {
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

function validTree(nodes: unknown): boolean {
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

    return {
      success: true,
      data: {
        metadata: obj.metadata as ProjectMetadata,
        tree: obj.tree as ProjectTreeNode[],
        sharedElements: obj.sharedElements as Record<string, DiagramElement>,
        diagrams: obj.diagrams as Record<string, DiagramData>,
        ...(obj.diagramTexts !== undefined ? { diagramTexts: obj.diagramTexts as Record<string, string> } : {}),
      },
    };
  },
};
