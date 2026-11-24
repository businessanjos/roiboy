import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';
import { MonthPicker } from './MonthPicker';

const fmt = (n: number) => n.toLocaleString('pt-BR');

export function StoryLinkClicksTab() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const accountId = currentUser?.account_id;
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [profileId, setProfileId] = useState('');
  const [form, setForm] = useState({ story_date: now.toISOString().slice(0, 10), description: '', link_url: '', views: '', link_clicks: '' });
  const [saving, setSaving] = useState(false);

  const { data: profiles = [] } = useQuery({
    queryKey: ['story-clicks-profiles', accountId],
    queryFn: async () => {
      const { data, error } = await supabase.from('instagram_profiles').select('id, username').eq('account_id', accountId!).order('username');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!accountId,
  });
  useEffect(() => { if (!profileId && profiles.length) setProfileId(profiles[0].id); }, [profiles, profileId]);

  const start = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = new Date(Number(year), Number(month), 0).getDate();
  const end = `${year}-${month.padStart(2, '0')}-${endDate}`;
  const key = ['story-clicks', profileId, year, month];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from('instagram_story_link_clicks').select('*')
        .eq('profile_id', profileId).gte('story_date', start).lte('story_date', end).order('story_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profileId,
  });

  const totals = useMemo(() => {
    const views = rows.reduce((s, r) => s + (r.views || 0), 0);
    const clicks = rows.reduce((s, r) => s + (r.link_clicks || 0), 0);
    return { views, clicks, rate: views ? (clicks / views) * 100 : 0 };
  }, [rows]);

  const add = async () => {
    if (!accountId || !profileId) return;
    setSaving(true);
    const { error } = await supabase.from('instagram_story_link_clicks').insert({
      account_id: accountId, profile_id: profileId, story_date: form.story_date,
      description: form.description || null, link_url: form.link_url || null,
      views: Number(form.views.replace(/\D/g, '')) || 0, link_clicks: Number(form.link_clicks.replace(/\D/g, '')) || 0,
      created_by: currentUser?.auth_user_id ?? null,
    });
    setSaving(false);
    if (error) return toast.error('Não foi possível salvar o story.');
    toast.success('Story registrado.');
    setForm((f) => ({ ...f, description: '', link_url: '', views: '', link_clicks: '' }));
    qc.invalidateQueries({ queryKey: key });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('instagram_story_link_clicks').delete().eq('id', id);
    if (error) return toast.error('Não foi possível excluir.');
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={profileId} onValueChange={setProfileId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Perfil" /></SelectTrigger>
          <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>@{p.username}</SelectItem>)}</SelectContent>
        </Select>
        <MonthPicker year={Number(year)} month={Number(month)} onMonthChange={(m) => setMonth(String(m))} onYearChange={(y) => setYear(String(y))} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[['Stories com link', fmt(rows.length)], ['Cliques no link', fmt(totals.clicks)], ['Taxa de clique', `${totals.rate.toFixed(1).replace('.', ',')}%`]].map(([l, v]) => (
          <Card key={l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-semibold">{v}</p></CardContent></Card>
        ))}
      </div>

      <Card><CardContent className="p-4 grid gap-2 md:grid-cols-[140px_1fr_1fr_110px_110px_auto] items-end">
        <Input type="date" value={form.story_date} onChange={(e) => setForm({ ...form, story_date: e.target.value })} aria-label="Data" />
        <Input placeholder="Sobre o story" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Input placeholder="Link" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
        <Input inputMode="numeric" placeholder="Visualizações" value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value })} />
        <Input inputMode="numeric" placeholder="Cliques" value={form.link_clicks} onChange={(e) => setForm({ ...form, link_clicks: e.target.value })} />
        <Button onClick={add} disabled={saving || !profileId}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Adicionar</Button>
      </CardContent></Card>

      <Card><CardContent className="p-0">
        {isLoading ? <p className="p-4 text-sm text-muted-foreground">Carregando…</p> : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Nenhum story com link neste mês.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b"><tr>
              <th className="text-left p-3">Data</th><th className="text-left p-3">Story</th><th className="text-right p-3">Visualizações</th><th className="text-right p-3">Cliques</th><th className="text-right p-3">Taxa</th><th className="p-3" />
            </tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-3 whitespace-nowrap">{r.story_date.split('-').reverse().join('/')}</td>
                <td className="p-3"><div>{r.description || '—'}</div>{r.link_url && <a href={r.link_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline break-all">{r.link_url}</a>}</td>
                <td className="p-3 text-right">{fmt(r.views)}</td>
                <td className="p-3 text-right font-medium">{fmt(r.link_clicks)}</td>
                <td className="p-3 text-right">{r.views ? `${((r.link_clicks / r.views) * 100).toFixed(1).replace('.', ',')}%` : '—'}</td>
                <td className="p-3 text-right"><Button size="icon" variant="ghost" aria-label="Excluir story" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>))}</tbody>
          </table>
        )}
      </CardContent></Card>
    </div>
  );
}
