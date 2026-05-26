import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Crown, Loader2, Sparkles, FileText, Copy, Network, Package, Trophy } from 'lucide-react';
import MarkdownRenderer from '@/components/sales/MarkdownRenderer';
import MindMapViewer from '@/components/sales/MindMapViewer';
import { toast } from 'sonner';

export function IdealScriptGenerator() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [idealScript, setIdealScript] = useState<string | null>(null);
  const [scriptProductName, setScriptProductName] = useState<string>('');
  const [scriptStats, setScriptStats] = useState<{ analyzed: number; champions: number; rate: number } | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');
  const [mindMapOpen, setMindMapOpen] = useState(false);

  // All champion calls (used to compute per-product counts and to filter)
  const { data: allChampionCalls = [], isLoading } = useQuery({
    queryKey: ['champion-calls-for-script', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_call_analyses')
        .select('id, analysis, created_at, transcript_preview, product_id, icp_signals')
        .eq('account_id', accountId!)
        .eq('call_outcome', 'success')
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  // All analyses (any outcome) — used to compute success rate per product
  const { data: allAnalyses = [] } = useQuery({
    queryKey: ['all-call-analyses-for-stats', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_call_analyses')
        .select('id, product_id, call_outcome')
        .eq('account_id', accountId!)
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const productStats = useMemo(() => {
    const map = new Map<string, { analyzed: number; champions: number }>();
    for (const a of allAnalyses) {
      if (!a.product_id) continue;
      const cur = map.get(a.product_id) || { analyzed: 0, champions: 0 };
      cur.analyzed += 1;
      if (a.call_outcome === 'success') cur.champions += 1;
      map.set(a.product_id, cur);
    }
    return map;
  }, [allAnalyses]);

  // Products in the account (with color for badges)
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-ideal-script', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, color, description')
        .eq('account_id', accountId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  // Per-product counts of champion calls
  const productOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of allChampionCalls) {
      if (!c.product_id) continue;
      counts.set(c.product_id, (counts.get(c.product_id) || 0) + 1);
    }
    return products
      .map((p: any) => ({ ...p, count: counts.get(p.id) || 0 }))
      .sort((a, b) => b.count - a.count);
  }, [products, allChampionCalls]);

  const selectedProduct = productOptions.find(p => p.id === selectedProductId) || null;
  const productChampionCalls = useMemo(
    () => allChampionCalls.filter(c => c.product_id === selectedProductId),
    [allChampionCalls, selectedProductId]
  );

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error('Selecione um produto');
      if (productChampionCalls.length === 0) throw new Error('Nenhuma call campeã para este produto');

      // Look up the latest existing "Script Ideal — <produto>" so we can EVOLVE it
      // instead of regenerating from scratch every time.
      const { data: existing } = await supabase
        .from('sales_scripts')
        .select('id, content, created_at')
        .eq('account_id', accountId!)
        .eq('title', `Script Ideal — ${selectedProduct.name}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke('generate-ideal-script', {
        body: {
          product_name: selectedProduct.name,
          product_description: selectedProduct.description ?? null,
          custom_instructions: customInstructions || null,
          previous_script: existing?.content || null,
          champion_calls: productChampionCalls.slice(0, 10).map(c => ({
            created_at: c.created_at,
            analysis: c.analysis,
            transcript_preview: c.transcript_preview,
            icp_signals: (c as any).icp_signals ?? null,
          })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.script as string) || '';
    },
    onSuccess: async (script) => {
      setIdealScript(script);
      const productName = selectedProduct?.name || '';
      setScriptProductName(productName);
      const stats = productStats.get(selectedProductId!) || { analyzed: productChampionCalls.length, champions: productChampionCalls.length };
      const rate = stats.analyzed > 0 ? Math.round((stats.champions / stats.analyzed) * 100) : 0;
      setScriptStats({ analyzed: stats.analyzed, champions: stats.champions, rate });
      // Strip any AI preamble before the first markdown heading so the card
      // preview shows the actual script — not "Com certeza! Analisarei...".
      const firstHeading = script.search(/^#{1,3}\s/m);
      const cleanedContent = firstHeading > 0 ? script.slice(firstHeading).trim() : script.trim();
      const callsUsed = Math.min(productChampionCalls.length, 8);
      const tags = [
        `🏆 ${productName}`,
        `${callsUsed} call${callsUsed === 1 ? '' : 's'} campeã${callsUsed === 1 ? '' : 's'}`,
        'Gerado por IA',
        'Script Ideal',
      ];
      // Auto-save into the Scripts tab (sales_scripts table)
      try {
        const { error } = await supabase.from('sales_scripts').insert({
          account_id: accountId!,
          title: `Script Ideal — ${productName}`,
          content: cleanedContent,
          objection_type: null,
          funnel_stage: 'presentation',
          tags,
          is_active: true,
          created_by: currentUser?.id!,
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
        toast.success('Script ideal gerado e salvo na aba Scripts!');
      } catch (e: any) {
        console.error('Erro ao salvar script ideal:', e);
        toast.success('Script ideal gerado!');
        toast.error('Não foi possível salvar automaticamente na aba Scripts');
      }
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao gerar script'),
  });

  const handleCopy = async () => {
    if (!idealScript) return;
    await navigator.clipboard.writeText(idealScript);
    toast.success('Script copiado!');
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const totalChampions = allChampionCalls.length;
  const productsWithCalls = productOptions.filter(p => p.count > 0);

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base">Script Ideal por Produto</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Selecione um produto para gerar o script perfeito a partir das suas calls campeãs.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge variant="secondary" className="text-[10px] gap-1 h-5">
                  <Trophy className="w-2.5 h-2.5" />
                  {totalChampions} call{totalChampions === 1 ? '' : 's'} campeã{totalChampions === 1 ? '' : 's'} no total
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1 h-5">
                  <Package className="w-2.5 h-2.5" />
                  {productsWithCalls.length} produto{productsWithCalls.length === 1 ? '' : 's'} com dados
                </Badge>
              </div>
            </div>
          </div>

          {totalChampions === 0 ? (
            <div className="text-center py-8 rounded-lg border border-dashed bg-muted/20">
              <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Marque calls como <span className="font-medium text-foreground">"Campeã ✅"</span> na aba <span className="font-medium text-foreground">Analisar</span> para habilitar a geração de scripts ideais por produto.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-primary" />
                  Produto <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedProductId || ''} onValueChange={(v) => setSelectedProductId(v || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto para gerar o script ideal" />
                  </SelectTrigger>
                  <SelectContent>
                    {productOptions.map(p => (
                      <SelectItem key={p.id} value={p.id} disabled={p.count === 0}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || '#6b7280' }} />
                          <span>{p.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {p.count > 0 ? `· ${p.count} campeã${p.count === 1 ? '' : 's'}` : '· sem calls campeãs'}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProduct && productChampionCalls.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Usaremos as {Math.min(productChampionCalls.length, 8)} calls campeãs mais recentes deste produto como base.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Instruções adicionais (opcional)</Label>
                <Textarea
                  placeholder={`Ex: Foque no perfil de cliente médico, ticket médio R$15.000, vendas consultivas...`}
                  value={customInstructions}
                  onChange={e => setCustomInstructions(e.target.value)}
                  className="min-h-[72px] text-sm"
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !selectedProductId || productChampionCalls.length === 0}
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Construindo script ideal...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Gerar Script Ideal{selectedProduct ? ` — ${selectedProduct.name}` : ''}</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {idealScript && (
        <Card className="border-primary/30 shadow-sm">
          <CardHeader className="pb-3 border-b bg-gradient-to-r from-primary/5 to-transparent space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                Script Modelo {scriptProductName && <span className="text-muted-foreground font-normal">— {scriptProductName}</span>}
              </CardTitle>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button variant="default" size="sm" onClick={() => setMindMapOpen(true)} className="gap-1.5">
                  <Network className="w-3.5 h-3.5" />Mapa Mental
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                  <Copy className="w-3.5 h-3.5" />Copiar
                </Button>
              </div>
            </div>
            {scriptStats && (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-[10px] gap-1 h-5">
                  <FileText className="w-2.5 h-2.5" />
                  {scriptStats.analyzed} call{scriptStats.analyzed === 1 ? '' : 's'} analisada{scriptStats.analyzed === 1 ? '' : 's'}
                </Badge>
                <Badge variant="secondary" className="text-[10px] gap-1 h-5 bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  <Trophy className="w-2.5 h-2.5" />
                  {scriptStats.champions} campeã{scriptStats.champions === 1 ? '' : 's'}
                </Badge>
                <Badge
                  variant="secondary"
                  className={`text-[10px] gap-1 h-5 border ${
                    scriptStats.rate >= 50
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      : scriptStats.rate >= 25
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
                  }`}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  {scriptStats.rate}% de sucesso
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-4">
            <div className="max-w-3xl mx-auto">
              <MarkdownRenderer content={idealScript} />
            </div>
          </CardContent>
        </Card>
      )}

      {idealScript && (
        <MindMapViewer
          open={mindMapOpen}
          onOpenChange={setMindMapOpen}
          content={idealScript}
          title={`Script Ideal — ${scriptProductName}`}
        />
      )}
    </div>
  );
}
