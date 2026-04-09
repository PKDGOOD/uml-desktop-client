// =============================================================================
// Version Manager Tests - In-memory file system mock
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { VersionManager, type FileSystem } from './versionManager';
import type { ProjectData } from '../types';

// =============================================================================
// In-memory FileSystem mock
// =============================================================================

class InMemoryFS implements FileSystem {
  private files = new Map<string, string>();

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`ENOENT: ${path}`);
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async mkdir(_path: string): Promise<void> {
    // No-op for in-memory
  }

  async readdir(path: string): Promise<string[]> {
    const prefix = path.endsWith('/') ? path : path + '/';
    const entries = new Set<string>();
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length);
        const first = rest.split('/')[0];
        if (first) entries.add(first);
      }
    }
    return [...entries];
  }

  async rmdir(path: string): Promise<void> {
    const prefix = path.endsWith('/') ? path : path + '/';
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix) || key === path) {
        this.files.delete(key);
      }
    }
  }

  async exists(path: string): Promise<boolean> {
    // Check exact file or any file under this directory
    if (this.files.has(path)) return true;
    const prefix = path.endsWith('/') ? path : path + '/';
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }
}

// =============================================================================
// Test helpers
// =============================================================================

function makeProjectData(name: string, diagramCount = 1): ProjectData {
  const diagrams: Record<string, any> = {};
  const diagramIndex: Record<string, any> = {};
  const treeChildren: any[] = [];

  for (let i = 0; i < diagramCount; i++) {
    const id = `diag-${i}`;
    diagrams[id] = {
      id,
      name: `Diagram ${i}`,
      type: 'class',
      elements: [
        {
          id: `el-${i}`,
          type: 'class',
          position: { x: i * 100, y: 0 },
          size: { width: 120, height: 80 },
          properties: { name: `Class${i}` },
        },
      ],
      connectors: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    diagramIndex[id] = { id, name: `Diagram ${i}`, type: 'class', parentFolderId: 'root' };
    treeChildren.push({ id, name: `Diagram ${i}`, type: 'diagram', diagramType: 'class' });
  }

  return {
    metadata: {
      name,
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      diagramIndex,
    },
    tree: [{ id: 'root', name: 'Root', type: 'folder', children: treeChildren }],
    sharedElements: {},
    diagrams,
  };
}

const PROJECT_PATH = '/test/project';

// =============================================================================
// Tests
// =============================================================================

describe('VersionManager', () => {
  let fs: InMemoryFS;
  let vm: VersionManager;

  beforeEach(() => {
    fs = new InMemoryFS();
    vm = new VersionManager(fs);
  });

  describe('createSnapshot', () => {
    it('should create a snapshot with metadata', async () => {
      const project = makeProjectData('TestProject');
      const snapshot = await vm.createSnapshot(PROJECT_PATH, project, 'Initial commit');

      expect(snapshot.id).toMatch(/^snap-/);
      expect(snapshot.message).toBe('Initial commit');
      expect(snapshot.createdAt).toBeInstanceOf(Date);
      expect(snapshot.projectDataPath).toContain(snapshot.id);
    });

    it('should persist snapshot data to file system', async () => {
      const project = makeProjectData('TestProject');
      const snapshot = await vm.createSnapshot(PROJECT_PATH, project, 'Save point');

      // Verify the snapshot file exists
      const content = await fs.readFile(snapshot.projectDataPath);
      expect(content).toBeTruthy();
      const parsed = JSON.parse(content);
      expect(parsed.metadata.name).toBe('TestProject');
    });

    it('should create multiple snapshots', async () => {
      const project1 = makeProjectData('V1');
      const project2 = makeProjectData('V2', 2);

      await vm.createSnapshot(PROJECT_PATH, project1, 'Version 1');
      await vm.createSnapshot(PROJECT_PATH, project2, 'Version 2');

      const history = await vm.getHistory(PROJECT_PATH);
      expect(history).toHaveLength(2);
    });
  });

  describe('getHistory', () => {
    it('should return empty array when no snapshots exist', async () => {
      const history = await vm.getHistory(PROJECT_PATH);
      expect(history).toEqual([]);
    });

    it('should return snapshots in chronological order', async () => {
      const project = makeProjectData('Test');
      await vm.createSnapshot(PROJECT_PATH, project, 'First');
      await vm.createSnapshot(PROJECT_PATH, project, 'Second');
      await vm.createSnapshot(PROJECT_PATH, project, 'Third');

      const history = await vm.getHistory(PROJECT_PATH);
      expect(history).toHaveLength(3);
      expect(history[0].message).toBe('First');
      expect(history[1].message).toBe('Second');
      expect(history[2].message).toBe('Third');

      // Verify chronological order
      for (let i = 1; i < history.length; i++) {
        expect(history[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          history[i - 1].createdAt.getTime(),
        );
      }
    });

    it('should include id, createdAt, and message in each snapshot', async () => {
      const project = makeProjectData('Test');
      await vm.createSnapshot(PROJECT_PATH, project, 'My snapshot');

      const history = await vm.getHistory(PROJECT_PATH);
      const snap = history[0];
      expect(snap.id).toBeTruthy();
      expect(snap.createdAt).toBeInstanceOf(Date);
      expect(snap.message).toBe('My snapshot');
    });
  });

  describe('restoreSnapshot', () => {
    it('should restore project data from a snapshot', async () => {
      const project = makeProjectData('Original', 2);
      const snapshot = await vm.createSnapshot(PROJECT_PATH, project, 'Backup');

      const restored = await vm.restoreSnapshot(PROJECT_PATH, snapshot.id);
      expect(restored.metadata.name).toBe('Original');
      expect(Object.keys(restored.diagrams)).toHaveLength(2);
    });

    it('should throw when snapshot does not exist', async () => {
      await expect(
        vm.restoreSnapshot(PROJECT_PATH, 'nonexistent'),
      ).rejects.toThrow('Snapshot not found');
    });

    it('should restore exact state even after project modification', async () => {
      const projectV1 = makeProjectData('V1', 1);
      const snapshot = await vm.createSnapshot(PROJECT_PATH, projectV1, 'V1 snapshot');

      // "Modify" the project (V2 has 3 diagrams)
      const projectV2 = makeProjectData('V2', 3);
      await vm.createSnapshot(PROJECT_PATH, projectV2, 'V2 snapshot');

      // Restore V1
      const restored = await vm.restoreSnapshot(PROJECT_PATH, snapshot.id);
      expect(restored.metadata.name).toBe('V1');
      expect(Object.keys(restored.diagrams)).toHaveLength(1);
    });
  });

  describe('deleteSnapshot', () => {
    it('should remove a snapshot from history', async () => {
      const project = makeProjectData('Test');
      const snap1 = await vm.createSnapshot(PROJECT_PATH, project, 'First');
      await vm.createSnapshot(PROJECT_PATH, project, 'Second');

      await vm.deleteSnapshot(PROJECT_PATH, snap1.id);

      const history = await vm.getHistory(PROJECT_PATH);
      expect(history).toHaveLength(1);
      expect(history[0].message).toBe('Second');
    });

    it('should throw when deleting nonexistent snapshot', async () => {
      await expect(
        vm.deleteSnapshot(PROJECT_PATH, 'nonexistent'),
      ).rejects.toThrow('Snapshot not found');
    });
  });

  describe('diff', () => {
    it('should detect added diagrams', async () => {
      const projectA = makeProjectData('A', 1);
      const projectB = makeProjectData('B', 2);

      const snapA = await vm.createSnapshot(PROJECT_PATH, projectA, 'A');
      const snapB = await vm.createSnapshot(PROJECT_PATH, projectB, 'B');

      const result = await vm.diff(PROJECT_PATH, snapA.id, snapB.id);
      expect(result.added.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect deleted diagrams', async () => {
      const projectA = makeProjectData('A', 2);
      const projectB = makeProjectData('B', 1);

      const snapA = await vm.createSnapshot(PROJECT_PATH, projectA, 'A');
      const snapB = await vm.createSnapshot(PROJECT_PATH, projectB, 'B');

      const result = await vm.diff(PROJECT_PATH, snapA.id, snapB.id);
      expect(result.deleted.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect modified elements', async () => {
      const projectA = makeProjectData('A', 1);
      const projectB = makeProjectData('B', 1);
      // Modify element in B
      projectB.diagrams['diag-0'].elements[0].properties.name = 'ModifiedClass';

      const snapA = await vm.createSnapshot(PROJECT_PATH, projectA, 'A');
      const snapB = await vm.createSnapshot(PROJECT_PATH, projectB, 'B');

      const result = await vm.diff(PROJECT_PATH, snapA.id, snapB.id);
      expect(result.modified).toHaveLength(1);
      expect(result.modified[0].elementChanges[0].type).toBe('modified');
    });

    it('should return empty diff for identical snapshots', async () => {
      const project = makeProjectData('Same', 1);
      const snapA = await vm.createSnapshot(PROJECT_PATH, project, 'A');
      const snapB = await vm.createSnapshot(PROJECT_PATH, project, 'B');

      const result = await vm.diff(PROJECT_PATH, snapA.id, snapB.id);
      expect(result.added).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
    });
  });
});
