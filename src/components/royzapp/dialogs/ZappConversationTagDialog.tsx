import { memo, useMemo, useState } from "react";
import { Check, Search, Tags, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ZappTag } from "../types";

interface ZappConversationTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: ZappTag[];
  selectedTags: string[];
  onToggleTag: (tagId: string) => void;
  onSave: () => void;
  saving: boolean;
  onNavigateToTags: () => void;
}

const FALLBACK_COLOR = "#6b7c85";

/** Mesma grade em todas as linhas: bolinha, nome e caixa de seleção sempre no prumo. */
const ROW = "grid grid-cols-[18px_10px_minmax(0,1fr)] items-center gap-3 px-3";

export const ZappConversationTagDialog = memo(function ZappConversationTagDialog({
  open,
  onOpenChange,
  tags,
  selectedTags,
  onToggleTag,
  onSave,
  saving,
  onNavigateToTags,
}: ZappConversationTagDialogProps) {
  const [search, setSearch] = useState("");

  const visibleTags = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q),
    );
  }, [tags, search]);

  const close = () => {
    setSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[86vh] w-[94vw] max-w-xl flex-col gap-3 overflow-hidden bg-zapp-input border-zapp-border text-zapp-text">
        <DialogHeader className="pr-8">
          <DialogTitle>Etiquetar Conversa</DialogTitle>
          <DialogDescription className="text-zapp-text-muted">
            Selecione as etiquetas para esta conversa
          </DialogDescription>
        </DialogHeader>

        {tags.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zapp-text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar etiqueta"
                className="h-9 bg-zapp-panel pl-8 text-sm"
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-zapp-text-muted">
              {selectedTags.length} de {tags.length}
            </span>
            {selectedTags.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => selectedTags.forEach((id) => onToggleTag(id))}
                className="h-9 shrink-0 px-2 text-xs text-zapp-text-muted hover:text-zapp-text"
              >
                Limpar
              </Button>
            )}
          </div>
        )}

        {tags.length === 0 ? (
          <div className="py-6 text-center">
            <Tags className="mx-auto mb-2 h-8 w-8 text-zapp-text-muted" />
            <p className="text-sm text-zapp-text-muted">Nenhuma etiqueta cadastrada</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 border-zapp-border text-zapp-text-muted"
              onClick={() => {
                close();
                onNavigateToTags();
              }}
            >
              Criar etiquetas
            </Button>
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1 pr-1">
            <div className="space-y-1.5 pb-1">
              {visibleTags.map((tag) => {
                const selected = selectedTags.includes(tag.id);
                const color = tag.color || FALLBACK_COLOR;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onToggleTag(tag.id)}
                    className={cn(
                      ROW,
                      "h-[46px] w-full rounded-lg border text-left transition-colors",
                      selected
                        ? "border-zapp-accent/70 bg-zapp-accent/12"
                        : "border-zapp-border/70 bg-zapp-panel hover:bg-zapp-hover",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border",
                        selected
                          ? "border-zapp-accent bg-zapp-accent text-zapp-input"
                          : "border-zapp-border bg-zapp-input",
                      )}
                    >
                      {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: color }}
                    />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block truncate text-sm font-medium",
                          selected ? "text-zapp-text" : "text-zapp-text/90",
                        )}
                      >
                        {tag.name}
                      </span>
                      {tag.description && (
                        <span className="block truncate text-[11px] leading-tight text-zapp-text-muted">
                          {tag.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}

              {visibleTags.length === 0 && (
                <div className="py-6 text-center">
                  <p className="text-sm text-zapp-text-muted">
                    Nenhuma etiqueta com "{search.trim()}"
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 text-xs text-zapp-text-muted hover:text-zapp-text"
                    onClick={() => setSearch("")}
                  >
                    Limpar busca
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button
            variant="outline"
            onClick={close}
            className="border-zapp-border text-zapp-text-muted"
          >
            Cancelar
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || tags.length === 0}
            className="bg-zapp-accent hover:bg-zapp-accent/90"
          >
            {saving ? "Salvando..." : `Salvar${selectedTags.length > 0 ? ` (${selectedTags.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
