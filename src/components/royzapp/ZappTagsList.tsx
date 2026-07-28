import { memo } from "react";
import { Tags, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZappTag } from "./types";

interface ZappTagsListProps {
  tags: ZappTag[];
  onOpenTagDialog: (tag?: ZappTag) => void;
  onDeleteTag: (tagId: string) => void;
}

export const ZappTagsList = memo(function ZappTagsList({
  tags,
  onOpenTagDialog,
  onDeleteTag,
}: ZappTagsListProps) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-zapp-text font-medium">Tags</h3>
        <Button
          size="sm"
          className="bg-zapp-accent hover:bg-zapp-accent-hover text-white"
          onClick={() => onOpenTagDialog()}
        >
          <Plus className="h-4 w-4 mr-1" />
          Nova
        </Button>
      </div>

      {tags.length === 0 ? (
        <div className="text-center py-8">
          <Tags className="h-12 w-12 text-zapp-text-muted mx-auto mb-3" />
          <p className="text-zapp-text-muted text-sm">Nenhuma tag cadastrada</p>
          <p className="text-zapp-text-muted text-xs mt-1">Crie tags para organizar suas conversas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="p-3 bg-zapp-panel rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-zapp-text font-medium">{tag.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zapp-text-muted hover:bg-zapp-bg-dark"
                    onClick={() => onOpenTagDialog(tag)}
                    aria-label={`Editar tag ${tag.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => onDeleteTag(tag.id)}
                    aria-label={`Excluir tag ${tag.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {tag.description && (
                <p className="text-zapp-text-muted text-xs mt-1">{tag.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
