import { lazy, Suspense, ComponentType } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load recharts components
const LazyBarChart = lazy(() => 
  import("recharts").then(mod => ({ default: mod.BarChart as ComponentType<any> }))
);
const LazyLineChart = lazy(() => 
  import("recharts").then(mod => ({ default: mod.LineChart as ComponentType<any> }))
);
const LazyAreaChart = lazy(() => 
  import("recharts").then(mod => ({ default: mod.AreaChart as ComponentType<any> }))
);
const LazyPieChart = lazy(() => 
  import("recharts").then(mod => ({ default: mod.PieChart as ComponentType<any> }))
);

// Chart loading skeleton
function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="w-full animate-pulse" style={{ height }}>
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  );
}

// Wrapper components with suspense
export function LazyBarChartWrapper({ 
  children, 
  height = 300,
  ...props 
}: { 
  children: React.ReactNode; 
  height?: number;
  [key: string]: any;
}) {
  return (
    <Suspense fallback={<ChartSkeleton height={height} />}>
      <LazyBarChart height={height} {...props}>
        {children}
      </LazyBarChart>
    </Suspense>
  );
}

export function LazyLineChartWrapper({ 
  children, 
  height = 300,
  ...props 
}: { 
  children: React.ReactNode; 
  height?: number;
  [key: string]: any;
}) {
  return (
    <Suspense fallback={<ChartSkeleton height={height} />}>
      <LazyLineChart height={height} {...props}>
        {children}
      </LazyLineChart>
    </Suspense>
  );
}

export function LazyAreaChartWrapper({ 
  children, 
  height = 300,
  ...props 
}: { 
  children: React.ReactNode; 
  height?: number;
  [key: string]: any;
}) {
  return (
    <Suspense fallback={<ChartSkeleton height={height} />}>
      <LazyAreaChart height={height} {...props}>
        {children}
      </LazyAreaChart>
    </Suspense>
  );
}

export function LazyPieChartWrapper({ 
  children, 
  height = 300,
  ...props 
}: { 
  children: React.ReactNode; 
  height?: number;
  [key: string]: any;
}) {
  return (
    <Suspense fallback={<ChartSkeleton height={height} />}>
      <LazyPieChart height={height} {...props}>
        {children}
      </LazyPieChart>
    </Suspense>
  );
}
