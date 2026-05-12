import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export interface KpiOption {
  id: string;
  label: string;
  description?: string;
  category?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  catalog: KpiOption[];
  selected: string[];
  onSave: (ids: string[]) => void;
  maxItems?: number;
}

export function KpiPicker({
  open,
  onOpenChange,
  title,
  catalog,
  selected,
  onSave,
  maxItems,
}: Props) {
  const [draft, setDraft] = useState<string[]>(selected);

  useEffect(() => {
    if (open) setDraft(selected);
  }, [open, selected]);

  const toggle = (id: string) => {
    setDraft((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (maxItems && prev.length >= maxItems) return prev;
      return [...prev, id];
    });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, KpiOption[]>();
    const all: KpiOption[] = [];
    for (const opt of catalog) {
      const cat = opt.category || "Outros";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(opt);
      all.push(opt);
    }
    return { categories: Array.from(map.entries()), all };
  }, [catalog]);

  const [tab, setTab] = useState<string>("__all");
  useEffect(() => {
    if (open) setTab("__all");
  }, [open]);

  const renderItem = (opt: KpiOption) => {
    const checked = draft.includes(opt.id);
    const disabled = !checked && !!maxItems && draft.length >= maxItems;
    return (
      <label
        key={opt.id}
        className={`flex items-start gap-3 rounded-md p-2 cursor-pointer border border-transparent hover:bg-muted/50 ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        } ${checked ? "bg-muted/40 border-border" : ""}`}
      >
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={() => !disabled && toggle(opt.id)}
          className="mt-0.5"
        />
        <div className="flex-1">
          <div className="text-sm font-medium leading-tight">{opt.label}</div>
          {opt.description && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {opt.description}
            </div>
          )}
        </div>
      </label>
    );
  };

  const countInCat = (cat: string) =>
    grouped.categories
      .find(([c]) => c === cat)?.[1]
      .filter((o) => draft.includes(o.id)).length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Escolha quais indicadores deseja exibir nesta seção.
            {maxItems ? ` Máximo ${maxItems}.` : ""}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="flex flex-wrap h-auto justify-start gap-1">
            <TabsTrigger value="__all" className="text-xs">
              Todos ({draft.length})
            </TabsTrigger>
            {grouped.categories.map(([cat]) => {
              const c = countInCat(cat);
              return (
                <TabsTrigger key={cat} value={cat} className="text-xs">
                  {cat}
                  {c > 0 && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ({c})
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-3 -mr-3 mt-3 min-h-0">
            <TabsContent value="__all" className="m-0 space-y-4">
              {grouped.categories.map(([cat, opts]) => (
                <div key={cat}>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1 px-1">
                    {cat}
                  </div>
                  <div className="space-y-1">{opts.map(renderItem)}</div>
                </div>
              ))}
            </TabsContent>
            {grouped.categories.map(([cat, opts]) => (
              <TabsContent key={cat} value={cat} className="m-0 space-y-1">
                {opts.map(renderItem)}
              </TabsContent>
            ))}
          </div>
        </Tabs>

        <DialogFooter className="flex-row sm:justify-between gap-2 pt-2">
          <div className="text-xs text-muted-foreground self-center">
            {draft.length} selecionado{draft.length === 1 ? "" : "s"}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                onSave(draft);
                onOpenChange(false);
              }}
            >
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
