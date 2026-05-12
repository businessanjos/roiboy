import { useState, useEffect } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";

export interface KpiOption {
  id: string;
  label: string;
  description?: string;
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
        <div className="flex-1 overflow-y-auto pr-3 -mr-3 min-h-0">
          <div className="space-y-1">
            {catalog.map((opt) => {
              const checked = draft.includes(opt.id);
              const disabled =
                !checked && !!maxItems && draft.length >= maxItems;
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
                    <div className="text-sm font-medium leading-tight">
                      {opt.label}
                    </div>
                    {opt.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {opt.description}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
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
