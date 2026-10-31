// =============================================================================
// Schema-2 project file codec (ADR 0001, A02.04)
// Reads and writes the versioned envelope. Legacy files go through
// legacyMigration.ts (A02.06); the full validation boundary (A03.01, A03.08)
// is a separate task.
// =============================================================================

import type { DiagramDocument, ProjectDocument, ProjectFileWriter } from '@/types';
import {
  isRecord,
  tryParseJson,
  validateDiagram,
  validTree,
  type ProjectFileParseError,
  type ProjectFileParseResult,
} from './projectFileParser';

export const PROJECT_FILE_FORMAT = 'uml-studio.project';
export const CURRENT_SCHEMA_VERSION = 2;

export interface DecodedProjectFile {
  document: ProjectDocument;
  writer: ProjectFileWriter;
}

export function encodeProjectFile(document: ProjectDocument, writer: ProjectFileWriter): string {
  return JSON.stringify({
    format: PROJECT_FILE_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    writer: { app: writer.app, version: writer.version },
    project: document.project,
    tree: document.tree,
    diagrams: document.diagrams,
    sharedElements: document.sharedElements,
  }, null, 2);
}

export function decodeProjectFile(content: string): ProjectFileParseResult<DecodedProjectFile> {
  const json = tryParseJson(content);
  if (!json.success) return json;
  const file = json.data as Record<string, unknown>;

  const versionError = checkVersion(file);
  if (versionError) return { success: false, errors: [versionError] };

  const errors = [...checkHeader(file), ...checkDiagrams(file.diagrams)];
  if (errors.length > 0) return { success: false, errors };

  return {
    success: true,
    data: {
      writer: file.writer as ProjectFileWriter,
      document: {
        project: file.project as ProjectDocument['project'],
        tree: file.tree as ProjectDocument['tree'],
        diagrams: file.diagrams as ProjectDocument['diagrams'],
        sharedElements: file.sharedElements as ProjectDocument['sharedElements'],
      },
    },
  };
}

function checkVersion(file: Record<string, unknown>): ProjectFileParseError | undefined {
  if (file.format === undefined) {
    return isRecord(file.metadata)
      ? { message: 'Legacy project file: it must be migrated before it can be read', path: 'metadata' }
      : { message: 'Not a UML Studio project file', path: 'format' };
  }
  if (file.format !== PROJECT_FILE_FORMAT) return { message: 'Not a UML Studio project file', path: 'format' };
  const version = file.schemaVersion;
  if (!Number.isInteger(version) || (version as number) < 1) {
    return { message: 'Invalid schema version', path: 'schemaVersion' };
  }
  if (version !== CURRENT_SCHEMA_VERSION) {
    return {
      message: `This project was saved by a newer version of UML Studio (file format ${version}). Update the app to open it.`,
      path: 'schemaVersion',
    };
  }
  return undefined;
}

function checkHeader(file: Record<string, unknown>): ProjectFileParseError[] {
  const errors: ProjectFileParseError[] = [];
  const missing = (path: string) => errors.push({ message: `Missing required field: ${path}`, path });
  const writer = file.writer;
  if (!isRecord(writer) || typeof writer.app !== 'string' || typeof writer.version !== 'string') missing('writer');
  const project = file.project;
  if (!isRecord(project)) missing('project');
  else {
    for (const key of ['id', 'name', 'createdAt', 'updatedAt']) {
      if (typeof project[key] !== 'string') missing(`project.${key}`);
    }
  }
  if (!validTree(file.tree)) missing('tree');
  if (!isRecord(file.sharedElements)) missing('sharedElements');
  if (!isRecord(file.diagrams)) missing('diagrams');
  return errors;
}

function checkDiagrams(diagrams: unknown): ProjectFileParseError[] {
  if (!isRecord(diagrams)) return [];
  return Object.entries(diagrams)
    .filter(([id, document]) => !validDocument(document, id))
    .map(([id]) => ({ message: `Invalid diagram: ${id}`, path: `diagrams.${id}` }));
}

function validDocument(document: unknown, id: string): document is DiagramDocument {
  return isRecord(document) && validateDiagram(document.model, id)
    && typeof document.text === 'string'
    && (document.textStatus === 'in-sync' || document.textStatus === 'invalid');
}
