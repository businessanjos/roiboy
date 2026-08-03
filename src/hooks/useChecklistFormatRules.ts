import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';
import { FormatRuleMap, ruleKey } from '@/components/marketing/contentChecklistSchema';

interface FormatRuleRow {
  format: string;
  section_id: string;
  enabled: boolean;
}

export function useChecklistFormatRules() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const { data: rules = {}, isLoading } = useQuery({
    queryKey: ['content-checklist-format-rules', accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<FormatRuleMap> => {
      const { data, error } = await (supabase as any)
        .from('content_checklist_format_rules')
        .select('format, section_id, enabled')
        .eq('account_id', accountId);
      if (error) throw error;
      const map: FormatRuleMap = {};
      for (const row of (data ?? []) as FormatRuleRow[]) {
        map[ruleKey(row.format, row.section_id)] = row.enabled;
      }
      return map;
    },
  });

  const saveRules = useMutation({
    mutationFn: async (entries: Array<{ format: string; sectionId: string; enabled: boolean }>) => {
      if (!accountId) throw new Error('Sem conta ativa');
      const payload = entries.map((e) => ({
        account_id: accountId,
        format: e.format,
        section_id: e.sectionId,
        enabled: e.enabled,
      }));
      const { error } = await (supabase as any)
        .from('content_checklist_format_rules')
        .upsert(payload, { onConflict: 'account_id,format,section_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-checklist-format-rules'] });
      toast.success('Configuração de etapas por formato salva');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar configuração'),
  });

  const resetRules = useMutation({
    mutationFn: async () => {
      if (!accountId) throw new Error('Sem conta ativa');
      const { error } = await (supabase as any)
        .from('content_checklist_format_rules')
        .delete()
        .eq('account_id', accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-checklist-format-rules'] });
      toast.success('Configuração restaurada para o padrão');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao restaurar padrão'),
  });

  return { rules, isLoading, saveRules, resetRules };
}
