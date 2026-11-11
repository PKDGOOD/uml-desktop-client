// =============================================================================
// Schema-1 → schema-2 migration (ADR 0001 §7, A02.06/A02.07)
// Produces a detached ProjectDocument from legacy file text. The source text is
// only read. Containment that cannot be recovered without guessing is refused
// with a recovery diagnostic (A02.07). Session wiring is A02.08.
// =============================================================================

import type { DiagramData, DiagramDocument, DiagramElement, ProjectData, ProjectDocument, ProjectTreeNode } from '@/types';
import { parseDSL } from '../dsl/peggyParser';
import { serializeDSL } from '../dsl/serializer';
import { renameDiagramHeader } from '../dsl/diagramHeader';
import {
  ProjectFileParser,
  type ProjectFileParseError,
  type ProjectFileParseResult,
} from './projectFileParser';

export interface LegacyMigrationOptions {
  /** Injected so tests stay deterministic; the app passes crypto.randomUUID. */
  createId: () => string;
}

export function migrateLegacyProjectFile(
  content: string,
  options: LegacyMigrationOptions,
): ProjectFileParseResult<ProjectDocument> {
  const parsed = ProjectFileParser.parseAll(content);
  if (!parsed.success) return parsed;
  const legacy = parsed.data;

  // ProjectFileParser.parseAll has already refused every major version other than 1.
  const indexErrors = checkDiagramIndex(legacy);
  if (indexErrors.length > 0) return { success: false, errors: indexErrors };

  const names = treeDiagramNames(legacy.tree);
  const diagrams: Record<string, DiagramDocument> = {};
  const containmentErrors: ProjectFileParseError[] = [];
  for (const [id, source] of Object.entries(legacy.diagrams)) {
    const text = legacy.diagramTexts?.[id];
    const recovered = recoverContainment(id, source, text);
    if ('error' in recovered) {
      containmentErrors.push(recovered.error);
      continue;
    }
    diagrams[id] = migrateDiagram(recovered.model, text, names.get(id) ?? source.name);
  }
  if (containmentErrors.length > 0) return { success: false, errors: containmentErrors };

  return {
    success: true,
    data: {
      project: {
        id: options.createId(),
        name: legacy.metadata.name,
        createdAt: legacy.metadata.createdAt,
        updatedAt: legacy.metadata.updatedAt,
      },
      tree: legacy.tree,
      diagrams,
      sharedElements: legacy.sharedElements,
    },
  };
}

/**
 * The legacy index must describe the same diagrams, types and parent folders as
 * the tree before it is dropped (F4c). Names are not compared: before #23,
 * renaming a diagram in the project tree changed only the tree label, so files
 * saved by those builds carry stale index and model names. The tree name, which
 * the user saw, wins during migration (see migrateDiagram).
 */
function checkDiagramIndex(legacy: ProjectData): ProjectFileParseError[] {
  const index = legacy.metadata.diagramIndex;
  const entries = treeDiagrams(legacy.tree);
  const errors: ProjectFileParseError[] = [];
  const mismatch = (id: string) => errors.push({
    message: `Legacy diagram index disagrees with the project tree: ${id}`,
    path: `metadata.diagramIndex.${id}`,
  });

  for (const [id, entry] of entries) {
    const meta = index[id];
    if (!meta || meta.id !== id || meta.type !== entry.type || meta.parentFolderId !== entry.parentFolderId) mismatch(id);
  }
  for (const id of Object.keys(index)) {
    if (!entries.has(id)) mismatch(id);
  }
  return errors;
}

function treeDiagrams(
  nodes: ProjectTreeNode[],
  parentFolderId = '',
  result = new Map<string, { type: ProjectTreeNode['diagramType']; parentFolderId: string }>(),
) {
  for (const node of nodes) {
    if (node.type === 'diagram') result.set(node.id, { type: node.diagramType, parentFolderId });
    if (node.children) treeDiagrams(node.children, node.id, result);
  }
  return result;
}

function treeDiagramNames(nodes: ProjectTreeNode[], result = new Map<string, string>()): Map<string, string> {
  for (const node of nodes) {
    if (node.type === 'diagram') result.set(node.id, node.name);
    if (node.children) treeDiagramNames(node.children, result);
  }
  return result;
}

/**
 * Schema 2 requires the model name to equal the tree name (ADR 0001 §4). A
 * legacy name drift is repaired by renaming the model and the DSL header to the
 * tree name, which is what the user saw in the project tree.
 */
function migrateDiagram(source: DiagramData, sourceText: string | undefined, name: string): DiagramDocument {
  const model = source.name === name ? source : { ...source, name };
  if (sourceText === undefined) return { model, text: serializeDSL(model), textStatus: 'in-sync' };
  const text = source.name === name ? sourceText : renameDiagramHeader(sourceText, name);
  // A parsable draft is in-sync here; comparing its meaning with the model is A03.09.
  return { model, text, textStatus: parseDSL(text).success ? 'in-sync' : 'invalid' };
}

// -----------------------------------------------------------------------------
// Containment recovery (A02.07)
// -----------------------------------------------------------------------------

const CONTAINMENT_RULES: { container: DiagramElement['type']; children: ReadonlySet<string> }[] = [
  { container: 'composite-state', children: new Set(['state', 'initial-state', 'final-state']) },
  { container: 'system-boundary', children: new Set(['usecase']) },
];

const elementKey = (element: DiagramElement) => `${element.type}:${element.properties.name}`;

/**
 * Schema 1 never stored `parentId`. Old builds inferred nesting from array order,
 * which F2 showed to be wrong, so the order is never trusted. Containment is
 * recovered only when nothing could be nested, or when the saved DSL text
 * parses and names every relevant element exactly once. Anything else is
 * refused rather than guessed.
 */
function recoverContainment(
  id: string,
  model: DiagramData,
  text: string | undefined,
): { model: DiagramData } | { error: ProjectFileParseError } {
  if (model.elements.some((element) => element.parentId !== undefined)) return { model };
  const rules = CONTAINMENT_RULES.filter((rule) => model.elements.some((element) => element.type === rule.container));
  const relevant = (element: DiagramElement) => rules.some((rule) => rule.container === element.type || rule.children.has(element.type));
  const candidates = model.elements.filter((element) => rules.some((rule) => rule.children.has(element.type)));
  if (rules.length === 0 || candidates.length === 0) return { model };

  const parsed = text === undefined ? undefined : parseDSL(text);
  if (parsed?.success) {
    const parsedRelevant = parsed.diagram.elements.filter(relevant);
    const modelRelevant = model.elements.filter(relevant);
    const parsedByKey = uniqueByKey(parsedRelevant);
    const modelByKey = uniqueByKey(modelRelevant);
    if (parsedByKey && modelByKey && sameKeys(parsedByKey, modelByKey)) {
      const parsedById = new Map(parsedRelevant.map((element) => [element.id, element]));
      const elements = model.elements.map((element) => {
        if (!relevant(element)) return element;
        const parentId = parsedByKey.get(elementKey(element))!.parentId;
        const parent = parentId === undefined ? undefined : parsedById.get(parentId);
        return parent ? { ...element, parentId: modelByKey.get(elementKey(parent))!.id } : element;
      });
      return { model: { ...model, elements } };
    }
  }

  const containers = model.elements
    .filter((element) => rules.some((rule) => rule.container === element.type))
    .map((element) => JSON.stringify(element.properties.name))
    .join(', ');
  return {
    error: {
      message: `Diagram ${JSON.stringify(model.name)} comes from an older file that does not record which elements are inside ${containers}, `
        + 'and its saved DSL text cannot settle it. Nothing was changed. Fix the diagram text in the version that saved it, save, and open the file again.',
      path: `diagrams.${id}.elements`,
    },
  };
}

function uniqueByKey(elements: DiagramElement[]): Map<string, DiagramElement> | undefined {
  const result = new Map<string, DiagramElement>();
  for (const element of elements) {
    if (result.has(elementKey(element))) return undefined;
    result.set(elementKey(element), element);
  }
  return result;
}

function sameKeys(a: Map<string, unknown>, b: Map<string, unknown>): boolean {
  return a.size === b.size && [...a.keys()].every((key) => b.has(key));
}
