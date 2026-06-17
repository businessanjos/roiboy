import { useMemo, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UserMinus, Plus, Search, Briefcase, List, LayoutGrid, DollarSign, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHROffboardings, OFFBOARDING_STAGE_LABELS, OFFBOARDING_STAGE_COLORS, OFFBOARDING_STAGES, type HROffboarding } from "@/hooks/useHROffboardings";
import { TERMINATION_TYPE_LABELS } from "@/lib/rescissionCalc";
import OffboardingDrawer from "@/components/rh/offboarding/OffboardingDrawer";
import NewOffboardingDialog from "@/components/rh/offboarding/NewOffboardingDialog";

const RH_ALLOWED_EMAILS = ["m.quintana@me.com", "coachevertonsantos@gmail.com", "rh@anjosbusiness.com.br", "diessica@consultoria-luma.com", "jaqueline@consultoria-luma.com"];

const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

export default function RHOffboarding() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { offboardings, loading } = useHROffboardings();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "kanban">("list");
  const [selected, setSelected] = useState<HROffboarding | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  if (currentUser && !RH_ALLOWED_EMAILS.includes((currentUser.email || "").toLowerCase())) {
    return <Navigate to="/" replace />;
  }

  const filtered = useMemo(() => {
    const now = new Date();
    return offboardings.filter((o) => {
      if (stageFilter !== "all" && o.stage !== stageFilter) return false;
      if (typeFilter !== "all" && o.termination_type !== typeFilter) return false;
      if (search && !o.collaborator?.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (periodFilter !== "all") {
        const days = differenceInDays(now, new Date(o.created_at));
        if (periodFilter === "30" && days > 30) return false;
        if (periodFilter === "90" && days > 90) return false;
        if (periodFilter === "365" && days > 365) return false;
      }
      return true;
    });
  }, [offboardings, search, stageFilter, typeFilter, periodFilter]);

  const stats = useMemo(() => {
    const active = offboardings.filter((o) => !["completed", "cancelled"].includes(o.stage));
    const completedInMonth = offboardings.filter((o) => {
      if (o.stage !== "completed" || !o.completed_at) return false;
      const d = new Date(o.completed_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalCostMonth = completedInMonth.reduce((s, o) => s + ((o.rescission_calc as any)?.result?.net || 0), 0);
    const avgDays = completedInMonth.length
      ? Math.round(
          completedInMonth.reduce((s, o) => s + (o.completed_at ? differenceInDays(new Date(o.completed_at), new Date(o.created_at)) : 0), 0) /
            completedInMonth.length
        )
      : 0;
    return {
      total: offboardings.length,
      ativos: active.length,
      mes: offboardings.filter((o) => {
        const d = new Date(o.created_at);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
      repor: offboardings.filter((o) => o.will_replace && o.stage !== "cancelled").length,
      totalCostMonth,
      avgDays,
    };
  }, [offboardings]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10">
            <UserMinus className="h-7 w-7 text-rose-600" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Desligamentos</h1>
            <p className="text-sm text-muted-foreground">Motivo, rescisão CLT, checklist, anexos, corte de acessos, entrevista e auditoria.</p>
          </div>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Novo desligamento</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Em andamento" value={stats.ativos} color="text-amber-600" />
        <StatCard label="Este mês" value={stats.mes} color="text-blue-600" />
        <StatCard label="Vagas a repor" value={stats.repor} color="text-violet-600" />
        <StatCard label="Custo do mês" value={fmtBRL(stats.totalCostMonth)} color="text-rose-600" icon={<DollarSign className="h-3 w-3" />} small />
        <StatCard label="Tempo médio" value={stats.avgDays ? `${stats.avgDays}d` : "—"} color="text-emerald-600" icon={<Clock className="h-3 w-3" />} small />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar colaborador..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etapas</SelectItem>
            {OFFBOARDING_STAGES.map((s) => (
              <SelectItem key={s} value={s}>{OFFBOARDING_STAGE_LABELS[s]}</SelectItem>
            ))}
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TERMINATION_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="30">Últimos 30d</SelectItem>
            <SelectItem value="90">Últimos 90d</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
        <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as any)}>
          <ToggleGroupItem value="list" className="h-9"><List className="h-4 w-4" /></ToggleGroupItem>
          <ToggleGroupItem value="kanban" className="h-9"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* List or Kanban */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <UserMinus className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum desligamento {stageFilter !== "all" ? "nesta etapa" : "registrado"}.</p>
        </CardContent></Card>
      ) : view === "list" ? (
        <div className="space-y-2">
          {filtered.map((o) => <OffboardingRow key={o.id} o={o} onClick={() => setSelected(o)} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {OFFBOARDING_STAGES.map((stg) => {
            const items = filtered.filter(o => o.stage === stg);
            return (
              <div key={stg} className="space-y-2">
                <div className="flex items-center justify-between sticky top-0 bg-background z-10 py-1">
                  <p className="text-xs font-semibold">{OFFBOARDING_STAGE_LABELS[stg]}</p>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                {items.map(o => (
                  <Card key={o.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(o)}>
                    <CardContent className="p-2.5">
                      <p className="text-xs font-medium truncate">{o.collaborator?.full_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{o.collaborator?.position || TERMINATION_TYPE_LABELS[o.termination_type]}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <NewOffboardingDialog open={newOpen} onOpenChange={setNewOpen} onCreated={(o) => { setNewOpen(false); setSelected(o); }} />
      {selected && (
        <OffboardingDrawer
          offboarding={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color = "text-foreground", icon, small }: { label: string; value: any; color?: string; icon?: any; small?: boolean }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`${small ? "text-lg" : "text-2xl"} font-semibold ${color}`}>{value}</p>
    </CardContent></Card>
  );
}

function OffboardingRow({ o, onClick }: { o: HROffboarding; onClick: () => void }) {
  const c = o.collaborator;
  const initials = (c?.full_name || "?").split(" ").slice(0,2).map(s=>s[0]).join("").toUpperCase();
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4 flex items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={c?.avatar_url || undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{c?.full_name || "Colaborador"}</p>
            <Badge variant="outline" className={`text-[10px] ${OFFBOARDING_STAGE_COLORS[o.stage]}`}>
              {OFFBOARDING_STAGE_LABELS[o.stage]}
            </Badge>
            {o.will_replace && (
              <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-700 border-violet-200">
                <Briefcase className="h-3 w-3 mr-1" /> Repor vaga
              </Badge>
            )}
            {o.exit_interview_submitted_at && (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
                Entrevista respondida
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {c?.position || "—"} · {TERMINATION_TYPE_LABELS[o.termination_type]}
            {o.termination_date && ` · Saída ${format(new Date(o.termination_date + "T00:00:00"), "dd MMM yyyy", { locale: ptBR })}`}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          Aberto em {format(new Date(o.created_at), "dd/MM/yyyy", { locale: ptBR })}
        </div>
      </CardContent>
    </Card>
  );
}
