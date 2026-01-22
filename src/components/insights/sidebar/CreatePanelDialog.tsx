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
import { useInsightsPanels } from "@/hooks/useInsightsPanels";
import { LayoutDashboard, FileText } from "lucide-react";

interface CreatePanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "dashboard" | "report";
}

export function CreatePanelDialog({
  open,
  onOpenChange,
  type,
}: CreatePanelDialogProps) {
  const [name, setName] = useState("");
  const { createPanel, isCreating } = useInsightsPanels();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await createPanel(name.trim(), type);
    setName("");
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
    }
    onOpenChange(newOpen);
  };

  const typeLabel = type === "dashboard" ? "Painel" : "Relatório";
  const Icon = type === "dashboard" ? LayoutDashboard : FileText;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            Novo {typeLabel}
          </DialogTitle>
          <DialogDescription>
            Dê um nome para o seu novo {typeLabel.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="panel-name">Nome do {typeLabel}</Label>
              <Input
                id="panel-name"
                placeholder={`Ex: ${type === "dashboard" ? "Vendas Mensal" : "Performance Q1"}`}
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
              {isCreating ? "Criando..." : `Criar ${typeLabel}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
