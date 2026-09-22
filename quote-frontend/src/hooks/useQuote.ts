import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { Quote } from '../types/Quote';
import quoteApi from '../api/quoteApi';
import { useQuoteCache } from './useQuoteCache';

interface UseQuoteOptions {
  enableOptimisticUpdates?: boolean;
}

export const useQuote = (quoteId: number | null, options: UseQuoteOptions = {}) => {
  const queryClient = useQueryClient();
  const quoteCache = useQuoteCache();
  const { enableOptimisticUpdates = true } = options;

  // React Query for server state
  const {
    data: serverQuote,
    isLoading,
    error,
    isFetching
  } = useQuery({
    queryKey: ['quote', quoteId],
    queryFn: () => quoteId ? quoteApi.getQuoteById(quoteId) : null,
    enabled: !!quoteId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
  });

  // Get quote from cache or server
  const quote = enableOptimisticUpdates && quoteId && quoteCache.has(quoteId)
    ? quoteCache.get(quoteId)
    : serverQuote;

  // Prefetch adjacent quotes when quote changes
  const prefetchAdjacent = useCallback(async () => {
    if (quoteId && enableOptimisticUpdates) {
      // Temporarily disabled to debug double-quote advancement issue
      console.log('🚫 prefetchAdjacent disabled to prevent double state advancement');
      // await quoteCache.prefetchAdjacent(quoteId);
    }
  }, [quoteId, quoteCache, enableOptimisticUpdates]);

  // Prefetch specific quote
  const prefetchQuote = useCallback(async (id: number) => {
    await queryClient.prefetchQuery({
      queryKey: ['quote', id],
      queryFn: () => quoteApi.getQuoteById(id),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  // Invalidate quote (force refresh)
  const invalidateQuote = useCallback(async (id: number) => {
    await queryClient.invalidateQueries({ queryKey: ['quote', id] });
  }, [queryClient]);

  // Update quote in cache
  const updateQuote = useCallback((updatedQuote: Quote) => {
    if (enableOptimisticUpdates) {
      quoteCache.set(updatedQuote.id, updatedQuote);
    }
    queryClient.setQueryData(['quote', updatedQuote.id], updatedQuote);
  }, [quoteCache, queryClient, enableOptimisticUpdates]);

  return {
    quote,
    isLoading: isLoading && !quote, // Only show loading if no cached data
    isFetching,
    error,
    prefetchAdjacent,
    prefetchQuote,
    invalidateQuote,
    updateQuote,
    isFromCache: enableOptimisticUpdates && quoteId && quoteCache.has(quoteId) && quote !== serverQuote
  };
};

// Hook for user progress
export const useUserProgress = () => {
  return useQuery({
    queryKey: ['userProgress'],
    queryFn: () => quoteApi.getUserProgress(),
    enabled: false, // Don't fetch automatically
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes (renamed from cacheTime)
  });
};

// Hook for authenticated quote (next sequential)
export const useAuthenticatedQuote = () => {
  const queryClient = useQueryClient();
  
  const result = useQuery({
    queryKey: ['authenticatedQuote'],
    queryFn: () => quoteApi.getAuthenticatedQuote(),
    enabled: false, // Don't fetch automatically
    staleTime: 0, // Always fresh
    gcTime: 0, // Don't cache
  });

  // Handle side effect in useEffect instead of onSuccess
  useEffect(() => {
    if (result.data) {
      // Invalidate user progress after getting new quote
      queryClient.invalidateQueries({ queryKey: ['userProgress'] });
    }
  }, [result.data, queryClient]);

  return result;
};
