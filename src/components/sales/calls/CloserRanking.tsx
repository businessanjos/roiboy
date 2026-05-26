import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Crown, Medal, Award, TrendingUp, Phone, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SellerStats {
  userId: string;
  userName: string;
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  partialCalls: number;
  conversionRate: number;
}

export function CloserRanking() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ['closer-ranking-v2', accountId],
    queryFn: async (): Promise<SellerStats[]> => {
      // Get analyses with user info
      const { data: analyses, error } = await supabase
        .from('sales_call_analyses')
        .select('user_id, seller_user_id, call_outcome')
        .eq('account_id', accountId!)
        .not('call_outcome', 'is', null);
      if (error) throw error;

      // Build the universe of users that should appear in the ranking:
      // anyone with a sales-area role (Closer, Head, Comercial, SDR, Vendas, Mentor)
      // OR anyone that actually has at least one analysis.
      const SALES_ROLE_PATTERNS = ['closer', 'head', 'comercial', 'sdr', 'vendas', 'mentor'];
      const orFilter = SALES_ROLE_PATTERNS.map(p => `name.ilike.%${p}%`).join(',');
      const { data: salesRoles } = await supabase
        .from('team_roles')
        .select('id')
        .or(orFilter);
      const salesRoleIds = (salesRoles || []).map(r => r.id);

      const salesUserIdsSet = new Set<string>();
      if (salesRoleIds.length) {
        const { data: links } = await supabase
          .from('user_team_roles')
          .select('user_id')
          .in('team_role_id', salesRoleIds);
        (links || []).forEach(l => salesUserIdsSet.add(l.user_id));
      }
      // Also include any user that already has analyses (so o gestor sempre
      // aparece se rodou uma análise, mesmo sem o role formal).
      (analyses || []).forEach(a => {
        const uid = (a.seller_user_id as string | null) || (a.user_id as string | null);
        if (uid) salesUserIdsSet.add(uid);
      });

      if (salesUserIdsSet.size === 0) return [];

      const { data: users } = await supabase
        .from('users')
        .select('id, name')
        .eq('account_id', accountId!)
        .in('id', Array.from(salesUserIdsSet));

      const userMap = new Map((users || []).map(u => [u.id, u.name]));
      const statsMap = new Map<string, SellerStats>();

      for (const a of (analyses || [])) {
        // Prefer seller_user_id (quem de fato fez a call) sobre user_id (quem subiu a análise).
        const uid = (a.seller_user_id as string | null) || (a.user_id as string | null);
        if (!uid) continue;
        if (!salesUserIdsSet.has(uid)) continue;
        if (!statsMap.has(uid)) {
          statsMap.set(uid, {
            userId: uid,
            userName: userMap.get(uid) || 'Desconhecido',
            totalCalls: 0, successCalls: 0, failureCalls: 0, partialCalls: 0, conversionRate: 0,
          });
        }
        const s = statsMap.get(uid)!;
        s.totalCalls++;
        if (a.call_outcome === 'success') s.successCalls++;
        else if (a.call_outcome === 'failure') s.failureCalls++;
        else if (a.call_outcome === 'partial') s.partialCalls++;
      }

      const result = Array.from(statsMap.values());
      result.forEach(s => {
        const denominator = s.successCalls + s.failureCalls;
        s.conversionRate = denominator > 0 ? Math.round((s.successCalls / denominator) * 100) : 0;
      });

      // Sort by success count, then by conversion rate
      result.sort((a, b) => b.successCalls - a.successCalls || b.conversionRate - a.conversionRate);
      return result;
    },
    enabled: !!accountId,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (ranking.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Sem dados de ranking</h3>
          <p className="text-sm text-muted-foreground">Classifique calls com resultado para montar o ranking.</p>
        </CardContent>
      </Card>
    );
  }

  const maxCalls = Math.max(...ranking.map(r => r.totalCalls), 1);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (index === 1) return <Medal className="w-6 h-6 text-gray-400" />;
    if (index === 2) return <Award className="w-6 h-6 text-amber-600" />;
    return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-muted-foreground">{index + 1}º</span>;
  };

  const getRankBg = (index: number) => {
    if (index === 0) return 'border-yellow-500/30 bg-yellow-500/5';
    if (index === 1) return 'border-gray-400/30 bg-gray-400/5';
    if (index === 2) return 'border-amber-600/30 bg-amber-600/5';
    return '';
  };

  return (
    <div className="space-y-4">
      {/* Top 3 podium */}
      {ranking.length >= 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ranking.slice(0, 3).map((seller, i) => (
            <Card key={seller.userId} className={cn("transition-all", getRankBg(i))}>
              <CardContent className="p-5 text-center">
                <div className="flex justify-center mb-2">{getRankIcon(i)}</div>
                <h3 className="font-semibold text-base mb-1">{seller.userName}</h3>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-xs">
                    {seller.successCalls} campeãs
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Conversão</span>
                    <span className="font-medium">{seller.conversionRate}%</span>
                  </div>
                  <Progress value={seller.conversionRate} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{seller.totalCalls} calls</span>
                    <span>{seller.failureCalls} falhas</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Full ranking table */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" />Ranking Completo</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {ranking.map((seller, i) => (
            <div key={seller.userId} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="w-8 shrink-0 flex justify-center">{getRankIcon(i)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{seller.userName}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{seller.totalCalls} calls</span>
                  <span className="text-green-600">{seller.successCalls} ✓</span>
                  <span className="text-red-500">{seller.failureCalls} ✗</span>
                  <span className="text-amber-500">{seller.partialCalls} ~</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">{seller.conversionRate}%</p>
                <p className="text-xs text-muted-foreground">conversão</p>
              </div>
              <div className="w-24 shrink-0 hidden md:block">
                <Progress value={(seller.totalCalls / maxCalls) * 100} className="h-1.5" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
