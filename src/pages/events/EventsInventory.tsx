import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Boxes, Plus, Search, Pencil, Trash2, MapPin, Package } from "lucide-react";

const CATEGORIES = [
  { value: "totem", label: "Totem" },
  { value: "banner", label: "Banner / Backdrop" },
  { value: "mesa", label: "Mesa / Mobiliário" },
  { value: "som", label: "Som / Áudio" },
  { value: "iluminacao", label: "Iluminação" },
  { value: "video", label: "Vídeo / Tela" },
  { value: "decoracao", label: "Decoração" },
  { value: "outro", label: "Outro" },
];

const STATUSES = [
  { value: "available", label: "Disponível", color: "bg-green-500/10 text-green-700 border-green-500/30" },
  { value: "in_use", label: "Em uso", color: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  { value: "maintenance", label: "Manutenção", color: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  { value: "lost", label: "Perdido/Quebrado", color: "bg-red-500/10 text-red-700 border-red-500/30" },
];

interface Item {
  id: string;
  name: string;
  category: string;
  description: string | null;
  quantity_total: number;
  status: string;
  location: string | null;
  photo_url: string | null;
  acquisition_cost: number | null;
  notes: string | null;
}

const EMPTY: Partial<Item> = {
  name: "",
  category: "outro",
  description: "",
  quantity_total: 1,
  status: "available",
  location: "",
  photo_url: "",
  acquisition_cost: null,
  notes: "",
};

export default function EventsInventory() {
  const { user } = useCurrentUser();
  const accountId = user?.account_id ?? null;
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Item>>(EMPTY);

  const load = async () => {
    if (!accountId) return;
    setLoading(true);
    const { data } = await supabase
      .from("event_inventory_items")
      .select("*")
      .eq("account_id", accountId)
      .order("name");
    setItems((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [accountId]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filterCategory !== "all" && it.category !== filterCategory) return false;
      if (filterStatus !== "all" && it.status !== filterStatus) return false;
      if (search && !it.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, search, filterCategory, filterStatus]);

  const handleSave = async () => {
    if (!accountId || !editing.name?.trim()) return;
    const payload = {
      account_id: accountId,
      name: editing.name!,
      category: editing.category || "outro",
      description: editing.description || null,
      quantity_total: editing.quantity_total ?? 1,
      status: editing.status || "available",
      location: editing.location || null,
      photo_url: editing.photo_url || null,
      acquisition_cost: editing.acquisition_cost ?? null,
      notes: editing.notes || null,
    };
    const { error } = editing.id
      ? await supabase.from("event_inventory_items").update(payload).eq("id", editing.id)
      : await supabase.from("event_inventory_items").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing.id ? "Item atualizado" : "Item criado" });
    setDialogOpen(false);
    setEditing(EMPTY);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este item do inventário?")) return;
    const { error } = await supabase.from("event_inventory_items").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Item excluído" });
    load();
  };

  const stats = useMemo(() => ({
    total: items.length,
    available: items.filter((i) => i.status === "available").length,
    inUse: items.filter((i) => i.status === "in_use").length,
    maintenance: items.filter((i) => i.status === "maintenance").length,
  }), [items]);

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Boxes className="h-7 w-7 text-primary" />
            Inventário de Eventos
          </h1>
          <p className="text-muted-foreground">
            Itens reutilizáveis: totens, banners, equipamentos, mobiliário.
          </p>
        </div>
        <Button onClick={() => { setEditing(EMPTY); setDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo item
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Disponível", value: stats.available, color: "text-green-600" },
          { label: "Em uso", value: stats.inUse, color: "text-blue-600" },
          { label: "Manutenção", value: stats.maintenance, color: "text-amber-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum item encontrado"
          description="Cadastre seu primeiro item reutilizável."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const status = STATUSES.find((s) => s.value === item.status);
            const category = CATEGORIES.find((c) => c.value === item.category);
            return (
              <Card key={item.id} className="overflow-hidden">
                {item.photo_url && (
                  <div className="aspect-video bg-muted overflow-hidden">
                    <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <Badge className={status?.color} variant="outline">{status?.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">{category?.label}</Badge>
                    <span>Qtd: {item.quantity_total}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {item.description && <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>}
                  {item.location && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {item.location}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => { setEditing(item); setDialogOpen(true); }}>
                      <Pencil className="h-3 w-3" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar item" : "Novo item de inventário"}</DialogTitle>
            <DialogDescription>Itens reutilizáveis entre eventos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min={1} value={editing.quantity_total ?? 1} onChange={(e) => setEditing({ ...editing, quantity_total: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Custo aquisição (R$)</Label>
                <Input type="number" step="0.01" value={editing.acquisition_cost ?? ""} onChange={(e) => setEditing({ ...editing, acquisition_cost: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div>
              <Label>Localização</Label>
              <Input value={editing.location || ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} placeholder="Ex: Depósito sala 2" />
            </div>
            <div>
              <Label>URL da foto</Label>
              <Input value={editing.photo_url || ""} onChange={(e) => setEditing({ ...editing, photo_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
