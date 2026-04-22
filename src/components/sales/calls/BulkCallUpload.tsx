import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, Crown, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ResultItem {
  filename: string;
  status: 'processed' | 'duplicate' | 'error';
  error?: string;
  ai_score?: number | null;
  is_champion?: boolean;
  matched_deal_id?: string | null;
  matched_seller_id?: string | null;
  extracted?: { seller_name?: string | null; lead_name?: string | null; call_date?: string | null };
}

interface Summary {
  total: number;
  processed: number;
  duplicates: number;
  errors: number;
  champions: number;
}

const MAX_FILES_PER_BATCH = 10;
const MAX_FILE_SIZE_MB = 15;

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function BulkCallUpload() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (incoming: File[]) => {
    const docx = incoming.filter(f => f.name.toLowerCase().endsWith('.docx'));
    const skipped = incoming.length - docx.length;
    if (skipped > 0) toast.warning(`${skipped} arquivo(s) ignorado(s) — apenas .docx é aceito`);
    const tooBig = docx.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (tooBig.length > 0) {
      toast.warning(`${tooBig.length} arquivo(s) acima de ${MAX_FILE_SIZE_MB}MB ignorado(s)`);
    }
    const valid = docx.filter(f => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024);
    setFiles(prev => {
      const map = new Map(prev.map(f => [f.name, f]));
      valid.forEach(f => map.set(f.name, f));
      return Array.from(map.values());
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  };

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name));

  const processBatch = useMutation({
    mutationFn: async () => {
      if (files.length === 0) throw new Error('Selecione pelo menos um arquivo');
      const allResults: ResultItem[] = [];
      let aggregated: Summary = { total: 0, processed: 0, duplicates: 0, errors: 0, champions: 0 };
      setProgress(0);
      setResults([]);
      setSummary(null);

      for (let i = 0; i < files.length; i += MAX_FILES_PER_BATCH) {
        const batch = files.slice(i, i + MAX_FILES_PER_BATCH);
        const payload = await Promise.all(
          batch.map(async f => ({ name: f.name, contentBase64: await fileToBase64(f) }))
        );
        const { data, error } = await supabase.functions.invoke('bulk-process-call-transcripts', {
          body: { files: payload },
        });
        if (error) throw error;
        const batchResults: ResultItem[] = data?.results || [];
        const batchSummary: Summary = data?.summary || { total: 0, processed: 0, duplicates: 0, errors: 0, champions: 0 };
        allResults.push(...batchResults);
        aggregated = {
          total: aggregated.total + batchSummary.total,
          processed: aggregated.processed + batchSummary.processed,
          duplicates: aggregated.duplicates + batchSummary.duplicates,
          errors: aggregated.errors + batchSummary.errors,
          champions: aggregated.champions + batchSummary.champions,
        };
        setResults([...allResults]);
        setSummary({ ...aggregated });
        setProgress(Math.round(Math.min(100, ((i + batch.length) / files.length) * 100)));
      }

      return { results: allResults, summary: aggregated };
    },
    onSuccess: ({ summary }) => {
      queryClient.invalidateQueries({ queryKey: ['sales-call-analyses'] });
      const champ = summary.champions > 0 ? ` 🏆 ${summary.champions} Call(s) Campeã(s)!` : '';
      toast.success(`Lote processado: ${summary.processed} novas, ${summary.duplicates} duplicadas, ${summary.errors} erros.${champ}`);
      setFiles([]);
    },
    onError: (e: any) => {
      toast.error(e?.message || 'Erro ao processar lote');
    },
  });

  const isProcessing = processBatch.isPending;

  return (
    <div className="space-y-4">
      <Card
        className={cn(
          'border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          isProcessing && 'pointer-events-none opacity-60'
        )}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ''; }}
        />
        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="font-medium mb-1">Arraste arquivos .docx aqui ou clique para selecionar</p>
        <p className="text-xs text-muted-foreground">
          Nomeie no padrão: <code className="px-1 py-0.5 rounded bg-muted">Vendedor - Lead - YYYY-MM-DD.docx</code>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Match com negócios ganhos em ±7 dias. Score ≥ 8 vira Call Campeã automaticamente.
        </p>
      </Card>

      {files.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">{files.length} arquivo(s) selecionado(s)</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={isProcessing} onClick={() => setFiles([])}>
                Limpar
              </Button>
              <Button size="sm" disabled={isProcessing} onClick={() => processBatch.mutate()}>
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />Processar lote</>
                )}
              </Button>
            </div>
          </div>
          <ScrollArea className="max-h-40">
            <ul className="space-y-1">
              {files.map(f => (
                <li key={f.name} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-muted">
                  <span className="flex items-center gap-2 truncate">
                    <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{f.name}</span>
                    <span className="text-muted-foreground shrink-0">({(f.size / 1024).toFixed(0)} KB)</span>
                  </span>
                  {!isProcessing && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(f.name)}>
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </Card>
      )}

      {isProcessing && (
        <div className="space-y-1">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground text-center">{progress}%</p>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold">{summary.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </Card>
          <Card className="p-3 text-center border-green-500/30 bg-green-500/5">
            <p className="text-2xl font-bold text-green-600">{summary.processed}</p>
            <p className="text-xs text-muted-foreground">Novas</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{summary.duplicates}</p>
            <p className="text-xs text-muted-foreground">Duplicadas</p>
          </Card>
          <Card className="p-3 text-center border-red-500/30 bg-red-500/5">
            <p className="text-2xl font-bold text-red-600">{summary.errors}</p>
            <p className="text-xs text-muted-foreground">Erros</p>
          </Card>
          <Card className="p-3 text-center border-amber-500/30 bg-amber-500/5">
            <p className="text-2xl font-bold text-amber-600 flex items-center justify-center gap-1">
              <Crown className="w-5 h-5" />{summary.champions}
            </p>
            <p className="text-xs text-muted-foreground">Campeãs</p>
          </Card>
        </div>
      )}

      {results.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium text-sm mb-3">Resultado do processamento</h4>
          <ScrollArea className="max-h-80">
            <ul className="space-y-1.5">
              {results.map((r, idx) => (
                <li key={idx} className="text-xs border rounded p-2 flex items-start gap-2">
                  {r.status === 'processed' && r.is_champion ? (
                    <Crown className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  ) : r.status === 'processed' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  ) : r.status === 'duplicate' ? (
                    <Copy className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{r.filename}</span>
                      {r.status === 'duplicate' && <Badge variant="secondary" className="text-[10px]">Duplicada</Badge>}
                      {r.status === 'error' && <Badge variant="destructive" className="text-[10px]">Erro</Badge>}
                      {r.is_champion && <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500">Campeã</Badge>}
                      {typeof r.ai_score === 'number' && <Badge variant="outline" className="text-[10px]">Nota {r.ai_score}/10</Badge>}
                    </div>
                    {r.extracted && (r.extracted.seller_name || r.extracted.lead_name || r.extracted.call_date) && (
                      <p className="text-muted-foreground mt-0.5">
                        {r.extracted.seller_name && <>Vendedor: <strong>{r.extracted.seller_name}</strong> · </>}
                        {r.extracted.lead_name && <>Lead: <strong>{r.extracted.lead_name}</strong> · </>}
                        {r.extracted.call_date && <>Data: {r.extracted.call_date}</>}
                      </p>
                    )}
                    {r.matched_deal_id && (
                      <p className="text-green-600 mt-0.5">✓ Match com negócio ganho</p>
                    )}
                    {r.status === 'processed' && !r.matched_deal_id && (
                      <p className="text-amber-600 mt-0.5">Sem match automático — revise manualmente</p>
                    )}
                    {r.error && <p className="text-red-600 mt-0.5">{r.error}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
