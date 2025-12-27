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
      <DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef]">
        <DialogHeader>
          <DialogTitle>Etiquetar Conversa</DialogTitle>
          <DialogDescription className="text-[#8696a0]">
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
                className="mt-3 border-[#3b4a54] text-[#8696a0]"
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
                      : "bg-[#202c33] hover:bg-[#2a3942] border border-transparent"
                  )}
                  onClick={() => onToggleTag(tag.id)}
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[#e9edef] text-sm font-medium truncate">{tag.name}</p>
                    {tag.description && (
                      <p className="text-[#8696a0] text-xs truncate">{tag.description}</p>
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
            className="border-[#3b4a54] text-[#8696a0]"
          >
            Cancelar
          </Button>
          <Button 
            onClick={onSave} 
            disabled={saving || tags.length === 0}
            className="bg-[#00a884] hover:bg-[#00a884]/90"
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
