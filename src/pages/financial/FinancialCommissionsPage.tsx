import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Percent,
  DollarSign,
  Users,
  Calculator,
  Settings,
  TrendingUp,
  Edit2,
  Trash2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

interface CommissionRule {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  percentage: number;
  fixed_value: number | null;
  apply_to_products: boolean;
  apply_to_contracts: boolean;
  user_id: string | null;
  product_id: string | null;
  is_active: boolean;
  user?: { full_name: string } | null;
  product?: { name: string } | null;
}

interface CommissionEntry {
  id: string;
  rule_id: string | null;
  user_id: string | null;
  reference_id: string | null;
  reference_type: string;
  base_value: number;
  commission_value: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  user?: { full_name: string } | null;
  rule?: { name: string } | null;
}

interface User {
  id: string;
  full_name: string;
}

interface Product {
  id: string;
  name: string;
}

export default function FinancialCommissionsPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"entries" | "rules">("entries");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  
  const [ruleForm, setRuleForm] = useState({
    name: "",
    description: "",
    rule_type: "percentage",
    percentage: "10",
    fixed_value: "",
    user_id: "",
    product_id: "",
    apply_to_products: true,
    apply_to_contracts: true,
    is_active: true,
  });

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["commission-rules", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await (supabase as any)
        .from("commission_rules")
        .select(`
          *,
          user:users(name),
          product:products(name)
        `)
        .eq("account_id", accountId)
        .order("name");
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        user: r.user ? { full_name: r.user.name || 'Sem nome' } : null,
      })) as CommissionRule[];
    },
    enabled: !!accountId,
  });

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["commission-entries", accountId, currentMonth],
    queryFn: async () => {
      if (!accountId) return [];
      
      const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      
      const { data, error } = await (supabase as any)
        .from("commission_entries")
        .select(`
          *,
          user:users(name),
          rule:commission_rules(name)
        `)
        .eq("account_id", accountId)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((e: any) => ({
        ...e,
        user: e.user ? { full_name: e.user.name || 'Sem nome' } : null,
      })) as CommissionEntry[];
    },
    enabled: !!accountId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["team-users", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .eq("account_id", accountId)
        .order("name");
      if (error) throw error;
      return (data || []).map((u: any) => ({ id: u.id, full_name: u.name || 'Sem nome' })) as User[];
    },
    enabled: !!accountId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!accountId,
  });

  const saveRuleMutation = useMutation({
    mutationFn: async (data: typeof ruleForm) => {
      const payload = {
        account_id: accountId,
        name: data.name,
        description: data.description || null,
        rule_type: data.rule_type,
        percentage: parseFloat(data.percentage) || 0,
        fixed_value: data.fixed_value ? parseFloat(data.fixed_value) : null,
        user_id: data.user_id || null,
        product_id: data.product_id || null,
        apply_to_products: data.apply_to_products,
        apply_to_contracts: data.apply_to_contracts,
        is_active: data.is_active,
      };

      if (editingRule) {
        const { error } = await (supabase as any)
          .from("commission_rules")
          .update(payload)
          .eq("id", editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("commission_rules")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-rules"] });
      setIsRuleDialogOpen(false);
      resetRuleForm();
      toast({
        title: editingRule ? "Regra atualizada" : "Regra criada",
        description: "A regra de comissão foi salva com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a regra.",
        variant: "destructive",
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("commission_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-rules"] });
      toast({ title: "Regra excluída" });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a regra.",
        variant: "destructive",
      });
    },
  });

  const payCommissionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("commission_entries")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-entries"] });
      toast({ title: "Comissão marcada como paga" });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a comissão.",
        variant: "destructive",
      });
    },
  });

  const resetRuleForm = () => {
    setRuleForm({
      name: "",
      description: "",
      rule_type: "percentage",
      percentage: "10",
      fixed_value: "",
      user_id: "",
      product_id: "",
      apply_to_products: true,
      apply_to_contracts: true,
      is_active: true,
    });
    setEditingRule(null);
  };

  const handleEditRule = (rule: CommissionRule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      description: rule.description || "",
      rule_type: rule.rule_type,
      percentage: rule.percentage.toString(),
      fixed_value: rule.fixed_value?.toString() || "",
      user_id: rule.user_id || "",
      product_id: rule.product_id || "",
      apply_to_products: rule.apply_to_products,
      apply_to_contracts: rule.apply_to_contracts,
      is_active: rule.is_active,
    });
    setIsRuleDialogOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const summary = {
    total: entries.reduce((sum, e) => sum + e.commission_value, 0),
    pending: entries.filter(e => e.status === "pending").reduce((sum, e) => sum + e.commission_value, 0),
    paid: entries.filter(e => e.status === "paid").reduce((sum, e) => sum + e.commission_value, 0),
    count: entries.length,
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            <div>
              <CardTitle>Gestão de Comissões</CardTitle>
              <CardDescription>
                Configure regras e acompanhe comissões da equipe
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Calculator className="h-4 w-4" />
                  Total
                </div>
                <div className="text-2xl font-bold">{formatCurrency(summary.total)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-yellow-600 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  Pendentes
                </div>
                <div className="text-2xl font-bold text-yellow-600">{formatCurrency(summary.pending)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Pagas
                </div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.paid)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Users className="h-4 w-4" />
                  Lançamentos
                </div>
                <div className="text-2xl font-bold">{summary.count}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="entries" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Comissões
                </TabsTrigger>
                <TabsTrigger value="rules" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Regras
                </TabsTrigger>
              </TabsList>

              {activeTab === "entries" && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[120px] text-center capitalize">
                    {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {activeTab === "rules" && (
                <Button size="sm" onClick={() => setIsRuleDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Regra
                </Button>
              )}
            </div>

            <TabsContent value="entries" className="mt-4">
              {entriesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : entries.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma comissão neste período</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Regra</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.user?.full_name || "-"}
                        </TableCell>
                        <TableCell>{entry.rule?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {entry.reference_type === "contract" ? "Contrato" : 
                             entry.reference_type === "product" ? "Produto" : entry.reference_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(entry.base_value)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(entry.commission_value)}
                        </TableCell>
                        <TableCell>
                          {entry.status === "paid" ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Pago
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.status !== "paid" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => payCommissionMutation.mutate(entry.id)}
                              disabled={payCommissionMutation.isPending}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Pagar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="rules" className="mt-4">
              {rulesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : rules.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma regra de comissão configurada</p>
                  <Button variant="link" onClick={() => setIsRuleDialogOpen(true)}>
                    Criar primeira regra
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rule.name}</div>
                            {rule.description && (
                              <div className="text-xs text-muted-foreground">{rule.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {rule.rule_type === "percentage" ? "Percentual" : "Valor Fixo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rule.rule_type === "percentage" 
                            ? `${rule.percentage}%`
                            : formatCurrency(rule.fixed_value || 0)}
                        </TableCell>
                        <TableCell>
                          {rule.user?.full_name || "Todos"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.is_active ? "default" : "secondary"}>
                            {rule.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditRule(rule)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Deseja excluir esta regra?")) {
                                  deleteRuleMutation.mutate(rule.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Editar Regra" : "Nova Regra de Comissão"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveRuleMutation.mutate(ruleForm);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={ruleForm.name}
                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                placeholder="Ex: Comissão Padrão"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={ruleForm.description}
                onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                placeholder="Descrição da regra..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={ruleForm.rule_type} onValueChange={(v) => setRuleForm({ ...ruleForm, rule_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual</SelectItem>
                    <SelectItem value="fixed">Valor Fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{ruleForm.rule_type === "percentage" ? "Percentual (%)" : "Valor Fixo (R$)"}</Label>
                <Input
                  value={ruleForm.rule_type === "percentage" ? ruleForm.percentage : ruleForm.fixed_value}
                  onChange={(e) => setRuleForm({ 
                    ...ruleForm, 
                    [ruleForm.rule_type === "percentage" ? "percentage" : "fixed_value"]: e.target.value 
                  })}
                  placeholder={ruleForm.rule_type === "percentage" ? "10" : "100,00"}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Select value={ruleForm.user_id || "all"} onValueChange={(v) => setRuleForm({ ...ruleForm, user_id: v === "all" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={ruleForm.product_id || "all"} onValueChange={(v) => setRuleForm({ ...ruleForm, product_id: v === "all" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={ruleForm.apply_to_products}
                  onCheckedChange={(v) => setRuleForm({ ...ruleForm, apply_to_products: v })}
                />
                <Label>Aplicar a produtos</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={ruleForm.apply_to_contracts}
                  onCheckedChange={(v) => setRuleForm({ ...ruleForm, apply_to_contracts: v })}
                />
                <Label>Aplicar a contratos</Label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={ruleForm.is_active}
                onCheckedChange={(v) => setRuleForm({ ...ruleForm, is_active: v })}
              />
              <Label>Regra ativa</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRuleDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveRuleMutation.isPending}>
                {saveRuleMutation.isPending ? "Salvando..." : editingRule ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
