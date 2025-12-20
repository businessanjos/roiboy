import React, { useState } from "react";
import { Search, Filter, X, SlidersHorizontal } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
  className?: string;
  filtersActive?: boolean;
  onClearFilters?: () => void;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  children,
  className,
  filtersActive = false,
  onClearFilters,
}: FilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasFilters = React.Children.count(children) > 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-10 pr-10 h-10"
        />
        {searchValue && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter Button with Popover (for mobile) or inline filters (desktop) */}
      {hasFilters && (
        <>
          {/* Mobile: Popover */}
          <div className="sm:hidden">
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className={cn(
                    "h-10 w-10 shrink-0",
                    filtersActive && "border-primary text-primary"
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {filtersActive && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Filtros</span>
                    {filtersActive && onClearFilters && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          onClearFilters();
                          setFiltersOpen(false);
                        }}
                        className="h-7 text-xs"
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {children}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Desktop: Inline filters */}
          <div className="hidden sm:flex items-center gap-2">
            {children}
            {filtersActive && onClearFilters && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onClearFilters}
                className="h-10 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </>
      )}

      {/* Simple filter icon when no children */}
      {!hasFilters && (
        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
          <Filter className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// Wrapper for filter items to ensure consistent styling
interface FilterItemProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterItem({ children, className }: FilterItemProps) {
  return (
    <div className={cn("w-full sm:w-auto", className)}>
      {children}
    </div>
  );
}
