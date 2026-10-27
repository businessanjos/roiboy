import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, GraduationCap, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  FAVORITE_EDUCATION_OPTIONS,
  formatEducationName,
} from "@/lib/educationOptions";
import { useEducationOptions } from "@/hooks/useEducationOptions";

interface EducationSelectProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const strip = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Dropdown com busca para padronizar o campo Formação. */
export function EducationSelect({
  value,
  onChange,
  placeholder = "Selecione a formação",
  className,
  disabled,
}: EducationSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const { options: customOptions, addOption } = useEducationOptions();

  const customNames = useMemo(() => customOptions.map((o) => o.name), [customOptions]);
  const allKnown = useMemo(
    () => [...FAVORITE_EDUCATION_OPTIONS, ...customNames],
    [customNames],
  );

  const filter = (list: string[]) => {
    const q = strip(query.trim());
    if (!q) return list;
    return list.filter((o) => strip(o).includes(q));
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const sorted = useMemo(() => {
    const seen = new Set<string>();
    const unique = allKnown.filter((o) => { const k = strip(o.trim()); if (!k || seen.has(k)) return false; seen.add(k); return true; });
    return unique.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [allKnown]);
  const visible = useMemo(() => filter(sorted), [query, sorted]);

  const exactMatch = useMemo(() => {
    const q = strip(query.trim());
    if (!q) return true;
    return allKnown.some((o) => strip(o) === q);
  }, [query, allKnown]);

  const select = (v: string) => {
    onChange(v);
    setQuery("");
    setAddError(null);
    setOpen(false);
  };

  const handleAdd = async () => {
    const clean = formatEducationName(query);
    if (!clean || creating) return;
    const existing = allKnown.find((o) => strip(o.trim()) === strip(clean));
    if (existing) { select(existing); return; }
    setCreating(true);
    setAddError(null);
    try {
      const saved = await addOption(clean);
      if (saved) select(saved);
      else setAddError("Não foi possível adicionar. Tente novamente.");
    } catch {
      setAddError("Não foi possível adicionar. Tente novamente.");
    } finally {
      setCreating(false);
    }
  };

  const renderItem = (opt: string) => (
    <Button
      type="button"
      variant="ghost"
      key={opt}
      onClick={() => select(opt)}
      className={cn(
        "h-auto w-full justify-start gap-2 whitespace-normal px-2 py-1.5 text-left text-sm font-normal",
        value === opt && "bg-accent/60",
      )}
    >
      <span
        className={cn(
          "h-4 w-4 rounded border flex items-center justify-center shrink-0",
          value === opt ? "bg-primary border-primary text-primary-foreground" : "border-input",
        )}
      >
        {value === opt && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0 break-words">{opt}</span>
    </Button>
  );

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={(nextOpen) => {
        if (nextOpen) setPortalContainer(triggerRef.current?.closest<HTMLElement>('[role="dialog"]') ?? null);
        setOpen(nextOpen);
      }}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            aria-expanded={open}
            className={cn(
              "h-9 w-full justify-between font-normal",
              !value && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate flex items-center gap-2">
              <GraduationCap className="h-3.5 w-3.5 shrink-0 opacity-60" />
              {value || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          portalContainer={portalContainer}
          className="flex w-[min(280px,calc(100vw-1rem))] max-h-[var(--radix-popover-content-available-height)] flex-col overflow-hidden p-0"
          collisionPadding={8}
          align="start"
        >
          <div className="shrink-0 p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                ref={inputRef}
                onKeyDown={(e) => { if (e.key === "Enter" && query.trim() && !exactMatch) { e.preventDefault(); handleAdd(); } }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar ou criar formação..."
                aria-label="Nome da formação"
                className="h-8 pl-8 pr-7"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div
            role="region"
            aria-label="Lista de formações"
            className="min-h-0 max-h-[280px] flex-1 overflow-y-auto overscroll-contain touch-pan-y"
          >
            <div className="p-1">
              {visible.map(renderItem)}
              {visible.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhuma formação encontrada</p>
              )}
              <div className="mt-1 border-t pt-1">
                {query.trim() && exactMatch ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">Essa formação já existe na lista.</p>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={creating}
                    onClick={() => (query.trim() ? handleAdd() : inputRef.current?.focus())}
                    className="h-auto w-full justify-start gap-2 whitespace-normal px-2 py-1.5 text-left text-sm text-primary"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 break-words">
                      {creating ? "Adicionando..." : query.trim() ? <>Criar "{formatEducationName(query)}"</> : "Criar nova formação (digite o nome na busca)"}
                    </span>
                  </Button>
                )}
                {addError && <p className="px-2 py-1 text-[11px] text-destructive">{addError}</p>}
              </div>
            </div>
          </div>
          {value && (
            <div className="shrink-0 p-2 border-t">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Limpar seleção
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
