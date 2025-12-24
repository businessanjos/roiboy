import { useQuery, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

interface PaginatedResult<T> {
  data: T[];
  count: number;
  hasMore: boolean;
}

interface UseOptimizedQueryOptions<T> {
  queryKey: string[];
  queryFn: () => Promise<T>;
  staleTime?: number;
  gcTime?: number;
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  prefetchNext?: boolean;
}

/**
 * Optimized query hook with smart caching and prefetching
 */
export function useOptimizedQuery<T>({
  queryKey,
  queryFn,
  staleTime = 5 * 60 * 1000, // 5 minutes
  gcTime = 30 * 60 * 1000, // 30 minutes
  enabled = true,
  refetchOnWindowFocus = false,
  prefetchNext = false,
}: UseOptimizedQueryOptions<T>) {
  return useQuery({
    queryKey,
    queryFn,
    staleTime,
    gcTime,
    enabled,
    refetchOnWindowFocus,
    // Only refetch if data is stale
    refetchOnMount: 'always',
    // Dedupe requests
    structuralSharing: true,
  });
}

interface UsePaginatedQueryOptions<T> {
  queryKey: string[];
  queryFn: (page: number, pageSize: number) => Promise<PaginatedResult<T>>;
  pageSize?: number;
  enabled?: boolean;
}

/**
 * Paginated query with prefetching next page
 */
export function usePaginatedQuery<T>({
  queryKey,
  queryFn,
  pageSize = 20,
  enabled = true,
}: UsePaginatedQueryOptions<T>) {
  const queryClient = useQueryClient();
  const currentPage = useRef(0);

  const query = useQuery({
    queryKey: [...queryKey, currentPage.current, pageSize],
    queryFn: () => queryFn(currentPage.current, pageSize),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled,
    placeholderData: (previousData) => previousData,
  });

  // Prefetch next page
  useEffect(() => {
    if (query.data?.hasMore) {
      queryClient.prefetchQuery({
        queryKey: [...queryKey, currentPage.current + 1, pageSize],
        queryFn: () => queryFn(currentPage.current + 1, pageSize),
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [query.data, queryClient, queryKey, queryFn, pageSize]);

  const goToPage = useCallback((page: number) => {
    currentPage.current = page;
    queryClient.invalidateQueries({ queryKey: [...queryKey, page, pageSize] });
  }, [queryClient, queryKey, pageSize]);

  const nextPage = useCallback(() => {
    if (query.data?.hasMore) {
      goToPage(currentPage.current + 1);
    }
  }, [query.data, goToPage]);

  const previousPage = useCallback(() => {
    if (currentPage.current > 0) {
      goToPage(currentPage.current - 1);
    }
  }, [goToPage]);

  return {
    ...query,
    currentPage: currentPage.current,
    goToPage,
    nextPage,
    previousPage,
    pageSize,
  };
}

/**
 * Hook to prefetch data on hover/focus for instant navigation
 */
export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchQuery = useCallback(
    <T,>(queryKey: string[], queryFn: () => Promise<T>) => {
      queryClient.prefetchQuery({
        queryKey,
        queryFn,
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  return { prefetchQuery };
}

/**
 * Hook to invalidate related queries efficiently
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  const invalidate = useCallback(
    (queryKeys: string[][]) => {
      queryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    [queryClient]
  );

  const invalidateByPrefix = useCallback(
    (prefix: string) => {
      queryClient.invalidateQueries({
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === prefix,
      });
    },
    [queryClient]
  );

  return { invalidate, invalidateByPrefix };
}

/**
 * Debounced value hook for search inputs
 * Returns a value that only updates after the specified delay
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for memoizing expensive computations with dependencies
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, deps);

  return useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }, []) as T;
}
