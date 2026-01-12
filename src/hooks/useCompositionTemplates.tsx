import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { toast } from 'sonner';

export interface CompositionTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  composition_items: string[];
  post_type: string | null;
  objective: string | null;
  is_system: boolean;
  created_at: string;
}

export interface CompositionPreset {
  id: string;
  account_id: string;
  name: string;
  composition_items: string[];
  specialist_version: string | null;
  post_type: string | null;
  objective: string | null;
  is_favorite: boolean;
  created_at: string;
}

export function useCompositionTemplates() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();

  // Fetch system templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['composition-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('composition_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as CompositionTemplate[];
    },
  });

  // Fetch user presets
  const { data: presets = [], isLoading: isLoadingPresets } = useQuery({
    queryKey: ['composition-presets', accountId],
    queryFn: async () => {
      if (!accountId) return [];

      const { data, error } = await supabase
        .from('composition_presets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CompositionPreset[];
    },
    enabled: !!accountId,
  });

  // Create preset
  const createPreset = useMutation({
    mutationFn: async (preset: {
      name: string;
      composition_items: string[];
      specialist_version?: string;
      post_type?: string;
      objective?: string;
    }) => {
      if (!accountId) throw new Error('Account not found');

      const { data, error } = await supabase
        .from('composition_presets')
        .insert({
          account_id: accountId,
          name: preset.name,
          composition_items: preset.composition_items,
          specialist_version: preset.specialist_version || null,
          post_type: preset.post_type || null,
          objective: preset.objective || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['composition-presets'] });
      toast.success('Preset salvo com sucesso!');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('Já existe um preset com este nome');
      } else {
        toast.error('Erro ao salvar preset');
      }
    },
  });

  // Delete preset
  const deletePreset = useMutation({
    mutationFn: async (presetId: string) => {
      const { error } = await supabase
        .from('composition_presets')
        .delete()
        .eq('id', presetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['composition-presets'] });
      toast.success('Preset removido');
    },
    onError: () => {
      toast.error('Erro ao remover preset');
    },
  });

  // Filter templates by post type and objective
  const getFilteredTemplates = (postType?: string, objective?: string) => {
    return templates.filter((t) => {
      const matchType = !postType || !t.post_type || t.post_type === postType;
      const matchObjective = !objective || !t.objective || t.objective === objective;
      return matchType && matchObjective;
    });
  };

  return {
    templates,
    presets,
    isLoading: isLoadingTemplates || isLoadingPresets,
    createPreset,
    deletePreset,
    getFilteredTemplates,
  };
}
