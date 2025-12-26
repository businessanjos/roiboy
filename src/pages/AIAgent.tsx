import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';
import { 
  Bot, 
  TrendingUp, 
  AlertTriangle, 
  Heart, 
  Activity, 
  ThumbsUp, 
  Headphones,
  ChevronDown, 
  ChevronUp,
  Save,
  RefreshCw,
  MessageSquareText
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AIAgentFunction {
  id: string;
  account_id: string;
  function_key: string;
  function_name: string;
  description: string | null;
  is_enabled: boolean;
  instructions: string | null;
  settings: Record<string, unknown>;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const FUNCTION_ICONS: Record<string, React.ReactNode> = {
  roi_detection: <TrendingUp className="h-5 w-5" />,
  risk_detection: <AlertTriangle className="h-5 w-5" />,
  life_events: <Heart className="h-5 w-5" />,
  engagement_score: <Activity className="h-5 w-5" />,
  vnps_eligibility: <ThumbsUp className="h-5 w-5" />,
  support_requests: <Headphones className="h-5 w-5" />,
};

const FUNCTION_COLORS: Record<string, string> = {
  roi_detection: 'bg-green-500/10 text-green-500 border-green-500/20',
  risk_detection: 'bg-red-500/10 text-red-500 border-red-500/20',
  life_events: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  engagement_score: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  vnps_eligibility: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  support_requests: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

export default function AIAgent() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const queryClient = useQueryClient();
  const [expandedFunctions, setExpandedFunctions] = useState<Record<string, boolean>>({});
  const [editedInstructions, setEditedInstructions] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});

  // Fetch AI functions
  const { data: functions, isLoading, refetch } = useQuery({
    queryKey: ['ai-agent-functions', accountId],
    queryFn: async () => {
      if (!accountId) return [];

      // First, try to initialize default functions if none exist
      const { data: existing } = await supabase
        .from('ai_agent_functions')
        .select('id')
        .eq('account_id', accountId)
        .limit(1);

      if (!existing || existing.length === 0) {
        // Initialize default functions
        await supabase.rpc('initialize_ai_agent_functions', { p_account_id: accountId });
      }

      const { data, error } = await supabase
        .from('ai_agent_functions')
        .select('*')
        .eq('account_id', accountId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as AIAgentFunction[];
    },
    enabled: !!accountId,
  });

  // Initialize edited instructions when functions load
  useEffect(() => {
    if (functions) {
      const instructions: Record<string, string> = {};
      functions.forEach(fn => {
        instructions[fn.id] = fn.instructions || '';
      });
      setEditedInstructions(instructions);
    }
  }, [functions]);

  // Toggle function enabled/disabled
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('ai_agent_functions')
        .update({ is_enabled })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-functions'] });
      toast.success('Função atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar função');
    },
  });

  // Save instructions
  const saveInstructionsMutation = useMutation({
    mutationFn: async ({ id, instructions }: { id: string; instructions: string }) => {
      const { error } = await supabase
        .from('ai_agent_functions')
        .update({ instructions })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-functions'] });
      setHasChanges(prev => ({ ...prev, [variables.id]: false }));
      toast.success('Instruções salvas');
    },
    onError: () => {
      toast.error('Erro ao salvar instruções');
    },
  });

  const handleToggle = (fn: AIAgentFunction) => {
    toggleMutation.mutate({ id: fn.id, is_enabled: !fn.is_enabled });
  };

  const handleInstructionsChange = (id: string, value: string) => {
    setEditedInstructions(prev => ({ ...prev, [id]: value }));
    const original = functions?.find(f => f.id === id)?.instructions || '';
    setHasChanges(prev => ({ ...prev, [id]: value !== original }));
  };

  const handleSaveInstructions = (id: string) => {
    saveInstructionsMutation.mutate({ id, instructions: editedInstructions[id] });
  };

  const toggleExpanded = (id: string) => {
    setExpandedFunctions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Agente ROY</h1>
            <p className="text-muted-foreground">
              Configure as funções de inteligência artificial do seu assistente
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <MessageSquareText className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Como funciona o Agente ROY?</p>
              <p className="text-muted-foreground mt-1">
                O Agente ROY analisa automaticamente as conversas dos grupos de WhatsApp que têm a 
                "Análise IA" ativada. Cada função abaixo pode ser ligada ou desligada individualmente, 
                e você pode personalizar as instruções para adaptar o comportamento da IA ao seu negócio.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Functions List */}
      <div className="grid gap-4">
        {functions?.map((fn) => (
          <Card key={fn.id} className={fn.is_enabled ? 'border-primary/30' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg border ${FUNCTION_COLORS[fn.function_key] || 'bg-muted'}`}>
                    {FUNCTION_ICONS[fn.function_key] || <Bot className="h-5 w-5" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{fn.function_name}</CardTitle>
                      {fn.is_enabled && (
                        <Badge variant="secondary" className="text-xs">
                          Ativo
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{fn.description}</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={fn.is_enabled}
                  onCheckedChange={() => handleToggle(fn)}
                  disabled={toggleMutation.isPending}
                />
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <Collapsible open={expandedFunctions[fn.id]} onOpenChange={() => toggleExpanded(fn.id)}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="text-sm text-muted-foreground">
                      {expandedFunctions[fn.id] ? 'Ocultar instruções' : 'Ver instruções'}
                    </span>
                    {expandedFunctions[fn.id] ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Instruções para a IA
                    </label>
                    <Textarea
                      value={editedInstructions[fn.id] || ''}
                      onChange={(e) => handleInstructionsChange(fn.id, e.target.value)}
                      placeholder="Descreva como a IA deve realizar esta função..."
                      className="min-h-[150px] font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Personalize as instruções para adaptar o comportamento da IA ao seu negócio.
                      Use markdown para formatação.
                    </p>
                  </div>
                  {hasChanges[fn.id] && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleSaveInstructions(fn.id)}
                        disabled={saveInstructionsMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salvar instruções
                      </Button>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {(!functions || functions.length === 0) && !isLoading && (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhuma função configurada</h3>
            <p className="text-muted-foreground mt-1">
              Clique em "Atualizar" para carregar as funções padrão.
            </p>
            <Button className="mt-4" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Carregar funções
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
