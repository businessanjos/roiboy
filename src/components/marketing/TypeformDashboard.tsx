import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { FileText, Plus, RefreshCw, Trash2, Users, CheckCircle2, TrendingUp, Trophy, Clock, ExternalLink, Search, Info, AlertTriangle, CalendarIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TrackedForm {
  id: string;
  form_id: string;
  title: string;
  campaign_tag: string | null;
  webhook_installed: boolean;
  is_active: boolean;
}

interface FunnelData {
  visits: number;
  starts: number;
  submissions: number;
  completed: number;
  matched_responses: number;
  matched_leads: number;
  matched_deals: number;
  won: number;
  won_value: number;
  completion_rate: number;
  lifetime_completion_rate: number;
  avg_time: number;
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtTime = (s: number) => {
  if (!s) return '–';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

export function TypeformDashboard() {
  const [forms, setForms] = useState<TrackedForm[]>([]);
  const [selectedForm, setSelectedForm] = useState<string>('');
  const [period, setPeriod] = useState<'today' | '7' | '30' | 'this_year' | 'this_month' | 'custom' | 'lifetime'>('30');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const isCustom = period === 'custom';
  const isLifetime = period === 'lifetime';
  const customReady = isCustom && !!customRange?.from && !!customRange?.to;
  const periodPayload = useMemo(() => {
    const now = new Date();
    if (period === 'lifetime') return { lifetime: true, days: 36500 };
    if (period === 'today') return { since: format(startOfDay(now), 'yyyy-MM-dd'), until: format(endOfDay(now), 'yyyy-MM-dd') };
    if (period === 'this_month') return { since: format(startOfMonth(now), 'yyyy-MM-dd'), until: format(endOfMonth(now), 'yyyy-MM-dd') };
    if (period === 'this_year') return { since: format(startOfYear(now), 'yyyy-MM-dd'), until: format(endOfYear(now), 'yyyy-MM-dd') };
    if (period === 'custom' && customReady) {
      return { since: format(customRange!.from!, 'yyyy-MM-dd'), until: format(customRange!.to!, 'yyyy-MM-dd') };
    }
    return { days: Number(period) || 30 };
  }, [period, customReady, customRange]);
  const periodLabel = period === 'lifetime' ? 'histórico total' : period === 'today' ? 'hoje' : period === 'this_month' ? 'este mês' : period === 'this_year' ? 'este ano' : period === 'custom' && customReady ? `${format(customRange!.from!, 'dd/MM/yy')} – ${format(customRange!.to!, 'dd/MM/yy')}` : `últimos ${period}d`;
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [wonDeals, setWonDeals] = useState<any[]>([]);
  const [wonOpen, setWonOpen] = useState(false);
  const [detailsCard, setDetailsCard] = useState<null | {
    label: string;
    source: string;
    steps: string[];
    sample: { columns: string[]; rows: any[][] } | null;
  }>(null);
  const [consistency, setConsistency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFunnel, setLoadingFunnel] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [availableForms, setAvailableForms] = useState<any[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [pickedForms, setPickedForms] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const loadForms = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('typeform_forms').select('*').order('created_at', { ascending: false });
    setForms((data as any) || []);
    if (data && data.length && !selectedForm) setSelectedForm('__all__');
    setLoading(false);
  }, [selectedForm]);

  useEffect(() => { loadForms(); }, [loadForms]);

  const loadFunnel = useCallback(async () => {
    if (!selectedForm) { setFunnel(null); setConsistency(null); return; }
    if (period === 'custom' && !customReady) return;
    setLoadingFunnel(true);
    const { data, error } = await supabase.functions.invoke('typeform-manager', {
      body: { action: 'get_dashboard', form_id: selectedForm, ...periodPayload },
    });
    if (error) {
      toast.error('Erro ao carregar funil');
      setConsistency(null);
    } else {
      setFunnel(data?.funnel || null);
      setConsistency(data?.consistency || null);
      setWonDeals(data?.won_deals || []);
      if (data?.consistency && data.consistency.ok === false && (data.consistency.out_of_scope_responses ?? 0) > 0) {
        toast.warning(`Inconsistência detectada: ${data.consistency.out_of_scope_responses} resposta(s) fora do escopo do funil selecionado.`);
      }
    }
    setLoadingFunnel(false);
  }, [selectedForm, periodPayload, period, customReady]);

  useEffect(() => { loadFunnel(); }, [loadFunnel]);

  const openAdd = async () => {
    setAddOpen(true);
    setLoadingAvailable(true);
    setSearch('');
    setPickedForms([]);
    const { data, error } = await supabase.functions.invoke('typeform-manager', { body: { action: 'list_typeform_forms' } });
    if (error) toast.error('Erro ao listar formulários do Typeform');
    else setAvailableForms(data?.items || []);
    setLoadingAvailable(false);
  };

  const togglePicked = (id: string) => {
    setPickedForms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const addForm = async () => {
    if (!pickedForms.length) { toast.error('Selecione ao menos um formulário'); return; }
    setAdding(true);
    let ok = 0, fail = 0;
    for (const id of pickedForms) {
      const f = availableForms.find(x => x.id === id);
      if (!f) { fail++; continue; }
      const { error } = await supabase.functions.invoke('typeform-manager', {
        body: { action: 'add_form', form_id: f.id, title: f.title, campaign_tag: null },
      });
      if (error) fail++; else ok++;
    }
    setAdding(false);
    if (ok) toast.success(`${ok} formulário(s) rastreados em tempo real`);
    if (fail) toast.error(`${fail} falha(s) ao adicionar`);
    setAddOpen(false); setPickedForms([]);
    await loadForms();
  };

  const refresh = async () => {
    if (!selectedForm) return;
    setLoadingFunnel(true);
    const targets = selectedForm === '__all__' ? forms.map(f => f.form_id) : [selectedForm];
    let fail = 0;
    for (const fid of targets) {
      const { error } = await supabase.functions.invoke('typeform-manager', { body: { action: 'refresh_form', form_id: fid } });
      if (error) fail++;
    }
    if (fail) toast.error(`Erro ao sincronizar ${fail} form(s)`);
    else toast.success(targets.length > 1 ? `Sincronizando ${targets.length} formulários` : 'Sincronizado');
    await loadFunnel();
    setLoadingFunnel(false);
  };

  const removeForm = async (form_id: string) => {
    if (!confirm('Remover este formulário do tracking?')) return;
    const { error } = await supabase.functions.invoke('typeform-manager', { body: { action: 'remove_form', form_id } });
    if (error) toast.error('Erro ao remover');
    else { toast.success('Removido'); if (selectedForm === form_id) setSelectedForm(''); await loadForms(); }
  };

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <Card className="bg-card/50 border-border/30">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-500" />Funil Typeform
              </CardTitle>
              <CardDescription className="space-y-1">
                <span className="block">
                  {isLifetime ? (
                    <>
                      <Badge variant="outline" className="mr-1.5 border-sky-500/40 text-sky-500 bg-sky-500/5">Histórico total</Badge>
                      Mostrando todos os dados desde a criação dos formulários.
                    </>
                  ) : (
                    <>
                      <Badge variant="outline" className="mr-1.5 border-emerald-500/40 text-emerald-500 bg-emerald-500/5">Período · {periodLabel}</Badge>
                      Todos os cards consideram apenas o intervalo selecionado.
                    </>
                  )}
                </span>
                {consistency && (
                  <span className="block pt-1">
                    {consistency.ok || (consistency.out_of_scope_responses ?? 0) === 0 ? (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 bg-emerald-500/5" title={`${consistency.responses_in_scope} resposta(s) validada(s) em ${consistency.scope_form_ids?.length || 0} funil(is)`}>
                        ✓ Dados consistentes ({consistency.responses_in_scope} resp.)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-500 bg-amber-500/5" title="Foram encontradas respostas fora do escopo do funil selecionado. Os números exibidos descartaram esses registros.">
                        ⚠ {consistency.out_of_scope_responses} resposta(s) fora do escopo descartadas
                      </Badge>
                    )}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {forms.length > 0 && (
                <Select value={selectedForm} onValueChange={setSelectedForm}>
                  <SelectTrigger className="w-[260px]"><SelectValue placeholder="Formulário" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">📊 Todos os funis ({forms.length})</SelectItem>
                    {forms.map(f => <SelectItem key={f.form_id} value={f.form_id}>{f.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7">Últimos 7d</SelectItem>
                  <SelectItem value="30">Últimos 30d</SelectItem>
                  <SelectItem value="this_year">Este ano</SelectItem>
                  <SelectItem value="this_month">Este mês</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                  <SelectItem value="lifetime">Histórico total</SelectItem>
                </SelectContent>
              </Select>
              {isCustom && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('gap-2', !customReady && 'text-muted-foreground')}>
                      <CalendarIcon className="w-4 h-4" />
                      {customReady
                        ? `${format(customRange!.from!, 'dd/MM/yy')} – ${format(customRange!.to!, 'dd/MM/yy')}`
                        : 'Selecionar intervalo'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="range"
                      selected={customRange}
                      onSelect={setCustomRange}
                      numberOfMonths={2}
                      locale={ptBR}
                      defaultMonth={customRange?.from ?? subDays(new Date(), 30)}
                    />
                  </PopoverContent>
                </Popover>
              )}
              <Button variant="outline" size="sm" onClick={refresh} disabled={!selectedForm || loadingFunnel}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loadingFunnel ? 'animate-spin' : ''}`} />Sincronizar
              </Button>
              <Button size="sm" onClick={openAdd}>
                <Plus className="w-4 h-4 mr-1" />Adicionar form
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!forms.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum formulário rastreado.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>Adicionar primeiro</Button>
            </div>
          ) : !funnel ? (
            <Skeleton className="h-40" />
          ) : (
            <TooltipProvider delayDuration={150}>
              <div className={cn('transition-opacity', loadingFunnel && 'opacity-60 pointer-events-none')}>
              {(() => {
                const issues: string[] = [];
                if (funnel.submissions > 0 && funnel.visits === 0) {
                  issues.push(`Há ${funnel.submissions.toLocaleString('pt-BR')} submissões no DB, mas o Typeform Insights reporta 0 visitas — provavelmente o snapshot de Insights nunca foi sincronizado.`);
                }
                if (funnel.visits > 0 && funnel.submissions > funnel.visits) {
                  issues.push(`Submissões (${funnel.submissions.toLocaleString('pt-BR')}) excedem o total de visitas lifetime (${funnel.visits.toLocaleString('pt-BR')}). O snapshot de Insights está desatualizado.`);
                }
                if (funnel.starts > 0 && funnel.completed > funnel.starts) {
                  issues.push(`Completados (${funnel.completed.toLocaleString('pt-BR')}) excedem Iniciados (${funnel.starts.toLocaleString('pt-BR')}) — Insights precisa ser ressincronizado.`);
                }
                if (consistency && consistency.ok === false && (consistency.out_of_scope_responses ?? 0) > 0) {
                  issues.push(`${consistency.out_of_scope_responses} resposta(s) fora do escopo do funil selecionado foram descartadas do cálculo.`);
                }
                if (!issues.length) return null;
                return (
                  <Alert className="mb-4 border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 !text-amber-500" />
                    <AlertTitle className="flex items-center justify-between gap-3">
                      <span>Discrepância entre Insights (Typeform) e DB (Roy)</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                        onClick={refresh}
                        disabled={loadingFunnel}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingFunnel ? 'animate-spin' : ''}`} />
                        Sincronizar agora
                      </Button>
                    </AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5 text-xs">
                        {issues.map((i, idx) => <li key={idx}>{i}</li>)}
                      </ul>
                      <p className="text-[11px] mt-2 opacity-80">
                        Os snapshots de Insights são atualizados a cada sincronização. Clique em "Sincronizar agora" para puxar os números mais recentes do Typeform.
                      </p>
                    </AlertDescription>
                  </Alert>
                );
              })()}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="border-sky-500/40 text-sky-500 bg-sky-500/5">
                      {isLifetime ? 'Histórico total' : `Período · ${periodLabel}`}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {isLifetime
                        ? (selectedForm === '__all__' ? `somatório de ${forms.length} funis` : 'desde a criação do form')
                        : (selectedForm === '__all__' ? `${forms.length} funis · filtrado pelo intervalo` : 'filtrado pelo intervalo selecionado')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FunnelCard
                      scope={isLifetime ? 'lifetime' : 'period'} label="Visitas" value={funnel.visits} icon={Users}
                      sub={isLifetime ? 'desde a criação do form' : `pessoas que abriram ${periodLabel}`}
                      source="Typeform"
                      tip={isLifetime
                        ? "Quantas pessoas abriram o link do formulário desde que ele foi criado."
                        : `Quantas pessoas abriram o link do formulário ${periodLabel}. Vem do Typeform já filtrado pelo período.`}
                      onDetails={() => setDetailsCard({
                        label: 'Visitas',
                        source: 'Typeform Insights API',
                        steps: [
                          `1. Para cada form rastreado, chama GET /insights/{form_id}/summary do Typeform${isLifetime ? '' : ' com os parâmetros from/to do período'}.`,
                          `2. Lê o campo form.summary.total_visits.`,
                          `3. ${isLifetime ? 'Usa o snapshot mais recente armazenado em typeform_form_stats.' : 'Soma o resultado de cada form do escopo (chamada ao vivo, sem cache).'}`,
                          `4. Total exibido = ${funnel.visits.toLocaleString('pt-BR')}.`,
                        ],
                        sample: null,
                      })}
                    />
                    <FunnelCard
                      scope={isLifetime ? 'lifetime' : 'period'} label="Iniciados" value={funnel.starts} icon={TrendingUp}
                      sub={funnel.visits ? `${((funnel.starts/funnel.visits)*100).toFixed(1)}% das visitas` : (isLifetime ? 'desde a criação do form' : `iniciados ${periodLabel}`)}
                      source="Typeform"
                      tip={isLifetime
                        ? "Quem abriu o formulário e começou a responder, indo além da tela de boas-vindas."
                        : `Quem começou a responder o formulário ${periodLabel} (passou da tela de boas-vindas).`}
                      onDetails={() => setDetailsCard({
                        label: 'Iniciados',
                        source: 'Typeform Insights API',
                        steps: [
                          `1. Chama /insights/{form_id}/summary${isLifetime ? '' : ' com from/to do período'} e itera o array fields.`,
                          `2. Ignora screens (welcome/thankyou) e pega o primeiro campo real.`,
                          `3. Lê o atributo views = quantas pessoas viram o primeiro campo.`,
                          `4. ${isLifetime ? 'Lê do snapshot mais recente em typeform_form_stats.' : 'Soma o resultado de cada form do escopo ao vivo.'}`,
                          `5. Total exibido = ${funnel.starts.toLocaleString('pt-BR')}${funnel.visits ? ` (${((funnel.starts/funnel.visits)*100).toFixed(1)}% das ${funnel.visits.toLocaleString('pt-BR')} visitas)` : ''}.`,
                        ],
                        sample: null,
                      })}
                    />
                    <FunnelCard
                      scope={isLifetime ? 'lifetime' : 'period'} label="Tempo médio" value={fmtTime(funnel.avg_time)} icon={Clock}
                      sub={isLifetime ? 'por resposta (histórico)' : `por resposta ${periodLabel}`}
                      source="Typeform"
                      tip={isLifetime
                        ? "Tempo médio que cada pessoa leva para responder o formulário do começo ao fim."
                        : `Tempo médio que cada pessoa levou para responder o formulário ${periodLabel}.`}
                      onDetails={() => setDetailsCard({
                        label: 'Tempo médio',
                        source: 'Typeform Insights API',
                        steps: [
                          `1. Lê form.summary.average_time (em segundos) do endpoint Insights${isLifetime ? '' : ' com from/to do período'}.`,
                          `2. ${isLifetime ? 'Persiste em typeform_form_stats.average_time_seconds.' : 'Calcula ao vivo, sem cache.'}`,
                          `3. Quando 'Todos os funis' está selecionado, aplica média ponderada: Σ(avg_time × visitas) / Σ(visitas).`,
                          `4. Resultado convertido para minutos/segundos = ${fmtTime(funnel.avg_time)}.`,
                        ],
                        sample: null,
                      })}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 bg-emerald-500/5">{isLifetime ? 'Histórico total' : `Período · ${periodLabel}`}</Badge>
                    <span className="text-xs text-muted-foreground">{isLifetime ? 'todas as respostas recebidas' : 'filtrado pelo intervalo selecionado'}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <FunnelCard
                      scope="period" label="Submissões" value={funnel.submissions} icon={CheckCircle2}
                      sub={`recebidas ${periodLabel}`}
                      source="Roy"
                      tip={`Quantas pessoas enviaram alguma resposta (mesmo sem terminar o formulário) ${periodLabel}. Conta apenas o que chegou no Roy nesse período.`}
                      onDetails={() => setDetailsCard({
                        label: 'Submissões',
                        source: 'DB · typeform_responses',
                        steps: [
                          `1. Filtra typeform_responses por account_id da conta logada.`,
                          `2. Restringe form_id ao(s) funil(is) selecionado(s) (${selectedForm === '__all__' ? `todos os ${forms.length}` : '1 funil'}).`,
                          `3. Mantém apenas linhas com created_at >= hoje - ${period} dias.`,
                          `4. Conta total de linhas resultantes = ${funnel.submissions.toLocaleString('pt-BR')}.`,
                        ],
                        sample: null,
                      })}
                    />
                    <FunnelCard
                      scope="period" label="Completados" value={funnel.completed} icon={CheckCircle2}
                      sub={`${funnel.completion_rate.toFixed(1)}% das submissões`}
                      source="Roy"
                      tip="Pessoas que responderam o formulário até o final (chegaram na tela de agradecimento). A taxa mostra quantos completaram, do total de quem começou no período."
                      highlight
                      onDetails={() => setDetailsCard({
                        label: 'Completados',
                        source: 'DB · typeform_responses',
                        steps: [
                          `1. Parte do conjunto de Submissões (${funnel.submissions.toLocaleString('pt-BR')} no período).`,
                          `2. Filtra apenas linhas com is_completed = true (chegou até a thank-you screen).`,
                          `3. Resultado = ${funnel.completed.toLocaleString('pt-BR')} respostas completas.`,
                          `4. Taxa de conversão = ${funnel.completed} / ${funnel.submissions} = ${funnel.completion_rate.toFixed(1)}%.`,
                        ],
                        sample: null,
                      })}
                    />
                    <FunnelCard
                      scope="period" label="Lead no Roy" value={funnel.matched_responses} icon={Users}
                      sub={funnel.completed ? `${((funnel.matched_responses/funnel.completed)*100).toFixed(1)}% dos completados` : 'matches no período'}
                      source="Roy"
                      tip="Respostas do período que conseguimos identificar como um lead ou uma negociação que já existia no Roy (cruzando pelo e-mail ou pelo telefone). Cada pessoa conta uma vez só."
                      onDetails={() => setDetailsCard({
                        label: 'Lead no Roy',
                        source: 'DB · matching engine',
                        steps: [
                          `1. Parte das ${funnel.submissions.toLocaleString('pt-BR')} respostas do período.`,
                          `2. Para cada resposta, normaliza email (lowercase/trim) e telefone (DDD + últimos 8 dígitos).`,
                          `3. Cruza com leads e deals da conta procurando match por email OU phoneCoreKey.`,
                          `4. Marca matched_lead_id / matched_deal_id na resposta quando encontra.`,
                          `5. Conta respostas únicas com matched_lead_id OU matched_deal_id = ${funnel.matched_responses.toLocaleString('pt-BR')}.`,
                          `   • Match por lead: ${funnel.matched_leads.toLocaleString('pt-BR')}`,
                          `   • Match por deal: ${funnel.matched_deals.toLocaleString('pt-BR')}`,
                        ],
                        sample: null,
                      })}
                    />
                    <FunnelCard
                      scope="period" label="Ganhos" value={funnel.won} icon={Trophy}
                      sub={fmtBRL(funnel.won_value)}
                      source="Roy"
                      tip="Quantas dessas respostas viraram venda fechada (status Ganho) no Roy. O valor mostrado é a soma do valor desses contratos. Clique no card para ver a lista."
                      highlight
                      onClick={funnel.won > 0 ? () => setWonOpen(true) : undefined}
                      onDetails={() => setDetailsCard({
                        label: 'Ganhos',
                        source: 'DB · deals (status=won)',
                        steps: [
                          `1. Parte das ${funnel.matched_responses.toLocaleString('pt-BR')} respostas com match no período.`,
                          `2. Caminho A — matched_deal_id direto: busca deals com status='won'.`,
                          `3. Caminho B — matched_lead_id: busca QUALQUER deal won criado depois para o mesmo lead.`,
                          `4. Caminho C — cruzamento ao vivo por email (case-insensitive) e telefone (variantes BR) com TODOS os deals won da conta.`,
                          `5. Caminho D — respostas → leads (por email/telefone) → deals won daqueles leads (pega casos onde o deal não tem email/telefone preenchido).`,
                          `6. Deduplica os deal IDs encontrados nos 4 caminhos = ${funnel.won.toLocaleString('pt-BR')} deals únicos.`,
                          `7. Valor total = soma de deals.value desses deals = ${fmtBRL(funnel.won_value)}.`,
                        ],
                        sample: wonDeals.length ? {
                          columns: ['Contato', 'Valor', 'Won em', 'Vendedor'],
                          rows: wonDeals.slice(0, 10).map((d: any) => [
                            d.contact_name || d.contact_email || '—',
                            fmtBRL(Number(d.value || 0)),
                            d.won_at ? new Date(d.won_at).toLocaleDateString('pt-BR') : '—',
                            d.responsible_user_name || '—',
                          ]),
                        } : null,
                      })}
                    />
                  </div>
                </div>
              </div>
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {forms.length > 0 && (
        <Card className="bg-card/50 border-border/30">
          <CardHeader><CardTitle className="text-base">Formulários rastreados</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {forms.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-md border border-border/30 hover:bg-muted/30">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{f.title}</p>
                      <p className="text-xs text-muted-foreground truncate">ID: {f.form_id}</p>
                    </div>
                    {f.campaign_tag && <Badge variant="secondary">{f.campaign_tag}</Badge>}
                    {f.webhook_installed ? (
                      <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Webhook ativo</Badge>
                    ) : (
                      <Badge variant="outline">Sem webhook</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild><a href={`https://admin.typeform.com/form/${f.form_id}`} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a></Button>
                    <Button variant="ghost" size="icon" onClick={() => removeForm(f.form_id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="p-6 pb-4 border-b border-border/40">
            <DialogTitle>Selecionar formulários para acompanhar</DialogTitle>
            <DialogDescription>
              Marque os formulários que deseja rastrear em tempo real. O webhook é instalado automaticamente em cada um.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
            {loadingAvailable ? (
              <Skeleton className="h-64" />
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar formulário..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>{pickedForms.length} selecionado(s)</span>
                  {pickedForms.length > 0 && (
                    <button type="button" className="hover:underline" onClick={() => setPickedForms([])}>
                      Limpar
                    </button>
                  )}
                </div>
                <div className="max-h-[340px] overflow-y-auto border border-border/30 rounded-md divide-y divide-border/20">
                  {availableForms
                    .filter(f => !forms.some(t => t.form_id === f.id))
                    .filter(f => !search || f.title.toLowerCase().includes(search.toLowerCase()))
                    .map(f => {
                      const checked = pickedForms.includes(f.id);
                      return (
                        <div
                          key={f.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => togglePicked(f.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePicked(f.id); } }}
                          className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <Checkbox checked={checked} className="pointer-events-none" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{f.title}</p>
                            <p className="text-xs text-muted-foreground truncate">ID: {f.id}</p>
                          </div>
                        </div>
                      );
                    })}
                  {availableForms.filter(f => !forms.some(t => t.form_id === f.id)).length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Todos os seus formulários já estão sendo rastreados.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter className="p-4 border-t border-border/40">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>Cancelar</Button>
            <Button onClick={addForm} disabled={!pickedForms.length || adding}>
              {adding ? 'Adicionando...' : `Acompanhar ${pickedForms.length || ''} form${pickedForms.length === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={wonOpen} onOpenChange={(o) => {
        setWonOpen(o);
        if (o && wonDeals.length === 0 && (funnel?.won || 0) > 0 && !loadingFunnel) {
          loadFunnel();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="p-6 pb-4 border-b border-border/40">
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-500" />
              Ganhos cruzados com o Typeform
            </DialogTitle>
            <DialogDescription>
              {wonDeals.length} deal{wonDeals.length === 1 ? '' : 's'} ganho{wonDeals.length === 1 ? '' : 's'} · {fmtBRL(wonDeals.reduce((s, d) => s + (d.value || 0), 0))} · respostas {periodLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-2">
            {loadingFunnel ? (
              <Skeleton className="h-40" />
            ) : wonDeals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum match encontrado.</p>
            ) : wonDeals.map((d) => (
              <div key={d.id} className="p-3 rounded-md border border-border/40 hover:bg-muted/30 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{d.contact_name || d.title || 'Sem nome'}</p>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        match: {d.matched_by}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {d.contact_email && <p className="truncate">📧 {d.contact_email}</p>}
                      {d.contact_phone && <p className="truncate">📱 {d.contact_phone}</p>}
                      {d.responsible_user_name && <p>👤 {d.responsible_user_name}</p>}
                      {d.won_at && <p>🏆 Ganho em {new Date(d.won_at).toLocaleDateString('pt-BR')}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-emerald-500">{fmtBRL(d.value || 0)}</p>
                    <Button variant="ghost" size="sm" asChild className="h-7 mt-1">
                      <a href={`/sales?deal=${d.id}`} target="_blank" rel="noreferrer">
                        Abrir <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="p-4 border-t border-border/40">
            <Button variant="outline" onClick={() => setWonOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsCard} onOpenChange={(o) => { if (!o) setDetailsCard(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-sky-500" />
              Como calculamos: {detailsCard?.label}
            </DialogTitle>
            <DialogDescription>
              Fonte: <span className="font-medium">{detailsCard?.source}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                Passo a passo
              </p>
              <ol className="space-y-2 text-sm">
                {detailsCard?.steps.map((s, i) => (
                  <li key={i} className="p-2 rounded-md bg-muted/40 border border-border/30 leading-relaxed">
                    {s}
                  </li>
                ))}
              </ol>
            </div>
            {detailsCard?.sample && detailsCard.sample.rows.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                  Amostra dos registros usados ({detailsCard.sample.rows.length})
                </p>
                <div className="overflow-x-auto rounded-md border border-border/40">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        {detailsCard.sample.columns.map((c) => (
                          <th key={c} className="text-left px-2 py-1.5 font-medium">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailsCard.sample.rows.map((row, idx) => (
                        <tr key={idx} className="border-t border-border/30">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1.5 text-muted-foreground">{String(cell)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsCard(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FunnelCard({ label, value, icon: Icon, sub, highlight, scope, tip, source, onClick, onDetails }: any) {
  const scopeStyles = scope === 'lifetime'
    ? 'border-sky-500/30 bg-sky-500/5'
    : scope === 'period'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : 'border-border/30 bg-muted/20';
  const clickable = typeof onClick === 'function';
  return (
    <div
      className={`p-3 rounded-lg border ${highlight ? 'border-emerald-500/40 bg-emerald-500/10' : scopeStyles} ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-emerald-500/40 transition' : ''}`}
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="flex items-center justify-between gap-1.5 text-xs text-muted-foreground mb-1">
        <span className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        {tip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
                aria-label={`Como ${label} é calculado`}
                onClick={(e) => e.stopPropagation()}
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
              {source && (
                <div className="font-semibold mb-1 text-[10px] uppercase tracking-wide opacity-80">
                  Fonte: {source}
                </div>
              )}
              <p>{tip}</p>
              {onDetails && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2 h-7 w-full text-xs"
                  onClick={(e) => { e.stopPropagation(); onDetails(); }}
                >
                  Ver detalhes do cálculo
                </Button>
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className="text-xl font-bold">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
