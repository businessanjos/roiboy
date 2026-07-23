import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Telescope,
  Users,
  AlertTriangle,
  MapPin,
  Package,
  DollarSign,
  Clock,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Loader2,
  Info,
  Ruler,
  BarChart3,
  Calendar as CalendarIcon,
  Search as SearchIcon,
  Compass,
  Swords,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import CompetitorsTab from "@/components/marketing/intelligence/CompetitorsTab";
import MarketResearchTab from "@/components/marketing/intelligence/MarketResearchTab";
import { MarketSnapshotCards } from "@/components/marketing/intelligence/MarketSnapshotCards";
import { TamSamSomCards } from "@/components/marketing/intelligence/TamSamSomCards";
import PenetrationTab from "@/components/marketing/intelligence/PenetrationTab";
import EventsTab from "@/components/marketing/intelligence/EventsTab";
import { MiKpiCard } from "@/components/marketing/intelligence/MiKpiCard";
import { MiSectionHeader } from "@/components/marketing/intelligence/MiSectionHeader";
import { MiCallout } from "@/components/marketing/intelligence/MiCallout";

type DistItem = { label: string; count: number; pct: number };
type Distribution = { total: number; items: DistItem[] };

type Profile = {
  headcount: number;
  avgTicket: number;
  medianTicket: number;
  totalValue: number;
  avgTenureDays: number;
  medianTenureDays: number;
  byProduct: Distribution;
  byRegion: Distribution;
  byState: Distribution;
  byCity: Distribution;
  byCountry: Distribution;
  byGender: Distribution;
  byEducation: Distribution;
  bySpecialty: Distribution;
  byTicketBand: Distribution;
  byCancellationReason: Distribution;
};

type RiskSignal = {
  dimension: string;
  label: string;
  activePct: number;
  churnPct: number;
  delta: number;
};

type Analysis = {
  generated_at: string;
  summary: {
    active_clients: number;
    active_contracts?: number;
    on_hold_clients?: number;
    on_hold_contracts?: number;
    churned_clients: number;
    churn_rate: number;
  };
  icp: Profile;
  antiIcp: Profile;
  riskSignals: RiskSignal[];
  coverage: {
    total_clients_sampled: number;
    with_city: number;
    with_state: number;
    with_gender: number;
    with_specialty: number;
    with_revenue: number;
  };
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function DistBar({
  data,
  tone = "primary",
  emptyLabel = "Sem dados suficientes",
}: {
  data: Distribution;
  tone?: "primary" | "success" | "danger";
  emptyLabel?: string;
}) {
  if (!data.items.length) {
    return (
      <p className="text-sm text-muted-foreground italic py-4 text-center">{emptyLabel}</p>
    );
  }
  const barColor =
    tone === "success"
      ? "bg-emerald-500 dark:bg-emerald-400"
      : tone === "danger"
      ? "bg-red-500 dark:bg-red-400"
      : "bg-primary";
  const max = Math.max(...data.items.map((i) => i.pct), 1);
  return (
    <div className="space-y-2.5">
      {data.items.map((i) => (
        <div key={i.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium truncate pr-2">{i.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {i.count} <span className="text-xs">({i.pct}%)</span>
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full transition-all`}
              style={{ width: `${(i.pct / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileGrid({
  profile,
  variant,
}: {
  profile: Profile;
  variant: "icp" | "anti";
}) {
  const distTone = variant === "icp" ? "success" : "danger";
  const kpiTone = variant === "icp" ? "success" : "danger";

  return (
    <>
      <div className="grid gap-3 md:grid-cols-4">
        <MiKpiCard
          icon={Users}
          label="Contratos"
          value={profile.headcount.toString()}
          hint={variant === "icp" ? "status = active" : "encerrados/cancelados"}
          tone={kpiTone}
        />
        <MiKpiCard
          icon={DollarSign}
          label="Ticket médio"
          value={brl(profile.avgTicket)}
          hint={`mediana ${brl(profile.medianTicket)}`}
          tone={kpiTone}
        />
        <MiKpiCard
          icon={DollarSign}
          label="Volume total"
          value={brl(profile.totalValue)}
          tone={kpiTone}
        />
        <MiKpiCard
          icon={Clock}
          label={variant === "icp" ? "Tempo de casa" : "Tempo até saída"}
          value={`${Math.round(profile.avgTenureDays)} dias`}
          hint={`mediana ${Math.round(profile.medianTenureDays)} dias`}
          tone={kpiTone}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <Package className="h-3.5 w-3.5" /> Produto contratado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DistBar data={profile.byProduct} tone={distTone} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" /> Faixa de ticket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DistBar data={profile.byTicketBand} tone={distTone} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Região
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DistBar data={profile.byRegion} tone={distTone} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Estado (top 15)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DistBar data={profile.byState} tone={distTone} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Cidades (top 15)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DistBar data={profile.byCity} tone={distTone} />
          </CardContent>
        </Card>

        {variant === "anti" && profile.byCancellationReason.items.length > 0 && (
          <Card className="lg:col-span-2 border-red-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Motivos de saída
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DistBar data={profile.byCancellationReason} tone="danger" />
            </CardContent>
          </Card>
        )}

        {profile.byGender.items.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Gênero</CardTitle>
            </CardHeader>
            <CardContent>
              <DistBar data={profile.byGender} tone={distTone} />
            </CardContent>
          </Card>
        )}
        {profile.bySpecialty.items.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground">Especialidade</CardTitle>
            </CardHeader>
            <CardContent>
              <DistBar data={profile.bySpecialty} tone={distTone} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

export default function MarketingIntelligence() {
  const { currentUser } = useCurrentUser();
  const [tab, setTab] = useState("market");
  const [baseSubtab, setBaseSubtab] = useState("icp");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["mi-icp-analysis", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("mi-icp-analysis");
      if (error) throw error;
      return data as Analysis;
    },
    enabled: !!currentUser?.account_id,
    staleTime: 5 * 60 * 1000,
  });

  const coveragePct = useMemo(() => {
    if (!data) return 0;
    const t = data.coverage.total_clients_sampled || 1;
    return Math.round((data.coverage.with_state / t) * 100);
  }, [data]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Executive header — compacto */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Telescope className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Market Intelligence</h1>
            <p className="text-muted-foreground text-sm">
              Panorama de mercado, ICP real da base e oportunidades por região
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <p className="text-xs text-muted-foreground">
              Atualizado {new Date(data.generated_at).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
            Recalcular base
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6">
            <p className="text-sm text-red-600">
              Erro ao carregar análise: {(error as Error).message}
            </p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* KPIs executivos — sempre visíveis, no topo */}
          <div className="grid gap-3 md:grid-cols-4">
            <MiKpiCard
              icon={Users}
              label="Clientes ativos"
              value={data.summary.active_clients.toString()}
              hint={`${data.summary.active_contracts ?? data.summary.active_clients} contratos active${data.summary.on_hold_clients ? ` · +${data.summary.on_hold_clients} em hold` : ""}`}
              tone="success"
            />
            <MiKpiCard
              icon={TrendingDown}
              label="Perdidos"
              value={data.summary.churned_clients.toString()}
              hint="clientes que já saíram"
              tone="danger"
            />
            <MiKpiCard
              icon={AlertTriangle}
              label="Churn histórico"
              value={`${data.summary.churn_rate}%`}
              hint="perdidos / (ativos + perdidos)"
              tone="warning"
            />
            <MiKpiCard
              icon={Info}
              label="Cobertura geográfica"
              value={`${coveragePct}%`}
              hint={`${data.coverage.with_state}/${data.coverage.total_clients_sampled} com estado`}
              tone="info"
            />
          </div>

          {/* Navegação principal — 3 categorias narrativas */}
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="grid grid-cols-3 w-full max-w-2xl">
              <TabsTrigger value="market" className="gap-2">
                <Telescope className="h-3.5 w-3.5" /> Mercado
              </TabsTrigger>
              <TabsTrigger value="base" className="gap-2">
                <Users className="h-3.5 w-3.5" /> Nossa Base
              </TabsTrigger>
              <TabsTrigger value="opportunity" className="gap-2">
                <Target className="h-3.5 w-3.5" /> Oportunidade
              </TabsTrigger>
            </TabsList>

            {/* ————— MERCADO: tamanho, snapshot, eventos, pesquisa ————— */}
            <TabsContent value="market" className="space-y-8 mt-6">
              <section>
                <MiSectionHeader
                  icon={Ruler}
                  title="Tamanho do mercado"
                  description="TAM · SAM · SOM do mercado de estética, com base em cenários salvos."
                />
                <TamSamSomCards
                  onOpenDetail={() => setTab("market")}
                  currentMetrics={{
                    activeClients: data.summary.active_clients,
                    avgTicket: data.icp.avgTicket,
                    annualRevenue: data.icp.totalValue,
                    churnRate: data.summary.churn_rate,
                  }}
                />
              </section>

              <section>
                <MiSectionHeader
                  icon={BarChart3}
                  title="Snapshot do setor"
                  description="Indicadores macro coletados nas últimas pesquisas de mercado."
                />
                <MarketSnapshotCards onOpenDetail={() => setTab("market")} />
              </section>

              <section>
                <MiSectionHeader
                  icon={CalendarIcon}
                  title="Eventos do setor"
                  description="Congressos, feiras e encontros relevantes para prospecção e presença."
                />
                <EventsTab />
              </section>

              <section>
                <MiSectionHeader
                  icon={SearchIcon}
                  title="Pesquisa de mercado"
                  description="Perguntas livres à IA e cenários salvos com fontes."
                />
                <MarketResearchTab />
              </section>
            </TabsContent>

            {/* ————— NOSSA BASE: ICP, Anti-ICP, sinais ————— */}
            <TabsContent value="base" className="space-y-4 mt-6">
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="pt-3 pb-3 text-xs text-muted-foreground">
                  <strong className="text-foreground">Régua de contagem:</strong> "Clientes ativos" usa a mesma definição da área de Customer Success — apenas contratos com status <code>active</code>. Contratos <code>paused</code>, <code>suspended</code> e <code>suspended_bonus</code> aparecem como "em hold" e não entram no ICP. Encerrados/cancelados entram no Anti-ICP.
                </CardContent>
              </Card>

              {(data.coverage.with_gender === 0 || data.coverage.with_specialty === 0) && (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="text-xs text-amber-900 dark:text-amber-200">
                        <strong>Baixa cobertura de perfil:</strong> gênero, especialidade e faturamento
                        dos mentorados estão pouco preenchidos. Isso limita a profundidade da análise
                        de ICP. Considere um mutirão de enriquecimento na ficha dos clientes ativos.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Tabs value={baseSubtab} onValueChange={setBaseSubtab}>
                <TabsList>
                  <TabsTrigger value="icp" className="gap-2">
                    <Sparkles className="h-3.5 w-3.5" /> ICP Real
                  </TabsTrigger>
                  <TabsTrigger value="anti" className="gap-2">
                    <TrendingDown className="h-3.5 w-3.5" /> Anti-ICP (Churn)
                  </TabsTrigger>
                  <TabsTrigger value="signals" className="gap-2">
                    <AlertTriangle className="h-3.5 w-3.5" /> Sinais de Risco
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="icp" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Quem realmente performa</CardTitle>
                      <CardDescription>
                        Perfil consolidado dos mentorados que estão hoje na base ativa. Use para calibrar
                        qualificação, segmentação de marketing e roteiros de vendas.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  <ProfileGrid profile={data.icp} variant="icp" />
                </TabsContent>

                <TabsContent value="anti" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Perfil dos que cancelaram</CardTitle>
                      <CardDescription>
                        Retrato dos contratos encerrados, cancelados ou desligados. Use para identificar
                        padrões de risco antes de fechar novos deals parecidos.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  <ProfileGrid profile={data.antiIcp} variant="anti" />
                </TabsContent>

                <TabsContent value="signals" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Onde o churn diverge do ICP</CardTitle>
                      <CardDescription>
                        Diferenças percentuais entre o perfil dos clientes ativos e o dos que saíram.
                        Delta positivo = super-representado no churn (risco). Delta negativo =
                        sub-representado no churn (protetor).
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {data.riskSignals.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Sem sinais estatisticamente relevantes ainda.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {data.riskSignals.map((s, i) => {
                            const risky = s.delta > 0;
                            return (
                              <div
                                key={`${s.dimension}-${s.label}-${i}`}
                                className="flex items-center justify-between p-3 rounded-lg border bg-card"
                              >
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-xs">
                                    {s.dimension}
                                  </Badge>
                                  <span className="font-medium text-sm">{s.label}</span>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                  <span className="text-muted-foreground">
                                    ICP <span className="font-medium text-foreground">{s.activePct}%</span>
                                  </span>
                                  <span className="text-muted-foreground">
                                    Churn <span className="font-medium text-foreground">{s.churnPct}%</span>
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={
                                      risky
                                        ? "bg-red-500/10 text-red-600 border-red-500/30"
                                        : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                    }
                                  >
                                    {risky ? (
                                      <TrendingUp className="h-3 w-3 mr-1" />
                                    ) : (
                                      <TrendingDown className="h-3 w-3 mr-1" />
                                    )}
                                    {risky ? "+" : ""}
                                    {s.delta} pts
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* ————— OPORTUNIDADE: penetração + concorrentes ————— */}
            <TabsContent value="opportunity" className="space-y-8 mt-6">
              <section>
                <MiSectionHeader
                  icon={Compass}
                  title="Penetração por região"
                  description="Onde temos base forte, onde há espaço para crescer."
                />
                <PenetrationTab />
              </section>

              <section>
                <MiSectionHeader
                  icon={Swords}
                  title="Concorrentes"
                  description="Quem disputa o mesmo mentorado, com posicionamento e ticket."
                />
                <CompetitorsTab />
              </section>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
