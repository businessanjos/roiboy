import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Crown, MapPin, Building2, Calendar, TrendingUp, Users, Target, Briefcase, Loader2 } from 'lucide-react';

interface ICPData {
  totalSuccess: number;
  totalFailure: number;
  cities: Record<string, number>;
  states: Record<string, number>;
  segments: Record<string, number>;
  niches: Record<string, number>;
  companies: Record<string, number>;
  hasCompany: number;
  noCompany: number;
  avgAge: number | null;
  ageRanges: Record<string, number>;
}

function calcAgeFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getAgeRange(age: number): string {
  if (age < 25) return '18-24';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  return '55+';
}

function TopItems({ data, label, icon: Icon, color }: { data: Record<string, number>; label: string; icon: any; color: string }) {
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = sorted[0]?.[1] || 1;
  if (sorted.length === 0) return <p className="text-xs text-muted-foreground">Sem dados suficientes</p>;
  return (
    <div className="space-y-2">
      {sorted.map(([name, count]) => (
        <div key={name} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
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

  const { data: icpData, isLoading } = useQuery({
    queryKey: ['icp-dashboard', accountId],
    queryFn: async (): Promise<ICPData> => {
      // Get all analyses with outcomes and client data
      const { data: analyses, error } = await supabase
        .from('sales_call_analyses')
        .select('call_outcome, client:clients!sales_call_analyses_client_id_fkey(full_name, city, state, company_name, business_segment, business_niche, birth_date, cnpj)')
        .eq('account_id', accountId!)
        .not('client_id', 'is', null);
      if (error) throw error;

      const result: ICPData = {
        totalSuccess: 0, totalFailure: 0,
        cities: {}, states: {}, segments: {}, niches: {}, companies: {},
        hasCompany: 0, noCompany: 0, avgAge: null, ageRanges: {},
      };
      const ages: number[] = [];

      for (const a of (analyses || [])) {
        if (a.call_outcome === 'success') result.totalSuccess++;
        else if (a.call_outcome === 'failure') result.totalFailure++;

        // Only profile from successful calls
        if (a.call_outcome !== 'success') continue;
        const c = a.client as any;
        if (!c) continue;

        if (c.city) result.cities[c.city] = (result.cities[c.city] || 0) + 1;
        if (c.state) result.states[c.state] = (result.states[c.state] || 0) + 1;
        if (c.business_segment) result.segments[c.business_segment] = (result.segments[c.business_segment] || 0) + 1;
        if (c.business_niche) result.niches[c.business_niche] = (result.niches[c.business_niche] || 0) + 1;
        if (c.company_name) {
          result.companies[c.company_name] = (result.companies[c.company_name] || 0) + 1;
          result.hasCompany++;
        } else {
          result.noCompany++;
        }
        const age = calcAgeFromBirthDate(c.birth_date);
        if (age) {
          ages.push(age);
          const range = getAgeRange(age);
          result.ageRanges[range] = (result.ageRanges[range] || 0) + 1;
        }
      }
      result.avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null;
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
          <p className="text-sm text-muted-foreground">Marque calls como "Campeã" e vincule a clientes para construir seu perfil ideal.</p>
        </CardContent>
      </Card>
    );
  }

  const conversionRate = icpData.totalSuccess + icpData.totalFailure > 0
    ? Math.round((icpData.totalSuccess / (icpData.totalSuccess + icpData.totalFailure)) * 100)
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
          <Calendar className="w-6 h-6 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{icpData.avgAge ? `${icpData.avgAge} anos` : '—'}</p>
          <p className="text-xs text-muted-foreground">Idade Média ICP</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Building2 className="w-6 h-6 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{icpData.hasCompany + icpData.noCompany > 0 ? Math.round((icpData.hasCompany / (icpData.hasCompany + icpData.noCompany)) * 100) : 0}%</p>
          <p className="text-xs text-muted-foreground">Possuem Empresa</p>
        </CardContent></Card>
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" />Top Cidades (Calls Campeãs)</CardTitle></CardHeader>
          <CardContent><TopItems data={icpData.cities} label="Cidade" icon={MapPin} color="text-primary" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" />Top Estados</CardTitle></CardHeader>
          <CardContent><TopItems data={icpData.states} label="Estado" icon={MapPin} color="text-primary" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Briefcase className="w-4 h-4 text-primary" />Segmentos</CardTitle></CardHeader>
          <CardContent><TopItems data={icpData.segments} label="Segmento" icon={Briefcase} color="text-primary" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Faixa Etária</CardTitle></CardHeader>
          <CardContent><TopItems data={icpData.ageRanges} label="Faixa" icon={Calendar} color="text-amber-500" /></CardContent>
        </Card>
      </div>
    </div>
  );
}
