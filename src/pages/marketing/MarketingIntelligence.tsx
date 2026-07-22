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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import CompetitorsTab from "@/components/marketing/intelligence/CompetitorsTab";
import MarketResearchTab from "@/components/marketing/intelligence/MarketResearchTab";
import { MarketSnapshotCards } from "@/components/marketing/intelligence/MarketSnapshotCards";
import { TamSamSomCards } from "@/components/marketing/intelligence/TamSamSomCards";
import { Swords, Search as SearchIcon, Target } from "lucide-react";
import PenetrationTab from "@/components/marketing/intelligence/PenetrationTab";

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
  color = "bg-primary",
  emptyLabel = "Sem dados suficientes",
}: {
  data: Distribution;
  color?: string;
  emptyLabel?: string;
}) {
  if (!data.items.length) {
    return (
      <p className="text-sm text-muted-foreground italic py-4 text-center">{emptyLabel}</p>
    );
  }
  const max = Math.max(...data.items.map((i) => i.pct), 1);
  return (
    <div className="space-y-2">
      {data.items.map((i) => (
        <div key={i.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium truncate pr-2">{i.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {i.count} <span className="text-xs">({i.pct}%)</span>
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${color} rounded-full transition-all`}
              style={{ width: `${(i.pct / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "text-primary",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <Icon className={`h-5 w-5 ${accent}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileGrid({
  profile,
  variant,
}: {
  profile: Profile;
  variant: "icp" | "anti";
}) {
  const color = variant === "icp" ? "bg-emerald-500" : "bg-red-500";
  const iconColor = variant === "icp" ? "text-emerald-600" : "text-red-600";

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={Users}
          label="Contratos"
          value={profile.headcount.toString()}
          hint={variant === "icp" ? "status = active" : "encerrados/cancelados"}
          accent={iconColor}
        />
        <StatCard
          icon={DollarSign}
          label="Ticket médio"
          value={brl(profile.avgTicket)}
          hint={`mediana ${brl(profile.medianTicket)}`}
          accent={iconColor}
        />
        <StatCard
          icon={DollarSign}
          label="Volume total"
          value={brl(profile.totalValue)}
          accent={iconColor}
        />
        <StatCard
          icon={Clock}
          label={variant === "icp" ? "Tempo de casa" : "Tempo até saída"}
          value={`${Math.round(profile.avgTenureDays)} dias`}
          hint={`mediana ${Math.round(profile.medianTenureDays)} dias`}
          accent={iconColor}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className={`h-4 w-4 ${iconColor}`} /> Produto contratado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DistBar data={profile.byProduct} color={color} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className={`h-4 w-4 ${iconColor}`} /> Faixa de ticket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DistBar data={profile.byTicketBand} color={color} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className={`h-4 w-4 ${iconColor}`} /> Região
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DistBar data={profile.byRegion} color={color} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className={`h-4 w-4 ${iconColor}`} /> Estado (top 15)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DistBar data={profile.byState} color={color} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className={`h-4 w-4 ${iconColor}`} /> Cidades (top 15)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DistBar data={profile.byCity} color={color} />
          </CardContent>
        </Card>

        {variant === "anti" && profile.byCancellationReason.items.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" /> Motivos de saída
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DistBar data={profile.byCancellationReason} color="bg-red-500" />
            </CardContent>
          </Card>
        )}

        {(profile.byGender.items.length > 0 ||
          profile.bySpecialty.items.length > 0 ||
          profile.byEducation.items.length > 0) && (
          <>
            {profile.byGender.items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gênero</CardTitle>
                </CardHeader>
                <CardContent>
                  <DistBar data={profile.byGender} color={color} />
                </CardContent>
              </Card>
            )}
            {profile.bySpecialty.items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Especialidade</CardTitle>
                </CardHeader>
                <CardContent>
                  <DistBar data={profile.bySpecialty} color={color} />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function MarketingIntelligence() {
  const { currentUser } = useCurrentUser();
  const [tab, setTab] = useState("icp");

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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Telescope className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Market Intelligence</h1>
            <p className="text-muted-foreground text-sm">
              Fase 1 · Inteligência sobre a base de mentorados: ICP real x Anti-ICP
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
          Recalcular
        </Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-3">
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
          <TamSamSomCards
            onOpenDetail={() => setTab("research")}
            currentMetrics={{
              activeClients: data.summary.active_clients,
              avgTicket: data.icp.avgTicket,
              annualRevenue: data.icp.totalValue,
              churnRate: data.summary.churn_rate,
            }}
          />
          <MarketSnapshotCards onOpenDetail={() => setTab("research")} />

          <div className="grid gap-4 md:grid-cols-4">

            <StatCard
              icon={Users}
              label="Clientes ativos"
              value={data.summary.active_clients.toString()}
              hint={`${data.summary.active_contracts ?? data.summary.active_clients} contratos active${data.summary.on_hold_clients ? ` · +${data.summary.on_hold_clients} em hold` : ""}`}
              accent="text-emerald-600"
            />
            <StatCard
              icon={TrendingDown}
              label="Perdidos"
              value={data.summary.churned_clients.toString()}
              hint="clientes que já saíram"
              accent="text-red-600"
            />
            <StatCard
              icon={AlertTriangle}
              label="Taxa de churn histórica"
              value={`${data.summary.churn_rate}%`}
              hint="perdidos / (ativos + perdidos)"
              accent="text-amber-600"
            />
            <StatCard
              icon={Info}
              label="Cobertura geográfica"
              value={`${coveragePct}%`}
              hint={`${data.coverage.with_state}/${data.coverage.total_clients_sampled} com estado`}
              accent="text-blue-600"
            />
          </div>

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

          <Tabs value={tab} onValueChange={setTab}>
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
              <TabsTrigger value="competitors" className="gap-2">
                <Swords className="h-3.5 w-3.5" /> Concorrentes
              </TabsTrigger>
              <TabsTrigger value="penetration" className="gap-2">
                <Target className="h-3.5 w-3.5" /> Penetração
              </TabsTrigger>
              <TabsTrigger value="research" className="gap-2">
                <SearchIcon className="h-3.5 w-3.5" /> Pesquisa de mercado
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

            <TabsContent value="competitors" className="space-y-4 mt-6">
              <CompetitorsTab />
            </TabsContent>

            <TabsContent value="penetration" className="space-y-4 mt-6">
              <PenetrationTab />
            </TabsContent>

            <TabsContent value="research" className="space-y-4 mt-6">
              <MarketResearchTab />
            </TabsContent>
          </Tabs>


          <p className="text-xs text-muted-foreground text-right">
            Atualizado em{" "}
            {new Date(data.generated_at).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        </>
      )}
    </div>
  );
}
