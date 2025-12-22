import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { Plus, Pencil, Trash2, Gift, Package } from "lucide-react";

type GiftStatus = "planned" | "purchased" | "in_stock" | "distributed";

interface GiftItem {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  quantity_distributed: number;
  unit_cost: number | null;
  total_cost: number | null;
  status: GiftStatus;
  supplier: string | null;
  notes: string | null;
}

interface Props {
  eventId: string;
  accountId: string | null;
  onUpdate?: () => void;
}

export default function EventGiftsTab({ eventId, accountId, onUpdate }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GiftItem | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    quantity: "1",
    unit_cost: "",
    status: "planned" as GiftStatus,
    supplier: "",
    notes: "",
  });

  useEffect(() => {
    fetchItems();
  }, [eventId]);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_gifts")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching gifts:", error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      quantity: "1",
      unit_cost: "",
      status: "planned",
      supplier: "",
      notes: "",
    });
    setEditingItem(null);
  };

  const openEditDialog = (item: GiftItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      quantity: item.quantity.toString(),
      unit_cost: item.unit_cost?.toString() || "",
      status: item.status,
      supplier: item.supplier || "",
      notes: item.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !accountId) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const itemData = {
      event_id: eventId,
      account_id: accountId,
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      quantity: parseInt(formData.quantity) || 1,
      unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : null,
      status: formData.status,
      supplier: formData.supplier.trim() || null,
      notes: formData.notes.trim() || null,
    };

    if (editingItem) {
      const { error } = await supabase
        .from("event_gifts")
        .update(itemData)
        .eq("id", editingItem.id);

      if (error) {
        toast({ title: "Erro", description: "Não foi possível atualizar", variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase.from("event_gifts").insert(itemData);
      if (error) {
        toast({ title: "Erro", description: "Não foi possível criar", variant: "destructive" });
        return;
      }
    }

    toast({ title: "Sucesso", description: editingItem ? "Brinde atualizado" : "Brinde adicionado" });
    setDialogOpen(false);
    resetForm();
    fetchItems();
    onUpdate?.();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("event_gifts").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível excluir", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Brinde excluído" });
      fetchItems();
      onUpdate?.();
    }
  };

  const getStatusBadge = (status: GiftStatus) => {
    const config = {
      planned: { label: "Planejado", variant: "outline" as const },
      purchased: { label: "Comprado", variant: "secondary" as const },
      in_stock: { label: "Em estoque", variant: "default" as const },
      distributed: { label: "Distribuído", variant: "default" as const },
    };
    return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
  };

  const totalValue = items.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalDistributed = items.reduce((sum, item) => sum + item.quantity_distributed, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex-1">
          <CardTitle>Brindes e Presentes</CardTitle>
          <CardDescription>Itens para entrega no evento</CardDescription>
          {items.length > 0 && (
            <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
              <span>{items.length} itens</span>
              <span>{totalItems} unidades</span>
              <span>
                Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
              </span>
            </div>
          )}
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
            icon={Gift}
            title="Nenhum brinde cadastrado"
            description="Adicione brindes e presentes do evento"
            action={{
              label: "Adicionar Brinde",
              onClick: () => { resetForm(); setDialogOpen(true); }
            }}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brinde</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead className="text-right">Custo Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {item.supplier && (
                        <p className="text-xs text-muted-foreground">Fornecedor: {item.supplier}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      {item.quantity}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.unit_cost != null
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.unit_cost)
                      : "-"
                    }
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {item.total_cost != null
                      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total_cost)
                      : "-"
                    }
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Brinde" : "Novo Brinde"}</DialogTitle>
            <DialogDescription>Adicione um brinde ou presente do evento</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do brinde"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_cost">Custo Unitário</Label>
                <Input
                  id="unit_cost"
                  type="number"
                  step="0.01"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: GiftStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planejado</SelectItem>
                    <SelectItem value="purchased">Comprado</SelectItem>
                    <SelectItem value="in_stock">Em Estoque</SelectItem>
                    <SelectItem value="distributed">Distribuído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

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
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalhes do brinde"
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
    </Card>
  );
}
