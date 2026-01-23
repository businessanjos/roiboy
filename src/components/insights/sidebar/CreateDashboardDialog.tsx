import { useState } from "react";
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
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { LayoutDashboard } from "lucide-react";

interface CreateDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateDashboardDialog({
  open,
  onOpenChange,
}: CreateDashboardDialogProps) {
  const [name, setName] = useState("");
  const { createDashboard, isCreating } = useInsightsDashboards();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await createDashboard(name.trim());
    setName("");
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Novo Painel
          </DialogTitle>
          <DialogDescription>
            Dê um nome para o seu novo painel.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dashboard-name">Nome do Painel</Label>
              <Input
                id="dashboard-name"
                placeholder="Ex: Vendas Mensal"
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
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || isCreating}>
              {isCreating ? "Criando..." : "Criar Painel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
