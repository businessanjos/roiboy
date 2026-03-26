import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Crown, Loader2, Sparkles, FileText, Copy, Download } from 'lucide-react';
import MarkdownRenderer from '@/components/sales/MarkdownRenderer';
import { toast } from 'sonner';

export function IdealScriptGenerator() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [idealScript, setIdealScript] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');

  const { data: championCalls = [], isLoading } = useQuery({
    queryKey: ['champion-calls-for-script', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_call_analyses')
        .select('id, analysis, created_at, transcript_preview')
        .eq('account_id', accountId!)
        .eq('call_outcome', 'success')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (championCalls.length === 0) throw new Error('Nenhuma call campeã encontrada');

      const callsSummary = championCalls.slice(0, 8).map((c, i) =>
        `### Call ${i + 1} (${new Date(c.created_at).toLocaleDateString('pt-BR')})\n${c.analysis?.substring(0, 2000) || 'Sem análise'}`
      ).join('\n\n---\n\n');

      const { data, error } = await supabase.functions.invoke('analyze-sales-call', {
        body: {
          transcript: `GERAÇÃO DE SCRIPT IDEAL BASEADO EM CALLS CAMPEÃS:

Baseado nas ${championCalls.length} calls de maior sucesso abaixo, gere um SCRIPT MODELO PERFEITO.

${callsSummary}

${customInstructions ? `INSTRUÇÕES ADICIONAIS DO GESTOR:\n${customInstructions}\n` : ''}

GERE UM SCRIPT COMPLETO E DETALHADO contendo:

## 🏆 Script Modelo — Baseado em ${championCalls.length} Calls Campeãs

### 📞 Abertura (primeiros 30 segundos)
- Exatamente o que dizer ao atender/ligar
- Tom de voz e postura

### 🔍 Sondagem / Qualificação
- Perguntas que geraram melhor engajamento
- Ordem ideal das perguntas
- Como reagir às respostas

### 💡 Apresentação da Solução
- Padrão de pitch que mais converteu
- Palavras e frases de impacto identificadas
- Como conectar dor → solução

### 🚫 Contorno de Objeções
- Objeções mais comuns e como foram superadas nas calls campeãs
- Frases exatas que funcionaram

### 🎯 Fechamento
- Técnicas de fechamento que mais apareceram
- Frases de transição para o fechamento
- Como criar urgência de forma natural

### ⚡ Dicas de Ouro
- Padrões sutis que diferenciam os vendedores campeões
- Timing, pausas, e ritmo ideal

Seja EXTREMAMENTE ESPECÍFICO. Use exemplos reais extraídos das análises. Este script deve ser copiado e praticado pelo time.`
        }
      });
      if (error) throw error;
      return data.analysis;
    },
    onSuccess: (script) => {
      setIdealScript(script);
      toast.success('Script ideal gerado!');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao gerar script'),
  });

  const handleCopy = async () => {
    if (!idealScript) return;
    await navigator.clipboard.writeText(idealScript);
    toast.success('Script copiado!');
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Script Ideal Automático</h3>
              <p className="text-sm text-muted-foreground">
                {championCalls.length > 0
                  ? `Baseado em ${championCalls.length} call(s) campeã(s) do seu histórico`
                  : 'Classifique calls como "Campeã" para gerar o script ideal'}
              </p>
            </div>
          </div>

          {championCalls.length > 0 && (
            <div className="space-y-3">
              <div>
                <Label>Instruções adicionais (opcional)</Label>
                <Textarea
                  placeholder="Ex: Foque em vendas B2B de tecnologia, considere ticket médio de R$5.000..."
                  value={customInstructions}
                  onChange={e => setCustomInstructions(e.target.value)}
                  className="mt-1.5 min-h-[80px]"
                />
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Construindo script ideal...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Gerar Script Ideal</>
                )}
              </Button>
            </div>
          )}

          {championCalls.length === 0 && (
            <div className="text-center py-6">
              <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Marque calls como "Campeã ✅" na aba de análises para habilitar esta funcionalidade.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {idealScript && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Crown className="w-5 h-5 text-primary" />Script Modelo Gerado</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="w-4 h-4 mr-1" />Copiar</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent><MarkdownRenderer content={idealScript} /></CardContent>
        </Card>
      )}
    </div>
  );
}
