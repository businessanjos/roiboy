import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Link2, Copy, Check, Plus, Trash2, Pencil, Search, ExternalLink, BarChart3, Sparkles, QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MarketingLink {
  id: string;
  account_id: string;
  created_by_user_id: string | null;
  name: string;
  destination_url: string;
  full_url: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  meta_campaign_id: string | null;
  meta_campaign_name: string | null;
  event_id: string | null;
  seller_user_id: string | null;
  tags: string[] | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
}

interface FormState {
  id?: string;
  name: string;
  destination_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  meta_campaign_id: string;
  event_id: string;
  seller_user_id: string;
  notes: string;
  tags: string;
}

const SOURCE_PRESETS = ['facebook', 'instagram', 'google', 'youtube', 'whatsapp', 'email', 'tiktok', 'linkedin', 'direct'];
const MEDIUM_PRESETS = ['cpc', 'organic', 'social', 'email', 'referral', 'display', 'video', 'affiliate'];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function buildUrl(form: FormState): string {
  if (!form.destination_url) return '';
  let base = form.destination_url.trim();
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return '';
  }
  const params = url.searchParams;
  const set = (k: string, v: string) => {
    const val = v.trim();
    if (val) params.set(k, val);
  };
  set('utm_source', form.utm_source);
  set('utm_medium', form.utm_medium);
  set('utm_campaign', form.utm_campaign);
  set('utm_content', form.utm_content);
  set('utm_term', form.utm_term);
  return url.toString();
}

const emptyForm: FormState = {
  name: '',
  destination_url: '',
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
  utm_content: '',
  utm_term: '',
  meta_campaign_id: '',
  event_id: '',
  seller_user_id: '',
  notes: '',
  tags: '',
};

export function MarketingLinksUtm() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const userId = currentUser?.id;
  const [links, setLinks] = useState<MarketingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [analyticsLink, setAnalyticsLink] = useState<MarketingLink | null>(null);

  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string; meta_campaign_id: string | null }>>([]);
  const [events, setEvents] = useState<Array<{ id: string; title: string }>>([]);
  const [sellers, setSellers] = useState<Array<{ id: string; name: string }>>([]);

  const fetchAll = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [linksRes, campRes, evRes, userRes] = await Promise.all([
        supabase.from('marketing_links').select('*').eq('account_id', accountId).eq('archived', false).order('created_at', { ascending: false }),
        supabase.from('marketing_ad_sets').select('id, name, meta_campaign_id').order('updated_at', { ascending: false }).limit(200),
        supabase.from('events').select('id, title').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(200),
        supabase.from('users').select('id, name').eq('account_id', accountId).order('name'),
      ]);
      setLinks((linksRes.data as MarketingLink[]) || []);
      setCampaigns(campRes.data || []);
      setEvents(evRes.data || []);
      setSellers(userRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const previewUrl = useMemo(() => buildUrl(form), [form]);

  const openNew = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (l: MarketingLink) => {
    setForm({
      id: l.id,
      name: l.name,
      destination_url: l.destination_url,
      utm_source: l.utm_source || '',
      utm_medium: l.utm_medium || '',
      utm_campaign: l.utm_campaign || '',
      utm_content: l.utm_content || '',
      utm_term: l.utm_term || '',
      meta_campaign_id: l.meta_campaign_id || '',
      event_id: l.event_id || '',
      seller_user_id: l.seller_user_id || '',
      notes: l.notes || '',
      tags: (l.tags || []).join(', '),
    });
    setOpen(true);
  };

  const autoFillFromCampaign = (metaCampaignId: string) => {
    const camp = campaigns.find((c) => c.meta_campaign_id === metaCampaignId || c.id === metaCampaignId);
    if (!camp) return;
    setForm((f) => ({
      ...f,
      meta_campaign_id: camp.meta_campaign_id || camp.id,
      utm_source: f.utm_source || 'facebook',
      utm_medium: f.utm_medium || 'cpc',
      utm_campaign: f.utm_campaign || slugify(camp.name),
    }));
  };

  const autoFillFromEvent = (eventId: string) => {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    setForm((f) => ({
      ...f,
      event_id: eventId,
      utm_campaign: f.utm_campaign || `evento-${slugify(ev.title)}`,
    }));
  };

  const autoFillFromSeller = (sellerId: string) => {
    const s = sellers.find((u) => u.id === sellerId);
    if (!s) return;
    setForm((f) => ({
      ...f,
      seller_user_id: sellerId,
      utm_content: f.utm_content || slugify(s.name),
    }));
  };

  const handleSave = async () => {
    if (!accountId) return;
    if (!form.name.trim()) return toast.error('Dê um nome ao link');
    if (!form.destination_url.trim()) return toast.error('URL de destino é obrigatória');
    const full = buildUrl(form);
    if (!full) return toast.error('URL de destino inválida');

    setSaving(true);
    const tagsArr = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const metaCamp = campaigns.find((c) => (c.meta_campaign_id || c.id) === form.meta_campaign_id);
    const payload = {
      account_id: accountId,
      created_by_user_id: userId || null,
      name: form.name.trim(),
      destination_url: form.destination_url.trim(),
      full_url: full,
      utm_source: form.utm_source.trim() || null,
      utm_medium: form.utm_medium.trim() || null,
      utm_campaign: form.utm_campaign.trim() || null,
      utm_content: form.utm_content.trim() || null,
      utm_term: form.utm_term.trim() || null,
      meta_campaign_id: form.meta_campaign_id || null,
      meta_campaign_name: metaCamp?.name || null,
      event_id: form.event_id || null,
      seller_user_id: form.seller_user_id || null,
      tags: tagsArr,
      notes: form.notes.trim() || null,
    };
    try {
      if (form.id) {
        const { error } = await supabase.from('marketing_links').update(payload).eq('id', form.id);
        if (error) throw error;
        toast.success('Link atualizado');
      } else {
        const { error } = await supabase.from('marketing_links').insert(payload);
        if (error) throw error;
        toast.success('Link criado');
      }
      setOpen(false);
      fetchAll();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('marketing_links').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success('Link removido');
      setDeleteId(null);
      fetchAll();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao remover');
    }
  };

  const copy = async (l: MarketingLink) => {
    try {
      await navigator.clipboard.writeText(l.full_url);
      setCopiedId(l.id);
      toast.success('Link copiado');
      setTimeout(() => setCopiedId((c) => (c === l.id ? null : c)), 1800);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return links.filter((l) => {
      if (filterSource !== 'all' && (l.utm_source || '').toLowerCase() !== filterSource) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        (l.utm_campaign || '').toLowerCase().includes(q) ||
        (l.utm_content || '').toLowerCase().includes(q) ||
        (l.full_url || '').toLowerCase().includes(q) ||
        (l.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [links, search, filterSource]);

  const sourcesAvailable = useMemo(() => {
    const s = new Set(links.map((l) => l.utm_source).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [links]);

  return (
    <div className="space-y-4">
      <Card className="bg-card/50 border-border/30">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-primary" />
                Links & UTM
              </CardTitle>
              <CardDescription>
                Gere links rastreáveis com parâmetros UTM e organize por campanha, evento ou vendedor.
              </CardDescription>
            </div>
            <Button onClick={openNew} className="gap-1.5">
              <Plus className="w-4 h-4" /> Novo link
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, campanha, tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                {sourcesAvailable.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} de {links.length}
            </span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Link2 className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">{links.length === 0 ? 'Nenhum link criado ainda' : 'Nenhum link com esses filtros'}</p>
              {links.length === 0 && (
                <Button variant="outline" size="sm" onClick={openNew} className="mt-3 gap-1.5">
                  <Plus className="w-4 h-4" /> Criar primeiro link
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((l) => (
                <LinkRow
                  key={l.id}
                  link={l}
                  onCopy={() => copy(l)}
                  copied={copiedId === l.id}
                  onEdit={() => openEdit(l)}
                  onDelete={() => setDeleteId(l.id)}
                  onAnalytics={() => setAnalyticsLink(l)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Builder dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {form.id ? 'Editar link' : 'Novo link com UTM'}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basics">
            <TabsList>
              <TabsTrigger value="basics">Básico</TabsTrigger>
              <TabsTrigger value="utm">UTM</TabsTrigger>
              <TabsTrigger value="link">Vínculos</TabsTrigger>
            </TabsList>

            <TabsContent value="basics" className="space-y-3 pt-3">
              <div>
                <Label>Nome interno *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Bio Instagram - Lançamento Outubro"
                />
              </div>
              <div>
                <Label>URL de destino *</Label>
                <Input
                  value={form.destination_url}
                  onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
                  placeholder="https://iamroy.app/..."
                />
              </div>
              <div>
                <Label>Tags (separadas por vírgula)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="bio, instagram, q4" />
              </div>
              <div>
                <Label>Notas</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </TabsContent>

            <TabsContent value="utm" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>utm_source</Label>
                  <Input list="utm-sources" value={form.utm_source} onChange={(e) => setForm({ ...form, utm_source: e.target.value })} placeholder="facebook" />
                  <datalist id="utm-sources">
                    {SOURCE_PRESETS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label>utm_medium</Label>
                  <Input list="utm-mediums" value={form.utm_medium} onChange={(e) => setForm({ ...form, utm_medium: e.target.value })} placeholder="cpc" />
                  <datalist id="utm-mediums">
                    {MEDIUM_PRESETS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div className="col-span-2">
                  <Label>utm_campaign</Label>
                  <Input value={form.utm_campaign} onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })} placeholder="lancamento-outubro" />
                </div>
                <div>
                  <Label>utm_content</Label>
                  <Input value={form.utm_content} onChange={(e) => setForm({ ...form, utm_content: e.target.value })} placeholder="vendedor / criativo" />
                </div>
                <div>
                  <Label>utm_term</Label>
                  <Input value={form.utm_term} onChange={(e) => setForm({ ...form, utm_term: e.target.value })} placeholder="palavra-chave" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="link" className="space-y-3 pt-3">
              <div>
                <Label>Campanha Meta Ads</Label>
                <Select value={form.meta_campaign_id || 'none'} onValueChange={(v) => (v === 'none' ? setForm({ ...form, meta_campaign_id: '' }) : autoFillFromCampaign(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.meta_campaign_id || c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Preenche utm_source/medium/campaign automaticamente.</p>
              </div>
              <div>
                <Label>Evento / Lançamento</Label>
                <Select value={form.event_id || 'none'} onValueChange={(v) => (v === 'none' ? setForm({ ...form, event_id: '' }) : autoFillFromEvent(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="none">Nenhum</SelectItem>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vendedor / SDR (vai em utm_content)</Label>
                <Select value={form.seller_user_id || 'none'} onValueChange={(v) => (v === 'none' ? setForm({ ...form, seller_user_id: '' }) : autoFillFromSeller(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="none">Nenhum</SelectItem>
                    {sellers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          <div className="rounded-md border border-border/40 bg-muted/30 p-3 mt-2">
            <p className="text-xs text-muted-foreground mb-1">Pré-visualização</p>
            <p className="text-xs font-mono break-all text-foreground">{previewUrl || '—'}</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : form.id ? 'Salvar' : 'Criar link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este link?</AlertDialogTitle>
            <AlertDialogDescription>
              O link será removido permanentemente. Leads já atribuídos não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LinkAnalyticsDialog
        link={analyticsLink}
        accountId={accountId}
        onClose={() => setAnalyticsLink(null)}
      />
    </div>
  );
}

function LinkRow({
  link,
  onCopy,
  copied,
  onEdit,
  onDelete,
  onAnalytics,
}: {
  link: MarketingLink;
  onCopy: () => void;
  copied: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAnalytics: () => void;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 p-3 hover:border-border/70 transition">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-foreground truncate">{link.name}</p>
            {link.utm_source && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {link.utm_source}
              </Badge>
            )}
            {link.utm_medium && (
              <Badge variant="secondary" className="text-[10px]">
                {link.utm_medium}
              </Badge>
            )}
            {link.meta_campaign_name && (
              <Badge variant="outline" className="text-[10px] bg-blue-500/10 border-blue-500/30 text-blue-400">
                Meta: {link.meta_campaign_name}
              </Badge>
            )}
            {(link.tags || []).map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                #{t}
              </Badge>
            ))}
          </div>
          <a
            href={link.full_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-muted-foreground hover:text-primary break-all block mt-1"
          >
            {link.full_url}
          </a>
          <p className="text-[10px] text-muted-foreground mt-1">
            Criado em {format(new Date(link.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="outline" onClick={onCopy} className="gap-1.5">
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onAnalytics} title="Atribuição de leads">
            <BarChart3 className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" asChild title="Abrir">
            <a href={link.full_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} title="Editar">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} title="Remover" className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function LinkAnalyticsDialog({
  link,
  accountId,
  onClose,
}: {
  link: MarketingLink | null;
  accountId: string | null | undefined;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ leads: number; deals: number; won: number; revenue: number } | null>(null);

  useEffect(() => {
    if (!link || !accountId) return;
    setLoading(true);
    setStats(null);
    (async () => {
      try {
        const campaign = link.utm_campaign;
        const content = link.utm_content;
        let leadsQ = supabase.from('leads').select('id, converted_to_client_id', { count: 'exact' }).eq('account_id', accountId);
        if (campaign) {
          leadsQ = leadsQ.ilike('source', `%${campaign}%`);
        } else if (content) {
          leadsQ = leadsQ.ilike('source', `%${content}%`);
        } else {
          // No matching key — bail
          setStats({ leads: 0, deals: 0, won: 0, revenue: 0 });
          setLoading(false);
          return;
        }
        const { data: leadsData, count } = await leadsQ.limit(1000);
        const leadIds = (leadsData || []).map((l: any) => l.id);
        const clientIds = (leadsData || []).map((l: any) => l.converted_to_client_id).filter(Boolean);

        let dealCount = 0;
        let wonCount = 0;
        let revenue = 0;
        if (clientIds.length) {
          const { data: deals } = await supabase
            .from('deals')
            .select('id, status, value')
            .in('client_id', clientIds)
            .limit(1000);
          dealCount = deals?.length || 0;
          (deals || []).forEach((d: any) => {
            if (d.status === 'won' || d.status === 'ganho') {
              wonCount += 1;
              revenue += Number(d.value || 0);
            }
          });
        }
        setStats({ leads: count || leadIds.length, deals: dealCount, won: wonCount, revenue });
      } catch (e) {
        console.error(e);
        setStats({ leads: 0, deals: 0, won: 0, revenue: 0 });
      } finally {
        setLoading(false);
      }
    })();
  }, [link, accountId]);

  if (!link) return null;

  return (
    <Dialog open={!!link} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Atribuição — {link.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded border border-border/40 bg-muted/30 p-3 text-xs">
            <p className="text-muted-foreground mb-1">Chave de atribuição</p>
            <p className="font-mono">
              source ILIKE %{link.utm_campaign || link.utm_content || '—'}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Leads cuja origem contém o utm_campaign (ou utm_content como fallback) deste link.
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Leads" value={stats.leads.toLocaleString('pt-BR')} />
              <StatBox label="Negociações" value={stats.deals.toLocaleString('pt-BR')} />
              <StatBox label="Ganhas" value={stats.won.toLocaleString('pt-BR')} accent />
              <StatBox label="Receita" value={`R$ ${stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} accent />
            </div>
          ) : null}

          <p className="text-[10px] text-muted-foreground">
            Sem encurtador próprio, contagem de cliques diretos não está disponível. Use plataformas como Meta Ads, Bitly ou seu shortener favorito para clicks brutos — esta tela mostra a conversão real (leads → vendas) atribuída ao link.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-card/40'}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold mt-1 ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
