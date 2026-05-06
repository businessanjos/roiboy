import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Plus, RefreshCw, Trash2, Users, CheckCircle2, TrendingUp, Trophy, Clock, ExternalLink, Search } from 'lucide-react';
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
  const [period, setPeriod] = useState(30);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
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
    if (data && data.length && !selectedForm) setSelectedForm(data[0].form_id);
    setLoading(false);
  }, [selectedForm]);

  useEffect(() => { loadForms(); }, [loadForms]);

  const loadFunnel = useCallback(async () => {
    if (!selectedForm) { setFunnel(null); return; }
    setLoadingFunnel(true);
    const { data, error } = await supabase.functions.invoke('typeform-manager', {
      body: { action: 'get_dashboard', form_id: selectedForm, days: period },
    });
    if (error) toast.error('Erro ao carregar funil');
    else setFunnel(data?.funnel || null);
    setLoadingFunnel(false);
  }, [selectedForm, period]);

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
    const { error } = await supabase.functions.invoke('typeform-manager', { body: { action: 'refresh_form', form_id: selectedForm } });
    if (error) toast.error('Erro ao sincronizar');
    else { toast.success('Sincronizado'); await loadFunnel(); }
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
              <CardDescription>
                Visitas/Iniciados/Tempo médio são <strong>histórico total</strong> (Typeform Insights). Submissões em diante respeitam o período selecionado.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {forms.length > 0 && (
                <Select value={selectedForm} onValueChange={setSelectedForm}>
                  <SelectTrigger className="w-[260px]"><SelectValue placeholder="Formulário" /></SelectTrigger>
                  <SelectContent>
                    {forms.map(f => <SelectItem key={f.form_id} value={f.form_id}>{f.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7d</SelectItem>
                  <SelectItem value="30">Últimos 30d</SelectItem>
                  <SelectItem value="90">Últimos 90d</SelectItem>
                  <SelectItem value="365">Últimos 12m</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <FunnelCard label="Visitas (total)" value={funnel.visits} icon={Users} sub="histórico" />
              <FunnelCard label="Iniciados (total)" value={funnel.starts} icon={TrendingUp} sub={funnel.visits ? `${((funnel.starts/funnel.visits)*100).toFixed(1)}% das visitas` : 'histórico'} />
              <FunnelCard label="Submissões" value={funnel.submissions} icon={CheckCircle2} sub="no período" />
              <FunnelCard label="Completados" value={funnel.completed} icon={CheckCircle2} sub={`${funnel.completion_rate.toFixed(1)}% das submissões`} highlight />
              <FunnelCard label="Lead no Roy" value={funnel.matched_responses} icon={Users} sub={funnel.completed ? `${((funnel.matched_responses/funnel.completed)*100).toFixed(1)}% dos completados` : undefined} />
              <FunnelCard label="Ganhos" value={funnel.won} icon={Trophy} sub={fmtBRL(funnel.won_value)} highlight />
              <FunnelCard label="Tempo médio" value={fmtTime(funnel.avg_time)} icon={Clock} sub="histórico" />
            </div>
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
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => togglePicked(f.id)}
                          className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
                        >
                          <Checkbox checked={checked} className="pointer-events-none" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{f.title}</p>
                            <p className="text-xs text-muted-foreground truncate">ID: {f.id}</p>
                          </div>
                        </button>
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
    </div>
  );
}

function FunnelCard({ label, value, icon: Icon, sub, highlight }: any) {
  return (
    <div className={`p-3 rounded-lg border ${highlight ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/30 bg-muted/20'}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" />{label}
      </div>
      <p className="text-xl font-bold">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
