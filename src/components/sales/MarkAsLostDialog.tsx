import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useLossReasons } from "@/hooks/useLossReasons";
import { Loader2 } from "lucide-react";

interface MarkAsLostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    lossReasonId: string;
    lossSubReasonId?: string;
    lossNotes: string;
    lostReason: string; // legacy field: "Reason > SubReason"
  }) => void;
}

export function MarkAsLostDialog({ open, onOpenChange, onConfirm }: MarkAsLostDialogProps) {
  const { reasons, getSubReasons, isLoading } = useLossReasons();
  const [selectedReasonId, setSelectedReasonId] = useState("");
  const [selectedSubReasonId, setSelectedSubReasonId] = useState("");
  const [notes, setNotes] = useState("");

  const availableSubReasons = selectedReasonId ? getSubReasons(selectedReasonId) : [];
  const selectedReason = reasons.find((r) => r.id === selectedReasonId);
  const selectedSubReason = availableSubReasons.find((s) => s.id === selectedSubReasonId);

  useEffect(() => {
    if (!open) {
      setSelectedReasonId("");
      setSelectedSubReasonId("");
      setNotes("");
    }
  }, [open]);

  // Reset sub-reason when reason changes
  useEffect(() => {
    setSelectedSubReasonId("");
  }, [selectedReasonId]);

  const canSubmit = selectedReasonId && notes.trim().length > 0;

  const handleConfirm = () => {
    if (!canSubmit || !selectedReason) return;

    // Build legacy lost_reason string for backward compat
    let legacyReason = selectedReason.name;
    if (selectedSubReason) {
      legacyReason += ` > ${selectedSubReason.name}`;
    }

    onConfirm({
      lossReasonId: selectedReasonId,
      lossSubReasonId: selectedSubReasonId || undefined,
      lossNotes: notes.trim(),
      lostReason: legacyReason,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como Perdida</DialogTitle>
          <DialogDescription>
            Selecione o motivo e adicione detalhes sobre a perda.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Reason Select */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Motivo da Perda <span className="text-destructive">*</span>
              </label>
              <Select value={selectedReasonId} onValueChange={setSelectedReasonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((reason) => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sub-reason Select (only if reason has sub-reasons) */}
            {availableSubReasons.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Detalhamento
                </label>
                <Select value={selectedSubReasonId} onValueChange={setSelectedSubReasonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o detalhamento (opcional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubReasons.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Observações <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Descreva os detalhes da perda, contexto adicional..."
                className="min-h-[100px]"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={!canSubmit} onClick={handleConfirm}>
            Confirmar Perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
