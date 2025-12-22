import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, DollarSign, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

type CostCategory = "venue" | "catering" | "equipment" | "marketing" | "travel" | "accommodation" | "speakers" | "gifts" | "staff" | "technology" | "insurance" | "other";
type CostStatus = "estimated" | "approved" | "paid" | "cancelled";

interface CostItem {
  id: string;
  description: string;
  category: CostCategory;
  estimated_value: number;
  actual_value: number | null;
  status: CostStatus;
  supplier: string | null;
  invoice_number: string | null;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
}

interface Props {
  eventId: string;
  accountId: string | null;
  budget: number | null;
  onUpdate?: () => void;
}

const CATEGORY_LABELS: Record<CostCategory, string> = {
  venue: "Local/Espaço",
  catering: "Alimentação",
  equipment: "Equipamentos",
  marketing: "Marketing",
  travel: "Viagens",
  accommodation: "Hospedagem",
  speakers: "Palestrantes",
  gifts: "Brindes",
  staff: "Equipe",
  technology: "Tecnologia",
  insurance: "Seguros",
  other: "Outros",
};

export default function EventCostsTab({ eventId, accountId, budget, onUpdate }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<CostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CostItem | null>(null);
  
  const [formData, setFormData] = useState({
    description: "",
    category: "other" as CostCategory,
    estimated_value: "",
    actual_value: "",
    status: "estimated" as CostStatus,
    supplier: "",
    invoice_number: "",
    due_date: "",
    notes: "",
  });

  useEffect(() => {
    fetchItems();
  }, [eventId]);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_costs")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching costs:", error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      description: "",
      category: "other",
      estimated_value: "",
      actual_value: "",
      status: "estimated",
      supplier: "",
      invoice_number: "",
      due_date: "",
      notes: "",
    });
    setEditingItem(null);
  };

  const openEditDialog = (item: CostItem) => {
    setEditingItem(item);
    setFormData({
      description: item.description,
      category: item.category,
      estimated_value: item.estimated_value.toString(),
      actual_value: item.actual_value?.toString() || "",
      status: item.status,
      supplier: item.supplier || "",
      invoice_number: item.invoice_number || "",
      due_date: item.due_date?.slice(0, 10) || "",
      notes: item.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.description.trim() || !formData.estimated_value || !accountId) {
      toast({
        title: "Erro",
        description: "Descrição e valor estimado são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const itemData = {
      event_id: eventId,
      account_id: accountId,
      description: formData.description.trim(),
      category: formData.category,
      estimated_value: parseFloat(formData.estimated_value),
      actual_value: formData.actual_value ? parseFloat(formData.actual_value) : null,
      status: formData.status,
      supplier: formData.supplier.trim() || null,
      invoice_number: formData.invoice_number.trim() || null,
      due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
      notes: formData.notes.trim() || null,
      paid_at: formData.status === "paid" ? new Date().toISOString() : null,
    };

    if (editingItem) {
      const { error } = await supabase
        .from("event_costs")
        .update(itemData)
        .eq("id", editingItem.id);

      if (error) {
        toast({ title: "Erro", description: "Não foi possível atualizar", variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase.from("event_costs").insert(itemData);
      if (error) {
        toast({ title: "Erro", description: "Não foi possível criar", variant: "destructive" });
        return;
      }
    }

    toast({ title: "Sucesso", description: editingItem ? "Custo atualizado" : "Custo adicionado" });
    setDialogOpen(false);
    resetForm();
    fetchItems();
    onUpdate?.();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("event_costs").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível excluir", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Custo excluído" });
      fetchItems();
      onUpdate?.();
    }
  };

  const getStatusBadge = (status: CostStatus) => {
    const config = {
      estimated: { label: "Estimado", variant: "outline" as const },
      approved: { label: "Aprovado", variant: "secondary" as const },
      paid: { label: "Pago", variant: "default" as const },
      cancelled: { label: "Cancelado", variant: "destructive" as const },
    };
    return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
  };

  // Calculate totals
  const totalEstimated = items.filter(i => i.status !== 'cancelled').reduce((sum, i) => sum + i.estimated_value, 0);
  const totalActual = items.filter(i => i.status !== 'cancelled').reduce((sum, i) => sum + (i.actual_value || i.estimated_value), 0);
  const totalPaid = items.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.actual_value || i.estimated_value), 0);
  const budgetUsage = budget ? (totalActual / budget) * 100 : 0;
  const isOverBudget = budget && totalActual > budget;

  // Group by category
  const categoryTotals = items
    .filter(i => i.status !== 'cancelled')
    .reduce((acc, item) => {
      const cat = item.category;
      if (!acc[cat]) acc[cat] = 0;
      acc[cat] += item.actual_value || item.estimated_value;
      return acc;
    }, {} as Record<CostCategory, number>);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estimado</p>
              <p className="text-xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalEstimated)}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <DollarSign className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Custo Real</p>
              <p className="text-xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalActual)}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <TrendingDown className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pago</p>
              <p className="text-xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPaid)}
              </p>
            </div>
          </div>
        </Card>
        
        {budget ? (
          <Card className={`p-4 ${isOverBudget ? 'border-destructive' : ''}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isOverBudget ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                {isOverBudget ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <DollarSign className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Orçamento</p>
                <p className="text-xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(budget)}
                </p>
                <Progress value={Math.min(budgetUsage, 100)} className="h-1.5 mt-1" />
                <p className="text-xs text-muted-foreground mt-1">{Math.round(budgetUsage)}% utilizado</p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4 border-dashed">
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Defina um orçamento na aba Visão Geral
            </div>
          </Card>
        )}
      </div>

      {/* Costs Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Custos do Evento</CardTitle>
            <CardDescription>Controle financeiro detalhado</CardDescription>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="Nenhum custo cadastrado"
              description="Adicione os custos do evento"
              action={
                <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Custo
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Estimado</TableHead>
                  <TableHead className="text-right">Real</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Vencimento</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className={item.status === 'cancelled' ? 'opacity-50' : ''}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.description}</p>
                        {item.supplier && (
                          <p className="text-xs text-muted-foreground">{item.supplier}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{CATEGORY_LABELS[item.category]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.estimated_value)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.actual_value != null
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.actual_value)
                        : "-"
                      }
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {item.due_date && (
                        <span className={new Date(item.due_date) < new Date() && item.status !== 'paid' ? 'text-destructive' : ''}>
                          {format(new Date(item.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Custo" : "Novo Custo"}</DialogTitle>
            <DialogDescription>Adicione um custo ao evento</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Descrição *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do custo"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: CostCategory) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: CostStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="estimated">Estimado</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimated_value">Valor Estimado *</Label>
                <Input
                  id="estimated_value"
                  type="number"
                  step="0.01"
                  value={formData.estimated_value}
                  onChange={(e) => setFormData({ ...formData, estimated_value: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actual_value">Valor Real</Label>
                <Input
                  id="actual_value"
                  type="number"
                  step="0.01"
                  value={formData.actual_value}
                  onChange={(e) => setFormData({ ...formData, actual_value: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier">Fornecedor</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Vencimento</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionais"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editingItem ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
