// =============================================================================
// Project file Save/Open (ADR 0001, A02.08)
// The one place the app turns file text into an editable project and back.
// Schema 2 is written; schema 2 is read directly and schema 1 is migrated.
// =============================================================================

import type { DiagramMeta, ProjectData, ProjectDocument, ProjectFileWriter, ProjectTreeNode } from '@/types';
import { CURRENT_SCHEMA_VERSION, PROJECT_FILE_FORMAT, decodeProjectFile, encodeProjectFile } from './projectFileCodec';
import { checkFileSize, checkProjectLimits, checkTextSizes, checkTreeDepth, checkUnknownKeys } from './projectFileLimits';
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
  const sizeError = checkFileSize(content);
  if (sizeError) return { success: false, errors: [sizeError] };
  const json = tryParseJson(content);
  if (!json.success) return json;
  const file = json.data as Record<string, unknown>;
  const legacy = file.format === undefined;
  const depthErrors = checkTreeDepth(file);
  if (depthErrors.length > 0) return { success: false, errors: depthErrors };
  // Version detection comes first (ADR 0001 §6): a newer or foreign file gets
  // that message, not limit or unknown-key errors.
  if (!legacy && (file.format !== PROJECT_FILE_FORMAT || file.schemaVersion !== CURRENT_SCHEMA_VERSION)) {
    const refused = decodeProjectFile(content);
    if (!refused.success) return refused;
  }
  if (legacy && !isLegacyMajorOne(file)) {
    // Refused by the legacy parser with the version or shape message.
    const refused = migrateLegacyProjectFile(content, options);
    if (!refused.success) return refused;
  }

  // Ceilings and closed keys run before any DSL text is parsed (A03.01).
  const limitErrors = checkProjectLimits(file, legacy);
  if (limitErrors.length > 0) return { success: false, errors: limitErrors };
  const keyErrors = checkUnknownKeys(file, legacy);
  if (keyErrors.length > 0) return { success: false, errors: keyErrors };

  const read = legacy ? migrateLegacyProjectFile(content, options) : decodeProjectFile(content);
  if (!read.success) return read;
  const document: ProjectDocument = 'document' in read.data ? read.data.document : read.data;

  // Migration may have generated text for diagrams the old file had none for.
  const generated = Object.fromEntries(Object.entries(document.diagrams).map(([id, diagram]) => [id, diagram.text]));
  const textErrors = checkTextSizes(generated, legacy);
  if (textErrors.length > 0) return { success: false, errors: textErrors };

  const project = documentToProjectData(document);
  const errors = validateProjectReferences(project, { strict: true }).map((error) => ({
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

function isLegacyMajorOne(file: Record<string, unknown>): boolean {
  const metadata = file.metadata;
  const version = typeof metadata === 'object' && metadata !== null ? (metadata as Record<string, unknown>).version : undefined;
  return typeof version === 'string' && /^1(?:\.|$)/.test(version);
}
