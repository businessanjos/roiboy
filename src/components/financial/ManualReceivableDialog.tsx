import { useState, useEffect } from "react";
import { Save, Search, Plus, User, Calendar, DollarSign, Building2, FileText, Repeat, Link2, CreditCard } from "lucide-react";
import { format, parseISO } from "date-fns";
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

interface ManualReceivableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ReceivableFormData) => void;
  editingEntry?: ReceivableFormData | null;
}

export interface ReceivableFormData {
  id?: string;
  client_id: string;
  client_name: string;
  due_date: string;
  amount: string;
  installment_current: number;
  installment_total: number;
  category_id: string;
  expected_date: string;
  bank_account_id: string;
  // Detalhes
  document_number: string;
  issue_date: string;
  project_id: string;
  seller_id: string;
  notes: string;
  // Repetição
  is_recurring: boolean;
  recurrence_type: string;
  recurrence_end_date: string;
}

const initialFormData: ReceivableFormData = {
  client_id: "",
  client_name: "",
  due_date: "",
  amount: "",
  installment_current: 1,
  installment_total: 1,
  category_id: "",
  expected_date: "",
  bank_account_id: "",
  document_number: "",
  issue_date: format(new Date(), "yyyy-MM-dd"),
  project_id: "",
  seller_id: "",
  notes: "",
  is_recurring: false,
  recurrence_type: "monthly",
  recurrence_end_date: "",
};

export function ManualReceivableDialog({
  open,
  onOpenChange,
  onSave,
  editingEntry,
}: ManualReceivableDialogProps) {
  const { toast } = useToast();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const [formData, setFormData] = useState<ReceivableFormData>(initialFormData);
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
        .in("type", ["income", "both"])
        .order("name");
      if (error) throw error;
      return data || [];
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
      return data || [];
    },
    enabled: !!accountId,
  });

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list-simple", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name")
        .eq("account_id", accountId)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  // Fetch team users (sellers)
  const { data: teamUsers = [] } = useQuery({
    queryKey: ["team-users", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .eq("account_id", accountId)
        .order("name");
      if (error) throw error;
      return data || [];
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

  const handleChange = (field: keyof ReceivableFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.client_name && !formData.client_id) {
      toast({ title: "Cliente é obrigatório", variant: "destructive" });
      return;
    }
    if (!formData.due_date) {
      toast({ title: "Data de vencimento é obrigatória", variant: "destructive" });
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({ title: "Valor deve ser maior que zero", variant: "destructive" });
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
            Nova Conta a Receber
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
                {/* Cliente */}
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    Cliente <Link2 className="h-3 w-3" />
                    <Button variant="link" size="sm" className="h-auto p-0 ml-auto text-xs text-primary">
                      <CreditCard className="h-3 w-3 mr-1" />
                      Consulta de Crédito
                    </Button>
                  </Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(v) => {
                      handleChange("client_id", v);
                      const client = clients.find((c: any) => c.id === v);
                      if (client) handleChange("client_name", client.full_name);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client: any) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

              {/* Previsão de Recebimento */}
              <div className="space-y-1.5">
                <Label className="text-xs">Previsão de Recebimento</Label>
                <Input
                  type="date"
                  value={formData.expected_date}
                  onChange={(e) => handleChange("expected_date", e.target.value)}
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
                  value="recebimentos"
                  className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3"
                >
                  Recebtos
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
                    <Label className="text-xs flex items-center gap-1">
                      Projeto <Plus className="h-3 w-3" />
                    </Label>
                    <div className="relative">
                      <Input placeholder="" className="pr-8" />
                      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      Vendedor <Plus className="h-3 w-3" />
                    </Label>
                    <Select
                      value={formData.seller_id}
                      onValueChange={(v) => handleChange("seller_id", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teamUsers.map((user: any) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Observações</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    placeholder=""
                    rows={4}
                  />
                </div>
              </TabsContent>

              {/* Aba Impostos Retidos */}
              <TabsContent value="impostos" className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Configuração de impostos retidos na fonte.
                </p>
              </TabsContent>

              {/* Aba Departamentos */}
              <TabsContent value="departamentos" className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Rateio por departamentos e centros de custo.
                </p>
              </TabsContent>

              {/* Aba Repetição */}
              <TabsContent value="repeticao" className="space-y-4 pt-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.is_recurring}
                    onCheckedChange={(v) => handleChange("is_recurring", v)}
                  />
                  <Label className="text-sm">Lançamento recorrente</Label>
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
                      <Label className="text-xs">Até (opcional)</Label>
                      <Input
                        type="date"
                        value={formData.recurrence_end_date}
                        onChange={(e) => handleChange("recurrence_end_date", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Aba Recebimentos */}
              <TabsContent value="recebimentos" className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Histórico de recebimentos parciais e baixas.
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
              
              {/* Cliente */}
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="text-sm font-medium truncate">
                    {formData.client_name || <span className="text-muted-foreground italic">Não selecionado</span>}
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

              {/* Vendedor */}
              {formData.seller_id && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Vendedor</p>
                    <p className="text-sm font-medium truncate">
                      {teamUsers.find((u: any) => u.id === formData.seller_id)?.name || '-'}
                    </p>
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
