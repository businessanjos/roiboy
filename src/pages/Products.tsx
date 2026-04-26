import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Package, 
  Edit2, 
  Trash2,
  Loader2,
  DollarSign,
  Award,
  Lock,
  PlusCircle,
  X
} from "lucide-react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { toast } from "sonner";
import { getMlsBadgeClasses, getMlsLevelLabel, MLS_LEVELS } from "@/lib/mls-utils";
import { PlanLimitAlert } from "@/components/plan/PlanLimitAlert";
import { ProductBonusesTab } from "@/components/products/ProductBonusesTab";

interface SessionPhase {
  duration_hours: string;
  periodicity: string;
  months: string;
  format: "presencial" | "online" | "";
}

const DEFAULT_PHASE: SessionPhase = {
  duration_hours: "",
  periodicity: "mensal",
  months: "",
  format: "",
};

interface ProductDeliverables {
  individual_session_enabled: boolean;
  individual_session_format: "presencial" | "online" | "";
  individual_session_duration: string;
  individual_session_periodicity: string;
  individual_session_phases?: SessionPhase[];
  whatsapp_individual_group: boolean;
  whatsapp_all_group: boolean;
  group_mentoring_enabled: boolean;
  group_mentoring_periodicity: string;
  presential_event: boolean;
  roy_private: boolean;
  clinica_ryka: boolean;
  dedicated_consultant: boolean;
}

const DEFAULT_DELIVERABLES: ProductDeliverables = {
  individual_session_enabled: false,
  individual_session_format: "",
  individual_session_duration: "",
  individual_session_periodicity: "",
  individual_session_phases: [],
  whatsapp_individual_group: false,
  whatsapp_all_group: false,
  group_mentoring_enabled: false,
  group_mentoring_periodicity: "",
  presential_event: false,
  roy_private: false,
  clinica_ryka: false,
  dedicated_consultant: false,
};

interface MqlCriteria {
  revenue_ranges: string[];
  segments: string[];
  specialties: string[];
}

const DEFAULT_MQL_CRITERIA: MqlCriteria = {
  revenue_ranges: [],
  segments: [],
  specialties: [],
};

const REVENUE_RANGE_OPTIONS = [
  { value: "abaixo_20k", label: "Abaixo de R$ 20 mil" },
  { value: "20k_30k", label: "R$ 20 mil – R$ 30 mil" },
  { value: "30k_50k", label: "R$ 30 mil – R$ 50 mil" },
  { value: "50k_100k", label: "R$ 50 mil – R$ 100 mil" },
  { value: "100k_150k", label: "R$ 100 mil – R$ 150 mil" },
  { value: "150k_300k", label: "R$ 150 mil – R$ 300 mil" },
  { value: "300k_500k", label: "R$ 300 mil – R$ 500 mil" },
  { value: "500k_1m", label: "R$ 500 mil – R$ 1 milhão" },
  { value: "acima_1m", label: "Acima de R$ 1 milhão" },
];

const SEGMENT_OPTIONS = [
  "Clínica de Estética",
  "Esteticista Autônoma",
  "Biomédica",
  "Médico",
  "Dentista",
  "Outros",
];

const SPECIALTY_OPTIONS = [
  "Dermatologia",
  "Cirurgia Plástica",
  "Nutrologia",
  "Endocrinologia",
  "Ginecologia",
  "Ortopedia",
  "Oftalmologia",
  "Cardiologia",
  "Pediatria",
  "Clínico Geral",
];

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cash_price: number;
  installment_price: number;
  payment_methods: string[];
  billing_period: "monthly" | "quarterly" | "semiannual" | "annual" | "one_time";
  is_active: boolean;
  is_mls: boolean;
  is_renewal: boolean;
  mls_level: string | null;
  color: string | null;
  renewal_discount_percent: number | null;
  deliverables: ProductDeliverables | null;
  mql_criteria: MqlCriteria | null;
  created_at: string;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "pix", label: "Pix" },
  { value: "cheque", label: "Cheque" },
];

const COLOR_OPTIONS = [
  { value: "#10b981", label: "Verde", class: "bg-emerald-500" },
  { value: "#3b82f6", label: "Azul", class: "bg-blue-500" },
  { value: "#8b5cf6", label: "Roxo", class: "bg-violet-500" },
  { value: "#f59e0b", label: "Laranja", class: "bg-amber-500" },
  { value: "#ef4444", label: "Vermelho", class: "bg-red-500" },
  { value: "#ec4899", label: "Rosa", class: "bg-pink-500" },
  { value: "#06b6d4", label: "Ciano", class: "bg-cyan-500" },
  { value: "#6b7280", label: "Cinza", class: "bg-gray-500" },
];

// Using shared MLS_LEVELS from mls-utils

const billingPeriodLabels = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  one_time: "Único",
};

export default function Products() {
  const { currentUser } = useCurrentUser();
  const { canCreate } = usePlanLimits();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [billingPeriod, setBillingPeriod] = useState<string>("monthly");
  const [isActive, setIsActive] = useState(true);
  const [isMls, setIsMls] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [mlsLevel, setMlsLevel] = useState<string>("");
  const [color, setColor] = useState<string>("#10b981");
  const [cashPrice, setCashPrice] = useState("");
  const [installmentPrice, setInstallmentPrice] = useState("");
  const [renewalDiscountPercent, setRenewalDiscountPercent] = useState("50");
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [deliverables, setDeliverables] = useState<ProductDeliverables>({ ...DEFAULT_DELIVERABLES });
  const [mqlCriteria, setMqlCriteria] = useState<MqlCriteria>({ ...DEFAULT_MQL_CRITERIA });
  const [newSegment, setNewSegment] = useState("");
  const [newSpecialty, setNewSpecialty] = useState("");

  // Format number with thousand separators (pt-BR)
  const formatNumberInput = (raw: string): string => {
    const clean = raw.replace(/[^\d,]/g, "");
    const parts = clean.split(",");
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parts.length > 1 ? `${intPart},${parts[1].slice(0, 2)}` : intPart;
  };

  const parseFormattedNumber = (formatted: string): number => {
    if (!formatted) return 0;
    return parseFloat(formatted.replace(/\./g, "").replace(",", ".")) || 0;
  };

  const handleCurrencyChange = (
    value: string,
    setter: (v: string) => void
  ) => {
    const raw = value.replace(/[^\d,]/g, "");
    setter(formatNumberInput(raw));
  };

  const toFormattedString = (num: number): string => {
    if (!num) return "";
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setProducts((data || []).map((p: any) => ({
        ...p,
        payment_methods: Array.isArray(p.payment_methods) ? p.payment_methods : [],
      })));
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setCashPrice("");
    setInstallmentPrice("");
    setRenewalDiscountPercent("50");
    setPaymentMethods([]);
    setDeliverables({ ...DEFAULT_DELIVERABLES });
    setMqlCriteria({ ...DEFAULT_MQL_CRITERIA });
    setNewSegment("");
    setNewSpecialty("");
    setBillingPeriod("monthly");
    setIsActive(true);
    setIsMls(false);
    setIsRenewal(false);
    setMlsLevel("");
    setColor("#10b981");
    setEditingId(null);
  };

  const openEditDialog = (product: Product) => {
    setEditingId(product.id);
    setName(product.name);
    setDescription(product.description || "");
    setPrice(toFormattedString(product.price));
    setCashPrice(product.cash_price ? toFormattedString(product.cash_price) : "");
    setInstallmentPrice(product.installment_price ? toFormattedString(product.installment_price) : "");
    setRenewalDiscountPercent(String(product.renewal_discount_percent ?? 50));
    setPaymentMethods(product.payment_methods || []);
    setBillingPeriod(product.billing_period);
    setIsActive(product.is_active);
    setIsMls(product.is_mls);
    setIsRenewal(product.is_renewal ?? false);
    setMlsLevel(product.mls_level || "");
    setColor(product.color || "#10b981");
    const rawDeliverables = product.deliverables ? { ...DEFAULT_DELIVERABLES, ...product.deliverables } : { ...DEFAULT_DELIVERABLES };
    // Migrate old single-field format to phases if needed
    if (rawDeliverables.individual_session_enabled && (!rawDeliverables.individual_session_phases || rawDeliverables.individual_session_phases.length === 0)) {
      if (rawDeliverables.individual_session_duration || rawDeliverables.individual_session_periodicity) {
        rawDeliverables.individual_session_phases = [{
          duration_hours: rawDeliverables.individual_session_duration || "",
          periodicity: rawDeliverables.individual_session_periodicity || "mensal",
          months: "",
          format: rawDeliverables.individual_session_format || "",
        }];
      } else {
        rawDeliverables.individual_session_phases = [{ ...DEFAULT_PHASE }];
      }
    }
    setDeliverables(rawDeliverables);
    setMqlCriteria(product.mql_criteria ? { ...DEFAULT_MQL_CRITERIA, ...product.mql_criteria } : { ...DEFAULT_MQL_CRITERIA });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }

    setSaving(true);
    try {
      if (!currentUser?.account_id) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const productData = {
        account_id: currentUser.account_id,
        name: name.trim(),
        description: description.trim() || null,
        price: parseFormattedNumber(price),
        cash_price: parseFormattedNumber(cashPrice),
        installment_price: parseFormattedNumber(installmentPrice),
        renewal_discount_percent: parseFloat(renewalDiscountPercent) || 50,
        payment_methods: paymentMethods,
        billing_period: billingPeriod as "monthly" | "quarterly" | "semiannual" | "annual" | "one_time",
        is_active: isActive,
        is_mls: isMls,
        is_renewal: isRenewal,
        mls_level: isMls ? (mlsLevel || null) : null,
        color: color,
        deliverables: JSON.parse(JSON.stringify(deliverables)),
        mql_criteria: isRenewal ? null : (
          (mqlCriteria.revenue_ranges.length > 0 || mqlCriteria.segments.length > 0 || mqlCriteria.specialties.length > 0) 
            ? JSON.parse(JSON.stringify(mqlCriteria)) 
            : null
        ),
      };

      if (editingId) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        const { error } = await supabase
          .from("products")
          .insert([productData]);
        if (error) throw error;
        toast.success("Produto criado!");
      }

      setDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      console.error("Error saving product:", error);
      toast.error(error.message || "Erro ao salvar produto");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Produto excluído!");
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir produto");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  if (loading) {
    return <LoadingScreen message="Carregando produtos..." fullScreen={false} />;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie os produtos e planos oferecidos aos seus clientes
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => resetForm()}
              disabled={!canCreate("products")}
              title={!canCreate("products") ? "Limite de produtos atingido. Faça upgrade do plano." : undefined}
            >
              {!canCreate("products") ? <Lock className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {!canCreate("products") ? "Limite atingido" : "Novo Produto"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
              <DialogDescription>
                Preencha as informações do produto
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="general" className="w-full">
              <TabsList className={`w-full grid ${isRenewal ? 'grid-cols-3' : 'grid-cols-4'}`}>
                <TabsTrigger value="general">Geral</TabsTrigger>
                <TabsTrigger value="deliverables">Entregas</TabsTrigger>
                <TabsTrigger value="bonuses">Bônus</TabsTrigger>
                {!isRenewal && <TabsTrigger value="mql">Qualificação MQL</TabsTrigger>}
              </TabsList>

              <TabsContent value="general" className="space-y-5 pt-2">
                {/* Row 1: Nome + Cor */}
                <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Mentoria Premium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <div className="flex gap-1.5">
                      {COLOR_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setColor(option.value)}
                          className={`w-7 h-7 rounded-full border-2 transition-all ${
                            color === option.value 
                              ? "border-foreground scale-110" 
                              : "border-transparent hover:scale-105"
                          }`}
                          style={{ backgroundColor: option.value }}
                          title={option.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 2: Descrição */}
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrição do produto..."
                    rows={2}
                  />
                </div>

                {/* Row 3: Valor, Parcelado, Periodicidade */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={price}
                      onChange={(e) => handleCurrencyChange(e.target.value, setPrice)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço parcelado (R$)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={installmentPrice}
                      onChange={(e) => handleCurrencyChange(e.target.value, setInstallmentPrice)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Periodicidade</Label>
                    <Select value={billingPeriod} onValueChange={setBillingPeriod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="semiannual">Semestral</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                        <SelectItem value="one_time">Pagamento Único</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 4: Renovação + Formas de pagamento */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Desconto renovação (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={renewalDiscountPercent}
                      onChange={(e) => setRenewalDiscountPercent(e.target.value)}
                      placeholder="50"
                    />
                    <p className="text-xs text-muted-foreground">
                      % do ticket atual cobrado na renovação
                      {price && parseFloat(renewalDiscountPercent) > 0 && (
                        <>
                          <br />
                          Valor renovação: <span className="font-medium text-foreground">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                              parseFormattedNumber(price) * (parseFloat(renewalDiscountPercent) / 100)
                            )}
                          </span>
                          {installmentPrice && parseFormattedNumber(installmentPrice) > 0 && (
                            <>
                              <br />
                              Valor renovação parcelado: <span className="font-medium text-foreground">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                  parseFormattedNumber(installmentPrice) * (parseFloat(renewalDiscountPercent) / 100)
                                )}
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Formas de pagamento</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PAYMENT_METHOD_OPTIONS.map((method) => (
                        <label
                          key={method.value}
                          className={cn(
                            "flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors text-sm",
                            paymentMethods.includes(method.value)
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-border hover:bg-muted/50 text-muted-foreground"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="rounded border-border"
                            checked={paymentMethods.includes(method.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPaymentMethods([...paymentMethods, method.value]);
                              } else {
                                setPaymentMethods(paymentMethods.filter((m) => m !== method.value));
                              }
                            }}
                          />
                          {method.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 5: Toggles + MLS */}
                <div className="flex items-center gap-6 pt-2 border-t flex-wrap">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is-active"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                    <Label htmlFor="is-active" className="mb-0">Ativo</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is-renewal"
                      checked={isRenewal}
                      onCheckedChange={setIsRenewal}
                    />
                    <Label htmlFor="is-renewal" className="mb-0">Renovação</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is-mls"
                      checked={isMls}
                      onCheckedChange={(checked) => {
                        setIsMls(checked);
                        if (!checked) setMlsLevel("");
                      }}
                    />
                    <Label htmlFor="is-mls" className="mb-0">MLS</Label>
                  </div>
                  {isMls && (
                    <div className="flex-1">
                      <Select value={mlsLevel} onValueChange={setMlsLevel}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Nível MLS" />
                        </SelectTrigger>
                        <SelectContent>
                          {MLS_LEVELS.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${level.dotColor}`} />
                                {level.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="deliverables" className="space-y-4 pt-2">
                {/* Sessão Individual com Fases */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold mb-0">Sessão Individual</Label>
                    <Switch
                      checked={deliverables.individual_session_enabled}
                      onCheckedChange={(v) => {
                        const updated = { ...deliverables, individual_session_enabled: v };
                        if (v && (!updated.individual_session_phases || updated.individual_session_phases.length === 0)) {
                          updated.individual_session_phases = [{ ...DEFAULT_PHASE }];
                        }
                        setDeliverables(updated);
                      }}
                    />
                  </div>
                  {deliverables.individual_session_enabled && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Configure as fases da sessão individual. Ex: 3h nos primeiros 3 meses, depois 1h por 9 meses.
                      </p>
                      {(deliverables.individual_session_phases || []).map((phase, idx) => (
                        <div key={idx} className="relative rounded-md border border-dashed p-3 space-y-2 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                              Fase {idx + 1}
                            </span>
                            {(deliverables.individual_session_phases || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const phases = [...(deliverables.individual_session_phases || [])];
                                  phases.splice(idx, 1);
                                  setDeliverables({ ...deliverables, individual_session_phases: phases });
                                }}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Duração (h)</Label>
                              <Input
                                type="number"
                                min={0}
                                step={0.5}
                                value={phase.duration_hours}
                                onChange={(e) => {
                                  const phases = [...(deliverables.individual_session_phases || [])];
                                  phases[idx] = { ...phases[idx], duration_hours: e.target.value };
                                  setDeliverables({ ...deliverables, individual_session_phases: phases });
                                }}
                                placeholder="1"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Frequência</Label>
                              <Select
                                value={phase.periodicity}
                                onValueChange={(v) => {
                                  const phases = [...(deliverables.individual_session_phases || [])];
                                  phases[idx] = { ...phases[idx], periodicity: v };
                                  setDeliverables({ ...deliverables, individual_session_phases: phases });
                                }}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1x_semana">1x/semana</SelectItem>
                                  <SelectItem value="2x_semana">2x/semana</SelectItem>
                                  <SelectItem value="3x_semana">3x/semana</SelectItem>
                                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                                  <SelectItem value="mensal">Mensal</SelectItem>
                                  <SelectItem value="trimestral">Trimestral</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Meses</Label>
                              <Input
                                type="number"
                                min={1}
                                value={phase.months}
                                onChange={(e) => {
                                  const phases = [...(deliverables.individual_session_phases || [])];
                                  phases[idx] = { ...phases[idx], months: e.target.value };
                                  setDeliverables({ ...deliverables, individual_session_phases: phases });
                                }}
                                placeholder="3"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Formato</Label>
                              <Select
                                value={phase.format || ""}
                                onValueChange={(v) => {
                                  const phases = [...(deliverables.individual_session_phases || [])];
                                  phases[idx] = { ...phases[idx], format: v as "presencial" | "online" };
                                  setDeliverables({ ...deliverables, individual_session_phases: phases });
                                }}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="presencial">Presencial</SelectItem>
                                  <SelectItem value="online">Online</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5"
                        onClick={() => {
                          const phases = [...(deliverables.individual_session_phases || []), { ...DEFAULT_PHASE }];
                          setDeliverables({ ...deliverables, individual_session_phases: phases });
                        }}
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        Adicionar fase
                      </Button>
                    </div>
                  )}
                </div>

                {/* Grupos WhatsApp */}
                <div className="rounded-lg border p-4 space-y-3">
                  <Label className="text-sm font-semibold">Grupos WhatsApp</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm mb-0">Grupo individual</Label>
                      <Switch
                        checked={deliverables.whatsapp_individual_group}
                        onCheckedChange={(v) => setDeliverables({ ...deliverables, whatsapp_individual_group: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm mb-0">Grupo com todos</Label>
                      <Switch
                        checked={deliverables.whatsapp_all_group}
                        onCheckedChange={(v) => setDeliverables({ ...deliverables, whatsapp_all_group: v })}
                      />
                    </div>
                  </div>
                </div>

                {/* Mentoria em Grupo */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold mb-0">Sessões online de mentoria em grupo</Label>
                    <Switch
                      checked={deliverables.group_mentoring_enabled}
                      onCheckedChange={(v) => setDeliverables({ ...deliverables, group_mentoring_enabled: v })}
                    />
                  </div>
                  {deliverables.group_mentoring_enabled && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Frequência</Label>
                      <Select
                        value={deliverables.group_mentoring_periodicity}
                        onValueChange={(v) => setDeliverables({ ...deliverables, group_mentoring_periodicity: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1x_semana">1x por semana</SelectItem>
                          <SelectItem value="2x_semana">2x por semana</SelectItem>
                          <SelectItem value="3x_semana">3x por semana</SelectItem>
                          <SelectItem value="quinzenal">Quinzenal</SelectItem>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="trimestral">Trimestral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Outros benefícios */}
                <div className="rounded-lg border p-4 space-y-3">
                  <Label className="text-sm font-semibold">Outros benefícios</Label>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm mb-0">Evento presencial</Label>
                      <Switch
                        checked={deliverables.presential_event}
                        onCheckedChange={(v) => setDeliverables({ ...deliverables, presential_event: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm mb-0">ROY Private</Label>
                      <Switch
                        checked={deliverables.roy_private}
                        onCheckedChange={(v) => setDeliverables({ ...deliverables, roy_private: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm mb-0">Clínica Ryka</Label>
                      <Switch
                        checked={deliverables.clinica_ryka}
                        onCheckedChange={(v) => setDeliverables({ ...deliverables, clinica_ryka: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm mb-0">Consultor Dedicado</Label>
                      <Switch
                        checked={deliverables.dedicated_consultant}
                        onCheckedChange={(v) => setDeliverables({ ...deliverables, dedicated_consultant: v })}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {!isRenewal && <TabsContent value="mql" className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Defina os critérios para que um lead seja considerado MQL (Marketing Qualified Lead) para este produto.
                  O faturamento é obrigatório; segmentos e especialidades são filtros adicionais.
                </p>

                {/* Faixas de Faturamento */}
                <div className="rounded-lg border p-4 space-y-3">
                   <Label className="text-sm font-semibold">Faturamento Mensal (obrigatório)</Label>
                   <p className="text-xs text-muted-foreground">Selecione as faixas de faturamento mensal em R$ aceitas para qualificação</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {REVENUE_RANGE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors text-sm",
                          mqlCriteria.revenue_ranges.includes(opt.value)
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border hover:bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          checked={mqlCriteria.revenue_ranges.includes(opt.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMqlCriteria({ ...mqlCriteria, revenue_ranges: [...mqlCriteria.revenue_ranges, opt.value] });
                            } else {
                              setMqlCriteria({ ...mqlCriteria, revenue_ranges: mqlCriteria.revenue_ranges.filter((v) => v !== opt.value) });
                            }
                          }}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Segmentos */}
                <div className="rounded-lg border p-4 space-y-3">
                  <Label className="text-sm font-semibold">Segmentos de Negócio</Label>
                  <p className="text-xs text-muted-foreground">
                    Tipos de empresa aceitos. "Outros" = qualquer empresa fora dos 5 segmentos acima.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {SEGMENT_OPTIONS.map((seg) => (
                      <label key={seg} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded p-1.5">
                        <input
                          type="checkbox"
                          checked={mqlCriteria.segments.includes(seg)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMqlCriteria({ ...mqlCriteria, segments: [...mqlCriteria.segments, seg] });
                            } else {
                              const newSegments = mqlCriteria.segments.filter((s) => s !== seg);
                              const newSpecialties = seg === "Médico" ? [] : mqlCriteria.specialties;
                              setMqlCriteria({ ...mqlCriteria, segments: newSegments, specialties: newSpecialties });
                            }
                          }}
                          className="rounded border-input"
                        />
                        {seg}
                      </label>
                    ))}
                  </div>
                </div>

                {mqlCriteria.segments.includes("Médico") && (
                  <div className="rounded-lg border p-4 space-y-3">
                    <Label className="text-sm font-semibold">Especialidades Médicas</Label>
                    <p className="text-xs text-muted-foreground">Especialidades aceitas para o segmento Médico (opcional)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {SPECIALTY_OPTIONS.map((spec) => (
                        <label key={spec} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded p-1.5">
                          <input
                            type="checkbox"
                            checked={mqlCriteria.specialties.includes(spec)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setMqlCriteria({ ...mqlCriteria, specialties: [...mqlCriteria.specialties, spec] });
                              } else {
                                setMqlCriteria({ ...mqlCriteria, specialties: mqlCriteria.specialties.filter((s) => s !== spec) });
                              }
                            }}
                            className="rounded border-input"
                          />
                          {spec}
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Adicionar outra especialidade..."
                        value={newSpecialty}
                        onChange={(e) => setNewSpecialty(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newSpecialty.trim() && !mqlCriteria.specialties.includes(newSpecialty.trim())) {
                            e.preventDefault();
                            setMqlCriteria({ ...mqlCriteria, specialties: [...mqlCriteria.specialties, newSpecialty.trim()] });
                            setNewSpecialty("");
                          }
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Preview summary */}
                {(mqlCriteria.revenue_ranges.length > 0 || mqlCriteria.segments.length > 0 || mqlCriteria.specialties.length > 0) && (
                  <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                    <p className="text-xs font-semibold text-foreground">Resumo da qualificação:</p>
                    {mqlCriteria.revenue_ranges.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        💰 Faturamento: {mqlCriteria.revenue_ranges.map((v) => REVENUE_RANGE_OPTIONS.find((o) => o.value === v)?.label || v).join(", ")}
                      </p>
                    )}
                    {mqlCriteria.segments.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        🏢 Segmentos: {mqlCriteria.segments.join(", ")}
                      </p>
                    )}
                    {mqlCriteria.specialties.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        🩺 Especialidades: {mqlCriteria.specialties.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>}
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhum produto cadastrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie produtos para vincular aos seus clientes
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className="shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(product)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {product.description && (
                  <p className="text-sm text-muted-foreground">
                    {product.description}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {formatCurrency(product.price)}
                  </Badge>
                  <Badge variant="outline">
                    {billingPeriodLabels[product.billing_period]}
                  </Badge>
                  {product.is_renewal && (
                    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                      🔄 Renovação
                    </Badge>
                  )}
                  {product.is_mls && (
                    <Badge className={`${getMlsBadgeClasses(product.mls_level)} gap-1`}>
                      <Award className="h-3 w-3" />
                      MLS {product.mls_level ? `- ${getMlsLevelLabel(product.mls_level)}` : ""}
                    </Badge>
                  )}
                  {!product.is_active && (
                    <Badge variant="destructive">Inativo</Badge>
                  )}
                  {product.mql_criteria && product.mql_criteria.revenue_ranges?.length > 0 && (
                    <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-300">
                      MQL Configurado
                    </Badge>
                  )}
                </div>
                {product.installment_price > 0 && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Parcelado: <span className="font-medium text-foreground">{formatCurrency(product.installment_price)}</span></span>
                  </div>
                )}
                {product.payment_methods.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {product.payment_methods.map((m) => (
                      <Badge key={m} variant="outline" className="text-[10px] px-1.5 py-0">
                        {PAYMENT_METHOD_OPTIONS.find((o) => o.value === m)?.label || m}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
