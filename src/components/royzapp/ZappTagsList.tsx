import { memo } from "react";
import { Tags, Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zapp-text-muted hover:bg-zapp-bg-dark">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border">
                    <DropdownMenuItem className="text-zapp-text" onClick={() => onOpenTagDialog(tag)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-zapp-border" />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => onDeleteTag(tag.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
