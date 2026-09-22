import { useState, useCallback, useRef } from 'react';
import { Quote } from '../types/Quote';
import quoteApi from '../api/quoteApi';

interface QuoteCache {
  get(id: number): Quote | undefined;
  set(id: number, quote: Quote): void;
  has(id: number): boolean;
  prefetchAdjacent(currentId: number): Promise<void>;
  clear(): void;
}

export const useQuoteCache = (): QuoteCache => {
  const [cache] = useState(() => new Map<number, Quote>());
  const prefetchPromises = useRef<Map<number, Promise<void>>>(new Map());

  const get = useCallback((id: number): Quote | undefined => {
    return cache.get(id);
  }, [cache]);

  const set = useCallback((id: number, quote: Quote): void => {
    cache.set(id, quote);
  }, [cache]);

  const has = useCallback((id: number): boolean => {
    return cache.has(id);
  }, [cache]);

  const prefetchAdjacent = useCallback(async (currentId: number): Promise<void> => {
    // Avoid duplicate prefetches
    if (prefetchPromises.current.has(currentId)) {
      return prefetchPromises.current.get(currentId);
    }

    const prefetchPromise = (async () => {
      try {
        console.log('🔄 prefetchAdjacent called for currentId:', currentId);
        // Prefetch previous and next quotes in parallel, but only if valid
        const promises = [];
        
        // Only prefetch previous if currentId > 1
        if (currentId > 1) {
          console.log('⬅️ Prefetching previous quote for ID:', currentId);
          promises.push(quoteApi.getPreviousQuote(currentId).catch(() => null));
        } else {
          promises.push(Promise.resolve(null));
        }
        
        // Always prefetch next quote
        console.log('➡️ Prefetching next quote for ID:', currentId);
        promises.push(quoteApi.getNextAuthenticatedQuote(currentId).catch(() => null));

        const [prev, next] = await Promise.all(promises);
        console.log('✅ Prefetch complete - prev:', prev?.id, 'next:', next?.id);

        // Cache the results if they exist
        if (prev) {
          cache.set(prev.id, prev);
        }
        if (next) {
          cache.set(next.id, next);
        }
      } catch (error) {
        console.warn('Failed to prefetch adjacent quotes:', error);
      } finally {
        // Clean up the promise reference
        prefetchPromises.current.delete(currentId);
      }
    })();

    prefetchPromises.current.set(currentId, prefetchPromise);
    return prefetchPromise;
  }, [cache]);

  const clear = useCallback((): void => {
    cache.clear();
    prefetchPromises.current.clear();
  }, [cache]);

  return {
    get,
    set,
    has,
    prefetchAdjacent,
    clear
  };
};
