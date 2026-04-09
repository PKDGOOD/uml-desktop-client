import { describe, it, expect, vi } from 'vitest';
import { LazyLoader, type LoadState } from './lazyLoader';
import type { DiagramData, ProjectMetadata } from '../types';

function makeDiagram(id: string): DiagramData {
  return {
    id,
    name: `Diagram ${id}`,
    type: 'class',
    elements: [],
    connectors: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function makeMetadata(): ProjectMetadata {
  return {
    name: 'Test Project',
    version: '1.0.0',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    diagramIndex: {},
  };
}

describe('LazyLoader', () => {
  describe('loadProjectMetadata', () => {
    it('should delegate to the provided metadata loader', async () => {
      const meta = makeMetadata();
      const loadFn = vi.fn();
      const loader = new LazyLoader(loadFn, { maxCacheSize: 5 });

      const result = await loader.loadProjectMetadata(async () => meta);
      expect(result).toBe(meta);
    });
  });

  describe('loadDiagram', () => {
    it('should call loadFn and cache the result', async () => {
      const diagram = makeDiagram('d1');
      const loadFn = vi.fn().mockResolvedValue(diagram);
      const loader = new LazyLoader(loadFn, { maxCacheSize: 5 });

      const result = await loader.loadDiagram('d1');
      expect(result).toEqual(diagram);
      expect(loadFn).toHaveBeenCalledWith('d1');
      expect(loader.getLoadState('d1')).toBe('loaded');
    });

    it('should return cached diagram without calling loadFn again', async () => {
      const diagram = makeDiagram('d1');
      const loadFn = vi.fn().mockResolvedValue(diagram);
      const loader = new LazyLoader(loadFn, { maxCacheSize: 5 });

      await loader.loadDiagram('d1');
      const result = await loader.loadDiagram('d1');
      expect(result).toEqual(diagram);
      expect(loadFn).toHaveBeenCalledTimes(1);
    });

    it('should evict LRU diagram when cache is full', async () => {
      const loadFn = vi.fn().mockImplementation(
        (id: string) => Promise.resolve(makeDiagram(id)),
      );
      const loader = new LazyLoader(loadFn, { maxCacheSize: 2 });

      await loader.loadDiagram('d1');
      await loader.loadDiagram('d2');
      await loader.loadDiagram('d3'); // evicts d1

      expect(loader.getCache().has('d1')).toBe(false);
      expect(loader.getCache().has('d2')).toBe(true);
      expect(loader.getCache().has('d3')).toBe(true);
    });

    it('should revert to unloaded state on load failure', async () => {
      const loadFn = vi.fn().mockRejectedValue(new Error('load failed'));
      const loader = new LazyLoader(loadFn, { maxCacheSize: 5 });

      await expect(loader.loadDiagram('d1')).rejects.toThrow('load failed');
      expect(loader.getLoadState('d1')).toBe('unloaded');
    });
  });

  describe('getLoadState', () => {
    it('should return unloaded for unknown diagrams', () => {
      const loadFn = vi.fn();
      const loader = new LazyLoader(loadFn, { maxCacheSize: 5 });
      expect(loader.getLoadState('unknown')).toBe('unloaded');
    });

    it('should return loaded for cached diagrams', async () => {
      const loadFn = vi.fn().mockResolvedValue(makeDiagram('d1'));
      const loader = new LazyLoader(loadFn, { maxCacheSize: 5 });

      await loader.loadDiagram('d1');
      expect(loader.getLoadState('d1')).toBe('loaded');
    });

    it('should return unloaded for evicted diagrams', async () => {
      const loadFn = vi.fn().mockImplementation(
        (id: string) => Promise.resolve(makeDiagram(id)),
      );
      const loader = new LazyLoader(loadFn, { maxCacheSize: 1 });

      await loader.loadDiagram('d1');
      await loader.loadDiagram('d2'); // evicts d1

      // d1 was evicted from cache, so state should reflect that
      expect(loader.getLoadState('d1')).toBe('unloaded');
    });
  });

  describe('progress callback', () => {
    it('should emit loading and loaded states', async () => {
      const diagram = makeDiagram('d1');
      const loadFn = vi.fn().mockResolvedValue(diagram);
      const progressEvents: Array<{ id: string; state: LoadState }> = [];

      const loader = new LazyLoader(loadFn, {
        maxCacheSize: 5,
        onProgress: (id, state) => progressEvents.push({ id, state }),
      });

      await loader.loadDiagram('d1');

      expect(progressEvents).toEqual([
        { id: 'd1', state: 'loading' },
        { id: 'd1', state: 'loaded' },
      ]);
    });

    it('should emit loading then unloaded on failure', async () => {
      const loadFn = vi.fn().mockRejectedValue(new Error('fail'));
      const progressEvents: Array<{ id: string; state: LoadState }> = [];

      const loader = new LazyLoader(loadFn, {
        maxCacheSize: 5,
        onProgress: (id, state) => progressEvents.push({ id, state }),
      });

      await loader.loadDiagram('d1').catch(() => {});

      expect(progressEvents).toEqual([
        { id: 'd1', state: 'loading' },
        { id: 'd1', state: 'unloaded' },
      ]);
    });

    it('should not emit progress for cached hits', async () => {
      const diagram = makeDiagram('d1');
      const loadFn = vi.fn().mockResolvedValue(diagram);
      const progressEvents: Array<{ id: string; state: LoadState }> = [];

      const loader = new LazyLoader(loadFn, {
        maxCacheSize: 5,
        onProgress: (id, state) => progressEvents.push({ id, state }),
      });

      await loader.loadDiagram('d1');
      progressEvents.length = 0; // clear

      await loader.loadDiagram('d1'); // cache hit
      expect(progressEvents).toEqual([]);
    });
  });
});
