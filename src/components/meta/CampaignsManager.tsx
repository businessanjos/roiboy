import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ChevronRight, RefreshCw, Loader2, Search, ArrowUpDown, Pencil, ExternalLink, Image as ImageIcon, TrendingUp, Inbox, Bell } from 'lucide-react';
import { CampaignAlertsDialog } from './CampaignAlertsDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

interface AdAccount { id: string; name: string; }
interface Insights {
  spend: number; impressions: number; clicks: number; reach: number;
  ctr: number; cpc: number; cpm: number; frequency: number;
  leads: number; purchases: number; purchaseValue: number; conversions: number;
  cpl: number; cpa: number; roas: number;
}
interface Campaign {
  id: string; name: string; status: string; configured_status: string;
  objective: string; daily_budget: number | null; lifetime_budget: number | null;
  start_time?: string; stop_time?: string; created_time?: string;
  insights: Insights | null;
}
interface AdSet {
  id: string; name: string; status: string; configured_status: string;
  daily_budget: number | null; lifetime_budget: number | null;
  optimization_goal?: string; billing_event?: string;
  insights: Insights | null;
}
interface Ad {
  id: string; name: string; status: string; configured_status: string;
  preview_url?: string;
  creative: { id: string; name?: string; title?: string; body?: string; thumbnail_url?: string; image_url?: string } | null;
  insights: Insights | null;
}

const fmtBRL = (v: number | null | undefined) => v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (v: number | null | undefined) => v == null ? '—' : Number(v).toLocaleString('pt-BR');
const fmtPct = (v: number | null | undefined) => v == null ? '—' : `${Number(v).toFixed(2)}%`;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    paused: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    deleted: 'bg-destructive/15 text-destructive border-destructive/30',
    archived: 'bg-muted text-muted-foreground border-border',
  };
  const labels: Record<string, string> = { active: 'Ativo', paused: 'Pausado', deleted: 'Excluído', archived: 'Arquivado' };
  return <Badge variant="outline" className={map[status] || map.paused}>{labels[status] || status}</Badge>;
}

interface BudgetHistoryEntry {
  id: string;
  user_name: string | null;
  user_email: string | null;
  previous_value: number | null;
  new_value: number | null;
  budget_type: string;
  created_at: string;
}

interface BudgetEditorProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entity: { id: string; name: string; daily_budget: number | null; lifetime_budget: number | null } | null;
  entityType?: 'campaign' | 'adset' | 'ad';
  adAccountId?: string;
  onSaved: () => void;
}
function BudgetEditor({ open, onOpenChange, entity, entityType = 'campaign', adAccountId, onSaved }: BudgetEditorProps) {
  const [daily, setDaily] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<BudgetHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!entity) return;
    setLoadingHistory(true);
    try {
      const { data } = await supabase.functions.invoke('meta-campaigns-manager', {
        body: { action: 'budget_history', entityId: entity.id },
      });
      setHistory(data?.history || []);
    } catch { /* noop */ }
    finally { setLoadingHistory(false); }
  }, [entity]);

  useEffect(() => {
    if (entity) {
      setDaily(entity.daily_budget != null ? String(entity.daily_budget) : '');
      loadHistory();
    }
  }, [entity, loadHistory]);

  if (!entity) return null;
  const handleSave = async () => {
    const value = parseFloat(daily.replace(',', '.'));
    if (isNaN(value) || value <= 0) { toast.error('Valor inválido'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-campaigns-manager', {
        body: { action: 'update_budget', entityId: entity.id, entityType, entityName: entity.name, adAccountId, dailyBudget: value },
      });
      if (error || data?.error) throw new Error(data?.error || 'Erro');
      toast.success('Orçamento atualizado');
      onSaved();
      loadHistory();
    } catch (e: any) { toast.error(e.message || 'Erro ao atualizar'); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Orçamento Diário</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground truncate">{entity.name}</p>
          <div>
            <Label htmlFor="dailyBudget">Orçamento diário (R$)</Label>
            <Input id="dailyBudget" type="number" step="0.01" min="1" value={daily} onChange={e => setDaily(e.target.value)} placeholder="50.00" />
          </div>

          <div className="pt-3 border-t border-border/40">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Histórico de alterações</p>
            {loadingHistory ? (
              <Skeleton className="h-16 w-full" />
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhuma alteração registrada ainda.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {history.map(h => (
                  <div key={h.id} className="text-xs flex items-start justify-between gap-2 p-2 rounded-md bg-muted/30 border border-border/30">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{h.user_name || h.user_email || 'Sistema'}</p>
                      <p className="text-muted-foreground">{new Date(h.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="text-muted-foreground">{fmtBRL(h.previous_value)}</span>
                      <span className="mx-1">→</span>
                      <span className="font-semibold text-primary">{fmtBRL(h.new_value)}</span>
                      {h.budget_type !== 'daily' && <p className="text-[10px] text-muted-foreground">{h.budget_type}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DrilldownProps {
  campaign: Campaign | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  datePreset: string;
  onMutated: () => void;
}
function CampaignDrilldown({ campaign, open, onOpenChange, datePreset, onMutated }: DrilldownProps) {
  const [adsets, setAdsets] = useState<AdSet[]>([]);
  const [loadingAdsets, setLoadingAdsets] = useState(false);
  const [selectedAdset, setSelectedAdset] = useState<AdSet | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [budgetEntity, setBudgetEntity] = useState<any>(null);

  const loadAdsets = useCallback(async () => {
    if (!campaign) return;
    setLoadingAdsets(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-campaigns-manager', {
        body: { action: 'list_adsets', campaignId: campaign.id, datePreset },
      });
      if (error || data?.error) throw new Error(data?.error || 'Erro');
      setAdsets(data.adsets || []);
    } catch (e: any) { toast.error(e.message || 'Erro ao carregar conjuntos'); }
    finally { setLoadingAdsets(false); }
  }, [campaign, datePreset]);

  const loadAds = useCallback(async (adsetId: string) => {
    setLoadingAds(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-campaigns-manager', {
        body: { action: 'list_ads', adsetId, datePreset },
      });
      if (error || data?.error) throw new Error(data?.error || 'Erro');
      setAds(data.ads || []);
    } catch (e: any) { toast.error(e.message || 'Erro ao carregar anúncios'); }
    finally { setLoadingAds(false); }
  }, [datePreset]);

  useEffect(() => {
    if (open && campaign) { setSelectedAdset(null); setAds([]); loadAdsets(); }
  }, [open, campaign, loadAdsets]);

  useEffect(() => { if (selectedAdset) loadAds(selectedAdset.id); }, [selectedAdset, loadAds]);

  const toggleStatus = async (entityType: 'adset' | 'ad', id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'PAUSED' : 'ACTIVE';
    try {
      const { data, error } = await supabase.functions.invoke('meta-campaigns-manager', {
        body: { action: 'toggle_status', entityType, entityId: id, status: newStatus },
      });
      if (error || data?.error) throw new Error(data?.error || 'Erro');
      toast.success(newStatus === 'ACTIVE' ? 'Ativado' : 'Pausado');
      if (entityType === 'adset') loadAdsets(); else if (selectedAdset) loadAds(selectedAdset.id);
      onMutated();
    } catch (e: any) { toast.error(e.message || 'Erro'); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl pr-8">{campaign?.name}</SheetTitle>
          <SheetDescription className="flex items-center gap-2 flex-wrap">
            <span>{campaign?.objective}</span>
            <span>·</span>
            <span>Diário: {fmtBRL(campaign?.daily_budget)}</span>
            {campaign?.insights && <><span>·</span><span>ROAS: {campaign.insights.roas.toFixed(2)}x</span></>}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* AdSets */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Conjuntos de Anúncios</h3>
              <Button variant="ghost" size="sm" onClick={loadAdsets} disabled={loadingAdsets}>
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAdsets ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            {loadingAdsets ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : adsets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum conjunto.</p>
            ) : (
              <div className="space-y-1.5">
                {adsets.map(as => (
                  <div key={as.id}
                    className={`group flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedAdset?.id === as.id ? 'bg-primary/5 border-primary/40' : 'border-border/40 hover:bg-muted/40'}`}
                    onClick={() => setSelectedAdset(as)}>
                    <Switch
                      checked={as.status === 'active'}
                      onCheckedChange={(e) => { /* handled below */ }}
                      onClick={(e) => { e.stopPropagation(); toggleStatus('adset', as.id, as.status); }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{as.name}</p>
                      <p className="text-xs text-muted-foreground">{as.optimization_goal} · Diário: {fmtBRL(as.daily_budget)}</p>
                    </div>
                    <div className="text-right text-xs hidden md:block">
                      <p className="font-medium">{fmtBRL(as.insights?.spend)}</p>
                      <p className="text-muted-foreground">{as.insights?.leads || 0} leads</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); setBudgetEntity({ id: as.id, name: as.name, daily_budget: as.daily_budget, lifetime_budget: as.lifetime_budget }); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ads with creatives */}
          {selectedAdset && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Anúncios — {selectedAdset.name}</h3>
              {loadingAds ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}</div>
              ) : ads.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum anúncio.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ads.map(ad => (
                    <Card key={ad.id} className="overflow-hidden bg-card/60 border-border/40">
                      <div className="aspect-video bg-muted/40 relative overflow-hidden">
                        {ad.creative?.thumbnail_url || ad.creative?.image_url ? (
                          <img src={ad.creative.image_url || ad.creative.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-muted-foreground/40" /></div>
                        )}
                        <div className="absolute top-2 left-2"><StatusBadge status={ad.status} /></div>
                        {ad.preview_url && (
                          <a href={ad.preview_url} target="_blank" rel="noreferrer"
                             className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-md hover:bg-black/80">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      <CardContent className="p-3 space-y-2">
                        <p className="text-sm font-medium truncate">{ad.creative?.title || ad.name}</p>
                        {ad.creative?.body && <p className="text-xs text-muted-foreground line-clamp-2">{ad.creative.body}</p>}
                        <div className="flex items-center justify-between pt-2 border-t border-border/30">
                          <div className="text-xs">
                            <span className="text-muted-foreground">Gasto </span>
                            <span className="font-medium">{fmtBRL(ad.insights?.spend)}</span>
                            <span className="text-muted-foreground"> · CTR </span>
                            <span className="font-medium">{fmtPct(ad.insights?.ctr)}</span>
                          </div>
                          <Switch checked={ad.status === 'active'}
                            onCheckedChange={() => toggleStatus('ad', ad.id, ad.status)} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <BudgetEditor open={!!budgetEntity} onOpenChange={(o) => !o && setBudgetEntity(null)} entity={budgetEntity} entityType="adset" onSaved={loadAdsets} />
      </SheetContent>
    </Sheet>
  );
}

interface Props { adAccountId: string; datePreset: string; }

export function CampaignsManager({ adAccountId, datePreset }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<keyof Insights | 'name'>('spend');
  const [drillCampaign, setDrillCampaign] = useState<Campaign | null>(null);
  const [budgetEntity, setBudgetEntity] = useState<any>(null);
  const [alertCampaign, setAlertCampaign] = useState<{ id: string; name: string } | null>(null);
  const [series, setSeries] = useState<any[]>([]);
  const [view, setView] = useState<'table' | 'bi'>('table');

  const load = useCallback(async () => {
    if (!adAccountId) return;
    setLoading(true);
    try {
      const [campRes, tsRes] = await Promise.all([
        supabase.functions.invoke('meta-campaigns-manager', { body: { action: 'list_campaigns', adAccountId, datePreset } }),
        supabase.functions.invoke('meta-campaigns-manager', { body: { action: 'timeseries', adAccountId, datePreset } }),
      ]);
      if (campRes.error || campRes.data?.error) throw new Error(campRes.data?.error || 'Erro ao listar campanhas');
      setCampaigns(campRes.data.campaigns || []);
      if (!tsRes.error && tsRes.data?.series) setSeries(tsRes.data.series);
    } catch (e: any) { toast.error(e.message || 'Erro'); }
    finally { setLoading(false); }
  }, [adAccountId, datePreset]);

  useEffect(() => { load(); }, [load]);

  const toggleCampaign = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'PAUSED' : 'ACTIVE';
    try {
      const { data, error } = await supabase.functions.invoke('meta-campaigns-manager', {
        body: { action: 'toggle_status', entityType: 'campaign', entityId: id, status: newStatus },
      });
      if (error || data?.error) throw new Error(data?.error || 'Erro');
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: newStatus.toLowerCase() } : c));
      toast.success(newStatus === 'ACTIVE' ? 'Campanha ativada' : 'Campanha pausada');
    } catch (e: any) { toast.error(e.message || 'Erro'); }
  };

  const filtered = campaigns
    .filter(c => statusFilter === 'all' || c.status === statusFilter)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      const av = a.insights?.[sortBy] ?? 0;
      const bv = b.insights?.[sortBy] ?? 0;
      return (bv as number) - (av as number);
    });

  const totals = filtered.reduce((acc, c) => {
    if (!c.insights) return acc;
    acc.spend += c.insights.spend;
    acc.impressions += c.insights.impressions;
    acc.clicks += c.insights.clicks;
    acc.leads += c.insights.leads;
    acc.purchaseValue += c.insights.purchaseValue;
    return acc;
  }, { spend: 0, impressions: 0, clicks: 0, leads: 0, purchaseValue: 0 });

  return (
    <div className="space-y-4">
      <Card className="bg-card/50 border-border/30">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Gestão de Campanhas</CardTitle>
              <CardDescription>Performance, controle e drilldown completo até o criativo</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={view} onValueChange={(v) => setView(v as any)}>
                <TabsList className="h-9">
                  <TabsTrigger value="table" className="text-xs">Tabela</TabsTrigger>
                  <TabsTrigger value="bi" className="text-xs">BI</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="outline" size="icon" onClick={load} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Totals strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Investimento', value: fmtBRL(totals.spend) },
              { label: 'Impressões', value: fmtNum(totals.impressions) },
              { label: 'Cliques', value: fmtNum(totals.clicks) },
              { label: 'Leads', value: fmtNum(totals.leads) },
              { label: 'CPL Médio', value: totals.leads > 0 ? fmtBRL(totals.spend / totals.leads) : '—' },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          {view === 'bi' ? (
            <div className="space-y-4">
              <Card className="border-border/40">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Investimento x Leads ao longo do tempo</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis yAxisId="left" fontSize={11} />
                      <YAxis yAxisId="right" orientation="right" fontSize={11} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="spend" name="Gasto (R$)" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--chart-2, 142 71% 45%))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Comparativo de Campanhas (Gasto vs Leads)</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filtered.slice(0, 10).map(c => ({ name: c.name.slice(0, 24), spend: c.insights?.spend || 0, leads: c.insights?.leads || 0 }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="name" fontSize={10} angle={-15} textAnchor="end" height={60} />
                      <YAxis yAxisId="left" fontSize={11} />
                      <YAxis yAxisId="right" orientation="right" fontSize={11} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="spend" name="Gasto (R$)" fill="hsl(var(--primary))" />
                      <Bar yAxisId="right" dataKey="leads" name="Leads" fill="hsl(142 71% 45%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Buscar campanha..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="paused">Pausados</SelectItem>
                    <SelectItem value="archived">Arquivados</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="w-[160px]">
                    <ArrowUpDown className="w-3.5 h-3.5 mr-1" /><SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spend">Maior gasto</SelectItem>
                    <SelectItem value="leads">Mais leads</SelectItem>
                    <SelectItem value="impressions">Mais impressões</SelectItem>
                    <SelectItem value="clicks">Mais cliques</SelectItem>
                    <SelectItem value="ctr">Maior CTR</SelectItem>
                    <SelectItem value="cpl">Menor CPL</SelectItem>
                    <SelectItem value="roas">Maior ROAS</SelectItem>
                    <SelectItem value="name">Nome (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              {loading ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Inbox className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Nenhuma campanha encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="text-left p-2 font-medium">Status</th>
                        <th className="text-left p-2 font-medium">Campanha</th>
                        <th className="text-right p-2 font-medium">Gasto</th>
                        <th className="text-right p-2 font-medium">Diário</th>
                        <th className="text-right p-2 font-medium">Impr.</th>
                        <th className="text-right p-2 font-medium">CTR</th>
                        <th className="text-right p-2 font-medium">Leads</th>
                        <th className="text-right p-2 font-medium">CPL</th>
                        <th className="text-right p-2 font-medium">ROAS</th>
                        <th className="text-right p-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(c => (
                        <tr key={c.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors group cursor-pointer"
                          onClick={() => setDrillCampaign(c)}>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={c.status === 'active'}
                                onClick={(e) => e.stopPropagation()}
                                onCheckedChange={() => toggleCampaign(c.id, c.status)}
                              />
                              <StatusBadge status={c.status} />
                            </div>
                          </td>
                          <td className="p-2">
                            <p className="font-medium text-foreground truncate max-w-[260px]">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.objective}</p>
                          </td>
                          <td className="p-2 text-right font-medium">{fmtBRL(c.insights?.spend)}</td>
                          <td className="p-2 text-right text-muted-foreground">{fmtBRL(c.daily_budget)}</td>
                          <td className="p-2 text-right text-muted-foreground">{fmtNum(c.insights?.impressions)}</td>
                          <td className="p-2 text-right">{fmtPct(c.insights?.ctr)}</td>
                          <td className="p-2 text-right font-medium">{c.insights?.leads || 0}</td>
                          <td className="p-2 text-right text-primary">{c.insights?.cpl ? fmtBRL(c.insights.cpl) : '—'}</td>
                          <td className="p-2 text-right">
                            {c.insights?.roas ? (
                              <span className={c.insights.roas >= 1 ? 'text-emerald-500 font-medium' : 'text-muted-foreground'}>
                                {c.insights.roas.toFixed(2)}x
                              </span>
                            ) : '—'}
                          </td>
                          <td className="p-2 text-right">
                            <div className="flex justify-end gap-0.5">
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                title="Alertas de performance"
                                onClick={(e) => { e.stopPropagation(); setAlertCampaign({ id: c.id, name: c.name }); }}>
                                <Bell className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                title="Editar orçamento"
                                onClick={(e) => { e.stopPropagation(); setBudgetEntity({ id: c.id, name: c.name, daily_budget: c.daily_budget, lifetime_budget: c.lifetime_budget }); }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CampaignDrilldown campaign={drillCampaign} open={!!drillCampaign} onOpenChange={(o) => !o && setDrillCampaign(null)} datePreset={datePreset} onMutated={load} />
      <BudgetEditor open={!!budgetEntity} onOpenChange={(o) => !o && setBudgetEntity(null)} entity={budgetEntity} entityType="campaign" adAccountId={adAccountId} onSaved={load} />
    </div>
  );
}
