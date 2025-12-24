import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Upload, Loader2 } from "lucide-react";

const PAYMENT_TYPES = [
  { value: "a_vista", label: "À Vista" },
  { value: "parcelado", label: "Parcelado" },
];

const INSTALLMENT_OPTIONS = [
  { value: "2x", label: "2x" },
  { value: "3x", label: "3x" },
  { value: "4x", label: "4x" },
  { value: "6x", label: "6x" },
  { value: "10x", label: "10x" },
  { value: "12x", label: "12x" },
];

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "cheque", label: "Cheque" },
];

const CONTRACT_TYPES = [
  { value: "compra", label: "Contrato de Compra" },
  { value: "renovacao", label: "Renovação" },
  { value: "confissao_divida", label: "Confissão de Dívida" },
  { value: "termo_congelamento", label: "Termo de Congelamento" },
  { value: "distrato", label: "Distrato" },
];

interface Contract {
  id: string;
  client_id: string;
  account_id: string;
  start_date: string;
  end_date: string | null;
  value: number;
  currency: string;
  payment_option: string | null;
  file_url: string | null;
  file_name: string | null;
  notes: string | null;
  parent_contract_id: string | null;
  status: string;
  contract_type: string;
}

interface ContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName?: string;
  existingContract?: Contract | null;
  onSuccess?: () => void;
}

export function ContractDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  existingContract,
  onSuccess,
}: ContractDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    start_date: "",
    end_date: "",
    value: "",
    contract_type: "compra",
    payment_type: "",
    installments: "",
    payment_method: "",
    notes: "",
    file: null as File | null,
    file_url: "",
    file_name: "",
  });

  // Reset form when dialog opens/closes or when editing contract changes
  useEffect(() => {
    if (open && existingContract) {
      const parsed = parsePaymentOption(existingContract.payment_option);
      setFormData({
        start_date: existingContract.start_date,
        end_date: existingContract.end_date || "",
        value: existingContract.value.toString(),
        contract_type: existingContract.contract_type || "compra",
        payment_type: parsed.type,
        installments: parsed.installments,
        payment_method: parsed.method,
        notes: existingContract.notes || "",
        file: null,
        file_url: existingContract.file_url || "",
        file_name: existingContract.file_name || "",
      });
    } else if (open) {
      setFormData({
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: "",
        value: "",
        contract_type: "compra",
        payment_type: "",
        installments: "",
        payment_method: "",
        notes: "",
        file: null,
        file_url: "",
        file_name: "",
      });
    }
  }, [open, existingContract]);

  const parsePaymentOption = (option: string | null) => {
    if (!option) return { type: "", installments: "", method: "" };
    const parts = option.split("_");
    if (parts[0] === "a" && parts[1] === "vista") {
      return { type: "a_vista", installments: "", method: parts[2] || "" };
    }
    if (parts[0] === "parcelado") {
      return { type: "parcelado", installments: parts[1] || "", method: parts[2] || "" };
    }
    return { type: "", installments: "", method: "" };
  };

  const buildPaymentOption = () => {
    if (!formData.payment_type) return null;
    if (formData.payment_type === "a_vista") {
      return formData.payment_method ? `a_vista_${formData.payment_method}` : "a_vista";
    }
    const installments = formData.installments || "1x";
    return formData.payment_method
      ? `parcelado_${installments}_${formData.payment_method}`
      : `parcelado_${installments}`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Apenas arquivos PDF são permitidos");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 10MB");
        return;
      }
      setFormData((prev) => ({ ...prev, file, file_name: file.name }));
    }
  };

  const uploadFile = async (file: File, accountId: string): Promise<{ url: string; name: string } | null> => {
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${accountId}/${clientId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("contracts")
        .getPublicUrl(fileName);

      return { url: urlData.publicUrl, name: file.name };
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao fazer upload do arquivo");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.start_date || !formData.value) {
      toast.error("Preencha a data de início e o valor");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: userProfile } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", userData.user.id)
        .single();

      if (!userProfile) throw new Error("Perfil não encontrado");

      let fileUrl = formData.file_url;
      let fileName = formData.file_name;

      if (formData.file) {
        const uploadResult = await uploadFile(formData.file, userProfile.account_id);
        if (uploadResult) {
          fileUrl = uploadResult.url;
          fileName = uploadResult.name;
        }
      }

      const contractData = {
        client_id: clientId,
        account_id: userProfile.account_id,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        value: parseFloat(formData.value) || 0,
        contract_type: formData.contract_type,
        payment_option: buildPaymentOption(),
        notes: formData.notes || null,
        file_url: fileUrl || null,
        file_name: fileName || null,
      };

      if (existingContract) {
        const { error } = await supabase
          .from("client_contracts")
          .update(contractData)
          .eq("id", existingContract.id);

        if (error) throw error;
        toast.success("Contrato atualizado");
      } else {
        const { error } = await supabase
          .from("client_contracts")
          .insert(contractData);

        if (error) throw error;
        toast.success("Contrato adicionado");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving contract:", error);
      toast.error("Erro ao salvar contrato");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existingContract ? "Editar Contrato" : "Novo Contrato"}
          </DialogTitle>
          {clientName && (
            <p className="text-sm text-muted-foreground">
              Cliente: {clientName}
            </p>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Data de Início *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Data de Término</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Contrato *</Label>
            <Select
              value={formData.contract_type}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, contract_type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value">Valor (R$) *</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.value}
                onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Pagamento</Label>
              <Select
                value={formData.payment_type}
                onValueChange={(value) => setFormData((prev) => ({
                  ...prev,
                  payment_type: value,
                  installments: value === "a_vista" ? "" : prev.installments
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.payment_type === "parcelado" && (
            <div className="space-y-2">
              <Label>Número de Parcelas</Label>
              <Select
                value={formData.installments}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, installments: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {INSTALLMENT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select
              value={formData.payment_method}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, payment_method: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Arquivo do Contrato (PDF)</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Upload PDF
              </Button>
              {(formData.file || formData.file_name) && (
                <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {formData.file?.name || formData.file_name}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Notas adicionais sobre o contrato..."
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
