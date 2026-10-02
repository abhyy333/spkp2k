/**
 * Lightweight Client-Side Query Cache & Request Deduplicator
 * Solves duplicate in-flight requests and avoids repetitive Supabase fetches.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightPromises = new Map<string, Promise<any>>();

export async function fetchWithCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: { staleTimeMs?: number; forceRefresh?: boolean } = {}
): Promise<T> {
  const staleTimeMs = options.staleTimeMs ?? 5 * 60 * 1000; // default 5 minutes
  const now = Date.now();

  // 1. Check valid memory cache if forceRefresh is false
  if (!options.forceRefresh) {
    const cached = memoryCache.get(cacheKey);
    if (cached && now - cached.timestamp < staleTimeMs) {
      return cached.data;
    }
  }

  // 2. Deduplicate identical in-flight promises
  if (inFlightPromises.has(cacheKey)) {
    return inFlightPromises.get(cacheKey) as Promise<T>;
  }

  // 3. Dispatch new request
  const promise = (async () => {
    try {
      const data = await fetcher();
      memoryCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      // Don't cache errors
      memoryCache.delete(cacheKey);
      throw err;
    } finally {
      inFlightPromises.delete(cacheKey);
    }
  })();

  inFlightPromises.set(cacheKey, promise);
  return promise;
}

export function invalidateCache(cacheKeyPrefix?: string): void {
  if (!cacheKeyPrefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(cacheKeyPrefix)) {
      memoryCache.delete(key);
    }
  }
}

export function setCacheData<T>(cacheKey: string, data: T): void {
  memoryCache.set(cacheKey, { data, timestamp: Date.now() });
}
