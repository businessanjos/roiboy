import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, ThumbsDown, Loader2, Sparkles, BarChart3, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import MarkdownRenderer from '@/components/sales/MarkdownRenderer';
import { toast } from 'sonner';

export function CallComparative() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [comparativeResult, setComparativeResult] = useState<string | null>(null);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['call-comparative-stats', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_call_analyses')
        .select('id, call_outcome, analysis, created_at, transcript_preview')
        .eq('account_id', accountId!)
        .in('call_outcome', ['success', 'failure']);
      if (error) throw error;

      const success = (data || []).filter(a => a.call_outcome === 'success');
      const failure = (data || []).filter(a => a.call_outcome === 'failure');
      return { success, failure, total: data?.length || 0 };
    },
    enabled: !!accountId,
  });

  const generateComparativeMutation = useMutation({
    mutationFn: async () => {
      if (!stats || stats.success.length === 0 || stats.failure.length === 0) {
        throw new Error('É necessário ter pelo menos 1 call campeã e 1 call fracassada');
      }

      const successSummaries = stats.success.slice(0, 5).map(s => s.analysis?.substring(0, 1500) || '').join('\n---\n');
      const failureSummaries = stats.failure.slice(0, 5).map(s => s.analysis?.substring(0, 1500) || '').join('\n---\n');

      const { data, error } = await supabase.functions.invoke('analyze-sales-call', {
        body: {
          transcript: `ANÁLISE COMPARATIVA SOLICITADA:

=== CALLS BEM-SUCEDIDAS (${stats.success.length} calls) ===
${successSummaries}

=== CALLS MAL-SUCEDIDAS (${stats.failure.length} calls) ===
${failureSummaries}

INSTRUÇÕES: Compare as calls de sucesso com as de fracasso. Identifique:
1. Padrões de abertura que funcionam vs que não funcionam
2. Palavras e frases mais usadas em cada grupo
3. Como objeções são tratadas nos dois cenários
4. Duração média e ritmo das conversas
5. Diferenças no tom e abordagem
6. O que os vendedores campeões fazem que os outros não fazem
7. Top 5 ações que diferenciam uma call campeã de uma fracassada

Formate em markdown com emojis. Seja extremamente específico e prático.`
        }
      });
      if (error) throw error;
      return data.analysis;
    },
    onSuccess: (analysis) => {
      setComparativeResult(analysis);
      toast.success('Análise comparativa gerada!');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao gerar comparativo'),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const successCount = stats?.success.length || 0;
  const failureCount = stats?.failure.length || 0;
  const canGenerate = successCount > 0 && failureCount > 0;

  return (
    <div className="space-y-4">
      {/* Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Crown className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-green-600">{successCount}</p>
              <p className="text-xs text-muted-foreground">Calls Campeãs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <ThumbsDown className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-600">{failureCount}</p>
              <p className="text-xs text-muted-foreground">Calls Fracassadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{successCount + failureCount > 0 ? Math.round((successCount / (successCount + failureCount)) * 100) : 0}%</p>
              <p className="text-xs text-muted-foreground">Taxa de Sucesso</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generate button */}
      <Card>
        <CardContent className="p-6 text-center">
          {!canGenerate ? (
            <>
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold mb-1">Dados insuficientes</h3>
              <p className="text-sm text-muted-foreground">Classifique pelo menos 1 call como "Campeã" e 1 como "Sem sucesso" para gerar o comparativo.</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="flex items-center gap-1 text-green-600"><TrendingUp className="w-5 h-5" /><span className="font-medium">{successCount} Campeãs</span></div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <div className="flex items-center gap-1 text-red-500"><TrendingDown className="w-5 h-5" /><span className="font-medium">{failureCount} Fracassadas</span></div>
              </div>
              <Button
                size="lg"
                onClick={() => generateComparativeMutation.mutate()}
                disabled={generateComparativeMutation.isPending}
              >
                {generateComparativeMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analisando padrões...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Gerar Comparativo IA</>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {comparativeResult && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />Análise Comparativa</CardTitle></CardHeader>
          <CardContent><MarkdownRenderer content={comparativeResult} /></CardContent>
        </Card>
      )}
    </div>
  );
}
