import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InsightsPanel } from "@/hooks/useInsightsPanels";
import { Pencil } from "lucide-react";

interface RenamePanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: InsightsPanel;
  onRename: (id: string, name: string) => Promise<void>;
}

export function RenamePanelDialog({
  open,
  onOpenChange,
  panel,
  onRename,
}: RenamePanelDialogProps) {
  const [name, setName] = useState(panel.name);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(panel.name);
    }
  }, [open, panel.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === panel.name) return;

    setIsSubmitting(true);
    try {
      await onRename(panel.id, name.trim());
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeLabel = panel.type === "dashboard" ? "painel" : "relatório";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Renomear {typeLabel}
          </DialogTitle>
          <DialogDescription>
            Digite o novo nome para o {typeLabel}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-panel">Nome</Label>
              <Input
                id="rename-panel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || name.trim() === panel.name || isSubmitting}
            >
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
