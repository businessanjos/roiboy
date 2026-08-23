import { memo } from "react";
import { Tags, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zapp-input border-zapp-border text-zapp-text">
        <DialogHeader>
          <DialogTitle>Etiquetar Conversa</DialogTitle>
          <DialogDescription className="text-zapp-text-muted">
            Selecione as tags para esta conversa
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {tags.length === 0 ? (
            <div className="text-center py-4">
              <Tags className="h-8 w-8 text-zapp-text-muted mx-auto mb-2" />
              <p className="text-zapp-text-muted text-sm">Nenhuma tag cadastrada</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 border-zapp-border text-zapp-text-muted"
                onClick={() => {
                  onOpenChange(false);
                  onNavigateToTags();
                }}
              >
                Criar tags
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                    selectedTags.includes(tag.id)
                      ? "bg-zapp-accent/20 border border-zapp-accent"
                      : "bg-zapp-panel hover:bg-zapp-input border border-transparent"
                  )}
                  onClick={() => onToggleTag(tag.id)}
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-zapp-text text-sm font-medium truncate">{tag.name}</p>
                    {tag.description && (
                      <p className="text-zapp-text-muted text-xs truncate">{tag.description}</p>
                    )}
                  </div>
                  {selectedTags.includes(tag.id) && (
                    <CheckCheck className="h-4 w-4 text-zapp-accent flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="border-zapp-border text-zapp-text-muted"
          >
            Cancelar
          </Button>
          <Button 
            onClick={onSave} 
            disabled={saving || tags.length === 0}
            className="bg-zapp-accent hover:bg-zapp-accent/90"
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
