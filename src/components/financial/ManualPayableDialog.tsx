import { useState, useEffect, useMemo } from "react";
import { Save, Search, Plus, User, Calendar, DollarSign, Building2, FileText, Repeat } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface ManualPayableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: PayableFormData) => void;
  editingEntry?: PayableFormData | null;
}

export interface PayableFormData {
  id?: string;
  supplier_id: string;
  supplier_name: string;
  due_date: string;
  amount: string;
  installment_current: number;
  installment_total: number;
  category_id: string;
  payment_forecast_date: string;
  bank_account_id: string;
  // Detalhes
  document_number: string;
  issue_date: string;
  registration_date: string;
  cost_center_id: string;
  notes: string;
  // Repetição
  is_recurring: boolean;
  recurrence_type: string;
  recurrence_end_date: string;
}

const initialFormData: PayableFormData = {
  supplier_id: "",
  supplier_name: "",
  due_date: "",
  amount: "",
  installment_current: 1,
  installment_total: 1,
  category_id: "",
  payment_forecast_date: "",
  bank_account_id: "",
  document_number: "",
  issue_date: format(new Date(), "yyyy-MM-dd"),
  registration_date: format(new Date(), "yyyy-MM-dd"),
  cost_center_id: "",
  notes: "",
  is_recurring: false,
  recurrence_type: "monthly",
  recurrence_end_date: "",
};

export function ManualPayableDialog({
  open,
  onOpenChange,
  onSave,
  editingEntry,
}: ManualPayableDialogProps) {
  const { toast } = useToast();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [formData, setFormData] = useState<PayableFormData>(initialFormData);
  const [activeTab, setActiveTab] = useState("detalhes");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["financial-categories", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("financial_categories")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .in("type", ["expense", "both"])
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Fetch bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Fetch cost centers
  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  useEffect(() => {
    if (editingEntry) {
      setFormData(editingEntry);
    } else {
      setFormData(initialFormData);
    }
  }, [editingEntry, open]);

  const handleChange = (field: keyof PayableFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.supplier_name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Informe o favorecido/fornecedor.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.due_date) {
      toast({
        title: "Campo obrigatório",
        description: "Informe a data de vencimento.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.amount || parseFloat(formData.amount.replace(",", ".")) <= 0) {
      toast({
        title: "Campo obrigatório",
        description: "Informe o valor da conta.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      onSave(formData);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setActiveTab("detalhes");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetForm();
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            Nova Conta a Pagar
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-6">
          {/* Formulário principal */}
          <div className="flex-1 space-y-6">
            {/* Linha superior com avatar e campos principais */}
            <div className="flex gap-4">
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarFallback className="bg-muted">
                  <User className="h-6 w-6 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 grid grid-cols-3 gap-4">
                {/* Favorecido/Fornecedor */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Favorecido / Fornecedor</Label>
                  <div className="relative">
                    <Input
                      value={formData.supplier_name}
                      onChange={(e) => handleChange("supplier_name", e.target.value)}
                      placeholder="Buscar fornecedor..."
                      className="pr-8"
                    />
                    <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                {/* Vencimento */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Vencimento</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => handleChange("due_date", e.target.value)}
                  />
                </div>

                {/* Valor da Conta */}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Valor da Conta{" "}
                    <span className="text-muted-foreground">
                      {formData.installment_current.toString().padStart(3, "0")}/
                      {formData.installment_total.toString().padStart(3, "0")}
                    </span>
                  </Label>
                  <Input
                    value={formData.amount}
                    onChange={(e) => handleChange("amount", e.target.value)}
                    placeholder="0,00"
                    className="text-right"
                  />
                </div>
              </div>
            </div>

            {/* Linha com categoria, previsão e conta */}
            <div className="grid grid-cols-3 gap-4">
              {/* Categoria */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  Categoria <Plus className="h-3 w-3" />
                </Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(v) => handleChange("category_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Previsão de Pagamento */}
              <div className="space-y-1.5">
                <Label className="text-xs">Previsão de Pagamento</Label>
                <Input
                  type="date"
                  value={formData.payment_forecast_date}
                  onChange={(e) => handleChange("payment_forecast_date", e.target.value)}
                />
              </div>

              {/* Conta Corrente */}
              <div className="space-y-1.5">
                <Label className="text-xs">Conta Corrente</Label>
                <Select
                  value={formData.bank_account_id}
                  onValueChange={(v) => handleChange("bank_account_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((acc: any) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start h-auto bg-transparent p-0 border-b rounded-none">
                <TabsTrigger
                  value="detalhes"
                  className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3"
                >
                  Detalhes
                </TabsTrigger>
                <TabsTrigger
                  value="impostos"
                  className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3"
                >
                  Impostos
                </TabsTrigger>
                <TabsTrigger
                  value="departamentos"
                  className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3"
                >
                  Depto.
                </TabsTrigger>
                <TabsTrigger
                  value="repeticao"
                  className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3"
                >
                  Repetição
                </TabsTrigger>
                <TabsTrigger
                  value="pagamentos"
                  className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3"
                >
                  Pagtos
                </TabsTrigger>
                <TabsTrigger
                  value="diversos"
                  className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3"
                >
                  Outros
                </TabsTrigger>
              </TabsList>

              {/* Aba Detalhes */}
              <TabsContent value="detalhes" className="space-y-4 pt-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nota Fiscal</Label>
                    <Input
                      value={formData.document_number}
                      onChange={(e) => handleChange("document_number", e.target.value)}
                      placeholder=""
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de Emissão</Label>
                    <Input
                      type="date"
                      value={formData.issue_date}
                      onChange={(e) => handleChange("issue_date", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de Registro</Label>
                    <Input
                      type="date"
                      value={formData.registration_date}
                      onChange={(e) => handleChange("registration_date", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      Projeto <Plus className="h-3 w-3" />
                    </Label>
                    <div className="relative">
                      <Input placeholder="" className="pr-8" />
                      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Observações</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    rows={4}
                    placeholder=""
                  />
                </div>
              </TabsContent>

              {/* Aba Impostos Retidos */}
              <TabsContent value="impostos" className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Configuração de impostos retidos (ISS, IRRF, CSLL, PIS, COFINS, INSS).
                </p>
              </TabsContent>

              {/* Aba Departamentos */}
              <TabsContent value="departamentos" className="pt-4">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Centro de Custo</Label>
                    <Select
                      value={formData.cost_center_id}
                      onValueChange={(v) => handleChange("cost_center_id", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {costCenters.map((cc: any) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* Aba Repetição */}
              <TabsContent value="repeticao" className="pt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={formData.is_recurring}
                      onCheckedChange={(v) => handleChange("is_recurring", v)}
                    />
                    <Label>Lançamento recorrente</Label>
                  </div>

                  {formData.is_recurring && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Frequência</Label>
                        <Select
                          value={formData.recurrence_type}
                          onValueChange={(v) => handleChange("recurrence_type", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="biweekly">Quinzenal</SelectItem>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="quarterly">Trimestral</SelectItem>
                            <SelectItem value="semiannual">Semestral</SelectItem>
                            <SelectItem value="annual">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Até quando</Label>
                        <Input
                          type="date"
                          value={formData.recurrence_end_date}
                          onChange={(e) =>
                            handleChange("recurrence_end_date", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Aba Pagamentos */}
              <TabsContent value="pagamentos" className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Histórico de pagamentos parciais e baixas.
                </p>
              </TabsContent>

              {/* Aba Diversos */}
              <TabsContent value="diversos" className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Configurações adicionais e anexos.
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar com resumo da cobrança */}
          <div className="w-64 shrink-0 border-l pl-4 space-y-4">
            <Button
              onClick={handleSave}
              disabled={isLoading}
              variant="ghost"
              className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10"
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>

            {/* Resumo */}
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Resumo</h4>
              
              {/* Fornecedor */}
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Fornecedor</p>
                  <p className="text-sm font-medium truncate">
                    {formData.supplier_name || <span className="text-muted-foreground italic">Não informado</span>}
                  </p>
                </div>
              </div>

              {/* Valor */}
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="text-sm font-medium">
                    {formData.amount ? 
                      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(formData.amount) || 0) : 
                      <span className="text-muted-foreground italic">R$ 0,00</span>
                    }
                  </p>
                </div>
              </div>

              {/* Vencimento */}
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="text-sm font-medium">
                    {formData.due_date ? 
                      format(parseISO(formData.due_date), "dd/MM/yyyy") : 
                      <span className="text-muted-foreground italic">Não informado</span>
                    }
                  </p>
                </div>
              </div>

              {/* Categoria */}
              {formData.category_id && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Categoria</p>
                    <p className="text-sm font-medium truncate">
                      {categories.find((c: any) => c.id === formData.category_id)?.name || '-'}
                    </p>
                  </div>
                </div>
              )}

              {/* Conta Bancária */}
              {formData.bank_account_id && (
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Conta</p>
                    <p className="text-sm font-medium truncate">
                      {bankAccounts.find((b: any) => b.id === formData.bank_account_id)?.name || '-'}
                    </p>
                  </div>
                </div>
              )}

              {/* Recorrência */}
              {formData.is_recurring && (
                <div className="flex items-start gap-2">
                  <Repeat className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Recorrência</p>
                    <p className="text-sm font-medium capitalize">
                      {formData.recurrence_type === 'weekly' && 'Semanal'}
                      {formData.recurrence_type === 'biweekly' && 'Quinzenal'}
                      {formData.recurrence_type === 'monthly' && 'Mensal'}
                      {formData.recurrence_type === 'quarterly' && 'Trimestral'}
                      {formData.recurrence_type === 'semiannual' && 'Semestral'}
                      {formData.recurrence_type === 'annual' && 'Anual'}
                    </p>
                  </div>
                </div>
              )}

              {/* Documento */}
              {formData.document_number && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Documento</p>
                    <p className="text-sm font-medium truncate">{formData.document_number}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
