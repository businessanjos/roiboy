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
import { InsightsDashboard } from "@/hooks/useInsightsDashboards";
import { Pencil } from "lucide-react";

interface RenameDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboard: InsightsDashboard;
  onRename: (id: string, name: string) => Promise<void>;
}

export function RenameDashboardDialog({
  open,
  onOpenChange,
  dashboard,
  onRename,
}: RenameDashboardDialogProps) {
  const [name, setName] = useState(dashboard.name);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(dashboard.name);
    }
  }, [open, dashboard.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === dashboard.name) return;

    setIsSubmitting(true);
    try {
      await onRename(dashboard.id, name.trim());
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Renomear painel
          </DialogTitle>
          <DialogDescription>
            Digite o novo nome para o painel.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-dashboard">Nome</Label>
              <Input
                id="rename-dashboard"
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
              disabled={!name.trim() || name.trim() === dashboard.name || isSubmitting}
            >
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
