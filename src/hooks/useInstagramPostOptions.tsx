import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { toast } from 'sonner';

export interface PostOption {
  id?: string;
  value: string;
  display_order?: number;
  isDefault?: boolean;
}

// Default composition options
const DEFAULT_COMPOSITION_OPTIONS: string[] = [
  'Valoriza a mulher',
  'Autoral (medo, riqueza, bmw)',
  'Mentalidade firme',
  'Ação',
  'Reels curto/trendy casal até 30s',
  'Versão marido',
  'Musica em alta',
  'Imagens são orgânicas',
  'Um take só sem edição',
  'Headline branca com borda preta legível',
  'Ganho forte de conexão',
  'Legenda reflexiva e maior',
  'Videos vitalizados',
  'Ideia de conteúdo',
  'Tela verde',
  'Jeito certo',
  'Legenda nível de consciência',
  'Duração: até 30 segundos',
  'Rostos conhecidos',
  '8 a 12 telas',
  'Legenda: média',
  'Despertou uma emoção',
  'Valores',
  'Família',
  'Fotos orgânicas',
  'Conquista',
  'Vida ryka',
  'Trendy e fixado',
  'Gancho forte',
  'Fonte stories',
  'Capa com expressão/imagem chamativa',
  'CTA clique no link',
  'Pessoas famosas para o público',
  'Padrão de gancho e estética',
  'Capa chamativa e bonita',
  'Capa elementos que comuniquem conteúdo',
  '2a tela contextualiza acontecimento',
  'Alterna com vídeos (1a tela e outras)',
  'Legenda contextualizada',
  'Conteúdo linkado com estética',
  'Tela antes e depois comparativo',
  'CTA + imagens do método',
  'Postado até a 1a semana',
];

export function useInstagramPostOptions() {
  const { currentUser: user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Fetch custom options from database
  const { data: customOptions = [], isLoading } = useQuery({
    queryKey: ['instagram-post-options', user?.account_id],
    queryFn: async () => {
      if (!user?.account_id) return [];

      const { data, error } = await supabase
        .from('instagram_post_options')
        .select('*')
        .eq('account_id', user.account_id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.account_id,
  });

  // Get specialist version options (custom only, user adds their own)
  const specialistVersionOptions: PostOption[] = customOptions
    .filter((opt) => opt.option_type === 'specialist_version')
    .map((opt) => ({
      id: opt.id,
      value: opt.value,
      display_order: opt.display_order,
    }));

  // Get composition options (defaults + custom)
  const customCompositionOptions = customOptions
    .filter((opt) => opt.option_type === 'composition')
    .map((opt) => opt.value);

  const allCompositionOptions: PostOption[] = [
    ...DEFAULT_COMPOSITION_OPTIONS.map((value) => ({
      value,
      isDefault: true,
    })),
    ...customOptions
      .filter((opt) => opt.option_type === 'composition')
      .map((opt) => ({
        id: opt.id,
        value: opt.value,
        display_order: opt.display_order,
      })),
  ];

  // Remove duplicates
  const uniqueCompositionOptions = allCompositionOptions.filter(
    (opt, index, self) =>
      index === self.findIndex((o) => o.value.toLowerCase() === opt.value.toLowerCase())
  );

  // Add new option mutation
  const addOption = useMutation({
    mutationFn: async ({
      optionType,
      value,
    }: {
      optionType: 'specialist_version' | 'composition';
      value: string;
    }) => {
      if (!user?.account_id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('instagram_post_options')
        .insert({
          account_id: user.account_id,
          option_type: optionType,
          value: value.trim(),
          display_order: 0,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Esta opção já existe');
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-post-options'] });
      toast.success('Opção adicionada!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Delete option mutation
  const deleteOption = useMutation({
    mutationFn: async (optionId: string) => {
      const { error } = await supabase
        .from('instagram_post_options')
        .delete()
        .eq('id', optionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-post-options'] });
      toast.success('Opção removida!');
    },
    onError: (error) => {
      toast.error('Erro ao remover opção: ' + error.message);
    },
  });

  return {
    specialistVersionOptions,
    compositionOptions: uniqueCompositionOptions,
    isLoading,
    addOption,
    deleteOption,
  };
}
