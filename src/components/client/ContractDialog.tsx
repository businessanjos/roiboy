import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Upload, Loader2, Plus, FileText, CheckCircle, Edit, Calendar, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";

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
  onSuccess?: () => void;
}

export function ContractDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  onSuccess,
}: ContractDialogProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
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

  useEffect(() => {
    if (open && clientId) {
      fetchContracts();
      setMode("list");
      setEditingContract(null);
    }
  }, [open, clientId]);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_contracts")
        .select("*")
        .eq("client_id", clientId)
        .order("start_date", { ascending: false });

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      toast.error("Erro ao carregar contratos");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
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
  };

  const openNewForm = () => {
    resetForm();
    setEditingContract(null);
    setMode("form");
  };

  const openEditForm = (contract: Contract) => {
    const parsed = parsePaymentOption(contract.payment_option);
    setFormData({
      start_date: contract.start_date,
      end_date: contract.end_date || "",
      value: contract.value.toString(),
      contract_type: contract.contract_type || "compra",
      payment_type: parsed.type,
      installments: parsed.installments,
      payment_method: parsed.method,
      notes: contract.notes || "",
      file: null,
      file_url: contract.file_url || "",
      file_name: contract.file_name || "",
    });
    setEditingContract(contract);
    setMode("form");
  };

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

      if (editingContract) {
        const { error } = await supabase
          .from("client_contracts")
          .update(contractData)
          .eq("id", editingContract.id);

        if (error) throw error;
        toast.success("Contrato atualizado");
      } else {
        const { error } = await supabase
          .from("client_contracts")
          .insert(contractData);

        if (error) throw error;
        toast.success("Contrato adicionado");
      }

      await fetchContracts();
      setMode("list");
      setEditingContract(null);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving contract:", error);
      toast.error("Erro ao salvar contrato");
    } finally {
      setSaving(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      active: { label: "Ativo", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
      cancelled: { label: "Cancelado", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
      ended: { label: "Encerrado", className: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400" },
      paused: { label: "Pausado", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    };
    return statusMap[status] || { label: status, className: "bg-muted text-muted-foreground" };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contratos
          </DialogTitle>
          {clientName && (
            <p className="text-sm text-muted-foreground">{clientName}</p>
          )}
        </DialogHeader>

        {mode === "list" ? (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : contracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum contrato registrado.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {contracts.map((contract) => {
                  const status = getStatusLabel(contract.status);
                  return (
                    <div
                      key={contract.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {CONTRACT_TYPES.find(t => t.value === contract.contract_type)?.label || "Compra"}
                          </Badge>
                          <Badge className={`text-xs ${status.className}`}>
                            {status.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(contract.start_date), "dd/MM/yy", { locale: ptBR })}
                            {contract.end_date && (
                              <> - {format(new Date(contract.end_date), "dd/MM/yy", { locale: ptBR })}</>
                            )}
                          </span>
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(contract.value)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => openEditForm(contract)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t">
              <Link
                to={`/clients/${clientId}`}
                className="text-xs text-primary hover:underline"
                onClick={() => onOpenChange(false)}
              >
                Ver todos os detalhes
              </Link>
              <Button size="sm" onClick={openNewForm}>
                <Plus className="h-4 w-4 mr-1" />
                Novo Contrato
              </Button>
            </div>
          </div>
        ) : (
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

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={() => setMode("list")}>
                Voltar
              </Button>
              <div className="flex gap-2">
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
