import { useState } from "react";
import { useTablePagination } from "@/hooks/useTablePagination";
import { TablePagination } from "@/components/ui/table-pagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

interface FinancialCategory {
  id: string;
  name: string;
  type: string;
  color: string;
  is_active: boolean;
  icon?: string;
  display_order?: number;
  dre_group?: string;
  parent_id?: string | null;
  code?: string | null;
}

const dreGroupLabels: Record<string, string> = {
  gross_revenue: "Receita Bruta",
  deductions: "(-) Deduções da Receita",
  cogs: "(-) CMV/CPV",
  personnel: "(-) Despesas com Pessoal",
  administrative: "(-) Despesas Administrativas",
  sales: "(-) Despesas com Vendas",
  financial_income: "(+) Receitas Financeiras",
  financial_expenses: "(-) Despesas Financeiras",
  taxes: "(-) Impostos sobre Lucro",
  depreciation: "(-) Depreciação/Amortização",
  other_revenue: "(+) Outras Receitas",
  other_expenses: "(-) Outras Despesas",
  // Compatibilidade com nomes antigos
  admin_expenses: "(-) Despesas Administrativas",
  sales_expenses: "(-) Despesas Comerciais",
};

const typeLabels: Record<string, string> = {
  income: "Receita",
  expense: "Despesa",
  both: "Ambos",
};

const defaultColors = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

export default function FinancialCategoriesPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "both" as "income" | "expense" | "both",
    color: defaultColors[0],
    is_active: true,
    dre_group: "" as string,
    parent_id: "" as string,
    code: "" as string,
  });

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["financial-categories-all", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("financial_categories")
        .select("*")
        .eq("account_id", accountId)
        .order("name");
      if (error) throw error;
      return data as unknown as FinancialCategory[];
    },
    enabled: !!accountId,
  });

  // Build hierarchical sorted list (parents first, children indented)
  const hierarchicalCategories = (() => {
    const byParent = new Map<string | null, FinancialCategory[]>();
    for (const c of categories) {
      const key = c.parent_id || null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }
    const sortFn = (a: FinancialCategory, b: FinancialCategory) =>
      (a.code || "").localeCompare(b.code || "") || a.name.localeCompare(b.name);
    const result: Array<FinancialCategory & { depth: number }> = [];
    const walk = (parent: string | null, depth: number) => {
      const children = (byParent.get(parent) || []).slice().sort(sortFn);
      for (const c of children) {
        result.push({ ...c, depth });
        walk(c.id, depth + 1);
      }
    };
    walk(null, 0);
    // Append orphans (parent_id references missing category)
    const seen = new Set(result.map((c) => c.id));
    for (const c of categories) {
      if (!seen.has(c.id)) result.push({ ...c, depth: 0 });
    }
    return result;
  })();

  const {
    paginatedItems: paginatedCategories,
    currentPage: catPage,
    pageSize: catPageSize,
    totalPages: catTotalPages,
    totalItems: catTotalItems,
    handlePageChange: handleCatPageChange,
    handlePageSizeChange: handleCatPageSizeChange,
  } = useTablePagination(hierarchicalCategories);


  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        account_id: accountId,
        name: data.name,
        type: data.type,
        color: data.color,
        is_active: data.is_active,
        dre_group: data.dre_group || null,
        parent_id: data.parent_id || null,
        code: data.code?.trim() || null,
      };

      if (editingCategory) {
        const { error } = await supabase
          .from("financial_categories")
          .update(payload)
          .eq("id", editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("financial_categories")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-categories"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: editingCategory ? "Categoria atualizada" : "Categoria criada" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar a categoria.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-categories"] });
      toast({ title: "Categoria excluída" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível excluir a categoria.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "both",
      color: defaultColors[Math.floor(Math.random() * defaultColors.length)],
      is_active: true,
      dre_group: "",
      parent_id: "",
      code: "",
    });
    setEditingCategory(null);
  };

  const handleEdit = (category: FinancialCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type as "income" | "expense" | "both",
      color: category.color,
      is_active: category.is_active,
      dre_group: category.dre_group || "",
      parent_id: category.parent_id || "",
      code: category.code || "",
    });
    setIsDialogOpen(true);
  };


  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Categorias Financeiras</h1>
          <p className="text-muted-foreground">Organize seus lançamentos por categoria</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : categories.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <p>Nenhuma categoria encontrada</p>
              <Button variant="link" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                Criar primeira categoria
              </Button>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Grupo DRE</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {category.code || "—"}
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex items-center gap-2"
                        style={{ paddingLeft: `${(category.depth || 0) * 20}px` }}
                      >
                        {category.depth > 0 && (
                          <span className="text-muted-foreground">└</span>
                        )}
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-medium">{category.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeLabels[category.type] || category.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {category.dre_group ? (
                        <Badge variant="secondary" className="text-xs">
                          {dreGroupLabels[category.dre_group] || category.dre_group}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={category.is_active ? "default" : "secondary"}>
                        {category.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(category)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Deseja excluir esta categoria?")) {
                                deleteMutation.mutate(category.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              currentPage={catPage}
              totalPages={catTotalPages}
              totalItems={catTotalItems}
              pageSize={catPageSize}
              onPageChange={handleCatPageChange}
              onPageSizeChange={handleCatPageSizeChange}
            />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(formData);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Salários"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="3.1.01"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categoria-pai</Label>
              <Select
                value={formData.parent_id || "_root_"}
                onValueChange={(v) => setFormData({ ...formData, parent_id: v === "_root_" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria-pai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_root_">— Nenhuma (categoria raiz) —</SelectItem>
                  {hierarchicalCategories
                    .filter((c) => c.id !== editingCategory?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {"— ".repeat(c.depth)}
                        {c.code ? `[${c.code}] ` : ""}
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Deixe vazio para criar uma categoria-raiz (grupo de contas)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as typeof formData.type })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {defaultColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === color ? "border-primary scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Grupo DRE</Label>
              <Select 
                value={formData.dre_group || "_none_"} 
                onValueChange={(v) => setFormData({ ...formData, dre_group: v === "_none_" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o grupo no DRE" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">Nenhum</SelectItem>
                  <SelectItem value="gross_revenue">Receita Bruta</SelectItem>
                  <SelectItem value="deductions">(-) Deduções da Receita</SelectItem>
                  <SelectItem value="cogs">(-) CMV/CPV (Custo dos Produtos)</SelectItem>
                  <SelectItem value="personnel">(-) Despesas com Pessoal</SelectItem>
                  <SelectItem value="administrative">(-) Despesas Administrativas</SelectItem>
                  <SelectItem value="sales">(-) Despesas com Vendas</SelectItem>
                  <SelectItem value="financial_income">(+) Receitas Financeiras</SelectItem>
                  <SelectItem value="financial_expenses">(-) Despesas Financeiras</SelectItem>
                  <SelectItem value="taxes">(-) Impostos sobre Lucro (IRPJ/CSLL)</SelectItem>
                  <SelectItem value="depreciation">(-) Depreciação/Amortização</SelectItem>
                  <SelectItem value="other_revenue">(+) Outras Receitas</SelectItem>
                  <SelectItem value="other_expenses">(-) Outras Despesas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Define onde esta categoria aparece na Demonstração do Resultado (DRE)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <Label>Categoria ativa</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editingCategory ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
