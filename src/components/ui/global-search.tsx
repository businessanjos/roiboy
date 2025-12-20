import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, FileText, Users, Calendar, Package, Settings, ArrowRight, Command } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
} from "./dialog";
import { Input } from "./input";
import { Button } from "./button";

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  type: "page" | "client" | "event" | "product" | "action";
  href?: string;
  action?: () => void;
  icon?: React.ReactNode;
}

// Predefined navigation items
const navigationItems: SearchResult[] = [
  { id: "dashboard", title: "Dashboard", type: "page", href: "/dashboard", icon: <FileText className="h-4 w-4" /> },
  { id: "clients", title: "Clientes", type: "page", href: "/clients", icon: <Users className="h-4 w-4" /> },
  { id: "events", title: "Eventos", type: "page", href: "/events", icon: <Calendar className="h-4 w-4" /> },
  { id: "tasks", title: "Tarefas", type: "page", href: "/tasks", icon: <FileText className="h-4 w-4" /> },
  { id: "products", title: "Produtos", type: "page", href: "/products", icon: <Package className="h-4 w-4" /> },
  { id: "forms", title: "Formulários", type: "page", href: "/forms", icon: <FileText className="h-4 w-4" /> },
  { id: "team", title: "Equipe", type: "page", href: "/team", icon: <Users className="h-4 w-4" /> },
  { id: "integrations", title: "Integrações", type: "page", href: "/integrations", icon: <Package className="h-4 w-4" /> },
  { id: "settings", title: "Configurações", type: "page", href: "/settings", icon: <Settings className="h-4 w-4" /> },
  { id: "new-client", title: "Novo Cliente", description: "Criar um novo cliente", type: "action", href: "/clients/new", icon: <Users className="h-4 w-4" /> },
  { id: "new-event", title: "Novo Evento", description: "Criar um novo evento", type: "action", href: "/events?new=true", icon: <Calendar className="h-4 w-4" /> },
];

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter results based on query
  const filteredResults = query.length > 0
    ? navigationItems.filter(
        item =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.description?.toLowerCase().includes(query.toLowerCase())
      )
    : navigationItems.slice(0, 6); // Show first 6 items when no query

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(i => (i + 1) % filteredResults.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + filteredResults.length) % filteredResults.length);
          break;
        case "Enter":
          e.preventDefault();
          const selected = filteredResults[selectedIndex];
          if (selected) {
            if (selected.action) {
              selected.action();
            } else if (selected.href) {
              navigate(selected.href);
            }
            onOpenChange(false);
          }
          break;
        case "Escape":
          onOpenChange(false);
          break;
      }
    },
    [filteredResults, selectedIndex, navigate, onOpenChange]
  );

  const handleSelect = (result: SearchResult) => {
    if (result.action) {
      result.action();
    } else if (result.href) {
      navigate(result.href);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar páginas, clientes, ações..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-4"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredResults.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum resultado encontrado</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredResults.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                    index === selectedIndex
                      ? "bg-primary/10 text-foreground"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className={cn(
                    "flex-shrink-0",
                    index === selectedIndex ? "text-primary" : ""
                  )}>
                    {result.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{result.title}</p>
                    {result.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {result.description}
                      </p>
                    )}
                  </div>
                  {index === selectedIndex && (
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-2 flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">↑↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">↵</kbd>
              selecionar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">esc</kbd>
              fechar
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to trigger global search
export function useGlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { open, setOpen };
}

// Search Trigger Button
export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
    >
      <Search className="mr-2 h-4 w-4" />
      <span className="hidden lg:inline-flex">Buscar...</span>
      <span className="inline-flex lg:hidden">Buscar</span>
      <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
        <Command className="h-3 w-3" />K
      </kbd>
    </Button>
  );
}
