import { memo, useMemo, useCallback, useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
}

/**
 * Simple virtualized list for rendering large lists efficiently
 */
export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { startIndex, endIndex, offsetY } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(items.length - 1, start + visibleCount + overscan * 2);
    
    return {
      startIndex: start,
      endIndex: end,
      offsetY: start * itemHeight,
    };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const visibleItems = useMemo(() => 
    items.slice(startIndex, endIndex + 1),
    [items, startIndex, endIndex]
  );

  const totalHeight = items.length * itemHeight;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height: containerHeight, overflow: "auto" }}
      className="relative"
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={startIndex + index} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface LazyTableRowsProps<T> {
  data: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  initialCount?: number;
  incrementCount?: number;
}

/**
 * Progressive loading table rows
 */
export function LazyTableRows<T>({
  data,
  renderRow,
  initialCount = 20,
  incrementCount = 20,
}: LazyTableRowsProps<T>) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < data.length) {
          setVisibleCount(prev => Math.min(prev + incrementCount, data.length));
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [visibleCount, data.length, incrementCount]);

  // Reset on data change
  useEffect(() => {
    setVisibleCount(initialCount);
  }, [data.length, initialCount]);

  const visibleData = useMemo(() => 
    data.slice(0, visibleCount),
    [data, visibleCount]
  );

  return (
    <>
      {visibleData.map((item, index) => renderRow(item, index))}
      {visibleCount < data.length && (
        <tr ref={loadMoreRef as any}>
          <td colSpan={100} className="py-4">
            <div className="flex justify-center">
              <Skeleton className="h-8 w-32" />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Memoized table cell for preventing unnecessary re-renders
 */
export const MemoizedCell = memo(function MemoizedCell({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return <>{children}</>;
});

/**
 * Loading skeleton for table rows
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </>
  );
}
