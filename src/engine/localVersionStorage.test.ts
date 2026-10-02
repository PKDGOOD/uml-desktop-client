import { expect, it } from 'vitest';
import { VersionManager } from './versionManager';
import { localVersionStorage } from './localVersionStorage';
import { createProject } from './projectFactory';

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); },
  };
}

it('keeps device snapshots available after the version manager is recreated', async () => {
  const device = storage();
  const first = new VersionManager(localVersionStorage(device));
  const project = createProject('Snapshot project');
  const snapshot = await first.createSnapshot('project-a', project, 'Before changes');
  const reopened = new VersionManager(localVersionStorage(device));
  expect(await reopened.restoreSnapshot('project-a', snapshot.id)).toEqual(project);
  expect(await reopened.getHistory('project-a')).toHaveLength(1);
});

it('isolates projects and removes all files of a deleted snapshot', async () => {
  const device = storage();
  const fs = localVersionStorage(device);
  const manager = new VersionManager(fs);
  const removed = await manager.createSnapshot('a', createProject('A'), 'Delete');
  await manager.createSnapshot('b', createProject('B'), 'Keep');
  await manager.deleteSnapshot('a', removed.id);
  expect(await manager.getHistory('a')).toHaveLength(0);
  expect(await manager.getHistory('b')).toHaveLength(1);
  expect(await fs.exists(`a/.versions/${removed.id}`)).toBe(false);
});

it('surfaces storage quota failures instead of claiming a snapshot was saved', async () => {
  const device = storage();
  device.setItem = () => { throw new Error('Storage quota exceeded'); };
  const manager = new VersionManager(localVersionStorage(device));
  await expect(manager.createSnapshot('a', createProject('A'), 'Fail')).rejects.toThrow('quota');
});
