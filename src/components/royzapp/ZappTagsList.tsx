import { memo } from "react";
import { Tags, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZappTag } from "./types";
import { ZappTagBadge } from "./ZappTagBadge";
import { ZAPP_TAG_FALLBACK_COLOR, tagEdge, tagTint } from "@/lib/zappTagColor";

interface ZappTagsListProps {
  tags: ZappTag[];
  onOpenTagDialog: (tag?: ZappTag) => void;
  onDeleteTag: (tagId: string) => void;
}

/**
 * Etiquetas em blocos iguais: cada uma é um cartão de altura fixa na cor dela,
 * com o selo, a descrição quando existe e as ações de editar/excluir.
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
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(172px, 1fr))" }}
        >
          {tags.map((tag) => {
            const color = tag.color || ZAPP_TAG_FALLBACK_COLOR;
            return (
              <li key={tag.id} className="min-w-0">
                <article
                  className="group flex h-[74px] flex-col justify-center gap-1.5 overflow-hidden rounded-xl border px-3 transition-shadow hover:shadow-sm"
                  style={{ backgroundColor: tagTint(color, 0.16), borderColor: tagEdge(color, 0.42) }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <ZappTagBadge tag={tag} size="md" tooltip={false} className="min-w-0 max-w-full" />
                    <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zapp-text-muted hover:bg-zapp-panel"
                        onClick={() => onOpenTagDialog(tag)}
                        aria-label={`Editar tag ${tag.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:bg-destructive/10"
                        onClick={() => onDeleteTag(tag.id)}
                        aria-label={`Excluir tag ${tag.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {tag.description ? (
                    <p className="truncate text-[11px] leading-4 text-zapp-text-muted">{tag.description}</p>
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
