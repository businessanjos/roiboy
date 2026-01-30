import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ZappEditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  groupJid: string;
  currentName: string;
  onSuccess?: () => void;
}

export function ZappEditGroupDialog({
  open,
  onOpenChange,
  conversationId,
  groupJid,
  currentName,
  onSuccess,
}: ZappEditGroupDialogProps) {
  const [groupName, setGroupName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      setGroupName(currentName);
    }
  }, [open, currentName]);

  const handleSave = async () => {
    if (!groupName.trim()) {
      toast.error("Nome do grupo não pode estar vazio");
      return;
    }

    if (groupName.trim() === currentName) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      // 1. Try to update group name in WhatsApp via UAZAPI
      if (groupJid) {
        const { error: uazapiError } = await supabase.functions.invoke("uazapi-manager", {
          body: {
            action: "update_group_name",
            group_id: groupJid,
            group_name: groupName.trim(),
          },
        });

        if (uazapiError) {
          console.warn("[ZappEditGroupDialog] Error updating group name in WhatsApp:", uazapiError);
          // Continue anyway - local update is still important
        }
      }

      // 2. Update contact_name in zapp_conversations (local sync)
      const { error: dbError } = await supabase
        .from("zapp_conversations")
        .update({ contact_name: groupName.trim() })
        .eq("id", conversationId);

      if (dbError) throw dbError;

      toast.success("Nome do grupo atualizado!");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("[ZappEditGroupDialog] Error saving group name:", error);
      toast.error("Erro ao atualizar nome do grupo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zapp-panel border-zapp-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zapp-text flex items-center gap-2">
            <Users2 className="h-5 w-5 text-zapp-accent" />
            Editar Grupo
          </DialogTitle>
          <DialogDescription className="text-zapp-text-muted">
            Altere o nome do grupo. Esta alteração será sincronizada com o WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="groupName" className="text-zapp-text">
              Nome do Grupo
            </Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Nome do grupo"
              className="bg-zapp-bg border-zapp-border text-zapp-text"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) {
                  handleSave();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-zapp-border text-zapp-text hover:bg-zapp-hover"
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !groupName.trim()}
            className="bg-zapp-accent hover:bg-zapp-accent-hover text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
