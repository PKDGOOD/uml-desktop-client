// =============================================================================
// Version Manager - Snapshot creation, restoration, history, and diff
// =============================================================================

import type {
  ProjectData,
  Snapshot,
  SnapshotEntry,
  DiffResult,
  DiffEntry,
  ElementChange,
  TextDiff,
  DiffHunk,
  DiffLine,
  DiagramData,
} from '../types';
import { ProjectFileSerializer } from '../parser/project/projectFileSerializer';
import { ProjectFileParser } from '../parser/project/projectFileParser';

// =============================================================================
// File System Abstraction (for testability)
// =============================================================================

export interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  rmdir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

// =============================================================================
// Snapshot Index
// =============================================================================

interface SnapshotIndex {
  projectPath: string;
  snapshots: SnapshotEntry[];
}

function generateSnapshotId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// Version Manager
// =============================================================================

export class VersionManager {
  private fs: FileSystem;

  constructor(fs: FileSystem) {
    this.fs = fs;
  }

  /**
   * Get the path to the .versions directory for a project.
   */
  private versionsDir(projectPath: string): string {
    // projectPath is the directory containing the project
    return `${projectPath}/.versions`;
  }

  private indexPath(projectPath: string): string {
    return `${this.versionsDir(projectPath)}/snapshots.json`;
  }

  /**
   * Load or create the snapshot index.
   */
  private async loadIndex(projectPath: string): Promise<SnapshotIndex> {
    const idxPath = this.indexPath(projectPath);
    const dirExists = await this.fs.exists(this.versionsDir(projectPath));
    if (!dirExists) {
      return { projectPath, snapshots: [] };
    }
    const fileExists = await this.fs.exists(idxPath);
    if (!fileExists) {
      return { projectPath, snapshots: [] };
    }
    try {
      const content = await this.fs.readFile(idxPath);
      return JSON.parse(content) as SnapshotIndex;
    } catch {
      return { projectPath, snapshots: [] };
    }
  }

  private async saveIndex(projectPath: string, index: SnapshotIndex): Promise<void> {
    await this.fs.mkdir(this.versionsDir(projectPath));
    await this.fs.writeFile(this.indexPath(projectPath), JSON.stringify(index, null, 2));
  }

  /**
   * Create a snapshot of the current project state.
   */
  async createSnapshot(projectPath: string, projectData: ProjectData, message: string): Promise<Snapshot> {
    const id = generateSnapshotId();
    const createdAt = new Date();
    const snapshotDir = `${this.versionsDir(projectPath)}/${id}`;

    // Serialize project data
    const serialized = ProjectFileSerializer.serialize(projectData);

    // Write snapshot data
    await this.fs.mkdir(snapshotDir);
    await this.fs.writeFile(`${snapshotDir}/project.uml.json`, serialized);

    // Update index
    const index = await this.loadIndex(projectPath);
    const entry: SnapshotEntry = {
      id,
      createdAt: createdAt.toISOString(),
      message,
      path: id,
    };
    index.snapshots.push(entry);
    await this.saveIndex(projectPath, index);

    return {
      id,
      createdAt,
      message,
      projectDataPath: `${snapshotDir}/project.uml.json`,
    };
  }

  /**
   * Get snapshot history in chronological order.
   */
  async getHistory(projectPath: string): Promise<Snapshot[]> {
    const index = await this.loadIndex(projectPath);
    return index.snapshots
      .map((entry) => ({
        id: entry.id,
        createdAt: new Date(entry.createdAt),
        message: entry.message,
        projectDataPath: `${this.versionsDir(projectPath)}/${entry.path}/project.uml.json`,
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Restore a snapshot by ID, returning the project data.
   */
  async restoreSnapshot(projectPath: string, snapshotId: string): Promise<ProjectData> {
    const index = await this.loadIndex(projectPath);
    const entry = index.snapshots.find((s) => s.id === snapshotId);
    if (!entry) {
      throw new Error(`Snapshot not found: "${snapshotId}"`);
    }

    const snapshotFile = `${this.versionsDir(projectPath)}/${entry.path}/project.uml.json`;
    const content = await this.fs.readFile(snapshotFile);
    const result = ProjectFileParser.parseAll(content);
    if (!result.success) {
      throw new Error(`Failed to restore snapshot: ${result.errors.map((e) => e.message).join(', ')}`);
    }
    return result.data;
  }

  /**
   * Delete a snapshot by ID.
   */
  async deleteSnapshot(projectPath: string, snapshotId: string): Promise<void> {
    const index = await this.loadIndex(projectPath);
    const entryIdx = index.snapshots.findIndex((s) => s.id === snapshotId);
    if (entryIdx === -1) {
      throw new Error(`Snapshot not found: "${snapshotId}"`);
    }

    const entry = index.snapshots[entryIdx];
    const snapshotDir = `${this.versionsDir(projectPath)}/${entry.path}`;

    // Remove from index
    index.snapshots.splice(entryIdx, 1);
    await this.saveIndex(projectPath, index);

    // Remove snapshot directory
    try {
      await this.fs.rmdir(snapshotDir);
    } catch {
      // Best effort cleanup
    }
  }

  /**
   * Compare two snapshots and return the differences.
   */
  async diff(projectPath: string, snapshotIdA: string, snapshotIdB: string): Promise<DiffResult> {
    const dataA = await this.restoreSnapshot(projectPath, snapshotIdA);
    const dataB = await this.restoreSnapshot(projectPath, snapshotIdB);

    const added: DiffEntry[] = [];
    const modified: DiffEntry[] = [];
    const deleted: DiffEntry[] = [];
    const dslTextDiff: TextDiff[] = [];

    const diagramIdsA = new Set(Object.keys(dataA.diagrams));
    const diagramIdsB = new Set(Object.keys(dataB.diagrams));

    // Diagrams added in B
    for (const id of diagramIdsB) {
      if (!diagramIdsA.has(id)) {
        const diag = dataB.diagrams[id];
        added.push({
          diagramId: id,
          diagramName: diag.name,
          elementChanges: diag.elements.map((el) => ({
            elementId: el.id,
            type: 'added' as const,
            after: el,
          })),
        });
      }
    }

    // Diagrams deleted from A
    for (const id of diagramIdsA) {
      if (!diagramIdsB.has(id)) {
        const diag = dataA.diagrams[id];
        deleted.push({
          diagramId: id,
          diagramName: diag.name,
          elementChanges: diag.elements.map((el) => ({
            elementId: el.id,
            type: 'deleted' as const,
            before: el,
          })),
        });
      }
    }

    // Diagrams in both — compare elements
    for (const id of diagramIdsA) {
      if (!diagramIdsB.has(id)) continue;
      const diagA = dataA.diagrams[id];
      const diagB = dataB.diagrams[id];

      const elementChanges = diffElements(diagA, diagB);
      if (elementChanges.length > 0) {
        modified.push({
          diagramId: id,
          diagramName: diagB.name,
          elementChanges,
        });
      }

      // Simple text diff based on serialized element names
      const textDiff = diffDiagramText(diagA, diagB);
      if (textDiff.hunks.length > 0) {
        dslTextDiff.push(textDiff);
      }
    }

    return { added, modified, deleted, dslTextDiff };
  }
}

// =============================================================================
// Diff Helpers
// =============================================================================

function diffElements(diagA: DiagramData, diagB: DiagramData): ElementChange[] {
  const changes: ElementChange[] = [];
  const mapA = new Map(diagA.elements.map((el) => [el.id, el]));
  const mapB = new Map(diagB.elements.map((el) => [el.id, el]));

  // Added in B
  for (const [id, el] of mapB) {
    if (!mapA.has(id)) {
      changes.push({ elementId: id, type: 'added', after: el });
    }
  }

  // Deleted from A
  for (const [id, el] of mapA) {
    if (!mapB.has(id)) {
      changes.push({ elementId: id, type: 'deleted', before: el });
    }
  }

  // Modified
  for (const [id, elA] of mapA) {
    const elB = mapB.get(id);
    if (!elB) continue;
    if (JSON.stringify(elA) !== JSON.stringify(elB)) {
      changes.push({ elementId: id, type: 'modified', before: elA, after: elB });
    }
  }

  return changes;
}

function diffDiagramText(diagA: DiagramData, diagB: DiagramData): TextDiff {
  const linesA = diagA.elements.map((el) => `${el.type} ${el.properties.name}`);
  const linesB = diagB.elements.map((el) => `${el.type} ${el.properties.name}`);

  const hunks: DiffHunk[] = [];
  const diffLines: DiffLine[] = [];

  const setA = new Set(linesA);
  const setB = new Set(linesB);

  // Removed lines
  for (const line of linesA) {
    if (!setB.has(line)) {
      diffLines.push({ type: 'remove', content: line });
    } else {
      diffLines.push({ type: 'context', content: line });
    }
  }
  // Added lines
  for (const line of linesB) {
    if (!setA.has(line)) {
      diffLines.push({ type: 'add', content: line });
    }
  }

  if (diffLines.some((l) => l.type !== 'context')) {
    hunks.push({
      oldStart: 1,
      oldLines: linesA.length,
      newStart: 1,
      newLines: linesB.length,
      lines: diffLines,
    });
  }

  return {
    diagramId: diagA.id,
    diagramName: diagB.name,
    hunks,
  };
}
