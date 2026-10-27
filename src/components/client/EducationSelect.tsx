import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, GraduationCap, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  FAVORITE_EDUCATION_OPTIONS,
  OTHER_EDUCATION_OPTIONS,
  normalizeEducation,
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
  const { options: customOptions, addOption } = useEducationOptions();

  const customNames = useMemo(() => customOptions.map((o) => o.name), [customOptions]);
  const allKnown = useMemo(
    () => [...FAVORITE_EDUCATION_OPTIONS, ...OTHER_EDUCATION_OPTIONS, ...customNames],
    [customNames],
  );

  const filter = (list: string[]) => {
    const q = strip(query.trim());
    if (!q) return list;
    return list.filter((o) => strip(o).includes(q));
  };

  const favorites = useMemo(() => filter(FAVORITE_EDUCATION_OPTIONS), [query, allKnown]);
  // Formações cadastradas pelo time primeiro, depois as padrão restantes.
  const customFiltered = useMemo(() => filter(customNames), [query, customNames]);
  const others = useMemo(() => {
    const rest = OTHER_EDUCATION_OPTIONS.filter((o) => !customNames.includes(o));
    return filter(rest);
  }, [query, customNames]);

  // Valor legado fora da lista: mostra sugestão de conversão (ou aviso simples)
  const isKnown = useMemo(() => {
    if (!value) return true;
    return allKnown.includes(value);
  }, [value, allKnown]);

  const suggestion = useMemo(() => {
    if (!value || isKnown) return null;
    return normalizeEducation(value);
  }, [value, isKnown]);

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
    const clean = query.trim();
    if (!clean || creating) return;
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
    <button
      type="button"
      key={opt}
      onClick={() => select(opt)}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover:bg-accent transition-colors",
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
      <span className="truncate">{opt}</span>
    </button>
  );

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
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
        <PopoverContent className="w-[280px] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar formação..."
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
          <ScrollArea className="max-h-[280px]">
            <div className="p-1">
              {customFiltered.length > 0 && (
                <>
                  <p className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Adicionadas pelo time
                  </p>
                  {customFiltered.map(renderItem)}
                </>
              )}
              {favorites.length > 0 && (
                <>
                  <p className="px-2 py-1 mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Área da saúde
                  </p>
                  {favorites.map(renderItem)}
                </>
              )}
              {others.length > 0 && (
                <>
                  <p className="px-2 py-1 mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Outras formações
                  </p>
                  {others.map(renderItem)}
                </>
              )}
              {favorites.length === 0 && others.length === 0 && customFiltered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Nenhuma formação encontrada
                </p>
              )}
              {query.trim() && !exactMatch && (
                <div className="p-1 pt-2 border-t mt-1">
                  <button
                    type="button"
                    disabled={creating}
                    onClick={handleAdd}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm text-primary hover:bg-accent transition-colors disabled:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {creating ? "Adicionando..." : <>Adicionar "{query.trim()}"</>}
                    </span>
                  </button>
                  {addError && (
                    <p className="px-2 py-1 text-[11px] text-destructive">{addError}</p>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
          {value && (
            <div className="p-2 border-t">
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
      {suggestion ? (
        <button
          type="button"
          onClick={() => onChange(suggestion)}
          className="text-[11px] text-warning hover:underline text-left block"
        >
          Valor fora do padrão. Converter para "{suggestion}"?
        </button>
      ) : (
        !isKnown && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[11px] text-warning hover:underline text-left block"
          >
            "{value}" está fora do padrão. Clique para escolher uma formação da lista.
          </button>
        )
      )}

    </div>
  );
}
