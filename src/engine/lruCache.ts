// =============================================================================
// LRU Cache - Generic Least Recently Used Cache
// =============================================================================

export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly _maxSize: number;

  constructor(maxSize: number) {
    if (maxSize < 1) {
      throw new Error('maxSize must be at least 1');
    }
    this._maxSize = maxSize;
  }

  get maxSize(): number {
    return this._maxSize;
  }

  get size(): number {
    return this.cache.size;
  }

  /**
   * Get a value by key. Marks the entry as recently used.
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    // Move to end (most recently used) by re-inserting
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Set a key-value pair. Evicts LRU entry if over maxSize.
   */
  set(key: K, value: V): void {
    // If key already exists, delete first to update insertion order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    // Evict if over capacity
    while (this.cache.size > this._maxSize) {
      this.evictLRU();
    }
  }

  /**
   * Delete an entry by key.
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Check if a key exists in the cache.
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Remove the least recently used entry.
   */
  evictLRU(): void {
    // Map iteration order is insertion order; first key is LRU
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
    }
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get all keys in order from LRU to MRU.
   */
  keys(): K[] {
    return [...this.cache.keys()];
  }
}
