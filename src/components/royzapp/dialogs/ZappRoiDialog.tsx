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

interface ZappRoiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roiType: string;
  roiCategory: string;
  roiImpact: string;
  roiEvidence: string;
  uploading: boolean;
  onTypeChange: (type: string) => void;
  onCategoryChange: (category: string) => void;
  onImpactChange: (impact: string) => void;
  onEvidenceChange: (evidence: string) => void;
  onSave: () => void;
}

export const ZappRoiDialog = memo(function ZappRoiDialog({
  open,
  onOpenChange,
  roiType,
  roiCategory,
  roiImpact,
  roiEvidence,
  uploading,
  onTypeChange,
  onCategoryChange,
  onImpactChange,
  onEvidenceChange,
  onSave,
}: ZappRoiDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zapp-bg border-zapp-border text-zapp-text">
        <DialogHeader>
          <DialogTitle className="text-zapp-text">Adicionar ROI</DialogTitle>
          <DialogDescription className="text-zapp-muted">
            Registre uma percepção de valor do cliente
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zapp-muted">Tipo</Label>
              <Select value={roiType} onValueChange={(v) => {
                onTypeChange(v);
                onCategoryChange(v === "tangible" ? "revenue" : "clarity");
              }}>
                <SelectTrigger className="bg-zapp-input border-zapp-border text-zapp-text">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zapp-bg border-zapp-border">
                  <SelectItem value="tangible" className="text-zapp-text focus:bg-zapp-hover focus:text-zapp-text">Tangível</SelectItem>
                  <SelectItem value="intangible" className="text-zapp-text focus:bg-zapp-hover focus:text-zapp-text">Intangível</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zapp-muted">Categoria</Label>
              <Select value={roiCategory} onValueChange={onCategoryChange}>
                <SelectTrigger className="bg-zapp-input border-zapp-border text-zapp-text">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zapp-bg border-zapp-border">
                  {roiType === "tangible" ? (
                    <>
                      <SelectItem value="revenue" className="text-zapp-text focus:bg-zapp-hover focus:text-zapp-text">Receita</SelectItem>
                      <SelectItem value="cost" className="text-zapp-text focus:bg-zapp-hover focus:text-zapp-text">Redução de Custo</SelectItem>
                      <SelectItem value="time" className="text-zapp-text focus:bg-zapp-hover focus:text-zapp-text">Economia de Tempo</SelectItem>
                      <SelectItem value="process" className="text-zapp-text focus:bg-zapp-hover focus:text-zapp-text">Melhoria de Processo</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="clarity" className="text-zapp-text focus:bg-zapp-hover focus:text-zapp-text">Clareza</SelectItem>
                      <SelectItem value="confidence" className="text-zapp-text focus:bg-zapp-hover focus:text-zapp-text">Confiança</SelectItem>
                      <SelectItem value="tranquility" className="text-zapp-text focus:bg-zapp-hover focus:text-zapp-text">Tranquilidade</SelectItem>
                      <SelectItem value="status_direction" className="text-zapp-text focus:bg-zapp-hover focus:text-zapp-text">Direção</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-zapp-muted">Impacto</Label>
            <Select value={roiImpact} onValueChange={onImpactChange}>
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
            <Label className="text-zapp-muted">Evidência / Detalhe</Label>
            <Textarea
              value={roiEvidence}
              onChange={(e) => onEvidenceChange(e.target.value)}
              placeholder="Descreva o que o cliente percebeu como valor..."
              className="bg-zapp-input border-zapp-border text-zapp-text placeholder:text-zapp-muted min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-zapp-border text-zapp-muted hover:bg-zapp-hover hover:text-zapp-text">
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={uploading} className="bg-zapp-accent hover:bg-zapp-accent/90 text-white">
            {uploading ? "Salvando..." : "Adicionar ROI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
