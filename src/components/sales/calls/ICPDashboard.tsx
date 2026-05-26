import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Crown, MapPin, Building2, TrendingUp, Users, Target, Briefcase, Loader2,
  Stethoscope, Sparkles, AlertCircle, ShieldCheck, DollarSign, RefreshCw,
} from 'lucide-react';
type IcpSignals = {
  profession?: string | null;
  specialty?: string | null;
  niche_combined?: string | null;
  business_model?: string | null;
  team_size?: string | null;
  revenue_range?: string | null;
  ticket_range?: string | null;
  decision_role?: string | null;
  main_pains?: string[];
  main_objections?: string[];
  triggers_that_worked?: string[];
  city?: string | null;
  state?: string | null;
  age_estimate?: string | null;
};

interface ICPData {
  totalSuccess: number;
  totalFailure: number;
  withSignals: number;
  professions: Record<string, number>;
  specialties: Record<string, number>;
  niches: Record<string, number>;
  businessModels: Record<string, number>;
  ticketRanges: Record<string, number>;
  revenueRanges: Record<string, number>;
  decisionRoles: Record<string, number>;
  pains: Record<string, number>;
  objections: Record<string, number>;
  triggers: Record<string, number>;
  cities: Record<string, number>;
  states: Record<string, number>;
}

function inc(map: Record<string, number>, key?: string | null) {
  if (!key) return;
  const k = key.trim();
  if (!k) return;
  map[k] = (map[k] || 0) + 1;
}

function TopItems({ data, empty }: { data: Record<string, number>; empty?: string }) {
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = sorted[0]?.[1] || 1;
  if (sorted.length === 0) return <p className="text-xs text-muted-foreground">{empty ?? 'Sem dados suficientes'}</p>;
  return (
    <div className="space-y-2">
      {sorted.map(([name, count]) => (
        <div key={name} className="space-y-1">
          <div className="flex items-center justify-between text-sm gap-2">
            <span className="truncate">{name}</span>
            <Badge variant="secondary" className="text-xs ml-2 shrink-0">{count}</Badge>
          </div>
          <Progress value={(count / max) * 100} className="h-1.5" />
        </div>
      ))}
    </div>
  );
}

export function ICPDashboard() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();
  const autoRanRef = useRef(false);
  const [autoRunning, setAutoRunning] = useState(false);

  async function runBackfillLoop(onlyChampions: boolean) {
    setAutoRunning(true);
    try {
      let totalOk = 0, totalFailed = 0, rounds = 0;
      // Loop até o backend dizer que não tem mais pendentes (ou 6 voltas no máx)
      // — cada chamada processa até 80 calls em paralelo.
      while (rounds < 6) {
        rounds++;
        const { data, error } = await supabase.functions.invoke('backfill-icp-signals', {
          body: { account_id: accountId, only_champions: onlyChampions, limit: 80 },
        });
        if (error) throw error;
        if (data?.error && !data?.processed) throw new Error(data.error);
        totalOk += data?.ok || 0;
        totalFailed += data?.failed || 0;
        queryClient.invalidateQueries({ queryKey: ['icp-dashboard-v2'] });
        if (!data?.remaining) break;
      }
      if (totalOk > 0) toast.success(`ICP extraído em ${totalOk} call(s)${totalFailed ? ` (${totalFailed} falharam)` : ''}.`);
      else if (totalFailed > 0) toast.error(`Não foi possível extrair ICP de ${totalFailed} call(s).`);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao reanalisar ICP');
    } finally {
      setAutoRunning(false);
    }
  }

  const backfillMutation = useMutation({
    mutationFn: () => runBackfillLoop(false),
  });



  const { data: icpData, isLoading } = useQuery({
    queryKey: ['icp-dashboard-v2', accountId],
    queryFn: async (): Promise<ICPData> => {
      const { data: analyses, error } = await supabase
        .from('sales_call_analyses')
        .select('call_outcome, icp_signals, client:clients!sales_call_analyses_client_id_fkey(city, state)')
        .eq('account_id', accountId!);
      if (error) throw error;

      const result: ICPData = {
        totalSuccess: 0, totalFailure: 0, withSignals: 0,
        professions: {}, specialties: {}, niches: {}, businessModels: {},
        ticketRanges: {}, revenueRanges: {}, decisionRoles: {},
        pains: {}, objections: {}, triggers: {},
        cities: {}, states: {},
      };

      for (const a of (analyses || [])) {
        if (a.call_outcome === 'success') result.totalSuccess++;
        else if (a.call_outcome === 'failure') result.totalFailure++;
        if (a.call_outcome !== 'success') continue;

        const sig = (a.icp_signals as IcpSignals | null) || null;
        if (sig) result.withSignals++;
        const client = a.client as any;

        inc(result.professions, sig?.profession);
        inc(result.specialties, sig?.specialty);
        inc(result.niches, sig?.niche_combined);
        inc(result.businessModels, sig?.business_model);
        inc(result.ticketRanges, sig?.ticket_range);
        inc(result.revenueRanges, sig?.revenue_range);
        inc(result.decisionRoles, sig?.decision_role);
        (sig?.main_pains || []).forEach(p => inc(result.pains, p));
        (sig?.main_objections || []).forEach(o => inc(result.objections, o));
        (sig?.triggers_that_worked || []).forEach(t => inc(result.triggers, t));
        inc(result.cities, sig?.city || client?.city);
        inc(result.states, sig?.state || client?.state);
      }
      return result;
    },
    enabled: !!accountId,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!icpData || icpData.totalSuccess === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Sem dados de ICP</h3>
          <p className="text-sm text-muted-foreground">Marque calls como "Campeã" para que a IA extraia o perfil ideal automaticamente.</p>
        </CardContent>
      </Card>
    );
  }

  const conversionRate = icpData.totalSuccess + icpData.totalFailure > 0
    ? Math.round((icpData.totalSuccess / (icpData.totalSuccess + icpData.totalFailure)) * 100)
    : 0;
  const signalsCoverage = icpData.totalSuccess > 0
    ? Math.round((icpData.withSignals / icpData.totalSuccess) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <Crown className="w-6 h-6 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{icpData.totalSuccess}</p>
          <p className="text-xs text-muted-foreground">Calls Campeãs</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <TrendingUp className="w-6 h-6 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{conversionRate}%</p>
          <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Sparkles className="w-6 h-6 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{signalsCoverage}%</p>
          <p className="text-xs text-muted-foreground">Cobertura ICP (IA)</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Building2 className="w-6 h-6 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{Object.keys(icpData.niches).length}</p>
          <p className="text-xs text-muted-foreground">Nichos distintos</p>
        </CardContent></Card>
      </div>

      {signalsCoverage < 100 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-3 flex items-center gap-3 text-xs flex-wrap">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-muted-foreground flex-1 min-w-[220px]">
              <span className="font-semibold text-foreground">{icpData.withSignals}/{icpData.totalSuccess}</span> calls campeãs com sinais ICP extraídos.
              {signalsCoverage < 100 && ' Reanalise para preencher os nichos das calls antigas.'}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => backfillMutation.mutate()}
              disabled={backfillMutation.isPending}
              className="gap-1.5"
            >
              {backfillMutation.isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Reanalisando...</>
                : <><RefreshCw className="w-3.5 h-3.5" />Reanalisar ICP de todas</>}
            </Button>
          </CardContent>
        </Card>
      )}


      {/* PRIMARY: niche combined (profissão + especialidade) */}
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" />Nichos campeões (profissão + especialidade)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TopItems data={icpData.niches} empty="A IA ainda não identificou nichos combinados — reanalise as calls campeãs." />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Briefcase className="w-4 h-4 text-primary" />Profissões</CardTitle></CardHeader>
          <CardContent><TopItems data={icpData.professions} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Especialidades / Áreas</CardTitle></CardHeader>
          <CardContent><TopItems data={icpData.specialties} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />Modelo de negócio</CardTitle></CardHeader>
          <CardContent><TopItems data={icpData.businessModels} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-500" />Faixa de ticket / faturamento</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Ticket médio do lead</p>
              <TopItems data={icpData.ticketRanges} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Faturamento mensal</p>
              <TopItems data={icpData.revenueRanges} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" />Papel decisor</CardTitle></CardHeader>
          <CardContent><TopItems data={icpData.decisionRoles} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" />Localização</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Estados</p>
              <TopItems data={icpData.states} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Cidades</p>
              <TopItems data={icpData.cities} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 text-rose-500" />Dores recorrentes (que fecharam)</CardTitle></CardHeader>
          <CardContent><TopItems data={icpData.pains} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-amber-500" />Objeções vencidas</CardTitle></CardHeader>
          <CardContent><TopItems data={icpData.objections} /></CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-500" />Gatilhos que mais funcionaram</CardTitle></CardHeader>
          <CardContent><TopItems data={icpData.triggers} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
