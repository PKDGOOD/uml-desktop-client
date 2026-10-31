// =============================================================================
// Schema-1 → schema-2 migration (ADR 0001 §7, A02.06)
// Produces a detached ProjectDocument from legacy file text. The source text is
// only read. Ambiguous containment (A02.07) and session wiring (A02.08) are
// separate tasks.
// =============================================================================

import type { DiagramData, DiagramDocument, ProjectData, ProjectDocument, ProjectTreeNode } from '@/types';
import { parseDSL } from '../dsl/peggyParser';
import { serializeDSL } from '../dsl/serializer';
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

  const versionError = checkLegacyVersion(legacy.metadata.version);
  if (versionError) return { success: false, errors: [versionError] };

  const indexErrors = checkDiagramIndex(legacy);
  if (indexErrors.length > 0) return { success: false, errors: indexErrors };

  const diagrams: Record<string, DiagramDocument> = {};
  for (const [id, model] of Object.entries(legacy.diagrams)) {
    diagrams[id] = migrateDiagram(model, legacy.diagramTexts?.[id]);
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

function checkLegacyVersion(version: string): ProjectFileParseError | undefined {
  const major = /^(\d+)(\.|$)/.exec(version)?.[1];
  if (major === '1') return undefined;
  if (major === undefined) return { message: 'Invalid legacy file version', path: 'metadata.version' };
  return {
    message: `This project was saved by a newer version of UML Studio (file version ${version}). Update the app to open it.`,
    path: 'metadata.version',
  };
}

/**
 * The legacy index must describe the same diagrams, types and parent folders as
 * the tree before it is dropped (F4c). Names are not compared: renaming a
 * diagram in the project tree never updated the index name.
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

function migrateDiagram(model: DiagramData, text: string | undefined): DiagramDocument {
  if (text === undefined) return { model, text: serializeDSL(model), textStatus: 'in-sync' };
  // A parsable draft is in-sync here; comparing its meaning with the model is A03.09.
  return { model, text, textStatus: parseDSL(text).success ? 'in-sync' : 'invalid' };
}
