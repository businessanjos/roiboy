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
import { Checkbox } from "@/components/ui/checkbox";
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
import { BookOpenCheck, Plus, Pencil, Trash2, ListChecks, AlertTriangle } from "lucide-react";

interface Playbook {
  id: string;
  name: string;
  description: string | null;
  event_type: string | null;
  modality: string | null;
  cover_color: string | null;
  is_default: boolean;
}

interface PlaybookItem {
  id: string;
  playbook_id: string;
  title: string;
  description: string | null;
  category: string | null;
  days_offset: number;
  responsible_role: string | null;
  position: number;
  is_critical: boolean;
}

const EVENT_TYPES = [
  { value: "live", label: "Live" },
  { value: "mentoria", label: "Mentoria" },
  { value: "imersao", label: "Imersão" },
  { value: "workshop", label: "Workshop" },
  { value: "outro", label: "Outro" },
];

const MODALITIES = [
  { value: "online", label: "Online" },
  { value: "presencial", label: "Presencial" },
  { value: "hibrido", label: "Híbrido" },
];

export default function EventsPlaybooks() {
  const { accountId } = useCurrentUser();
  const { toast } = useToast();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Playbook | null>(null);
  const [items, setItems] = useState<PlaybookItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Playbook>>({ name: "", cover_color: "#7c3aed" });
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<PlaybookItem>>({ title: "", days_offset: 0 });

  const loadPlaybooks = async () => {
    if (!accountId) return;
    setLoading(true);
    const { data } = await supabase
      .from("event_playbooks")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });
    setPlaybooks((data as any) ?? []);
    setLoading(false);
  };

  const loadItems = async (playbookId: string) => {
    const { data } = await supabase
      .from("event_playbook_items")
      .select("*")
      .eq("playbook_id", playbookId)
      .order("days_offset", { ascending: true })
      .order("position", { ascending: true });
    setItems((data as any) ?? []);
  };

  useEffect(() => { loadPlaybooks(); }, [accountId]);
  useEffect(() => { if (selected) loadItems(selected.id); }, [selected]);

  const handleSavePlaybook = async () => {
    if (!accountId || !editing.name?.trim()) return;
    const payload = {
      account_id: accountId,
      name: editing.name!,
      description: editing.description || null,
      event_type: editing.event_type || null,
      modality: editing.modality || null,
      cover_color: editing.cover_color || "#7c3aed",
      is_default: editing.is_default ?? false,
    };
    const { error } = editing.id
      ? await supabase.from("event_playbooks").update(payload).eq("id", editing.id)
      : await supabase.from("event_playbooks").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Playbook salvo" });
    setDialogOpen(false);
    setEditing({ name: "", cover_color: "#7c3aed" });
    loadPlaybooks();
  };

  const handleDeletePlaybook = async (id: string) => {
    if (!confirm("Excluir este playbook e todos seus itens?")) return;
    await supabase.from("event_playbooks").delete().eq("id", id);
    if (selected?.id === id) setSelected(null);
    loadPlaybooks();
  };

  const handleSaveItem = async () => {
    if (!accountId || !selected || !editingItem.title?.trim()) return;
    const payload = {
      account_id: accountId,
      playbook_id: selected.id,
      title: editingItem.title!,
      description: editingItem.description || null,
      category: editingItem.category || null,
      days_offset: editingItem.days_offset ?? 0,
      responsible_role: editingItem.responsible_role || null,
      position: editingItem.position ?? 0,
      is_critical: editingItem.is_critical ?? false,
    };
    const { error } = editingItem.id
      ? await supabase.from("event_playbook_items").update(payload).eq("id", editingItem.id)
      : await supabase.from("event_playbook_items").insert(payload);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setItemDialogOpen(false);
    setEditingItem({ title: "", days_offset: 0 });
    loadItems(selected.id);
  };

  const handleDeleteItem = async (id: string) => {
    await supabase.from("event_playbook_items").delete().eq("id", id);
    if (selected) loadItems(selected.id);
  };

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpenCheck className="h-7 w-7 text-primary" />
            Playbooks por tipo de evento
          </h1>
          <p className="text-muted-foreground">
            Templates reutilizáveis de checklist e cronograma para cada formato.
          </p>
        </div>
        <Button onClick={() => { setEditing({ name: "", cover_color: "#7c3aed" }); setDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo playbook
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Playbooks</h2>
          {loading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)
          ) : playbooks.length === 0 ? (
            <EmptyState icon={BookOpenCheck} title="Nenhum playbook" description="Crie seu primeiro template." />
          ) : (
            playbooks.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all ${selected?.id === p.id ? "ring-2 ring-primary" : "hover:shadow-md"}`}
                onClick={() => setSelected(p)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-12 rounded-full" style={{ backgroundColor: p.cover_color || "#7c3aed" }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {p.event_type && <Badge variant="secondary" className="text-xs">{p.event_type}</Badge>}
                        {p.modality && <Badge variant="outline" className="text-xs">{p.modality}</Badge>}
                        {p.is_default && <Badge className="text-xs">padrão</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditing(p); setDialogOpen(true); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDeletePlaybook(p.id); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ListChecks className="h-5 w-5" />
                      {selected.name}
                    </CardTitle>
                    {selected.description && <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>}
                  </div>
                  <Button size="sm" onClick={() => { setEditingItem({ title: "", days_offset: 0 }); setItemDialogOpen(true); }} className="gap-1">
                    <Plus className="h-4 w-4" /> Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    Adicione tarefas com prazo relativo ao evento (ex: -30 dias).
                  </div>
                ) : (
                  items.map((it) => (
                    <div key={it.id} className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/30">
                      <div className="flex-shrink-0 text-center min-w-[60px]">
                        <div className={`text-lg font-bold ${it.days_offset < 0 ? "text-primary" : it.days_offset === 0 ? "text-amber-600" : "text-green-600"}`}>
                          {it.days_offset > 0 ? `+${it.days_offset}` : it.days_offset}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">dias</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{it.title}</span>
                          {it.is_critical && (
                            <Badge variant="destructive" className="gap-1 text-xs">
                              <AlertTriangle className="h-3 w-3" /> crítico
                            </Badge>
                          )}
                        </div>
                        {it.description && <p className="text-sm text-muted-foreground">{it.description}</p>}
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {it.category && <Badge variant="secondary" className="text-xs">{it.category}</Badge>}
                          {it.responsible_role && <Badge variant="outline" className="text-xs">{it.responsible_role}</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingItem(it); setItemDialogOpen(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteItem(it.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[300px]">
              <div className="text-center text-muted-foreground">
                <BookOpenCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Selecione um playbook para ver os itens</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Playbook dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar playbook" : "Novo playbook"}</DialogTitle>
            <DialogDescription>Template de checklist por tipo de evento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={editing.event_type || ""} onValueChange={(v) => setEditing({ ...editing, event_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modalidade</Label>
                <Select value={editing.modality || ""} onValueChange={(v) => setEditing({ ...editing, modality: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{MODALITIES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Cor</Label>
              <Input type="color" value={editing.cover_color || "#7c3aed"} onChange={(e) => setEditing({ ...editing, cover_color: e.target.value })} className="h-10 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={editing.is_default ?? false} onCheckedChange={(v) => setEditing({ ...editing, is_default: !!v })} />
              <Label className="cursor-pointer">Marcar como padrão</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePlaybook}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem.id ? "Editar item" : "Novo item do playbook"}</DialogTitle>
            <DialogDescription>Use offset em dias relativos ao evento (ex: -30 = 30 dias antes).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={editingItem.title || ""} onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={editingItem.description || ""} onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dias (offset)</Label>
                <Input type="number" value={editingItem.days_offset ?? 0} onChange={(e) => setEditingItem({ ...editingItem, days_offset: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={editingItem.category || ""} onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })} placeholder="Logística, Marketing..." />
              </div>
            </div>
            <div>
              <Label>Responsável (função)</Label>
              <Input value={editingItem.responsible_role || ""} onChange={(e) => setEditingItem({ ...editingItem, responsible_role: e.target.value })} placeholder="Ex: Produção, Marketing" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={editingItem.is_critical ?? false} onCheckedChange={(v) => setEditingItem({ ...editingItem, is_critical: !!v })} />
              <Label className="cursor-pointer">Item crítico (bloqueador)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveItem}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
