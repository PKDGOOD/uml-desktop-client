import { describe, it, expect } from 'vitest';
import { LRUCache } from './lruCache';

describe('LRUCache', () => {
  describe('constructor', () => {
    it('should create a cache with the given maxSize', () => {
      const cache = new LRUCache<string, number>(5);
      expect(cache.maxSize).toBe(5);
      expect(cache.size).toBe(0);
    });

    it('should throw if maxSize is less than 1', () => {
      expect(() => new LRUCache<string, number>(0)).toThrow('maxSize must be at least 1');
      expect(() => new LRUCache<string, number>(-1)).toThrow('maxSize must be at least 1');
    });
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(2);
    });

    it('should return undefined for missing keys', () => {
      const cache = new LRUCache<string, number>(3);
      expect(cache.get('missing')).toBeUndefined();
    });

    it('should update value for existing key', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('a', 10);
      expect(cache.get('a')).toBe(10);
      expect(cache.size).toBe(1);
    });
  });

  describe('eviction', () => {
    it('should evict LRU entry when exceeding maxSize', () => {
      const cache = new LRUCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3); // should evict 'a'
      expect(cache.has('a')).toBe(false);
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
      expect(cache.size).toBe(2);
    });

    it('should evict correct entry after get reorders', () => {
      const cache = new LRUCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.get('a'); // 'a' is now most recently used
      cache.set('c', 3); // should evict 'b' (LRU)
      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
      expect(cache.has('c')).toBe(true);
    });

    it('should evict correct entry after set reorders existing key', () => {
      const cache = new LRUCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('a', 10); // 'a' is now most recently used
      cache.set('c', 3); // should evict 'b' (LRU)
      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
      expect(cache.has('c')).toBe(true);
      expect(cache.get('a')).toBe(10);
    });

    it('evictLRU removes the least recently used entry', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.evictLRU();
      expect(cache.has('a')).toBe(false);
      expect(cache.size).toBe(2);
    });

    it('evictLRU on empty cache does nothing', () => {
      const cache = new LRUCache<string, number>(3);
      cache.evictLRU(); // should not throw
      expect(cache.size).toBe(0);
    });
  });

  describe('delete', () => {
    it('should remove an entry', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      expect(cache.delete('a')).toBe(true);
      expect(cache.has('a')).toBe(false);
      expect(cache.size).toBe(0);
    });

    it('should return false for non-existent key', () => {
      const cache = new LRUCache<string, number>(3);
      expect(cache.delete('missing')).toBe(false);
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      expect(cache.has('a')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      const cache = new LRUCache<string, number>(3);
      expect(cache.has('a')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.has('a')).toBe(false);
    });
  });

  describe('keys', () => {
    it('should return keys in LRU to MRU order', () => {
      const cache = new LRUCache<string, number>(5);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.get('a'); // reorder: b, c, a
      expect(cache.keys()).toEqual(['b', 'c', 'a']);
    });
  });

  describe('maxSize of 1', () => {
    it('should only keep the most recent entry', () => {
      const cache = new LRUCache<string, number>(1);
      cache.set('a', 1);
      cache.set('b', 2);
      expect(cache.size).toBe(1);
      expect(cache.has('a')).toBe(false);
      expect(cache.get('b')).toBe(2);
    });
  });
});
