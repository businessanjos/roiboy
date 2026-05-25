import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Sparkles, Globe, Instagram, Linkedin, AtSign, Music, Youtube, Music2,
  Palette, BookOpen, Presentation, FileText, Mail, Briefcase, Megaphone,
  Users, Plus, ExternalLink, Trash2, Edit, GripVertical, CheckCircle2,
} from "lucide-react";

const ICONS: Record<string, any> = {
  Globe, Instagram, Linkedin, AtSign, Music, Youtube, Music2,
  Palette, BookOpen, Presentation, FileText, Mail, Briefcase, Megaphone, Users,
};

const STATUS_META: Record<string, { label: string; color: string; progress: number }> = {
  not_started: { label: "Não iniciado", color: "bg-muted text-muted-foreground", progress: 0 },
  in_progress: { label: "Em andamento", color: "bg-blue-500/15 text-blue-600", progress: 50 },
  review: { label: "Em revisão", color: "bg-amber-500/15 text-amber-700", progress: 80 },
  done: { label: "Concluído", color: "bg-emerald-500/15 text-emerald-700", progress: 100 },
};

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  web: { label: "Web", color: "bg-violet-500/10 text-violet-700" },
  social: { label: "Redes Sociais", color: "bg-pink-500/10 text-pink-700" },
  identity: { label: "Identidade Visual", color: "bg-amber-500/10 text-amber-700" },
  internal: { label: "Interno", color: "bg-slate-500/10 text-slate-700" },
};

const TASK_STATUSES = [
  { id: "todo", label: "A fazer" },
  { id: "doing", label: "Em execução" },
  { id: "review", label: "Em revisão" },
  { id: "done", label: "Concluído" },
];

type Channel = {
  id: string;
  account_id: string;
  name: string;
  category: string;
  icon: string | null;
  url: string | null;
  status: string;
  owner: string | null;
  notes: string | null;
  sort_order: number;
};

type Task = {
  id: string;
  account_id: string;
  channel_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee: string | null;
  due_date: string | null;
  checklist: { text: string; done: boolean }[];
  sort_order: number;
};

export default function Rebranding() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const accountId = currentUser?.account_id;

  const { data: channels = [] } = useQuery({
    queryKey: ["rebranding-channels", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rebranding_channels" as any)
        .select("*")
        .eq("account_id", accountId)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as Channel[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["rebranding-tasks", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rebranding_tasks" as any)
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Task[];
    },
  });

  // Seed default channels if account has none
  const seedMutation = useMutation({
    mutationFn: async () => {
      const defaults = [
        ["Site Institucional", "web", "Globe"],
        ["Instagram Eternum", "social", "Instagram"],
        ["LinkedIn Eternum", "social", "Linkedin"],
        ["LinkedIn Everton Pieri", "social", "Linkedin"],
        ["LinkedIn Bruna Pieri", "social", "Linkedin"],
        ["Threads Everton", "social", "AtSign"],
        ["Threads Bruna", "social", "AtSign"],
        ["Spotify (Podcast)", "social", "Music"],
        ["YouTube", "social", "Youtube"],
        ["TikTok", "social", "Music2"],
        ["Identidade Visual dos Produtos", "identity", "Palette"],
        ["Logo & Manual de Marca", "identity", "BookOpen"],
        ["Templates de Apresentação", "identity", "Presentation"],
        ["Templates de Contrato", "identity", "FileText"],
        ["Assinatura de E-mail", "identity", "Mail"],
        ["Material de Vendas", "identity", "Briefcase"],
        ["Anúncios pagos (Meta/Google)", "web", "Megaphone"],
        ["Comunicados internos & equipe", "internal", "Users"],
      ];
      const rows = defaults.map(([name, category, icon], i) => ({
        account_id: accountId, name, category, icon, sort_order: i + 1,
      }));
      const { error } = await supabase.from("rebranding_channels" as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rebranding-channels"] });
      toast.success("Canais padrão criados");
    },
  });

  const stats = useMemo(() => {
    const total = channels.length;
    const done = channels.filter((c) => c.status === "done").length;
    const inProg = channels.filter((c) => c.status === "in_progress" || c.status === "review").length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const taskDone = tasks.filter((t) => t.status === "done").length;
    return { total, done, inProg, pct, totalTasks: tasks.length, taskDone };
  }, [channels, tasks]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Rebranding Eternum</h1>
            <Badge variant="outline" className="ml-2">Anjos Business → Eternum</Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Mapa visual, tarefas e gestão do projeto de rebranding em todos os canais.
          </p>
        </div>
        {channels.length === 0 && (
          <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" /> Carregar canais padrão
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Canais" value={String(stats.total)} hint="mapeados" />
        <KpiCard label="Concluídos" value={String(stats.done)} hint={`${stats.pct}% do total`} accent="text-emerald-600" />
        <KpiCard label="Em andamento" value={String(stats.inProg)} hint="ativos agora" accent="text-blue-600" />
        <KpiCard label="Tarefas" value={`${stats.taskDone}/${stats.totalTasks}`} hint="executadas" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso geral do rebranding</span>
            <span className="text-sm text-muted-foreground">{stats.pct}%</span>
          </div>
          <Progress value={stats.pct} />
        </CardContent>
      </Card>

      <Tabs defaultValue="map">
        <TabsList>
          <TabsTrigger value="map">Mapa de Canais</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas (Kanban)</TabsTrigger>
          <TabsTrigger value="playbook">Playbook</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="mt-4">
          <ChannelsMap channels={channels} accountId={accountId!} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <TasksKanban tasks={tasks} channels={channels} accountId={accountId!} />
        </TabsContent>

        <TabsContent value="playbook" className="mt-4">
          <Playbook />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase text-muted-foreground tracking-wide">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${accent || ""}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function ChannelsMap({ channels, accountId }: { channels: Channel[]; accountId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Channel | null>(null);
  const [creating, setCreating] = useState(false);

  const byCategory = useMemo(() => {
    const g: Record<string, Channel[]> = {};
    channels.forEach((c) => {
      (g[c.category] = g[c.category] || []).push(c);
    });
    return g;
  }, [channels]);

  const update = useMutation({
    mutationFn: async (patch: Partial<Channel> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("rebranding_channels" as any).update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rebranding-channels"] });
      toast.success("Canal atualizado");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rebranding_channels" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rebranding-channels"] });
      toast.success("Canal removido");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo canal
        </Button>
      </div>

      {Object.entries(byCategory).map(([cat, items]) => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-3">
            <Badge className={CATEGORY_META[cat]?.color || ""} variant="secondary">
              {CATEGORY_META[cat]?.label || cat}
            </Badge>
            <span className="text-sm text-muted-foreground">{items.length} canais</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((ch) => {
              const Icon = ICONS[ch.icon || "Globe"] || Globe;
              const meta = STATUS_META[ch.status];
              return (
                <Card key={ch.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{ch.name}</div>
                          {ch.owner && (
                            <div className="text-xs text-muted-foreground truncate">{ch.owner}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {ch.url && (
                          <a href={ch.url} target="_blank" rel="noreferrer">
                            <Button size="icon" variant="ghost" className="h-7 w-7">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(ch)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <Select
                        value={ch.status}
                        onValueChange={(v) => update.mutate({ id: ch.id, status: v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_META).map(([k, m]) => (
                            <SelectItem key={k} value={k}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Progress value={meta?.progress || 0} className="h-1.5 mt-2" />
                    </div>

                    {ch.notes && (
                      <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{ch.notes}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      <ChannelDialog
        open={creating || !!editing}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        channel={editing}
        accountId={accountId}
        onDelete={editing ? () => { remove.mutate(editing.id); setEditing(null); } : undefined}
      />
    </div>
  );
}

function ChannelDialog({
  open, onOpenChange, channel, accountId, onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  channel: Channel | null;
  accountId: string;
  onDelete?: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Channel>>({});

  useMemo(() => {
    setForm(channel || { category: "social", status: "not_started", icon: "Globe" });
  }, [channel, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (channel) {
        const { error } = await supabase.from("rebranding_channels" as any).update(form).eq("id", channel.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rebranding_channels" as any).insert({ ...form, account_id: accountId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rebranding-channels"] });
      toast.success("Salvo");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{channel ? "Editar canal" : "Novo canal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Nome do canal" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.icon || "Globe"} onValueChange={(v) => setForm({ ...form, icon: v })}>
              <SelectTrigger><SelectValue placeholder="Ícone" /></SelectTrigger>
              <SelectContent>
                {Object.keys(ICONS).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="URL" value={form.url || ""} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <Input placeholder="Responsável" value={form.owner || ""} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          <Textarea placeholder="Notas / pendências" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <DialogFooter className="gap-2">
          {onDelete && <Button variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TasksKanban({ tasks, channels, accountId }: { tasks: Task[]; channels: Channel[]; accountId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: async (patch: Partial<Task> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("rebranding_tasks" as any).update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rebranding-tasks"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rebranding_tasks" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rebranding-tasks"] });
      toast.success("Tarefa removida");
    },
  });

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {TASK_STATUSES.map((s) => {
          const items = tasks.filter((t) => t.status === s.id);
          return (
            <div key={s.id} className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{s.label}</span>
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCreating(s.id)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {items.map((t) => {
                  const ch = channels.find((c) => c.id === t.channel_id);
                  const done = t.checklist.filter((x) => x.done).length;
                  return (
                    <Card
                      key={t.id}
                      className="cursor-pointer hover:shadow-sm"
                      onClick={() => setEditing(t)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm">{t.title}</div>
                          {t.priority === "high" && <Badge variant="destructive" className="text-[10px]">Alta</Badge>}
                        </div>
                        {ch && <div className="text-xs text-muted-foreground mt-1">{ch.name}</div>}
                        {t.assignee && <div className="text-xs text-muted-foreground mt-0.5">{t.assignee}</div>}
                        {t.checklist.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3" />
                            {done}/{t.checklist.length}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog
        open={!!editing || !!creating}
        onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(null); } }}
        task={editing}
        defaultStatus={creating || undefined}
        channels={channels}
        accountId={accountId}
        onDelete={editing ? () => { remove.mutate(editing.id); setEditing(null); } : undefined}
        onStatusChange={(status) => editing && update.mutate({ id: editing.id, status })}
      />
    </div>
  );
}

function TaskDialog({
  open, onOpenChange, task, defaultStatus, channels, accountId, onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Task | null;
  defaultStatus?: string;
  channels: Channel[];
  accountId: string;
  onDelete?: () => void;
  onStatusChange?: (s: string) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Task>>({});
  const [newChk, setNewChk] = useState("");

  useMemo(() => {
    setForm(task || { status: defaultStatus || "todo", priority: "medium", checklist: [] });
    setNewChk("");
  }, [task, defaultStatus, open]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, account_id: accountId };
      if (payload.channel_id === "none") payload.channel_id = null;
      if (task) {
        const { error } = await supabase.from("rebranding_tasks" as any).update(payload).eq("id", task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rebranding_tasks" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rebranding-tasks"] });
      toast.success("Salvo");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const checklist = (form.checklist || []) as { text: string; done: boolean }[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Título" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea placeholder="Descrição" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.channel_id || "none"} onValueChange={(v) => setForm({ ...form, channel_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem canal</SelectItem>
                {channels.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={form.due_date || ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <Input placeholder="Responsável" value={form.assignee || ""} onChange={(e) => setForm({ ...form, assignee: e.target.value })} />

          <div className="space-y-2">
            <div className="text-sm font-medium">Checklist</div>
            {checklist.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Checkbox
                  checked={c.done}
                  onCheckedChange={(v) => {
                    const next = [...checklist];
                    next[i] = { ...c, done: !!v };
                    setForm({ ...form, checklist: next });
                  }}
                />
                <span className={`text-sm flex-1 ${c.done ? "line-through text-muted-foreground" : ""}`}>{c.text}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                  setForm({ ...form, checklist: checklist.filter((_, j) => j !== i) });
                }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar item"
                value={newChk}
                onChange={(e) => setNewChk(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newChk.trim()) {
                    setForm({ ...form, checklist: [...checklist, { text: newChk.trim(), done: false }] });
                    setNewChk("");
                  }
                }}
              />
              <Button size="sm" onClick={() => {
                if (!newChk.trim()) return;
                setForm({ ...form, checklist: [...checklist, { text: newChk.trim(), done: false }] });
                setNewChk("");
              }}>
                Add
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {onDelete && <Button variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Playbook() {
  const phases = [
    {
      title: "1. Estratégia & Identidade",
      items: [
        "Aprovar logo, paleta, tipografia e manual de marca",
        "Definir voz e tom da Eternum (vs. Anjos Business)",
        "Comunicado oficial de rebranding (data D)",
        "Mensagem para clientes ativos (e-mail + WhatsApp)",
      ],
    },
    {
      title: "2. Ativos Digitais",
      items: [
        "Atualizar site: domínio, logo, copy, OG image, favicon",
        "Atualizar redirects do antigo domínio Anjos Business",
        "Trocar avatares, capas e bios de Instagram, LinkedIn, Threads, YouTube, Spotify, TikTok",
        "Renomear @handles (quando possível) e atualizar links na bio",
        "Atualizar perfis pessoais: Everton, Bruna (LinkedIn + Threads)",
      ],
    },
    {
      title: "3. Produtos & Vendas",
      items: [
        "Refazer artes/capas dos produtos com nova identidade",
        "Atualizar templates de contratos, propostas e decks",
        "Atualizar assinaturas de e-mail da equipe",
        "Atualizar materiais de onboarding e pós-venda",
      ],
    },
    {
      title: "4. Lançamento & Comunicação",
      items: [
        "Post de anúncio do rebranding em todos os canais (data unificada)",
        "Vídeo do Everton e Bruna explicando o porquê",
        "Ads pagos pausados na transição e reativados com novo criativo",
        "Atualizar parceiros, fornecedores e integrações externas",
      ],
    },
    {
      title: "5. Pós-lançamento",
      items: [
        "Monitorar menções, dúvidas e SEO da marca antiga",
        "Coletar feedback do mercado nos primeiros 30 dias",
        "Documentar lições aprendidas",
      ],
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {phases.map((p) => (
        <Card key={p.title}>
          <CardHeader><CardTitle className="text-base">{p.title}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {p.items.map((it) => (
                <li key={it} className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
