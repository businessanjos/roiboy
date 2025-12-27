import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Tag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FinancialCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Category {
  id: string;
  name: string;
  type: "expense" | "income" | "both";
  color: string;
  is_active: boolean;
}

const categoryColors = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e",
];

const typeLabels = {
  expense: "Despesa",
  income: "Receita",
  both: "Ambos",
};

export function FinancialCategoriesDialog({ open, onOpenChange }: FinancialCategoriesDialogProps) {
  const { accountId } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "both" as "expense" | "income" | "both",
    color: categoryColors[0],
  });

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["financial-categories", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("financial_categories")
        .select("*")
        .eq("account_id", accountId)
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!accountId && open,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        account_id: accountId,
        name: data.name,
        type: data.type,
        color: data.color,
      };

      if (editingCategory) {
        const { error } = await supabase
          .from("financial_categories")
          .update(payload)
          .eq("id", editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-categories"] });
      setIsFormOpen(false);
      resetForm();
      toast({ title: editingCategory ? "Categoria atualizada" : "Categoria criada" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar a categoria.", variant: "destructive" });
    },
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("financial_categories")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-categories"] });
    },
  });

  // Delete mutation
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
      toast({
        title: "Erro",
        description: "Não foi possível excluir. Verifique se não há lançamentos vinculados.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", type: "both", color: categoryColors[0] });
    setEditingCategory(null);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      color: category.color,
    });
    setIsFormOpen(true);
  };

  const activeCategories = categories.filter((c) => c.is_active);
  const inactiveCategories = categories.filter((c) => !c.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Categorias Financeiras
          </DialogTitle>
          <DialogDescription>
            Gerencie as categorias para organizar seus lançamentos
          </DialogDescription>
        </DialogHeader>

        {/* Category Form */}
        {isFormOpen ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(formData);
            }}
            className="space-y-4 border rounded-lg p-4"
          >
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Fornecedores"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa (A Pagar)</SelectItem>
                  <SelectItem value="income">Receita (A Receber)</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {categoryColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 ${formData.color === color ? "border-foreground ring-2 ring-offset-2" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => { setIsFormOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editingCategory ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" onClick={() => setIsFormOpen(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Nova Categoria
          </Button>
        )}

        {/* Categories List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Categories */}
            <div className="space-y-2">
              {activeCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma categoria cadastrada
                </p>
              ) : (
                activeCategories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <div>
                        <span className="font-medium">{category.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {typeLabels[category.type]}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(category)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Deseja excluir esta categoria?")) {
                            deleteMutation.mutate(category.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Inactive Categories */}
            {inactiveCategories.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Categorias Inativas</p>
                {inactiveCategories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 border rounded-lg opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span>{category.name}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleMutation.mutate({ id: category.id, is_active: true })}
                    >
                      Ativar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
