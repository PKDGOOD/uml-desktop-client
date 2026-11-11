// =============================================================================
// Schema-1 → schema-2 migration (ADR 0001 §7, A02.06)
// Produces a detached ProjectDocument from legacy file text. The source text is
// only read. Ambiguous containment (A02.07) and session wiring (A02.08) are
// separate tasks.
// =============================================================================

import type { DiagramData, DiagramDocument, ProjectData, ProjectDocument, ProjectTreeNode } from '@/types';
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
  for (const [id, model] of Object.entries(legacy.diagrams)) {
    diagrams[id] = migrateDiagram(model, legacy.diagramTexts?.[id], names.get(id) ?? model.name);
  }

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
