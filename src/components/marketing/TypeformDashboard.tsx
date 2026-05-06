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
  matched_leads: number;
  matched_deals: number;
  won: number;
  won_value: number;
  completion_rate: number;
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
  const [pickedForm, setPickedForm] = useState<string>('');
  const [campaignTag, setCampaignTag] = useState('');

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
    const { data, error } = await supabase.functions.invoke('typeform-manager', { body: { action: 'list_typeform_forms' } });
    if (error) toast.error('Erro ao listar formulários do Typeform');
    else setAvailableForms(data?.items || []);
    setLoadingAvailable(false);
  };

  const addForm = async () => {
    const f = availableForms.find(x => x.id === pickedForm);
    if (!f) { toast.error('Selecione um formulário'); return; }
    const { error } = await supabase.functions.invoke('typeform-manager', {
      body: { action: 'add_form', form_id: f.id, title: f.title, campaign_tag: campaignTag || null },
    });
    if (error) { toast.error('Erro ao adicionar'); return; }
    toast.success('Formulário rastreado! Webhook instalado.');
    setAddOpen(false); setPickedForm(''); setCampaignTag('');
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
              <CardDescription>Visitas → Iniciados → Concluídos → Lead no Roy → Ganho</CardDescription>
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
              <FunnelCard label="Visitas" value={funnel.visits} icon={Users} />
              <FunnelCard label="Iniciados" value={funnel.starts} icon={TrendingUp} sub={funnel.visits ? `${((funnel.starts/funnel.visits)*100).toFixed(1)}%` : undefined} />
              <FunnelCard label="Submissões" value={funnel.submissions} icon={CheckCircle2} sub={funnel.starts ? `${((funnel.submissions/funnel.starts)*100).toFixed(1)}%` : undefined} />
              <FunnelCard label="Completados" value={funnel.completed} icon={CheckCircle2} sub={`${funnel.completion_rate.toFixed(1)}%`} highlight />
              <FunnelCard label="Lead no Roy" value={funnel.matched_leads + funnel.matched_deals} icon={Users} sub={funnel.completed ? `${(((funnel.matched_leads + funnel.matched_deals)/funnel.completed)*100).toFixed(1)}%` : undefined} />
              <FunnelCard label="Ganhos" value={funnel.won} icon={Trophy} sub={fmtBRL(funnel.won_value)} highlight />
              <FunnelCard label="Tempo médio" value={fmtTime(funnel.avg_time)} icon={Clock} />
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
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar formulário Typeform</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Formulário</label>
              {loadingAvailable ? <Skeleton className="h-9 mt-1" /> : (
                <Select value={pickedForm} onValueChange={setPickedForm}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um formulário" /></SelectTrigger>
                  <SelectContent>
                    {availableForms.map(f => <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Tag de campanha (opcional)</label>
              <Input className="mt-1" value={campaignTag} onChange={e => setCampaignTag(e.target.value)} placeholder="ex: meta-blackfriday" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={addForm} disabled={!pickedForm}>Adicionar e instalar webhook</Button>
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
