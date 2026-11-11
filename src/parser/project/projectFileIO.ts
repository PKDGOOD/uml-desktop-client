// =============================================================================
// Project file Save/Open (ADR 0001, A02.08)
// The one place the app turns file text into an editable project and back.
// Schema 2 is written; schema 2 is read directly and schema 1 is migrated.
// =============================================================================

import type { DiagramMeta, ProjectData, ProjectDocument, ProjectFileWriter, ProjectTreeNode } from '@/types';
import { decodeProjectFile, encodeProjectFile } from './projectFileCodec';
import { migrateLegacyProjectFile } from './legacyMigration';
import { tryParseJson, validateProjectReferences, type ProjectFileParseResult } from './projectFileParser';

/** The in-memory version marker of a project opened from or saved as schema 2. */
const IN_MEMORY_VERSION = '1.0.0';

export interface OpenedProjectFile {
  project: ProjectData;
  projectId: string;
  /** True when the file was schema 1: it opens as unsaved and saving upgrades it. */
  migrated: boolean;
  /** Diagrams whose saved text did not parse; they open as marked drafts. */
  invalidDrafts: string[];
}

export interface ReadProjectFileOptions {
  /** Assigns the project ID of a legacy file (ADR 0001 §3). */
  createId: () => string;
}

export function readProjectFile(content: string, options: ReadProjectFileOptions): ProjectFileParseResult<OpenedProjectFile> {
  const json = tryParseJson(content);
  if (!json.success) return json;
  const legacy = (json.data as Record<string, unknown>).format === undefined;

  let document: ProjectDocument;
  if (legacy) {
    const migrated = migrateLegacyProjectFile(content, options);
    if (!migrated.success) return migrated;
    document = migrated.data;
  } else {
    const decoded = decodeProjectFile(content);
    if (!decoded.success) return decoded;
    document = decoded.data.document;
  }

  const project = documentToProjectData(document);
  const errors = validateProjectReferences(project).map((error) => ({
    ...error,
    // Schema-2 models live one level deeper than the in-memory layout.
    path: legacy || !error.path ? error.path : error.path.replace(/^diagrams\.([^.[]+)\./, 'diagrams.$1.model.'),
  }));
  if (errors.length > 0) return { success: false, errors };

  return {
    success: true,
    data: {
      project,
      projectId: document.project.id,
      migrated: legacy,
      invalidDrafts: Object.entries(document.diagrams)
        .filter(([, diagram]) => diagram.textStatus === 'invalid')
        .map(([id]) => id),
    },
  };
}

export function writeProjectFile(document: ProjectDocument, writer: ProjectFileWriter): string {
  return encodeProjectFile(document, writer);
}

/** The editable in-memory layout; the diagram index is derived from the tree. */
export function documentToProjectData(document: ProjectDocument): ProjectData {
  const copy = structuredClone(document);
  const diagrams: ProjectData['diagrams'] = {};
  const diagramTexts: Record<string, string> = {};
  for (const [id, diagram] of Object.entries(copy.diagrams)) {
    diagrams[id] = diagram.model;
    diagramTexts[id] = diagram.text;
  }
  return {
    metadata: {
      name: copy.project.name,
      version: IN_MEMORY_VERSION,
      createdAt: copy.project.createdAt,
      updatedAt: copy.project.updatedAt,
      diagramIndex: deriveIndex(copy.tree),
    },
    tree: copy.tree,
    diagrams,
    diagramTexts,
    sharedElements: copy.sharedElements,
  };
}

function deriveIndex(nodes: ProjectTreeNode[], parentFolderId = '', index: Record<string, DiagramMeta> = {}): Record<string, DiagramMeta> {
  for (const node of nodes) {
    if (node.type === 'diagram' && node.diagramType) {
      index[node.id] = { id: node.id, name: node.name, type: node.diagramType, parentFolderId };
    }
    if (node.children) deriveIndex(node.children, node.id, index);
  }
  return index;
}
