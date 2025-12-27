import { memo } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ZappAddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: { full_name: string; phone_e164: string };
  onFormChange: (form: { full_name: string; phone_e164: string }) => void;
  onSave: () => void;
  saving: boolean;
}

export const ZappAddClientDialog = memo(function ZappAddClientDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSave,
  saving,
}: ZappAddClientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-zapp-accent" />
            Adicionar Cliente
          </DialogTitle>
          <DialogDescription className="text-[#8696a0]">
            Cadastre este contato como cliente no sistema
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="client-name" className="text-[#8696a0]">Nome completo</Label>
            <Input
              id="client-name"
              value={form.full_name}
              onChange={(e) => onFormChange({ ...form, full_name: e.target.value })}
              placeholder="Nome do cliente"
              className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-phone" className="text-[#8696a0]">Telefone</Label>
            <Input
              id="client-phone"
              value={form.phone_e164}
              onChange={(e) => onFormChange({ ...form, phone_e164: e.target.value })}
              placeholder="+5511999999999"
              className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
              readOnly
            />
            <p className="text-xs text-[#8696a0]">
              O telefone é preenchido automaticamente com o número da conversa
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#3b4a54] text-[#8696a0]">
            Cancelar
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || !form.full_name.trim()}
            className="bg-[#00a884] hover:bg-[#00a884]/90"
          >
            {saving ? "Salvando..." : "Cadastrar Cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
