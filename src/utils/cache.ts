/**
 * High-Performance In-Memory Cache for Read-Heavy Static Catalog Data
 * Keeps Turso DB as the true source of truth while eliminating redundant roundtrips.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class InMemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Get value from cache or fetch and cache it
   */
  async getOrSet<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const existing = this.cache.get(key);

    if (existing && existing.expiresAt > now) {
      return existing.data as T;
    }

    // Cache miss or expired — fetch authoritative data from Turso
    const freshData = await fetcher();
    this.cache.set(key, {
      data: freshData,
      expiresAt: now + ttlMs
    });

    return freshData;
  }

  /**
   * Get cached value if present and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Invalidate specific key or keys matching prefix
   */
  invalidate(keyOrPrefix: string) {
    for (const key of this.cache.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached data
   */
  clear() {
    this.cache.clear();
  }
}

export const appCache = new InMemoryCache();

// Standard TTL constants
export const CACHE_TTL = {
  CATEGORIES: 5 * 60 * 1000, // 5 minutes
  SERVICES: 5 * 60 * 1000,   // 5 minutes
  STATIC_CONFIG: 10 * 60 * 1000 // 10 minutes
};
