import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ZappRiskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riskLevel: string;
  riskReason: string;
  uploading: boolean;
  onLevelChange: (level: string) => void;
  onReasonChange: (reason: string) => void;
  onSave: () => void;
}

export const ZappRiskDialog = memo(function ZappRiskDialog({
  open,
  onOpenChange,
  riskLevel,
  riskReason,
  uploading,
  onLevelChange,
  onReasonChange,
  onSave,
}: ZappRiskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zapp-bg border-zapp-border text-zapp-text">
        <DialogHeader>
          <DialogTitle className="text-zapp-text">Adicionar Risco</DialogTitle>
          <DialogDescription className="text-zapp-muted">
            Registre um alerta de risco para este cliente
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-zapp-muted">Nível de Risco</Label>
            <Select value={riskLevel} onValueChange={onLevelChange}>
              <SelectTrigger className="bg-zapp-input border-zapp-border text-zapp-text">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zapp-bg border-zapp-border">
                <SelectItem value="low" className="text-zapp-text focus:bg-zapp-hover focus:text-zapp-text">Baixo</SelectItem>
                <SelectItem value="medium" className="text-zapp-text focus:bg-zapp-hover focus:text-zapp-text">Médio</SelectItem>
                <SelectItem value="high" className="text-zapp-text focus:bg-zapp-hover focus:text-zapp-text">Alto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-zapp-muted">Motivo do Risco</Label>
            <Textarea
              value={riskReason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Descreva o motivo do alerta de risco..."
              className="bg-zapp-input border-zapp-border text-zapp-text placeholder:text-zapp-muted min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-zapp-border text-zapp-muted hover:bg-zapp-hover hover:text-zapp-text">
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={uploading} className="bg-amber-500 hover:bg-amber-600 text-white">
            {uploading ? "Salvando..." : "Adicionar Risco"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
