import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, CartesianGrid,
} from "recharts";
import {
  Activity, DollarSign, Users, Plus, RefreshCw, TrendingUp, Wallet,
  ExternalLink, Pencil, Trash2, Loader2,
} from "lucide-react";

const fmtBRL = (cents: number, currency = "BRL") =>
  ((cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
    maximumFractionDigits: 0,
  });

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  archived: "bg-zinc-500/15 text-zinc-700 border-zinc-500/30",
};

interface TechProject {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  platform: string;
  plan: string | null;
  url: string | null;
  status: string;
  notes: string | null;
  color: string | null;
  monthly_cost_cents: number;
  currency: string;
  stripe_secret_name: string | null;
  stripe_account_id: string | null;
  metrics_endpoint: string | null;
  metrics_token_secret_name: string | null;
  created_at: string;
  updated_at: string;
}

interface Snapshot {
  id: string;
  project_id: string;
  snapshot_date: string;
  mrr_cents: number;
  arr_cents: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  past_due_subscriptions: number;
  new_subscriptions: number;
  churned_subscriptions: number;
  net_new_subscriptions: number;
  revenue_last_30d_cents: number;
  revenue_last_month_cents: number;
  revenue_current_month_cents: number;
  last_month_label: string | null;
  ai_tokens_30d: number;
  ai_messages_30d: number;
  ai_cost_cents_30d: number;
  currency: string;
  source: string;
}

export default function GestaoTech() {
  const { currentUser } = useCurrentUser();
  const { isAdmin } = usePermissions();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TechProject | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const accountId = currentUser?.account_id;

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["tech-projects", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as TechProject[];
    },
    enabled: !!accountId,
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ["tech-snapshots", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_project_snapshots")
        .select("*")
        .order("snapshot_date", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []) as Snapshot[];
    },
    enabled: !!accountId,
  });

  const filteredProjects = useMemo(
    () => (filter === "all" ? projects : projects.filter((p) => p.id === filter)),
    [projects, filter],
  );

  // Latest snapshot per project (any source) — newest wins
  const latestByProject = useMemo(() => {
    const m = new Map<string, Snapshot>();
    for (const s of snapshots) {
      const prev = m.get(s.project_id);
      if (!prev || s.snapshot_date > prev.snapshot_date) m.set(s.project_id, s);
    }
    return m;
  }, [snapshots]);

  const kpis = useMemo(() => {
    let mrr = 0, subs = 0, trial = 0, pastDue = 0;
    let revenue30 = 0, revenueLastMonth = 0, revenueCurrentMonth = 0;
    let cost = 0, newSubs = 0, churned = 0;
    let lastMonthLabel: string | null = null;
    for (const p of filteredProjects) {
      cost += p.monthly_cost_cents || 0;
      const snap = latestByProject.get(p.id);
      if (snap) {
        mrr += snap.mrr_cents;
        subs += snap.active_subscriptions;
        trial += snap.trialing_subscriptions || 0;
        pastDue += snap.past_due_subscriptions || 0;
        revenue30 += snap.revenue_last_30d_cents;
        revenueLastMonth += snap.revenue_last_month_cents || 0;
        revenueCurrentMonth += snap.revenue_current_month_cents || 0;
        newSubs += snap.new_subscriptions || 0;
        churned += snap.churned_subscriptions || 0;
        if (snap.last_month_label) lastMonthLabel = snap.last_month_label;
      }
    }
    return {
      mrr, arr: mrr * 12, subs, trial, pastDue,
      revenue30, revenueLastMonth, revenueCurrentMonth,
      cost, margin: mrr - cost, newSubs, churned,
      netNew: newSubs - churned, lastMonthLabel,
    };
  }, [filteredProjects, latestByProject]);

  // MRR chart series
  const chartData = useMemo(() => {
    const projectIds = new Set(filteredProjects.map((p) => p.id));
    const byDate = new Map<string, number>();
    for (const s of snapshots) {
      if (!projectIds.has(s.project_id)) continue;
      byDate.set(s.snapshot_date, (byDate.get(s.snapshot_date) || 0) + s.mrr_cents);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-60)
      .map(([date, mrr]) => ({ date: date.slice(5), mrr: mrr / 100 }));
  }, [snapshots, filteredProjects]);

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tech_projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projeto removido");
      qc.invalidateQueries({ queryKey: ["tech-projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncProject = async (project: TechProject) => {
    setSyncing(project.id);
    try {
      const fn = project.metrics_endpoint ? "tech-projects-sync" : "tech-stripe-sync";
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { project_id: project.id },
      });
      if (error) throw error;
      if (!(data as { ok?: boolean })?.ok) {
        throw new Error((data as { error?: string })?.error || "Falha ao sincronizar");
      }
      toast.success(`Sincronizado: ${project.name}`);
      qc.invalidateQueries({ queryKey: ["tech-snapshots"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar");
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Gestão Tech
          </h1>
          <p className="text-muted-foreground text-sm">
            Painel centralizado de faturamento, custos e métricas dos seus projetos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtrar projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button
              onClick={() => { setEditing(null); setDialogOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Novo projeto
            </Button>
          )}
        </div>
      </div>

      {/* KPIs principais — finanças */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="MRR" value={fmtBRL(kpis.mrr)} icon={<DollarSign className="h-4 w-4" />} />
        <Kpi label="ARR" value={fmtBRL(kpis.arr)} icon={<TrendingUp className="h-4 w-4" />} />
        <Kpi
          label={`Faturado em ${kpis.lastMonthLabel ?? "mês passado"}`}
          value={fmtBRL(kpis.revenueLastMonth)}
          icon={<DollarSign className="h-4 w-4" />}
          tone="success"
        />
        <Kpi label="Mês atual (parcial)" value={fmtBRL(kpis.revenueCurrentMonth)} icon={<DollarSign className="h-4 w-4" />} />
        <Kpi label="Custo fixo / mês" value={fmtBRL(kpis.cost)} icon={<Wallet className="h-4 w-4" />} tone="warning" />
        <Kpi label="Margem (MRR − custo)" value={fmtBRL(kpis.margin)} tone={kpis.margin >= 0 ? "success" : "danger"} />
      </div>

      {/* KPIs operacionais — base */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Assinantes ativos" value={kpis.subs.toLocaleString("pt-BR")} icon={<Users className="h-4 w-4" />} />
        <Kpi label="Em trial" value={kpis.trial.toLocaleString("pt-BR")} />
        <Kpi label="Inadimplentes" value={kpis.pastDue.toLocaleString("pt-BR")} tone={kpis.pastDue > 0 ? "warning" : undefined} />
        <Kpi label="Novos 30d" value={`+${kpis.newSubs}`} tone="success" />
        <Kpi label="Churn 30d" value={`-${kpis.churned}`} tone={kpis.churned > 0 ? "danger" : undefined} />
        <Kpi label="Net new 30d" value={`${kpis.netNew >= 0 ? "+" : ""}${kpis.netNew}`} tone={kpis.netNew >= 0 ? "success" : "danger"} />
      </div>

      {/* MRR Chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">MRR ao longo do tempo</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`} />
                <ReTooltip
                  formatter={(v: number) =>
                    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  }
                />
                <Line type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Projects table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Projetos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              Nenhum projeto cadastrado. {isAdmin && "Clique em \"Novo projeto\"."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead className="text-right">Ativos</TableHead>
                  <TableHead className="text-right">Novos 30d</TableHead>
                  <TableHead className="text-right">Churn 30d</TableHead>
                  <TableHead className="text-right">ARPU</TableHead>
                  <TableHead className="text-right">Receita 30d</TableHead>
                  <TableHead className="text-right">Tokens 30d</TableHead>
                  <TableHead className="text-right">Custo IA 30d</TableHead>
                  <TableHead className="text-right">Custo fixo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((p) => {
                  const snap = latestByProject.get(p.id);
                  const arpu = snap && snap.active_subscriptions > 0
                    ? snap.mrr_cents / snap.active_subscriptions
                    : 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color || "#6366f1" }} />
                          <span className="font-medium">{p.name}</span>
                          {p.url && (
                            <a href={p.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        {p.plan && <p className="text-xs text-muted-foreground mt-0.5">{p.plan}</p>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{p.platform}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[p.status] || ""}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{snap ? fmtBRL(snap.mrr_cents, snap.currency) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{snap ? snap.active_subscriptions : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">{snap ? `+${snap.new_subscriptions}` : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-red-600">{snap ? `-${snap.churned_subscriptions}` : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{snap && arpu > 0 ? fmtBRL(arpu, snap.currency) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{snap ? fmtBRL(snap.revenue_last_30d_cents, snap.currency) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {snap?.ai_tokens_30d ? (snap.ai_tokens_30d / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + "k" : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{snap ? fmtBRL(snap.ai_cost_cents_30d, snap.currency) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtBRL(p.monthly_cost_cents, p.currency)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => syncProject(p)} disabled={syncing === p.id} title="Sincronizar">
                            {syncing === p.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <RefreshCw className="h-3.5 w-3.5" />}
                          </Button>
                          {isAdmin && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                                if (confirm(`Remover "${p.name}"?`)) deleteProject.mutate(p.id);
                              }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

          )}
        </CardContent>
      </Card>

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        accountId={accountId}
        userId={currentUser?.id}
        onSaved={() => qc.invalidateQueries({ queryKey: ["tech-projects"] })}
      />
    </div>
  );
}

function Kpi({
  label, value, icon, tone = "default",
}: { label: string; value: string; icon?: React.ReactNode; tone?: "default" | "success" | "warning" | "danger" }) {
  const toneClass = {
    default: "",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-red-600",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <p className={`text-xl font-semibold mt-1 ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ProjectDialog({
  open, onOpenChange, editing, accountId, userId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: TechProject | null;
  accountId: string | undefined;
  userId: string | undefined;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<TechProject>>({});
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (open) {
      setForm(
        editing || {
          name: "",
          slug: "",
          platform: "Lovable",
          plan: "",
          url: "",
          status: "active",
          notes: "",
          color: "#6366f1",
          monthly_cost_cents: 0,
          currency: "BRL",
          stripe_secret_name: "",
        },
      );
    }
  }, [open, editing]);

  const save = async () => {
    if (!accountId) return;
    if (!form.name || !form.slug) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        account_id: accountId,
        name: form.name,
        slug: form.slug,
        platform: form.platform || "Lovable",
        plan: form.plan || null,
        url: form.url || null,
        status: form.status || "active",
        notes: form.notes || null,
        color: form.color || "#6366f1",
        monthly_cost_cents: Math.round(Number(form.monthly_cost_cents) || 0),
        currency: form.currency || "BRL",
        stripe_secret_name: form.stripe_secret_name || null,
        metrics_endpoint: form.metrics_endpoint || null,
        metrics_token_secret_name: form.metrics_token_secret_name || null,
      };
      if (editing) {
        const { error } = await supabase.from("tech_projects").update(payload as never).eq("id", editing.id);
        if (error) throw error;
        toast.success("Projeto atualizado");
      } else {
        payload.created_by = userId;
        const { error } = await supabase.from("tech_projects").insert(payload as never);
        if (error) throw error;
        toast.success("Projeto criado");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar projeto" : "Novo projeto"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Slug (único) *</Label>
            <Input value={form.slug || ""} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
          </div>
          <div>
            <Label>Plataforma</Label>
            <Input value={form.platform || ""} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Lovable, Vercel, Bubble..." />
          </div>
          <div>
            <Label>Plano</Label>
            <Input value={form.plan || ""} onChange={(e) => setForm({ ...form, plan: e.target.value })} placeholder="Pro, Business..." />
          </div>
          <div>
            <Label>URL</Label>
            <Input value={form.url || ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status || "active"} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Custo fixo / mês (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={((form.monthly_cost_cents || 0) / 100).toString()}
              onChange={(e) => setForm({ ...form, monthly_cost_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
            />
          </div>
          <div>
            <Label>Moeda</Label>
            <Input value={form.currency || "BRL"} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <Label>Cor</Label>
            <Input type="color" value={form.color || "#6366f1"} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Metrics endpoint (edge function roy-metrics do projeto)</Label>
            <Input
              value={form.metrics_endpoint || ""}
              onChange={(e) => setForm({ ...form, metrics_endpoint: e.target.value })}
              placeholder="https://<ref>.supabase.co/functions/v1/roy-metrics"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Quando preenchido, ROY puxa métricas direto do projeto em vez do Stripe.
            </p>
          </div>
          <div>
            <Label>Token secret name (ROY)</Label>
            <Input
              value={form.metrics_token_secret_name || ""}
              onChange={(e) => setForm({ ...form, metrics_token_secret_name: e.target.value })}
              placeholder="ROY_METRICS_TOKEN"
            />
          </div>
          <div>
            <Label>Stripe secret name (fallback)</Label>
            <Input
              value={form.stripe_secret_name || ""}
              onChange={(e) => setForm({ ...form, stripe_secret_name: e.target.value })}
              placeholder="STRIPE_SECRET_KEY"
            />
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
