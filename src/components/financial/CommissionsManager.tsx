import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Plus,
  Percent,
  DollarSign,
  Users,
  Calculator,
  Settings,
  TrendingUp,
  Calendar,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

interface CommissionsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function CommissionsManager({ open, onOpenChange }: CommissionsManagerProps) {
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

  // Fetch commission rules
  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["commission-rules", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("commission_rules")
        .select(`
          *,
          user:users(full_name),
          product:products(name)
        `)
        .eq("account_id", accountId)
        .order("name");
      if (error) throw error;
      return data as CommissionRule[];
    },
    enabled: !!accountId && open,
  });

  // Fetch commission entries
  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["commission-entries", accountId, currentMonth],
    queryFn: async () => {
      if (!accountId) return [];
      
      const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("commission_entries")
        .select(`
          *,
          user:users(full_name),
          rule:commission_rules(name)
        `)
        .eq("account_id", accountId)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CommissionEntry[];
    },
    enabled: !!accountId && open,
  });

  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: ["team-users", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name")
        .eq("account_id", accountId)
        .order("full_name");
      if (error) throw error;
      return data as User[];
    },
    enabled: !!accountId && open,
  });

  // Fetch products
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
    enabled: !!accountId && open,
  });

  // Save rule mutation
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
        const { error } = await supabase
          .from("commission_rules")
          .update(payload)
          .eq("id", editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
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

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
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

  // Pay commission mutation
  const payCommissionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
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

  // Summary
  const summary = {
    total: entries.reduce((sum, e) => sum + e.commission_value, 0),
    pending: entries.filter(e => e.status === "pending").reduce((sum, e) => sum + e.commission_value, 0),
    paid: entries.filter(e => e.status === "paid").reduce((sum, e) => sum + e.commission_value, 0),
    count: entries.length,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Gestão de Comissões
            </DialogTitle>
            <DialogDescription>
              Configure regras e acompanhe comissões da equipe
            </DialogDescription>
          </DialogHeader>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 py-4">
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

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 overflow-hidden flex flex-col">
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

            {/* Entries Tab */}
            <TabsContent value="entries" className="flex-1 overflow-auto mt-4">
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
                      <TableHead>Data</TableHead>
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
                          {format(parseISO(entry.created_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          {entry.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => payCommissionMutation.mutate(entry.id)}
                              className="text-green-600"
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

            {/* Rules Tab */}
            <TabsContent value="rules" className="flex-1 overflow-auto mt-4">
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
                  <Button className="mt-4" onClick={() => setIsRuleDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeira Regra
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Aplica-se a</TableHead>
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
                            {rule.rule_type === "percentage" ? (
                              <><Percent className="h-3 w-3 mr-1" /> Percentual</>
                            ) : rule.rule_type === "fixed" ? (
                              <><DollarSign className="h-3 w-3 mr-1" /> Fixo</>
                            ) : (
                              <><Calculator className="h-3 w-3 mr-1" /> Misto</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rule.rule_type !== "fixed" && (
                            <span className="font-medium">{rule.percentage}%</span>
                          )}
                          {rule.fixed_value && (
                            <span className="text-muted-foreground ml-1">
                              + {formatCurrency(rule.fixed_value)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {rule.apply_to_products && <Badge variant="secondary">Produtos</Badge>}
                            {rule.apply_to_contracts && <Badge variant="secondary">Contratos</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {rule.user?.full_name || (
                            <span className="text-muted-foreground">Todos</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {rule.is_active ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inativo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditRule(rule)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteRuleMutation.mutate(rule.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
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

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Form Dialog */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Editar Regra" : "Nova Regra de Comissão"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Regra</Label>
              <Input
                value={ruleForm.name}
                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                placeholder="Ex: Comissão Padrão"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={ruleForm.description}
                onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                placeholder="Descreva a regra..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={ruleForm.rule_type}
                  onValueChange={(v) => setRuleForm({ ...ruleForm, rule_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual</SelectItem>
                    <SelectItem value="fixed">Valor Fixo</SelectItem>
                    <SelectItem value="mixed">Misto (% + Fixo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {ruleForm.rule_type !== "fixed" && (
                <div className="space-y-2">
                  <Label>Percentual (%)</Label>
                  <Input
                    type="number"
                    value={ruleForm.percentage}
                    onChange={(e) => setRuleForm({ ...ruleForm, percentage: e.target.value })}
                    placeholder="10"
                  />
                </div>
              )}
            </div>

            {(ruleForm.rule_type === "fixed" || ruleForm.rule_type === "mixed") && (
              <div className="space-y-2">
                <Label>Valor Fixo (R$)</Label>
                <Input
                  type="number"
                  value={ruleForm.fixed_value}
                  onChange={(e) => setRuleForm({ ...ruleForm, fixed_value: e.target.value })}
                  placeholder="100.00"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Vendedor Específico (opcional)</Label>
              <Select
                value={ruleForm.user_id}
                onValueChange={(v) => setRuleForm({ ...ruleForm, user_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os vendedores</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Produto Específico (opcional)</Label>
              <Select
                value={ruleForm.product_id}
                onValueChange={(v) => setRuleForm({ ...ruleForm, product_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os produtos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={ruleForm.apply_to_products}
                  onCheckedChange={(v) => setRuleForm({ ...ruleForm, apply_to_products: v })}
                />
                <Label>Produtos</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={ruleForm.apply_to_contracts}
                  onCheckedChange={(v) => setRuleForm({ ...ruleForm, apply_to_contracts: v })}
                />
                <Label>Contratos</Label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={ruleForm.is_active}
                onCheckedChange={(v) => setRuleForm({ ...ruleForm, is_active: v })}
              />
              <Label>Regra Ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsRuleDialogOpen(false);
              resetRuleForm();
            }}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveRuleMutation.mutate(ruleForm)}
              disabled={!ruleForm.name || saveRuleMutation.isPending}
            >
              {saveRuleMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
