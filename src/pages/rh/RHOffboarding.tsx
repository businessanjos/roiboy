import { useMemo, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserMinus, Plus, Search, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHROffboardings, OFFBOARDING_STAGE_LABELS, OFFBOARDING_STAGE_COLORS, OFFBOARDING_STAGES, type HROffboarding } from "@/hooks/useHROffboardings";
import { TERMINATION_TYPE_LABELS } from "@/lib/rescissionCalc";
import OffboardingDrawer from "@/components/rh/offboarding/OffboardingDrawer";
import NewOffboardingDialog from "@/components/rh/offboarding/NewOffboardingDialog";

const RH_ALLOWED_EMAILS = ["m.quintana@me.com", "coachevertonsantos@gmail.com", "rh@anjosbusiness.com.br", "diessica@consultoria-luma.com", "jaqueline@consultoria-luma.com"];

export default function RHOffboarding() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { offboardings, loading } = useHROffboardings();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [selected, setSelected] = useState<HROffboarding | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  if (currentUser && !RH_ALLOWED_EMAILS.includes((currentUser.email || "").toLowerCase())) {
    return <Navigate to="/" replace />;
  }

  const filtered = useMemo(() => {
    return offboardings.filter((o) => {
      if (stageFilter !== "all" && o.stage !== stageFilter) return false;
      if (search && !o.collaborator?.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [offboardings, search, stageFilter]);

  const stats = useMemo(() => {
    const active = offboardings.filter((o) => !["completed", "cancelled"].includes(o.stage));
    return {
      total: offboardings.length,
      ativos: active.length,
      mes: offboardings.filter((o) => {
        const d = new Date(o.created_at);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
      repor: offboardings.filter((o) => o.will_replace && !["cancelled"].includes(o.stage)).length,
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
            <p className="text-sm text-muted-foreground">Processo completo: motivo, rescisão, checklist, corte de acessos e entrevista de saída.</p>
          </div>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Novo desligamento</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Em andamento", value: stats.ativos, color: "text-amber-600" },
          { label: "Este mês", value: stats.mes, color: "text-blue-600" },
          { label: "Vagas a repor", value: stats.repor, color: "text-violet-600" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar colaborador..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etapas</SelectItem>
            {OFFBOARDING_STAGES.map((s) => (
              <SelectItem key={s} value={s}>{OFFBOARDING_STAGE_LABELS[s]}</SelectItem>
            ))}
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <UserMinus className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum desligamento {stageFilter !== "all" ? "nesta etapa" : "registrado"}.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const c = o.collaborator;
            const initials = (c?.full_name || "?").split(" ").slice(0,2).map(s=>s[0]).join("").toUpperCase();
            return (
              <Card key={o.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(o)}>
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
