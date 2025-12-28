import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import {
  Bookmark,
  Plus,
  Trash2,
  Edit2,
  Star,
  ArrowUpCircle,
  ArrowDownCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

interface EntryTemplate {
  id: string;
  name: string;
  description: string | null;
  type: "income" | "expense";
  category_id: string | null;
  cost_center_id: string | null;
  supplier_id: string | null;
  client_id: string | null;
  default_amount: number | null;
  notes: string | null;
  use_count: number;
  last_used_at: string | null;
  category?: { id: string; name: string; color: string } | null;
  client?: { id: string; full_name: string } | null;
  supplier?: { id: string; name: string } | null;
}

interface EntryTemplatesManagerProps {
  onUseTemplate?: (template: EntryTemplate) => void;
  activeTab?: "income" | "expense";
}

export function EntryTemplatesManager({
  onUseTemplate,
  activeTab = "expense",
}: EntryTemplatesManagerProps) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EntryTemplate | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: activeTab,
    category_id: "",
    client_id: "",
    supplier_id: "",
    default_amount: "",
    notes: "",
  });

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["entry-templates", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("financial_entry_templates")
        .select(`
          *,
          category:financial_categories(id, name, color),
          client:clients(id, full_name),
          supplier:suppliers(id, name)
        `)
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("use_count", { ascending: false });
      if (error) throw error;
      return data as EntryTemplate[];
    },
    enabled: !!accountId,
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
    enabled: !!accountId,
  });

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name")
        .eq("account_id", accountId)
        .eq("status", "active")
        .order("full_name");
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
        .select("id, name")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        account_id: accountId,
        name: data.name,
        description: data.description || null,
        type: data.type,
        category_id: data.category_id || null,
        client_id: data.client_id || null,
        supplier_id: data.supplier_id || null,
        default_amount: data.default_amount ? parseFloat(data.default_amount.replace(",", ".")) : null,
        notes: data.notes || null,
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from("financial_entry_templates")
          .update(payload)
          .eq("id", editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("financial_entry_templates")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry-templates"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingTemplate ? "Modelo atualizado" : "Modelo criado",
        description: "O modelo de lançamento foi salvo com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o modelo.",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_entry_templates")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry-templates"] });
      toast({ title: "Modelo removido" });
    },
  });

  // Use template mutation
  const useTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      await supabase.rpc("increment_template_usage", { template_id: templateId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry-templates"] });
    },
  });

  const handleUseTemplate = (template: EntryTemplate) => {
    useTemplateMutation.mutate(template.id);
    onUseTemplate?.(template);
  };

  const handleEdit = (template: EntryTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      type: template.type,
      category_id: template.category_id || "",
      client_id: template.client_id || "",
      supplier_id: template.supplier_id || "",
      default_amount: template.default_amount?.toString() || "",
      notes: template.notes || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: activeTab,
      category_id: "",
      client_id: "",
      supplier_id: "",
      default_amount: "",
      notes: "",
    });
    setEditingTemplate(null);
  };

  const filteredTemplates = templates.filter(
    (t) => t.type === (activeTab === "income" ? "income" : "expense")
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const filteredCategories = categories.filter(
    (cat: any) => cat.type === "both" || cat.type === activeTab
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            Modelos Rápidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bookmark className="h-4 w-4" />
                Modelos Rápidos
              </CardTitle>
              <CardDescription className="text-xs">
                Lançamentos frequentes salvos para uso rápido
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm();
                setIsDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Nenhum modelo salvo</p>
              <p className="text-xs">Salve lançamentos frequentes para agilizar</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[280px]">
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {template.type === "income" ? (
                          <ArrowDownCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        ) : (
                          <ArrowUpCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        )}
                        <span className="font-medium text-sm truncate">{template.name}</span>
                        {template.use_count > 0 && (
                          <Badge variant="secondary" className="text-xs h-5">
                            {template.use_count}x
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {template.category && (
                          <Badge
                            variant="outline"
                            className="text-xs h-5"
                            style={{ borderColor: template.category.color }}
                          >
                            {template.category.name}
                          </Badge>
                        )}
                        {template.default_amount && (
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(template.default_amount)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleUseTemplate(template)}
                        title="Usar modelo"
                      >
                        <Zap className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEdit(template)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteMutation.mutate(template.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Editar Modelo" : "Novo Modelo de Lançamento"}
            </DialogTitle>
            <DialogDescription>
              Salve lançamentos frequentes para usar rapidamente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome do Modelo *</Label>
              <Input
                id="name"
                placeholder="Ex: Aluguel mensal, Internet..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category">Categoria</Label>
              <Select
                value={formData.category_id}
                onValueChange={(v) => setFormData({ ...formData, category_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.type === "expense" && (
              <div className="grid gap-2">
                <Label htmlFor="supplier">Fornecedor</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(v) => setFormData({ ...formData, supplier_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((sup: any) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.type === "income" && (
              <div className="grid gap-2">
                <Label htmlFor="client">Cliente</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(v) => setFormData({ ...formData, client_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((cli: any) => (
                      <SelectItem key={cli.id} value={cli.id}>
                        {cli.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="amount">Valor Padrão</Label>
              <Input
                id="amount"
                placeholder="0,00"
                value={formData.default_amount}
                onChange={(e) => setFormData({ ...formData, default_amount: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Notas sobre este lançamento..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.name || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
