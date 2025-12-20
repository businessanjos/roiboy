import React from "react";
import { LucideIcon, FileQuestion, Inbox, Search, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: "default" | "search" | "error" | "inbox";
  className?: string;
}

const variantIcons = {
  default: FileQuestion,
  search: Search,
  error: AlertCircle,
  inbox: Inbox,
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "default",
  className,
}: EmptyStateProps) {
  const Icon = icon || variantIcons[variant];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in",
        className
      )}
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="outline" size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Skeleton Components
interface SkeletonCardProps {
  className?: string;
  hasAvatar?: boolean;
  lines?: number;
}

export function SkeletonCard({ className, hasAvatar = false, lines = 3 }: SkeletonCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 animate-pulse", className)}>
      <div className="flex items-start gap-3">
        {hasAvatar && (
          <div className="h-10 w-10 rounded-full bg-muted" />
        )}
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
          {Array.from({ length: lines }).map((_, i) => (
            <div 
              key={i} 
              className="h-3 bg-muted rounded" 
              style={{ width: `${Math.random() * 40 + 50}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="border-b bg-muted/50 p-3 flex gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 bg-muted rounded flex-1 animate-pulse" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-3 flex gap-4 border-b last:border-0">
          {[1, 2, 3, 4].map((j) => (
            <div 
              key={j} 
              className="h-4 bg-muted rounded flex-1 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={cn("grid gap-4", `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${count}`)}>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className="rounded-lg border bg-card p-4 animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-8 w-16 bg-muted rounded" />
            </div>
            <div className="h-10 w-10 rounded-full bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Loading Overlay
interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  className?: string;
  children: React.ReactNode;
}

export function LoadingOverlay({ isLoading, text, className, children }: LoadingOverlayProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            {text && <p className="text-sm text-muted-foreground">{text}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Loading
export function InlineLoader({ text = "Carregando..." }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

// Page Loading
export function PageLoader() {
  return (
    <div className="min-h-[400px] flex items-center justify-center animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}
