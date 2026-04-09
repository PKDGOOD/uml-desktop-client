// =============================================================================
// Lazy Loader - On-demand diagram loading with LRU cache
// =============================================================================

import type { DiagramData, ProjectMetadata } from '../types';
import { LRUCache } from './lruCache';

export type LoadState = 'unloaded' | 'loading' | 'loaded';

export interface LazyLoaderOptions {
  maxCacheSize: number;
  onProgress?: (diagramId: string, state: LoadState) => void;
}

export class LazyLoader {
  private cache: LRUCache<string, DiagramData>;
  private loadStates = new Map<string, LoadState>();
  private loadFn: (diagramId: string) => Promise<DiagramData>;
  private onProgress?: (diagramId: string, state: LoadState) => void;

  constructor(
    loadFn: (diagramId: string) => Promise<DiagramData>,
    options: LazyLoaderOptions,
  ) {
    this.loadFn = loadFn;
    this.cache = new LRUCache<string, DiagramData>(options.maxCacheSize);
    this.onProgress = options.onProgress;
  }

  /**
   * Load project metadata only. Delegates to the caller's metadata loader.
   * This is a pass-through: the actual metadata parsing is done externally.
   */
  async loadProjectMetadata(
    metadataLoader: () => Promise<ProjectMetadata>,
  ): Promise<ProjectMetadata> {
    return metadataLoader();
  }

  /**
   * Load a specific diagram. Returns from cache if available,
   * otherwise calls loadFn and caches the result.
   */
  async loadDiagram(diagramId: string): Promise<DiagramData> {
    // Check cache first
    const cached = this.cache.get(diagramId);
    if (cached !== undefined) {
      return cached;
    }

    // Set loading state and emit progress
    this.setLoadState(diagramId, 'loading');

    try {
      const data = await this.loadFn(diagramId);
      this.cache.set(diagramId, data);
      this.setLoadState(diagramId, 'loaded');
      return data;
    } catch (error) {
      // Revert to unloaded on failure
      this.setLoadState(diagramId, 'unloaded');
      throw error;
    }
  }

  /**
   * Get the load state of a diagram.
   * If the diagram was evicted from cache, it's considered unloaded.
   */
  getLoadState(diagramId: string): LoadState {
    // If it's in cache, it's loaded
    if (this.cache.has(diagramId)) {
      return 'loaded';
    }
    // If the state map says 'loading', it's still loading
    const state = this.loadStates.get(diagramId);
    if (state === 'loading') {
      return 'loading';
    }
    // Otherwise (including 'loaded' but evicted from cache), it's unloaded
    return 'unloaded';
  }

  /**
   * Get the internal LRU cache (for testing/inspection).
   */
  getCache(): LRUCache<string, DiagramData> {
    return this.cache;
  }

  private setLoadState(diagramId: string, state: LoadState): void {
    this.loadStates.set(diagramId, state);
    this.onProgress?.(diagramId, state);
  }
}
