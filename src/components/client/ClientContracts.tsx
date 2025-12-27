import { useState, useEffect, useRef } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, differenceInDays, isPast, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Plus, 
  FileText, 
  Upload, 
  Trash2, 
  Edit, 
  Download,
  Loader2,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  History,
  ChevronDown,
  ChevronRight,
  XCircle,
  PauseCircle,
  Ban,
  MoreHorizontal,
  PenTool
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ZapSignDialog } from "@/components/zapsign/ZapSignDialog";

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
  status_reason: string | null;
  status_changed_at: string | null;
  contract_type: string;
  created_at: string;
  updated_at: string;
}

type ContractStatusAction = 'cancelled' | 'ended' | 'paused' | 'active';

const CONTRACT_STATUS_CONFIG = {
  active: { label: "Ativo", icon: CheckCircle, className: "border-green-500 text-green-600" },
  cancelled: { label: "Cancelado (Churn)", icon: XCircle, className: "border-red-500 text-red-600" },
  ended: { label: "Encerrado", icon: Ban, className: "border-slate-500 text-slate-600" },
  paused: { label: "Pausado", icon: PauseCircle, className: "border-amber-500 text-amber-600" },
};

interface ClientContractsProps {
  clientId: string;
}

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

export function ClientContracts({ clientId }: ClientContractsProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [renewingContract, setRenewingContract] = useState<Contract | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ZapSign dialog state
  const [zapSignDialogOpen, setZapSignDialogOpen] = useState(false);
  const [zapSignContractId, setZapSignContractId] = useState<string | undefined>(undefined);

  // Status action dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusAction, setStatusAction] = useState<ContractStatusAction | null>(null);
  const [statusContract, setStatusContract] = useState<Contract | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

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
    fetchContracts();
  }, [clientId]);

  const fetchContracts = async () => {
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
      start_date: "",
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
    setEditingContract(null);
    setRenewingContract(null);
  };

  // Parse payment_option string into its components
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

  // Build payment_option string from components
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

  const openRenewalDialog = (contract: Contract) => {
    setRenewingContract(contract);
    const nextDay = contract.end_date 
      ? format(new Date(new Date(contract.end_date).getTime() + 86400000), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd");
    const parsed = parsePaymentOption(contract.payment_option);
    setFormData({
      start_date: nextDay,
      end_date: "",
      value: contract.value.toString(),
      contract_type: contract.contract_type || "compra",
      payment_type: parsed.type,
      installments: parsed.installments,
      payment_method: parsed.method,
      notes: "",
      file: null,
      file_url: "",
      file_name: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (contract: Contract) => {
    setEditingContract(contract);
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
    setDialogOpen(true);
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

  const handleDownloadContract = async (contract: Contract) => {
    if (!contract.file_url) return;
    
    setDownloading(contract.id);
    try {
      // Extract the file path from the URL
      let filePath = '';
      const match = contract.file_url.match(/\/contracts\/(.+?)(?:\?|$)/);
      if (match) {
        filePath = match[1];
      } else {
        const urlParts = contract.file_url.split('/contracts/');
        if (urlParts[1]) {
          filePath = urlParts[1].split('?')[0];
        }
      }
      
      if (!filePath) {
        throw new Error("Could not extract file path from URL");
      }

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Usuário não autenticado");
      }

      // Use edge function to proxy the download (bypasses browser extension blocking)
      const response = await supabase.functions.invoke('download-contract', {
        body: { 
          filePath: decodeURIComponent(filePath), 
          fileName: contract.file_name 
        },
      });

      if (response.error) {
        throw response.error;
      }

      // Create blob from response and trigger download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = contract.file_name || 'contrato.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      toast.success("Download iniciado!");
    } catch (error) {
      console.error("Error downloading contract:", error);
      toast.error("Erro ao baixar o contrato. Tente novamente.");
    } finally {
      setDownloading(null);
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
        parent_contract_id: renewingContract?.id || null,
      };

      if (editingContract) {
        const { error } = await supabase
          .from("client_contracts")
          .update({
            ...contractData,
            parent_contract_id: editingContract.parent_contract_id, // Keep original parent
          })
          .eq("id", editingContract.id);

        if (error) throw error;
        toast.success("Contrato atualizado");
      } else {
        const { error } = await supabase
          .from("client_contracts")
          .insert(contractData);

        if (error) throw error;
        toast.success(renewingContract ? "Contrato renovado" : "Contrato adicionado");
      }

      setDialogOpen(false);
      resetForm();
      fetchContracts();
    } catch (error) {
      console.error("Error saving contract:", error);
      toast.error("Erro ao salvar contrato");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!contractToDelete) return;

    try {
      const { error } = await supabase
        .from("client_contracts")
        .delete()
        .eq("id", contractToDelete);

      if (error) throw error;
      toast.success("Contrato excluído");
      fetchContracts();
    } catch (error) {
      console.error("Error deleting contract:", error);
      toast.error("Erro ao excluir contrato");
    } finally {
      setDeleteDialogOpen(false);
      setContractToDelete(null);
    }
  };

  const openStatusDialog = (contract: Contract, action: ContractStatusAction) => {
    setStatusContract(contract);
    setStatusAction(action);
    setStatusReason("");
    setStatusDialogOpen(true);
  };

  const handleStatusChange = async () => {
    if (!statusContract || !statusAction) return;
    
    // Require reason for pause action
    if (statusAction === 'paused' && !statusReason.trim()) {
      toast.error("Digite o motivo da pausa");
      return;
    }

    setStatusSaving(true);
    try {
      const { error } = await supabase
        .from("client_contracts")
        .update({
          status: statusAction,
          status_reason: statusAction === 'active' ? null : statusReason.trim() || null,
          status_changed_at: new Date().toISOString(),
        })
        .eq("id", statusContract.id);

      if (error) throw error;
      
      const actionLabels = {
        cancelled: "Contrato cancelado (churn)",
        ended: "Contrato encerrado",
        paused: "Contrato pausado",
        active: "Contrato reativado",
      };
      toast.success(actionLabels[statusAction]);
      
      setStatusDialogOpen(false);
      setStatusContract(null);
      setStatusAction(null);
      setStatusReason("");
      fetchContracts();
    } catch (error) {
      console.error("Error updating contract status:", error);
      toast.error("Erro ao atualizar status do contrato");
    } finally {
      setStatusSaving(false);
    }
  };

  const getContractStatus = (contract: Contract) => {
    // First check contract status field
    if (contract.status && contract.status !== 'active') {
      const config = CONTRACT_STATUS_CONFIG[contract.status as keyof typeof CONTRACT_STATUS_CONFIG];
      if (config) {
        return { 
          label: config.label, 
          variant: "outline" as const, 
          icon: config.icon, 
          className: config.className,
          reason: contract.status_reason
        };
      }
    }
    
    // Then check date-based status for active contracts
    if (!contract.end_date) {
      return { label: "Sem término", variant: "secondary" as const, icon: Clock, className: "", reason: null };
    }
    
    const endDate = new Date(contract.end_date);
    const daysRemaining = differenceInDays(endDate, new Date());
    
    if (isPast(endDate)) {
      return { label: "Expirado", variant: "destructive" as const, icon: AlertTriangle, className: "", reason: null };
    }
    if (daysRemaining <= 30) {
      return { label: `${daysRemaining}d restantes`, variant: "outline" as const, icon: AlertTriangle, className: "border-amber-500 text-amber-600", reason: null };
    }
    return { label: "Ativo", variant: "outline" as const, icon: CheckCircle, className: "border-green-500 text-green-600", reason: null };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getPaymentLabel = (value: string | null) => {
    if (!value) return "-";
    const parts = value.split("_");
    
    if (parts[0] === "a" && parts[1] === "vista") {
      const method = PAYMENT_METHODS.find(m => m.value === parts[2])?.label || "";
      return method ? `À Vista (${method})` : "À Vista";
    }
    
    if (parts[0] === "parcelado") {
      const installments = parts[1] || "";
      const method = PAYMENT_METHODS.find(m => m.value === parts[2])?.label || "";
      const base = installments ? `Parcelado ${installments}` : "Parcelado";
      return method ? `${base} (${method})` : base;
    }
    
    return value;
  };

  // Get contracts that are renewals of a given contract
  const getRenewals = (contractId: string): Contract[] => {
    return contracts.filter(c => c.parent_contract_id === contractId);
  };

  // Get the history chain (parent contracts)
  const getHistory = (contract: Contract): Contract[] => {
    const history: Contract[] = [];
    let current = contract;
    while (current.parent_contract_id) {
      const parent = contracts.find(c => c.id === current.parent_contract_id);
      if (parent) {
        history.push(parent);
        current = parent;
      } else {
        break;
      }
    }
    return history;
  };

  // Check if a contract has history (is a renewal or has renewals)
  const hasHistory = (contract: Contract): boolean => {
    return !!contract.parent_contract_id || getRenewals(contract.id).length > 0;
  };

  // Get root contracts (contracts that are not renewals of others)
  const rootContracts = contracts.filter(c => !c.parent_contract_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {contracts.length} contrato{contracts.length !== 1 ? "s" : ""} registrado{contracts.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => {
              setZapSignContractId(undefined);
              setZapSignDialogOpen(true);
            }}
          >
            <PenTool className="h-4 w-4 mr-1" />
            ZapSign
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Novo Contrato
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingContract ? "Editar Contrato" : renewingContract ? "Renovar Contrato" : "Novo Contrato"}
              </DialogTitle>
              {renewingContract && (
                <p className="text-sm text-muted-foreground">
                  Renovação do contrato de {format(new Date(renewingContract.start_date), "dd/MM/yyyy", { locale: ptBR })}
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
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
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
        </div>
      </div>

      {contracts.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum contrato registrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Clique em "Novo Contrato" para adicionar
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => {
                const status = getContractStatus(contract);
                const StatusIcon = status.icon;
                const renewals = getRenewals(contract.id);
                const history = getHistory(contract);
                const isExpanded = expandedHistory === contract.id;
                const hasRenewalsOrHistory = renewals.length > 0 || history.length > 0;
                
                return (
                  <TableRow key={contract.id} className={contract.parent_contract_id ? "bg-muted/30" : ""}>
                    <TableCell className="py-2">
                      {hasRenewalsOrHistory && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setExpandedHistory(isExpanded ? null : contract.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {CONTRACT_TYPES.find(t => t.value === contract.contract_type)?.label || "Compra"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {contract.parent_contract_id && (
                          <RefreshCw className="h-3 w-3 text-primary" />
                        )}
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm">
                          <div className="flex items-center gap-2">
                            {format(new Date(contract.start_date), "dd/MM/yyyy", { locale: ptBR })}
                            {contract.parent_contract_id && (
                              <Badge variant="outline" className="text-xs py-0 px-1">
                                Renovação
                              </Badge>
                            )}
                          </div>
                          {contract.end_date && (
                            <div className="text-muted-foreground">
                              até {format(new Date(contract.end_date), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        {formatCurrency(contract.value)}
                      </div>
                    </TableCell>
                    <TableCell>{getPaymentLabel(contract.payment_option)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge 
                          variant={status.variant}
                          className={status.className}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                        {status.reason && (
                          <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={status.reason}>
                            {status.reason}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {contract.file_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadContract(contract)}
                          disabled={downloading === contract.id}
                        >
                          {downloading === contract.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-1" />
                          )}
                          PDF
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {contract.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Renovar contrato"
                            onClick={() => openRenewalDialog(contract)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(contract)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {contract.status === 'active' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => openStatusDialog(contract, 'paused')}
                                  className="text-amber-600"
                                >
                                  <PauseCircle className="h-4 w-4 mr-2" />
                                  Pausar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => openStatusDialog(contract, 'ended')}
                                  className="text-slate-600"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Encerrar (Demissão)
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => openStatusDialog(contract, 'cancelled')}
                                  className="text-destructive"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancelar (Churn)
                                </DropdownMenuItem>
                              </>
                            )}
                            {contract.status !== 'active' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => openStatusDialog(contract, 'active')}
                                  className="text-green-600"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Reativar
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => {
                                setContractToDelete(contract.id);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O contrato será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status change dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={(open) => {
        setStatusDialogOpen(open);
        if (!open) {
          setStatusContract(null);
          setStatusAction(null);
          setStatusReason("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {statusAction === 'cancelled' && "Cancelar Contrato (Churn)"}
              {statusAction === 'ended' && "Encerrar Contrato (Demissão)"}
              {statusAction === 'paused' && "Pausar Contrato"}
              {statusAction === 'active' && "Reativar Contrato"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {statusAction === 'cancelled' && (
              <p className="text-sm text-muted-foreground">
                O contrato será marcado como cancelado por churn do cliente.
              </p>
            )}
            {statusAction === 'ended' && (
              <p className="text-sm text-muted-foreground">
                O contrato será marcado como encerrado (demissão/término acordado).
              </p>
            )}
            {statusAction === 'paused' && (
              <p className="text-sm text-muted-foreground">
                O contrato será pausado temporariamente.
              </p>
            )}
            {statusAction === 'active' && (
              <p className="text-sm text-muted-foreground">
                O contrato será reativado.
              </p>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="status_reason">
                {statusAction === 'paused' ? 'Motivo da pausa *' : 'Motivo (opcional)'}
              </Label>
              <Textarea
                id="status_reason"
                placeholder={
                  statusAction === 'cancelled' ? "Motivo do cancelamento..." :
                  statusAction === 'ended' ? "Motivo do encerramento..." :
                  statusAction === 'paused' ? "Descreva o motivo da pausa..." :
                  "Motivo da reativação..."
                }
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleStatusChange} 
                disabled={statusSaving}
                variant={statusAction === 'cancelled' ? 'destructive' : 'default'}
              >
                {statusSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Confirmar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ZapSignDialog
        open={zapSignDialogOpen}
        onOpenChange={setZapSignDialogOpen}
        clientId={clientId}
        contractId={zapSignContractId}
      />
    </div>
  );
}
