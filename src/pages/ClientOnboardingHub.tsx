import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingScreen } from "@/components/ui/loading-screen";
import {
  Rocket, Search, Sparkles, Users, AlertCircle, RefreshCw, Settings2,
  Brain, Activity, AlertTriangle, Timer, TrendingUp, Play, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { OnboardingOrchestrated } from "@/components/client/OnboardingOrchestrated";
import { StageChecklistEditor } from "@/components/client/StageChecklistEditor";
import { ClientOnboardingDrawer } from "@/components/client/ClientOnboardingDrawer";
import { useOnboardingHub, computeHealth, daysInStage, OnboardingClient } from "@/hooks/useOnboardingHub";

export default function ClientOnboardingHub() {
  const { stages, clients, loading, summary, moveClient, refetch } = useOnboardingHub();
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [drawerClient, setDrawerClient] = useState<OnboardingClient | null>(null);
  const accountId = stages[0] && (stages[0] as any).account_id; // not exposed; ignore

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      c.full_name?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q) ||
      c.phone_e164?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  // Health por etapa para o dashboard
  const stageHealth = useMemo(() => {
    return stages
      .filter(s => s.display_order < 9)
      .map(stage => {
        const inStage = clients.filter(c => c.stage_id === stage.id);
        let onTrack = 0, atRisk = 0, overdue = 0;
        const daysList: number[] = [];
        for (const c of inStage) {
          const h = computeHealth(c.stage_changed_at, stage.sla_hours);
          if (h === "on_track" || h === "no_sla") onTrack++;
          else if (h === "at_risk") atRisk++;
          else if (h === "overdue") overdue++;
          daysList.push(daysInStage(c.stage_changed_at));
        }
        const avgDays = daysList.length ? Math.round(daysList.reduce((a, b) => a + b, 0) / daysList.length) : 0;
        return { stage, total: inStage.length, onTrack, atRisk, overdue, avgDays };
      });
  }, [stages, clients]);

  const stageById = useMemo(() => new Map(stages.map(s => [s.id, s])), [stages]);

  if (loading && clients.length === 0) return <LoadingScreen />;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 p-2.5 border border-primary/20">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              Onboarding Hub
              <Badge variant="outline" className="gap-1 text-[10px] font-medium">
                <Brain className="h-3 w-3" /> IA
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Cockpit operacional inteligente — SLA por etapa, alertas de gargalo por cliente.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" /> Configurar Etapas
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          icon={Sparkles}
          value={summary.newCount}
          label="Aguardando início"
          tone={summary.newCount > 0 ? "amber" : "muted"}
          accent
        />
        <KpiCard icon={Users} value={summary.inProgress} label="Em andamento" tone="blue" />
        <KpiCard icon={AlertTriangle} value={summary.overdue} label="Atrasados" tone={summary.overdue > 0 ? "red" : "muted"} />
        <KpiCard icon={Activity} value={summary.atRisk} label="Em risco" tone={summary.atRisk > 0 ? "amber" : "muted"} />
        <KpiCard icon={Timer} value={`${summary.avgDays}d`} label="Tempo médio" tone="emerald" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Saúde por etapa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, empresa ou telefone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Lista enriquecida com botão Coach IA */}
          <SmartClientList clients={filtered} stageById={stageById} onOpenCoach={setDrawerClient} />

          {/* Orquestrador completo (mantido para gerenciar checklist) */}
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              Visão completa do orquestrador (checklist por etapa)
            </summary>
            <div className="mt-4">
              {accountId && (
                <OnboardingOrchestrated
                  clients={filtered as any}
                  stages={stages as any}
                  accountId={accountId as any}
                  onStageChange={async (id, sid) => moveClient(id, sid)}
                  onRefreshStages={refetch}
                />
              )}
            </div>
          </details>
        </TabsContent>

        <TabsContent value="health" className="space-y-3">
          {stageHealth.map(({ stage, total, onTrack, atRisk, overdue, avgDays }) => {
            const totalSafe = Math.max(total, 1);
            return (
              <Card key={stage.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color || "#94a3b8" }}
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{stage.name}</div>
                        {stage.description && (
                          <div className="text-xs text-muted-foreground truncate">{stage.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs whitespace-nowrap">
                      <span className="text-muted-foreground">{total} clientes</span>
                      {stage.sla_hours && (
                        <Badge variant="outline" className="text-[10px]">
                          SLA {stage.sla_hours}h
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        Média {avgDays}d
                      </Badge>
                    </div>
                  </div>
                  {/* Stacked bar */}
                  <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                    <div className="bg-emerald-500" style={{ width: `${(onTrack / totalSafe) * 100}%` }} />
                    <div className="bg-amber-500" style={{ width: `${(atRisk / totalSafe) * 100}%` }} />
                    <div className="bg-red-500" style={{ width: `${(overdue / totalSafe) * 100}%` }} />
                  </div>
                  <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
                    <span><span className="text-emerald-600 font-medium">●</span> {onTrack} no prazo</span>
                    <span><span className="text-amber-600 font-medium">●</span> {atRisk} em risco</span>
                    <span><span className="text-red-600 font-medium">●</span> {overdue} atrasados</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      <ClientOnboardingDrawer
        client={drawerClient}
        stage={drawerClient?.stage_id ? stageById.get(drawerClient.stage_id) ?? null : null}
        open={!!drawerClient}
        onOpenChange={(o) => !o && setDrawerClient(null)}
      />

      <StageChecklistEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        stages={stages as any}
        accountId={(accountId as any) || ""}
        onRefresh={refetch}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon, value, label, tone, accent,
}: {
  icon: any; value: number | string; label: string;
  tone: "amber" | "blue" | "red" | "emerald" | "muted";
  accent?: boolean;
}) {
  const tones = {
    amber: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
    blue: "bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400",
    red: "bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400",
    emerald: "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className={accent && tone !== "muted" ? "border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10" : ""}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`rounded-lg p-2 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function SmartClientList({
  clients, stageById, onOpenCoach,
}: {
  clients: OnboardingClient[];
  stageById: Map<string, any>;
  onOpenCoach: (c: OnboardingClient) => void;
}) {
  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum cliente em onboarding.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-2">
      {clients.slice(0, 50).map(c => {
        const stage = c.stage_id ? stageById.get(c.stage_id) : null;
        const health = computeHealth(c.stage_changed_at, stage?.sla_hours ?? null);
        const days = daysInStage(c.stage_changed_at);
        const product = c.client_products?.[0]?.products;
        const healthColor = health === "overdue" ? "border-l-red-500"
          : health === "at_risk" ? "border-l-amber-500"
          : health === "on_track" ? "border-l-emerald-500"
          : "border-l-muted-foreground/30";
        return (
          <Card key={c.id} className={`border-l-4 ${healthColor}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{c.full_name}</span>
                  {product && (
                    <Badge
                      variant="outline"
                      style={{
                        backgroundColor: `${product.color || "#6b7280"}20`,
                        color: product.color || "#6b7280",
                        borderColor: `${product.color || "#6b7280"}40`,
                      }}
                      className="text-[10px]"
                    >
                      {product.name}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{stage?.name || "Sem etapa"}</span>
                  <span>•</span>
                  <span className={
                    health === "overdue" ? "text-red-600 font-medium"
                    : health === "at_risk" ? "text-amber-600 font-medium"
                    : ""
                  }>
                    {days}d na etapa
                  </span>
                  {c.ai_next_step && <Badge variant="outline" className="text-[9px] gap-0.5"><Brain className="h-2.5 w-2.5" />IA</Badge>}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => onOpenCoach(c)} className="gap-1.5">
                <Brain className="h-3.5 w-3.5" /> Coach
              </Button>
            </CardContent>
          </Card>
        );
      })}
      {clients.length > 50 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Mostrando os 50 mais críticos. Use a busca para refinar.
        </p>
      )}
    </div>
  );
}
