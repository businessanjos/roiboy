import { memo } from "react";
import { Tags, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZappTag } from "./types";
import { ZAPP_TAG_FALLBACK_COLOR, tagReadableText } from "@/lib/zappTagColor";

interface ZappTagsListProps {
  tags: ZappTag[];
  onOpenTagDialog: (tag?: ZappTag) => void;
  onDeleteTag: (tagId: string) => void;
}

/**
 * Etiquetas em blocos iguais: cada uma é um cartão na cor dela, com o nome
 * inteiro (quebra em até duas linhas), a descrição quando existe e as ações
 * de editar/excluir no canto.
 */
export const ZappTagsList = memo(function ZappTagsList({
  tags,
  onOpenTagDialog,
  onDeleteTag,
}: ZappTagsListProps) {
  return (
    <div className="space-y-3 p-3 lg:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zapp-text">Tags</h3>
          <p className="text-xs text-zapp-text-muted">
            {tags.length === 0
              ? "Nenhuma etiqueta ainda"
              : `${tags.length} ${tags.length === 1 ? "etiqueta" : "etiquetas"}`}
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 bg-zapp-accent text-white hover:bg-zapp-accent-hover"
          onClick={() => onOpenTagDialog()}
        >
          <Plus className="mr-1 h-4 w-4" />
          Nova
        </Button>
      </div>

      {tags.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zapp-border px-4 py-10 text-center">
          <Tags className="mx-auto mb-3 h-10 w-10 text-zapp-text-muted" />
          <p className="text-sm text-zapp-text-muted">Nenhuma tag cadastrada</p>
          <p className="mt-1 text-xs text-zapp-text-muted">Crie tags para organizar suas conversas</p>
        </div>
      ) : (
        <ul
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(178px, 1fr))" }}
        >
          {tags.map((tag) => {
            const color = tag.color || ZAPP_TAG_FALLBACK_COLOR;
            const text = tagReadableText(color);
            const soft = text === "#ffffff" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.10)";
            return (
              <li key={tag.id} className="min-w-0">
                <article
                  className="group flex h-[84px] flex-col justify-between overflow-hidden rounded-xl px-3 py-2.5"
                  style={{
                    backgroundColor: color,
                    color: text,
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.22)",
                  }}
                >
                  <div className="flex items-start gap-1.5">
                    <p className="line-clamp-2 min-w-0 flex-1 text-[13px] font-semibold leading-[1.15]">
                      {tag.name}
                    </p>
                    <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => onOpenTagDialog(tag)}
                        aria-label={`Editar tag ${tag.name}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ backgroundColor: soft, color: text }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTag(tag.id)}
                        aria-label={`Excluir tag ${tag.name}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ backgroundColor: soft, color: text }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {tag.description ? (
                    <p className="truncate text-[11px] leading-4 opacity-80">{tag.description}</p>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
