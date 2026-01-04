import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  PauseCircle,
  Ban,
  Users,
  Loader2,
  Pencil,
  Save,
  X,
  Download,
  ExternalLink,
  Clock,
  Handshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ContractNegotiationTab } from "./ContractNegotiationTab";

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
  cancelled_at: string | null;
  contract_type: string;
  created_at: string;
  updated_at: string;
  negotiation_type?: string | null;
  negotiation_description?: string | null;
  payment_method?: string | null;
  installments_count?: number | null;
  first_due_date?: string | null;
  receivables_generated?: boolean;
  client?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  product?: {
    id: string;
    name: string;
  } | null;
}

interface ContractDetailSheetProps {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const CONTRACT_STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  scheduled: { label: "A Iniciar", icon: Clock, className: "border-indigo-500 text-indigo-600 bg-indigo-50" },
  active: { label: "Ativo", icon: CheckCircle, className: "border-green-500 text-green-600 bg-green-50" },
  pending: { label: "Pendente", icon: FileText, className: "border-blue-500 text-blue-600 bg-blue-50" },
  suspended: { label: "Suspenso", icon: Ban, className: "border-orange-500 text-orange-600 bg-orange-50" },
  paused: { label: "Pausado", icon: PauseCircle, className: "border-amber-500 text-amber-600 bg-amber-50" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "border-red-500 text-red-600 bg-red-50" },
  ended: { label: "Encerrado", icon: Ban, className: "border-slate-500 text-slate-600 bg-slate-50" },
  dismissed: { label: "Demitida", icon: XCircle, className: "border-rose-500 text-rose-600 bg-rose-50" },
  dropout_7d: { label: "Desistência 7D", icon: XCircle, className: "border-pink-500 text-pink-600 bg-pink-50" },
};

const CONTRACT_TYPES: Record<string, string> = {
  compra: "Compra",
  renovacao: "Renovação",
  migracao: "Migração",
  confissao_divida: "Confissão de Dívida",
  termo_congelamento: "Termo de Congelamento",
  distrato: "Distrato",
};

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

const parsePaymentOption = (option: string | null) => {
  if (!option) return { type: "", installments: "", method: "" };
  
  if (option.startsWith("a_vista")) {
    const parts = option.split("_");
    return {
      type: "a_vista",
      installments: "",
      method: parts.length > 2 ? parts.slice(2).join("_") : "",
    };
  }
  
  if (option.startsWith("parcelado")) {
    const parts = option.split("_");
    return {
      type: "parcelado",
      installments: parts[1] || "",
      method: parts.length > 2 ? parts.slice(2).join("_") : "",
    };
  }
  
  return { type: "", installments: "", method: "" };
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function ContractDetailSheet({ contract, open, onOpenChange, onUpdate }: ContractDetailSheetProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({
    start_date: "",
    end_date: "",
    cancelled_at: "",
    value: "",
    contract_type: "compra",
    product_id: "",
    payment_type: "",
    installments: "",
    payment_method: "",
    notes: "",
    status: "active",
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (contract) {
      const paymentParts = parsePaymentOption(contract.payment_option);
      setFormData({
        start_date: contract.start_date,
        end_date: contract.end_date || "",
        cancelled_at: contract.cancelled_at || "",
        value: String(contract.value || 0),
        contract_type: contract.contract_type,
        product_id: contract.product?.id || "",
        payment_type: paymentParts.type,
        installments: paymentParts.installments,
        payment_method: paymentParts.method,
        notes: contract.notes || "",
        status: contract.status,
      });
      setIsEditing(false);
    }
  }, [contract]);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    setProducts(data || []);
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

  const handleSave = async () => {
    if (!contract) return;
    
    setSaving(true);
    try {
      const updateData = {
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        cancelled_at: formData.cancelled_at || null,
        value: parseFloat(formData.value) || 0,
        contract_type: formData.contract_type,
        product_id: formData.product_id || null,
        payment_option: buildPaymentOption(),
        notes: formData.notes || null,
        status: formData.status,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("client_contracts")
        .update(updateData)
        .eq("id", contract.id);

      if (error) throw error;

      toast.success("Contrato atualizado com sucesso");
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating contract:", error);
      toast.error("Erro ao atualizar contrato");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (contract) {
      const paymentParts = parsePaymentOption(contract.payment_option);
      setFormData({
        start_date: contract.start_date,
        end_date: contract.end_date || "",
        cancelled_at: contract.cancelled_at || "",
        value: String(contract.value || 0),
        contract_type: contract.contract_type,
        product_id: contract.product?.id || "",
        payment_type: paymentParts.type,
        installments: paymentParts.installments,
        payment_method: paymentParts.method,
        notes: contract.notes || "",
        status: contract.status,
      });
    }
    setIsEditing(false);
  };

  if (!contract) return null;

  const statusConfig = CONTRACT_STATUS_CONFIG[contract.status] || CONTRACT_STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalhes do Contrato
            </SheetTitle>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Salvar
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Client Info */}
        <div 
          className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
          onClick={() => {
            onOpenChange(false);
            navigate(`/clients/${contract.client_id}`);
          }}
        >
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {contract.client?.avatar_url ? (
              <img
                src={contract.client.avatar_url}
                alt={contract.client.full_name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <Users className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium">{contract.client?.full_name || "Cliente"}</p>
            {contract.product && (
              <p className="text-sm text-muted-foreground">{contract.product.name}</p>
            )}
          </div>
        </div>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Detalhes
            </TabsTrigger>
            <TabsTrigger value="negotiation" className="flex items-center gap-2">
              <Handshake className="h-4 w-4" />
              Negociação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-6">
          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            {isEditing ? (
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className={cn("text-sm", statusConfig.className)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig.label}
              </Badge>
            )}
          </div>

          {/* Contract Type */}
          <div className="space-y-2">
            <Label>Tipo de Contrato</Label>
            {isEditing ? (
              <Select
                value={formData.contract_type}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, contract_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-medium">
                {CONTRACT_TYPES[contract.contract_type] || contract.contract_type}
              </p>
            )}
          </div>

          {/* Product */}
          <div className="space-y-2">
            <Label>Produto</Label>
            {isEditing ? (
              <Select
                value={formData.product_id}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, product_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-medium">
                {contract.product?.name || "—"}
              </p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Data de Início
              </Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              ) : (
                <p className="text-sm font-medium">
                  {format(new Date(contract.start_date), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Data de Término
              </Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value }))}
                />
              ) : (
                <p className="text-sm font-medium">
                  {contract.end_date
                    ? format(new Date(contract.end_date), "dd/MM/yyyy", { locale: ptBR })
                    : "—"}
                </p>
              )}
            </div>
          </div>

          {/* Cancelled At - only show for cancelled/dismissed/dropout_7d/ended statuses */}
          {["cancelled", "dismissed", "dropout_7d", "ended"].includes(isEditing ? formData.status : contract.status) && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-destructive">
                <XCircle className="h-3 w-3" />
                Data do Cancelamento
              </Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={formData.cancelled_at?.split('T')[0] || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, cancelled_at: e.target.value }))}
                  className="border-destructive/50"
                />
              ) : (
                <p className="text-sm font-medium text-destructive">
                  {contract.cancelled_at
                    ? format(new Date(contract.cancelled_at), "dd/MM/yyyy", { locale: ptBR })
                    : "—"}
                </p>
              )}
            </div>
          )}

          {/* Value */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Valor
            </Label>
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={formData.value}
                onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
              />
            ) : (
              <p className="text-lg font-semibold text-primary">
                {formatCurrency(contract.value)}
              </p>
            )}
          </div>

          {/* Payment Info */}
          <div className="space-y-4">
            <Label>Pagamento</Label>
            {isEditing ? (
              <div className="space-y-3">
                <Select
                  value={formData.payment_type}
                  onValueChange={(value) => setFormData((prev) => ({
                    ...prev,
                    payment_type: value,
                    installments: value === "a_vista" ? "" : prev.installments
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {formData.payment_type === "parcelado" && (
                  <Select
                    value={formData.installments}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, installments: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Parcelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTALLMENT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {formData.payment_type && (
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, payment_method: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <p className="text-sm">
                {contract.payment_option
                  ? contract.payment_option
                      .replace("a_vista", "À Vista")
                      .replace("parcelado", "Parcelado")
                      .replace(/_/g, " ")
                  : "—"}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            {isEditing ? (
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {contract.notes || "Sem observações"}
              </p>
            )}
          </div>

          {/* File */}
          {contract.file_url && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Arquivo do Contrato</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={contract.file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Visualizar
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={contract.file_url} download={contract.file_name}>
                      <Download className="h-4 w-4 mr-1" />
                      Baixar
                    </a>
                  </Button>
                </div>
                {contract.file_name && (
                  <p className="text-xs text-muted-foreground">{contract.file_name}</p>
                )}
              </div>
            </>
          )}

          {/* Metadata */}
          <Separator />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Criado em: {format(new Date(contract.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            <p>Atualizado em: {format(new Date(contract.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
          </TabsContent>

          <TabsContent value="negotiation" className="mt-4">
            <ContractNegotiationTab
              contractId={contract.id}
              contractValue={contract.value}
              clientId={contract.client_id}
              accountId={contract.account_id}
              negotiationType={contract.negotiation_type || null}
              negotiationDescription={contract.negotiation_description || null}
              paymentMethod={contract.payment_method || null}
              installmentsCount={contract.installments_count || null}
              firstDueDate={contract.first_due_date || null}
              receivablesGenerated={contract.receivables_generated || false}
              onUpdate={onUpdate}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
