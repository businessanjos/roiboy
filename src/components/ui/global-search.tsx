import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Search, X, ArrowRight, Command, Users, Briefcase, CornerDownLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "./dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "./input";
import { Button } from "./button";
import { sectors } from "@/config/sectors";
import { usePermissions } from "@/hooks/usePermissions";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { supabase } from "@/integrations/supabase/client";
import { PERMISSIONS } from "@/lib/access/permissions";

/** Evento global para abrir a busca a partir de qualquer botão do app. */
export const GLOBAL_SEARCH_EVENT = "roy:open-global-search";
export function openGlobalSearch() {
  window.dispatchEvent(new CustomEvent(GLOBAL_SEARCH_EVENT));
}

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  group: string;
  href: string;
  icon?: React.ReactNode;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [remote, setRemote] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const { hasSectorAccess, isLoading: sectorLoading } = useSectorAccess();

  // Páginas visíveis: apenas setores liberados + itens cuja permissão o usuário tem.
  const pages = useMemo<SearchResult[]>(() => {
    if (permissionsLoading || sectorLoading) return [];
    const items: SearchResult[] = [];
    for (const sector of sectors) {
      if (sector.comingSoon) continue;
      if (!hasSectorAccess(sector.id)) continue;
      for (const nav of sector.navItems) {
        if (nav.comingSoon) continue;
        if (nav.permission && !hasPermission(nav.permission)) continue;
        const Icon = nav.icon;
        items.push({
          id: `${sector.id}:${nav.to}`,
          title: nav.label,
          description: nav.group ? `${sector.name} · ${nav.group}` : sector.name,
          group: sector.name,
          href: nav.to,
          icon: <Icon className="h-4 w-4" />,
        });
      }
    }
    // Remove duplicatas de rota mantendo o primeiro setor encontrado.
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    });
  }, [hasPermission, hasSectorAccess, permissionsLoading, sectorLoading]);

  const canViewClients = hasPermission(PERMISSIONS.CLIENTS_VIEW);
  const canViewDeals = hasSectorAccess("vendas");

  const filteredPages = useMemo(() => {
    if (!query.trim()) return pages.slice(0, 8);
    const q = normalize(query.trim());
    return pages
      .filter(
        (item) =>
          normalize(item.title).includes(q) ||
          normalize(item.description || "").includes(q),
      )
      .slice(0, 12);
  }, [pages, query]);

  // Busca de registros (clientes/negócios). O RLS do banco garante que só
  // retorna aquilo que o usuário pode enxergar.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setRemote([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results: SearchResult[] = [];

      if (canViewClients) {
        const { data } = await supabase
          .from("clients")
          .select("id, full_name, company_name")
          .ilike("full_name", `%${term}%`)
          .limit(5);
        for (const c of data || []) {
          results.push({
            id: `client:${c.id}`,
            title: c.full_name,
            description: c.company_name || "Cliente",
            group: "Clientes",
            href: `/clients/${c.id}`,
            icon: <Users className="h-4 w-4" />,
          });
        }
      }

      if (canViewDeals) {
        const { data } = await supabase
          .from("deals")
          .select("id, title")
          .ilike("title", `%${term}%`)
          .limit(5);
        for (const d of data || []) {
          results.push({
            id: `deal:${d.id}`,
            title: d.title,
            description: "Negócio",
            group: "Negócios",
            href: `/pipeline?deal=${d.id}`,
            icon: <Briefcase className="h-4 w-4" />,
          });
        }
      }

      if (!cancelled) setRemote(results);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, canViewClients, canViewDeals]);

  const filteredResults = useMemo(
    () => [...filteredPages, ...remote],
    [filteredPages, remote],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, { result: SearchResult; index: number }[]>();
    filteredResults.forEach((result, index) => {
      const list = map.get(result.group) || [];
      list.push({ result, index });
      map.set(result.group, list);
    });
    return Array.from(map.entries());
  }, [filteredResults]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setRemote([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      navigate(result.href);
      onOpenChange(false);
    },
    [navigate, onOpenChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (filteredResults.length === 0) {
        if (e.key === "Escape") onOpenChange(false);
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % filteredResults.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + filteredResults.length) % filteredResults.length);
          break;
        case "Enter": {
          e.preventDefault();
          const selected = filteredResults[selectedIndex];
          if (selected) handleSelect(selected);
          break;
        }
        case "Escape":
          onOpenChange(false);
          break;
      }
    },
    [filteredResults, selectedIndex, handleSelect, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Busca global</DialogTitle>
        </VisuallyHidden>
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar páginas, clientes, negócios..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-4"
          />
          {query && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setQuery("")}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2">
          {filteredResults.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum resultado encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {grouped.map(([group, entries]) => (
                <div key={group} className="space-y-1">
                  <p className="px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {group}
                  </p>
                  {entries.map(({ result, index }) => (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                        index === selectedIndex
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className={cn("flex-shrink-0", index === selectedIndex && "text-primary")}>
                        {result.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.title}</p>
                        {result.description && (
                          <p className="text-xs text-muted-foreground truncate">{result.description}</p>
                        )}
                      </div>
                      {index === selectedIndex && (
                        <ArrowRight className="h-4 w-4 flex-shrink-0 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
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
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">
                <CornerDownLeft className="h-2.5 w-2.5" />
              </kbd>
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    const handleOpen = () => setOpen(true);

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener(GLOBAL_SEARCH_EVENT, handleOpen);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(GLOBAL_SEARCH_EVENT, handleOpen);
    };
  }, []);

  return { open, setOpen };
}

// Search Trigger Button
export function SearchTrigger({ onClick, className }: { onClick?: () => void; className?: string }) {
  return (
    <Button
      variant="outline"
      onClick={onClick || openGlobalSearch}
      className={cn(
        "relative h-10 justify-start text-sm text-muted-foreground sm:pr-12 w-56 lg:w-96",
        className,
      )}
    >
      <Search className="mr-2 h-4 w-4" />
      <span className="hidden lg:inline-flex">Buscar páginas, clientes, negócios...</span>
      <span className="inline-flex lg:hidden">Buscar</span>
      <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
        <Command className="h-3 w-3" />K
      </kbd>
    </Button>
  );
}
