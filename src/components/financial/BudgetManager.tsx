import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

interface BudgetManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Budget {
  id: string;
  name: string;
  year: number;
  month: number | null;
  category_id: string | null;
  cost_center_id: string | null;
  budget_type: string;
  planned_amount: number;
  category?: { name: string } | null;
  cost_center?: { name: string } | null;
}

interface BudgetVsActual {
  category_id: string | null;
  category_name: string | null;
  cost_center_id: string | null;
  cost_center_name: string | null;
  budget_type: string;
  planned_amount: number;
  actual_amount: number;
  variance: number;
  variance_percent: number;
}

const months = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

export function BudgetManager({ open, onOpenChange }: BudgetManagerProps) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(currentMonth);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    year: currentYear,
    month: currentMonth.toString(),
    category_id: "",
    cost_center_id: "",
    budget_type: "expense",
    planned_amount: "",
  });

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
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId && open,
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
    enabled: !!accountId && open,
  });

  // Fetch budget vs actual
  const { data: budgetVsActual = [], isLoading } = useQuery({
    queryKey: ["budget-vs-actual", accountId, selectedYear, selectedMonth],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase.rpc("get_budget_vs_actual", {
        p_account_id: accountId,
        p_year: selectedYear,
        p_month: selectedMonth,
      });
      if (error) throw error;
      return data as BudgetVsActual[];
    },
    enabled: !!accountId && open,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        account_id: accountId,
        name: data.name,
        year: data.year,
        month: data.month ? parseInt(data.month) : null,
        category_id: data.category_id || null,
        cost_center_id: data.cost_center_id || null,
        budget_type: data.budget_type,
        planned_amount: parseFloat(data.planned_amount.replace(",", ".")),
      };

      const { error } = await supabase.from("financial_budgets").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-vs-actual"] });
      setIsFormOpen(false);
      resetForm();
      toast({ title: "Orçamento criado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      year: currentYear,
      month: currentMonth.toString(),
      category_id: "",
      cost_center_id: "",
      budget_type: "expense",
      planned_amount: "",
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const totals = useMemo(() => {
    const expenses = budgetVsActual.filter(b => b.budget_type === "expense");
    const income = budgetVsActual.filter(b => b.budget_type === "income");

    return {
      plannedExpenses: expenses.reduce((sum, b) => sum + b.planned_amount, 0),
      actualExpenses: expenses.reduce((sum, b) => sum + b.actual_amount, 0),
      plannedIncome: income.reduce((sum, b) => sum + b.planned_amount, 0),
      actualIncome: income.reduce((sum, b) => sum + b.actual_amount, 0),
    };
  }, [budgetVsActual]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Orçamento vs Realizado
          </DialogTitle>
          <DialogDescription>
            Compare o planejado com o realizado por categoria e centro de custo
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Label>Ano:</Label>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label>Mês:</Label>
            <Select 
              value={selectedMonth?.toString() || "all"} 
              onValueChange={(v) => setSelectedMonth(v === "all" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ano inteiro</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Orçamento
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Despesas
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Orçado</p>
                <p className="text-lg font-bold">{formatCurrency(totals.plannedExpenses)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Realizado</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(totals.actualExpenses)}</p>
              </div>
            </div>
            <Progress 
              value={totals.plannedExpenses > 0 ? (totals.actualExpenses / totals.plannedExpenses) * 100 : 0} 
              className="mt-2 h-2" 
            />
          </div>
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Receitas
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Orçado</p>
                <p className="text-lg font-bold">{formatCurrency(totals.plannedIncome)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Realizado</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(totals.actualIncome)}</p>
              </div>
            </div>
            <Progress 
              value={totals.plannedIncome > 0 ? (totals.actualIncome / totals.plannedIncome) * 100 : 0} 
              className="mt-2 h-2" 
            />
          </div>
        </div>

        {/* Form */}
        {isFormOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(formData);
            }}
            className="space-y-4 border rounded-lg p-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Orçamento Marketing Q1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Orçado *</Label>
                <Input
                  value={formData.planned_amount}
                  onChange={(e) => setFormData({ ...formData, planned_amount: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formData.budget_type} onValueChange={(v) => setFormData({ ...formData, budget_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={formData.month} onValueChange={(v) => setFormData({ ...formData, month: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Centro de Custo</Label>
                <Select value={formData.cost_center_id} onValueChange={(v) => setFormData({ ...formData, cost_center_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Criar Orçamento"}
              </Button>
            </div>
          </form>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : budgetVsActual.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum orçamento cadastrado para este período
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Centro de Custo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Orçado</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Variação</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgetVsActual.map((row, idx) => {
                const isOverBudget = row.budget_type === "expense" 
                  ? row.actual_amount > row.planned_amount
                  : row.actual_amount < row.planned_amount;
                
                return (
                  <TableRow key={idx}>
                    <TableCell>{row.category_name || "Todas"}</TableCell>
                    <TableCell>{row.cost_center_name || "Todos"}</TableCell>
                    <TableCell>
                      <Badge variant={row.budget_type === "expense" ? "destructive" : "default"}>
                        {row.budget_type === "expense" ? "Despesa" : "Receita"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.planned_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.actual_amount)}</TableCell>
                    <TableCell className={`text-right ${isOverBudget ? "text-red-600" : "text-green-600"}`}>
                      {formatCurrency(row.variance)}
                      <span className="text-xs ml-1">({row.variance_percent.toFixed(1)}%)</span>
                    </TableCell>
                    <TableCell>
                      {isOverBudget ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
