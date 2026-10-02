import type { FileSystem } from './versionManager';

/** VersionManager storage scoped to this app's browser/Electron profile. */
export function localVersionStorage(storage: Storage): FileSystem {
  const prefix = 'uml-studio:versions:';
  const key = (path: string) => prefix + path;
  const keys = () => Array.from({ length: storage.length }, (_, i) => storage.key(i)!).filter(Boolean);
  return {
    async readFile(path) {
      const value = storage.getItem(key(path));
      if (value === null) throw new Error('Snapshot file is missing');
      return value;
    },
    async writeFile(path, content) { storage.setItem(key(path), content); },
    async mkdir(path) { storage.setItem(key(path) + '/', ''); },
    async exists(path) { return storage.getItem(key(path)) !== null || storage.getItem(key(path) + '/') !== null; },
    async readdir(path) {
      const root = key(path) + '/';
      return [...new Set(keys().filter((item) => item.startsWith(root)).map((item) => item.slice(root.length).split('/')[0]).filter(Boolean))];
    },
    async rmdir(path) {
      const root = key(path);
      for (const item of keys()) if (item === root || item.startsWith(root + '/')) storage.removeItem(item);
    },
  };
}
