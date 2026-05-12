import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { TrendingUp, Target, Inbox, BarChart3, Megaphone, Loader2, ExternalLink, Link2, RefreshCw, Zap, Unlink, Settings2, FileText, CalendarIcon } from 'lucide-react';
import { TypeformDashboard } from '@/components/marketing/TypeformDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserMetaConnection } from '@/hooks/useUserMetaConnection';
import { LeadAdsConfig } from '@/components/meta/LeadAdsConfig';
import { MetaKpiCard } from '@/components/meta/MetaKpiCard';
import { MetaKpiSettings } from '@/components/meta/MetaKpiSettings';
import { useMetaKpiPreferences } from '@/hooks/useMetaKpiPreferences';
import { ManageAdAccountsModal } from '@/components/meta/ManageAdAccountsModal';
import { CampaignsManager } from '@/components/meta/CampaignsManager';
import { toast } from 'sonner';

interface AdSet {
  id: string;
  name: string;
  platform: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpl: number;
}

interface Insights {
  impressions: number; clicks: number; spend: number; conversions: number;
  reach: number; ctr: number; cpc: number; cpm: number; cpp: number;
  frequency: number; engagement_rate: number; post_engagement: number;
  video_views: number; video_thruplay: number; leads: number;
  purchases: number; purchase_value: number; roas: number;
  landing_page_views: number; cost_per_result: number;
}

export default function MarketingTrafegoPago() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('last_30d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const isCustom = period === 'custom';
  const customReady = isCustom && !!customRange?.from && !!customRange?.to;
  const periodPayload = useMemo(() => {
    if (customReady) {
      return {
        since: format(customRange!.from!, 'yyyy-MM-dd'),
        until: format(customRange!.to!, 'yyyy-MM-dd'),
      };
    }
    return { datePreset: isCustom ? 'last_30d' : period };
  }, [period, isCustom, customReady, customRange]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<string>('active');
  const [campaignPlatformFilter, setCampaignPlatformFilter] = useState<string>('all');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignPage, setCampaignPage] = useState(1);
  const CAMPAIGN_PAGE_SIZE = 10;

  const { getVisibleKpiDetails, visibleKpis } = useMetaKpiPreferences();
  const { isConnected, isLoading: isLoadingConnection, accounts, allAccounts, connectMeta, disconnectMeta, refreshSelectedAccounts, error } = useUserMetaConnection('/marketing/trafego-pago');

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const fetchAdSets = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('marketing_ad_sets').select('*').eq('user_id', user.id).order('spend', { ascending: false });
      setAdSets((data as any[]) || []);
    } finally { setLoading(false); }
  }, [user?.id]);

  const syncCampaigns = useCallback(async () => {
    if (!accounts.length) { toast.error('Nenhuma conta de anúncios'); return; }
    setSyncing(true);
    try {
      const { data, error: e } = await supabase.functions.invoke('sync-meta-campaigns', { body: { adAccountId: accounts[0].id, ...periodPayload } });
      if (e) throw e;
      if (data?.error) toast.error(data.error);
      else { toast.success(`${data?.count || 0} campanhas sincronizadas!`); await fetchAdSets(); }
    } catch (err) { console.error(err); toast.error('Erro ao sincronizar'); }
    finally { setSyncing(false); }
  }, [accounts, periodPayload, fetchAdSets]);

  useEffect(() => {
    if (accounts.length > 0 && (!selectedAccount || !accounts.find(a => a.id === selectedAccount))) {
      setSelectedAccount(accounts[0].id);
    }
  }, [accounts, selectedAccount]);

  const loadInsights = useCallback(async () => {
    if (!selectedAccount) return;
    if (isCustom && !customReady) return;
    setLoadingInsights(true);
    try {
      const { data, error: e } = await supabase.functions.invoke('get-audience-insights', { body: { adAccountId: selectedAccount, ...periodPayload } });
      if (e) throw e;
      setInsights(data?.insights || null);
    } catch { setInsights(null); }
    finally { setLoadingInsights(false); }
  }, [selectedAccount, periodPayload, isCustom, customReady]);

  useEffect(() => { if (selectedAccount && isConnected) loadInsights(); }, [selectedAccount, isConnected, loadInsights]);
  useEffect(() => { if (isConnected) fetchAdSets(); }, [isConnected, fetchAdSets]);
  useEffect(() => {
    if (isConnected && !loading && adSets.length === 0 && accounts.length > 0) syncCampaigns();
  }, [isConnected, loading, adSets.length, accounts.length]);

  if (isLoadingConnection) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
        <p className="text-sm">Verificando conexão...</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tráfego Pago</h1>
          <p className="text-sm text-muted-foreground">Conecte sua conta para começar</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <Target className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Conecte sua conta Meta Ads</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-2">
            Para visualizar métricas, gerenciar campanhas e acompanhar o desempenho dos seus anúncios, conecte sua conta do Facebook/Meta.
          </p>
          <p className="text-xs text-muted-foreground text-center max-w-sm mb-8">É rápido, seguro e você pode desconectar a qualquer momento.</p>
          <Button size="lg" onClick={connectMeta} className="gap-2">
            <ExternalLink className="w-4 h-4" />Conectar com Facebook
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tráfego Pago</h1>
          <p className="text-sm text-muted-foreground">Performance de anúncios e campanhas pagas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setManageOpen(true)} className="gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />Contas ({accounts.length})
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={async () => {
              setIsDisconnecting(true);
              const ok = await disconnectMeta();
              setIsDisconnecting(false);
              if (ok) toast.success('Desconectado!');
            }}
            disabled={isDisconnecting}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}Desconectar
          </Button>
        </div>
      </div>

      <ManageAdAccountsModal open={manageOpen} onOpenChange={setManageOpen} allAccounts={allAccounts} onSaved={refreshSelectedAccounts} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2"><BarChart3 className="w-4 h-4" />Visão Geral</TabsTrigger>
          <TabsTrigger value="leadads" className="gap-2"><Zap className="w-4 h-4" />Lead Ads</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2"><Megaphone className="w-4 h-4" />Campanhas</TabsTrigger>
          <TabsTrigger value="links" className="gap-2"><Link2 className="w-4 h-4" />Links & UTM</TabsTrigger>
          <TabsTrigger value="typeform" className="gap-2"><FileText className="w-4 h-4" />Typeform</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <Card className="bg-card/50 border-border/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-500" />Métricas de Performance
                  </CardTitle>
                  <CardDescription>Dados agregados da conta selecionada</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {accounts.length > 1 && (
                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                      <SelectTrigger className="w-[180px]"><SelectValue placeholder="Conta" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <Select value={period} onValueChange={(v) => { setPeriod(v); if (v !== 'custom') setCustomRange(undefined); }}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="last_7d">Últimos 7 dias</SelectItem>
                      <SelectItem value="last_14d">Últimos 14 dias</SelectItem>
                      <SelectItem value="last_30d">Últimos 30 dias</SelectItem>
                      <SelectItem value="last_90d">Últimos 90 dias</SelectItem>
                      <SelectItem value="this_month">Este mês</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                  {isCustom && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn('gap-2', !customReady && 'text-muted-foreground')}>
                          <CalendarIcon className="w-4 h-4" />
                          {customReady
                            ? `${format(customRange!.from!, 'dd/MM/yy', { locale: ptBR })} - ${format(customRange!.to!, 'dd/MM/yy', { locale: ptBR })}`
                            : 'Selecionar período'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="range"
                          selected={customRange}
                          onSelect={setCustomRange}
                          numberOfMonths={2}
                          locale={ptBR}
                          className={cn('p-3 pointer-events-auto')}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                  <MetaKpiSettings />
                  <Button variant="outline" size="icon" onClick={loadInsights} disabled={loadingInsights}>
                    <RefreshCw className={`w-4 h-4 ${loadingInsights ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingInsights && !insights ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {visibleKpis.slice(0, 8).map(i => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
              ) : !insights ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma métrica disponível</p>
                  <p className="text-sm mt-1">Verifique se a conta possui campanhas ativas</p>
                </div>
              ) : (
                <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4 transition-opacity', loadingInsights && 'opacity-60')}>
                  {getVisibleKpiDetails().map((kpi, i) => (
                    <MetaKpiCard key={kpi.id} kpi={kpi} value={insights[kpi.id as keyof Insights] as number} index={i} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/40">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Campanhas</CardTitle>
                <Button variant="outline" size="sm" onClick={syncCampaigns} disabled={syncing} className="gap-2">
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {syncing ? 'Sincronizando...' : 'Sincronizar'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading || syncing ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mb-3 opacity-50" />
                  <p className="text-sm">Carregando campanhas...</p>
                </div>
              ) : adSets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Inbox className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Nenhuma campanha encontrada.</p>
                  <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={syncCampaigns}>
                    <RefreshCw className="w-4 h-4" />Sincronizar
                  </Button>
                </div>
              ) : (
                (() => {
                  const platforms = Array.from(new Set(adSets.map(a => a.platform).filter(Boolean)));
                  const filtered = adSets.filter(ad => {
                    if (campaignStatusFilter !== 'all' && ad.status !== campaignStatusFilter) return false;
                    if (campaignPlatformFilter !== 'all' && ad.platform !== campaignPlatformFilter) return false;
                    if (campaignSearch && !ad.name?.toLowerCase().includes(campaignSearch.toLowerCase())) return false;
                    return true;
                  });
                  const totalPages = Math.max(1, Math.ceil(filtered.length / CAMPAIGN_PAGE_SIZE));
                  const page = Math.min(campaignPage, totalPages);
                  const start = (page - 1) * CAMPAIGN_PAGE_SIZE;
                  const visible = filtered.slice(start, start + CAMPAIGN_PAGE_SIZE);
                  return (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          placeholder="Buscar campanha..."
                          value={campaignSearch}
                          onChange={(e) => { setCampaignSearch(e.target.value); setCampaignPage(1); }}
                          className="h-9 max-w-xs"
                        />
                        <Select value={campaignStatusFilter} onValueChange={(v) => { setCampaignStatusFilter(v); setCampaignPage(1); }}>
                          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Apenas ativas</SelectItem>
                            <SelectItem value="paused">Apenas pausadas</SelectItem>
                            <SelectItem value="all">Todas</SelectItem>
                          </SelectContent>
                        </Select>
                        {platforms.length > 1 && (
                          <Select value={campaignPlatformFilter} onValueChange={(v) => { setCampaignPlatformFilter(v); setCampaignPage(1); }}>
                            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todas plataformas</SelectItem>
                              {platforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} de {adSets.length}</span>
                      </div>

                      {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                          <Inbox className="w-10 h-10 mb-2 opacity-30" />
                          <p className="text-sm">Nenhuma campanha com esses filtros.</p>
                        </div>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead><tr className="border-b border-border/40">
                                <th className="text-left p-3 text-muted-foreground font-medium">Campanha</th>
                                <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                                <th className="text-right p-3 text-muted-foreground font-medium">Gasto</th>
                                <th className="text-right p-3 text-muted-foreground font-medium">Impressões</th>
                                <th className="text-right p-3 text-muted-foreground font-medium">Cliques</th>
                                <th className="text-right p-3 text-muted-foreground font-medium">Conversões</th>
                                <th className="text-right p-3 text-muted-foreground font-medium">CPL</th>
                              </tr></thead>
                              <tbody>
                                {visible.map(ad => (
                                  <tr key={ad.id} className="border-b border-border/20 hover:bg-muted/30">
                                    <td className="p-3">
                                      <p className="font-medium text-foreground">{ad.name}</p>
                                      <p className="text-xs text-muted-foreground">{ad.platform}</p>
                                    </td>
                                    <td className="p-3">
                                      <Badge variant="outline" className={ad.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}>
                                        {ad.status === 'active' ? 'Ativo' : 'Pausado'}
                                      </Badge>
                                    </td>
                                    <td className="p-3 text-right font-medium text-foreground">R$ {(ad.spend || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td className="p-3 text-right text-muted-foreground">{(ad.impressions || 0).toLocaleString('pt-BR')}</td>
                                    <td className="p-3 text-right text-muted-foreground">{(ad.clicks || 0).toLocaleString('pt-BR')}</td>
                                    <td className="p-3 text-right font-medium text-foreground">{ad.conversions || 0}</td>
                                    <td className="p-3 text-right text-primary font-medium">{ad.cpl > 0 ? `R$ ${ad.cpl.toFixed(2)}` : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-2">
                              <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
                              <div className="flex gap-1">
                                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setCampaignPage(page - 1)}>Anterior</Button>
                                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setCampaignPage(page + 1)}>Próxima</Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leadads" className="mt-4">
          <LeadAdsConfig />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          {selectedAccount ? (
            <CampaignsManager adAccountId={selectedAccount} datePreset={period} />
          ) : (
            <Card className="bg-card/50 border-border/30">
              <CardContent className="py-16 text-center text-muted-foreground">
                <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione uma conta de anúncios para ver as campanhas.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="links" className="mt-4">
          <MarketingLinksUtm />
        </TabsContent>

        <TabsContent value="typeform" className="mt-4">
          <TypeformDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
