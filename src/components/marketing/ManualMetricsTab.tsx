import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';
import { RecordsGoalsCharts, METRICS, type MetricKey } from './RecordsGoalsCharts';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const WEEKS = [1, 2, 3, 4, 5];

type RowValues = Record<MetricKey, string>;

const emptyRow = (): RowValues =>
  METRICS.reduce((acc, m) => ({ ...acc, [m.key]: '' }), {} as RowValues);


const parseNum = (v: string) => {
  const n = Number(String(v).replace(/\./g, '').replace(/,/g, '.').trim());
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const fmt = (n: number) => n.toLocaleString('pt-BR');

export function ManualMetricsTab() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [profileId, setProfileId] = useState<string>('');
  const [values, setValues] = useState<Record<number, RowValues>>({});
  const [goalValues, setGoalValues] = useState<RowValues>(emptyRow());
  const [saving, setSaving] = useState(false);


  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['manual-metrics-profiles', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instagram_profiles')
        .select('id, username, display_name')
        .eq('account_id', accountId)
        .order('username');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!accountId,
  });

  useEffect(() => {
    if (!profileId && profiles.length) setProfileId(profiles[0].id);
  }, [profiles, profileId]);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['manual-metrics', profileId, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_manual_weekly_metrics')
        .select('*')
        .eq('profile_id', profileId)
        .eq('year', Number(year))
        .eq('month', Number(month));
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profileId,
  });

  // Dados do ano inteiro (para os gráficos comparativos)
  const { data: yearRows = [] } = useQuery({
    queryKey: ['manual-metrics-year', profileId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_manual_weekly_metrics')
        .select('*')
        .eq('profile_id', profileId)
        .eq('year', Number(year));
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profileId,
  });

  const { data: goalRows = [] } = useQuery({
    queryKey: ['manual-metrics-goals', profileId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_manual_monthly_goals')
        .select('*')
        .eq('profile_id', profileId)
        .eq('year', Number(year));
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profileId,
  });

  useEffect(() => {
    const next: Record<number, RowValues> = {};
    WEEKS.forEach((w) => {
      const found = (rows ?? []).find((r: any) => r.week === w);
      next[w] = METRICS.reduce((acc, m) => {
        acc[m.key] = found ? String(found[m.key] ?? '') : '';
        return acc;
      }, {} as RowValues);
    });
    setValues(next);
  }, [rows, profileId, year, month]);

  useEffect(() => {
    const g = (goalRows ?? []).find((r: any) => r.month === Number(month));
    setGoalValues(
      METRICS.reduce((acc, m) => {
        acc[m.key] = g && Number(g[m.key]) ? String(g[m.key]) : '';
        return acc;
      }, {} as RowValues),
    );
  }, [goalRows, profileId, year, month]);


  const totals = useMemo(() => {
    return METRICS.reduce((acc, m) => {
      acc[m.key] = WEEKS.reduce((sum, w) => sum + parseNum(values[w]?.[m.key] ?? ''), 0);
      return acc;
    }, {} as Record<MetricKey, number>);
  }, [values]);

  const setCell = (week: number, key: MetricKey, v: string) => {
    setValues((prev) => ({ ...prev, [week]: { ...(prev[week] ?? emptyRow()), [key]: v } }));
  };

  const handleSave = async () => {
    if (!accountId || !profileId) return;
    setSaving(true);
    try {
      const payload = WEEKS.map((w) => ({
        account_id: accountId,
        profile_id: profileId,
        platform: 'instagram',
        year: Number(year),
        month: Number(month),
        week: w,
        ...METRICS.reduce((acc, m) => {
          acc[m.key] = parseNum(values[w]?.[m.key] ?? '');
          return acc;
        }, {} as Record<MetricKey, number>),
      }));
      const { error } = await supabase
        .from('social_manual_weekly_metrics')
        .upsert(payload, { onConflict: 'profile_id,year,month,week' });
      if (error) throw error;

      const goalPayload = {
        account_id: accountId,
        profile_id: profileId,
        platform: 'instagram',
        year: Number(year),
        month: Number(month),
        ...METRICS.reduce((acc, m) => {
          acc[m.key] = parseNum(goalValues[m.key] ?? '');
          return acc;
        }, {} as Record<MetricKey, number>),
      };
      const { error: goalError } = await supabase
        .from('social_manual_monthly_goals')
        .upsert(goalPayload, { onConflict: 'profile_id,year,month' });
      if (goalError) throw goalError;

      toast.success('Números e metas do mês salvos');
      queryClient.invalidateQueries({ queryKey: ['manual-metrics', profileId, year, month] });
      queryClient.invalidateQueries({ queryKey: ['manual-metrics-year', profileId, year] });
      queryClient.invalidateQueries({ queryKey: ['manual-metrics-goals', profileId, year] });
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };


  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y + 1, y, y - 1, y - 2].map(String);
  }, []);

  if (loadingProfiles) return <Skeleton className="h-64 w-full" />;

  if (!profiles.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Cadastre um perfil de Instagram para começar a preencher os números manuais.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={profileId} onValueChange={setProfileId}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Perfil" /></SelectTrigger>
          <SelectContent>
            {profiles.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.display_name ? `${p.display_name} (@${p.username})` : `@${p.username}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button className="ml-auto gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6"><Skeleton className="h-48 w-full" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left font-medium p-3 w-[110px]">Semana</th>
                  {METRICS.map((m) => (
                    <th key={m.key} className="text-left font-medium p-3 whitespace-nowrap">{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKS.map((w) => (
                  <tr key={w} className="border-b last:border-0">
                    <td className="p-3 font-medium text-muted-foreground">Semana {w}</td>
                    {METRICS.map((m) => (
                      <td key={m.key} className="p-2">
                        <Input
                          inputMode="numeric"
                          className="h-9 w-[130px]"
                          placeholder="0"
                          value={values[w]?.[m.key] ?? ''}
                          onChange={(e) => setCell(w, m.key, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold">
                  <td className="p-3">Total</td>
                  {METRICS.map((m) => (
                    <td key={m.key} className="p-3">{fmt(totals[m.key])}</td>
                  ))}
                </tr>
                <tr className="border-t bg-primary/5">
                  <td className="p-3 font-medium whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Target className="h-4 w-4 text-primary" /> Meta do mês
                    </span>
                  </td>
                  {METRICS.map((m) => (
                    <td key={m.key} className="p-2">
                      <Input
                        inputMode="numeric"
                        className="h-9 w-[130px]"
                        placeholder="0"
                        value={goalValues[m.key] ?? ''}
                        onChange={(e) => setGoalValues((prev) => ({ ...prev, [m.key]: e.target.value }))}
                      />
                    </td>
                  ))}
                </tr>
                <tr className="bg-primary/5 border-t">
                  <td className="p-3 text-muted-foreground">Atingimento</td>
                  {METRICS.map((m) => {
                    const goal = parseNum(goalValues[m.key] ?? '');
                    const pct = goal > 0 ? Math.round((totals[m.key] / goal) * 100) : null;
                    return (
                      <td
                        key={m.key}
                        className={`p-3 font-semibold ${
                          pct === null
                            ? 'text-muted-foreground'
                            : pct >= 100
                              ? 'text-emerald-600'
                              : pct < 80
                                ? 'text-destructive font-bold'
                                : 'text-amber-600'
                        }`}
                      >
                        {pct === null ? '—' : `${pct}%`}
                      </td>

                    );
                  })}
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <RecordsGoalsCharts
        weekly={(yearRows ?? []) as any}
        goals={(goalRows ?? []) as any}
        year={Number(year)}
        month={Number(month)}
      />

      <p className="text-xs text-muted-foreground">
        Preenchimento manual, semana a semana, com os números absolutos do mês de cada perfil. As metas são mensais e
        alimentam os gráficos comparativos (Hoje e 7d usam a semana corrente; 30d e “Este mês” usam as semanas do mês).
      </p>
    </div>

  );
}
