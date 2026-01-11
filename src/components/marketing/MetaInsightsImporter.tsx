import { useState, useCallback } from 'react';
import { Upload, FileText, Check, AlertCircle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  parseMetaCSV,
  readFileAsText,
  getMetricLabel,
  detectMetricFromFilename,
  MetaCSVRow,
} from '@/lib/meta-csv-parser';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MetaInsightsImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: Array<{ id: string; username: string }>;
  selectedProfileId?: string;
  onSuccess?: () => void;
}

const METRIC_TYPES = [
  { value: 'views', label: 'Visualizações' },
  { value: 'reach', label: 'Alcance' },
  { value: 'interactions', label: 'Interações' },
  { value: 'link_clicks', label: 'Cliques no Link' },
  { value: 'visits', label: 'Visitas ao perfil' },
  { value: 'followers', label: 'Seguidores' },
];

export function MetaInsightsImporter({
  open,
  onOpenChange,
  profiles,
  selectedProfileId,
  onSuccess,
}: MetaInsightsImporterProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [profileId, setProfileId] = useState(selectedProfileId || '');
  const [metricType, setMetricType] = useState('');
  const [parsedData, setParsedData] = useState<MetaCSVRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    try {
      const content = await readFileAsText(file);
      const { rows, metricName } = parseMetaCSV(content);

      if (rows.length === 0) {
        setError('Nenhum dado válido encontrado no arquivo');
        return;
      }

      setParsedData(rows);

      // Auto-detect metric type from filename
      const detected = detectMetricFromFilename(file.name);
      if (detected && !metricType) {
        setMetricType(detected);
      }

      toast({
        title: 'Arquivo processado',
        description: `${rows.length} registros encontrados`,
      });
    } catch (err) {
      setError('Erro ao processar o arquivo CSV');
      console.error(err);
    }
  }, [metricType, toast]);

  const handleImport = async () => {
    if (!profileId || !metricType || parsedData.length === 0) {
      toast({
        title: 'Dados incompletos',
        description: 'Selecione o perfil, tipo de métrica e um arquivo CSV',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);

    try {
      // Get account_id from user
      const { data: userData } = await supabase
        .from('users')
        .select('account_id')
        .eq('auth_user_id', user?.id)
        .single();

      if (!userData?.account_id) {
        throw new Error('Conta não encontrada');
      }

      // Prepare data for upsert
      const insightsData = parsedData.map((row) => ({
        profile_id: profileId,
        account_id: userData.account_id,
        metric_type: metricType,
        metric_date: format(row.date, 'yyyy-MM-dd'),
        value: row.value,
      }));

      // Upsert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < insightsData.length; i += batchSize) {
        const batch = insightsData.slice(i, i + batchSize);
        const { error: upsertError } = await supabase
          .from('instagram_insights')
          .upsert(batch, {
            onConflict: 'profile_id,metric_type,metric_date',
          });

        if (upsertError) throw upsertError;
      }

      toast({
        title: 'Importação concluída!',
        description: `${parsedData.length} registros de ${getMetricLabel(metricType)} importados`,
      });

      // Reset state
      setParsedData([]);
      setFileName('');
      setMetricType('');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Import error:', err);
      toast({
        title: 'Erro na importação',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClear = () => {
    setParsedData([]);
    setFileName('');
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar do Meta Business Suite
          </DialogTitle>
          <DialogDescription>
            Importe métricas históricas a partir de arquivos CSV exportados do Meta
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Profile Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Perfil do Instagram</label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o perfil" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    @{profile.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Metric Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Métrica</label>
            <Select value={metricType} onValueChange={setMetricType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de métrica" />
              </SelectTrigger>
              <SelectContent>
                {METRIC_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Arquivo CSV</label>
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex items-center gap-3 px-4 py-3 border border-dashed border-muted-foreground/30 rounded-lg hover:border-primary/50 transition-colors">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground flex-1">
                  {fileName || 'Clique ou arraste um arquivo CSV'}
                </span>
                {fileName && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.preventDefault();
                      handleClear();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Preview */}
          {parsedData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Preview dos dados</label>
                <Badge variant="secondary">{parsedData.length} registros</Badge>
              </div>
              <ScrollArea className="h-40 border rounded-lg">
                <div className="p-2 space-y-1 text-sm font-mono">
                  {parsedData.slice(0, 20).map((row, i) => (
                    <div key={i} className="flex justify-between px-2 py-1 rounded hover:bg-muted/50">
                      <span>{format(row.date, 'dd/MM/yyyy', { locale: ptBR })}</span>
                      <span className="text-muted-foreground">
                        {row.value.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))}
                  {parsedData.length > 20 && (
                    <div className="text-center text-muted-foreground py-1">
                      ... e mais {parsedData.length - 20} registros
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={!profileId || !metricType || parsedData.length === 0 || isImporting}
              className="gap-2"
            >
              {isImporting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Importando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Importar {parsedData.length > 0 ? `${parsedData.length} registros` : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
