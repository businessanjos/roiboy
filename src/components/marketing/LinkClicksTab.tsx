import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LINK_CLICK_STORAGE, sumLinkClicks, type LinkClickPlacement } from '@/lib/marketing/linkClicks';
import { formatMetricInput, parseMetricInput } from '@/lib/marketing/metricInput';
import { toast } from 'sonner';
import { MonthPicker } from './MonthPicker';

const fmt = (n: number) => n.toLocaleString('pt-BR');

export function LinkClicksTab({ placement }: { placement: LinkClickPlacement }) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const accountId = currentUser?.account_id;
  const storage = LINK_CLICK_STORAGE[placement];
  const isStory = placement === 'story';
  const noun = isStory ? 'story' : 'post do feed';
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [profileId, setProfileId] = useState('');
  const [form, setForm] = useState({ date: format(now, 'yyyy-MM-dd'), description: '', link_url: '', views: '', link_clicks: '' });
  const [saving, setSaving] = useState(false);

  const profilesQuery = useQuery({
    queryKey: ['link-clicks-profiles', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase.from('instagram_profiles').select('id, username').eq('account_id', accountId).order('username');
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(accountId),
  });
  const profiles = profilesQuery.data ?? [];
  useEffect(() => {
    if (profiles.length && !profiles.some((p) => p.id === profileId)) setProfileId(profiles[0].id);
  }, [profiles, profileId]);

  const start = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = new Date(Number(year), Number(month), 0).getDate();
  const end = `${year}-${month.padStart(2, '0')}-${endDate}`;
  const key = ['link-clicks', placement, accountId, profileId, year, month];
  const rowsQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!accountId || !profileId) return [];
      const { data, error } = await supabase.from(storage.table).select('*')
        .eq('account_id', accountId).eq('profile_id', profileId)
        .gte(storage.dateField, start).lte(storage.dateField, end)
        .order(storage.dateField, { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id, date: 'story_date' in row ? row.story_date : row.post_date,
        description: row.description, link_url: row.link_url, views: row.views, link_clicks: row.link_clicks,
      }));
    },
    enabled: Boolean(accountId && profileId),
  });
  const rows = rowsQuery.data ?? [];
  const totals = useMemo(() => sumLinkClicks(rows), [rows]);

  const add = async () => {
    if (!accountId || !profileId || saving) return;
    if (!form.date) return toast.error('Informe a data da publicação.');
    setSaving(true);
    try {
      const values = {
        account_id: accountId, profile_id: profileId,
        description: form.description.trim() || null, link_url: form.link_url.trim() || null,
        views: parseMetricInput(form.views), link_clicks: parseMetricInput(form.link_clicks),
        created_by: currentUser?.auth_user_id ?? null,
      };
      const { error } = isStory
        ? await supabase.from('instagram_story_link_clicks').insert({ ...values, story_date: form.date })
        : await supabase.from('instagram_feed_link_clicks').insert({ ...values, post_date: form.date });
      if (error) throw error;
      toast.success(isStory ? 'Story registrado.' : 'Post do feed registrado.');
      setForm((f) => ({ ...f, description: '', link_url: '', views: '', link_clicks: '' }));
      await qc.invalidateQueries({ queryKey: ['link-clicks', placement, accountId] });
    } catch {
      toast.error(`Não foi possível salvar o ${noun}.`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!accountId) return;
    const { error } = await supabase.from(storage.table).delete().eq('id', id).eq('account_id', accountId).eq('profile_id', profileId);
    if (error) return toast.error('Não foi possível excluir.');
    await qc.invalidateQueries({ queryKey: key });
  };

  if (!accountId || profilesQuery.isPending) return <p role="status" className="py-6 text-sm text-muted-foreground">Carregando perfis…</p>;
  if (profilesQuery.isError) return (
    <div role="alert" className="space-y-3 py-6">
      <p className="text-sm text-muted-foreground">Não foi possível carregar os perfis.</p>
      <Button variant="outline" onClick={() => profilesQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button>
    </div>
  );
  if (!profiles.length) return <p className="py-6 text-sm text-muted-foreground">Nenhum perfil de Instagram cadastrado.</p>;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={profileId} onValueChange={setProfileId}>
          <SelectTrigger aria-label="Perfil do Instagram" className="min-h-11 w-56 max-w-full"><SelectValue placeholder="Perfil" /></SelectTrigger>
          <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>@{p.username.replace(/^@/, '')}</SelectItem>)}</SelectContent>
        </Select>
        <MonthPicker year={Number(year)} month={Number(month)} onMonthChange={(m) => setMonth(String(m))} onYearChange={(y) => setYear(String(y))} />
      </div>

      {rowsQuery.isError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{rowsQuery.data ? 'Últimos números disponíveis — atualização não concluída.' : 'Não foi possível carregar os cliques deste mês.'}</span>
        <Button variant="ghost" size="sm" onClick={() => rowsQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button>
      </div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[[isStory ? 'Stories com link' : 'Posts do feed com link', fmt(totals.count)], ['Cliques no link', fmt(totals.clicks)], ['Taxa de clique', `${totals.rate.toFixed(1).replace('.', ',')}%`]].map(([label, value]) => (
          <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words text-2xl font-semibold">{rowsQuery.isPending || (rowsQuery.isError && !rowsQuery.data) ? '—' : value}</p></CardContent></Card>
        ))}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void add(); }} className="grid min-w-0 grid-cols-1 items-end gap-3 border-y border-border py-4 sm:grid-cols-2 xl:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_130px_100px_auto]">
        <div className="min-w-0 space-y-1.5"><Label htmlFor={`${placement}-date`}>Data</Label><Input id={`${placement}-date`} type="date" className="min-h-11 text-base" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Data" /></div>
        <div className="min-w-0 space-y-1.5"><Label htmlFor={`${placement}-description`}>{isStory ? 'Story' : 'Post do feed'}</Label><Input id={`${placement}-description`} className="min-h-11 text-base" placeholder={`Sobre o ${noun}`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="min-w-0 space-y-1.5"><Label htmlFor={`${placement}-link`}>Link</Label><Input id={`${placement}-link`} className="min-h-11 text-base" placeholder="https://" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} /></div>
        <div className="min-w-0 space-y-1.5"><Label htmlFor={`${placement}-views`}>Visualizações</Label><Input id={`${placement}-views`} className="min-h-11 text-base" inputMode="numeric" placeholder="0" value={form.views} onChange={(e) => setForm({ ...form, views: formatMetricInput(e.target.value) })} /></div>
        <div className="min-w-0 space-y-1.5"><Label htmlFor={`${placement}-clicks`}>Cliques</Label><Input id={`${placement}-clicks`} className="min-h-11 text-base" inputMode="numeric" placeholder="0" value={form.link_clicks} onChange={(e) => setForm({ ...form, link_clicks: formatMetricInput(e.target.value) })} /></div>
        <Button type="submit" className="min-h-11 gap-2" disabled={saving || !profileId}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Adicionar</Button>
      </form>

      {rowsQuery.isPending ? <p role="status" className="py-6 text-sm text-muted-foreground">Carregando cliques…</p> : rows.length === 0 ? (
        !rowsQuery.isError && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum {noun} com link neste mês.</p>
      ) : (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b text-xs text-muted-foreground"><tr>
              <th scope="col" className="p-3 text-left">Data</th><th scope="col" className="p-3 text-left">{isStory ? 'Story' : 'Post do feed'}</th><th scope="col" className="p-3 text-right">Visualizações</th><th scope="col" className="p-3 text-right">Cliques</th><th scope="col" className="p-3 text-right">Taxa</th><th scope="col" className="p-3"><span className="sr-only">Ações</span></th>
            </tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="whitespace-nowrap p-3">{row.date.split('-').reverse().join('/')}</td>
                <td className="max-w-64 p-3"><div className="break-words">{row.description || '—'}</div>{row.link_url && /^https?:\/\//i.test(row.link_url) && <a href={row.link_url} target="_blank" rel="noreferrer" className="break-all text-xs text-primary underline">{row.link_url}</a>}</td>
                <td className="p-3 text-right">{fmt(row.views)}</td><td className="p-3 text-right font-medium">{fmt(row.link_clicks)}</td>
                <td className="p-3 text-right">{row.views ? `${(row.link_clicks / row.views * 100).toFixed(1).replace('.', ',')}%` : '—'}</td>
                <td className="p-3 text-right"><Button size="icon" variant="ghost" className="h-11 w-11" aria-label={`Excluir ${noun}`} onClick={() => remove(row.id)}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}