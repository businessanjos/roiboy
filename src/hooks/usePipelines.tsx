import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePersistedFilter } from "@/hooks/usePersistedFilter";
import { toast } from "sonner";
import { buildPipelineOrderChanges } from "@/lib/sales/pipelineOrder";

export interface Pipeline {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  color: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function usePipelines() {
  const { currentUser } = useCurrentUser();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePipelineId, setActivePipelineId] = usePersistedFilter<string | null>("salesPipeline", "activePipelineId", null);

  const fetchPipelines = useCallback(async () => {
    if (!currentUser?.account_id) return;

    setLoading(true);
    try {
      let { data, error } = await supabase
        .from('pipelines')
        .select('*')
        .eq('account_id', currentUser.account_id)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (error) throw error;

      // If no pipelines exist, create a default one
      if (!data || data.length === 0) {
        const { data: newPipeline, error: createError } = await supabase
          .from('pipelines')
          .insert({
            account_id: currentUser.account_id,
            name: 'Pipeline Principal',
            description: 'Funil de vendas padrão',
            display_order: 0,
          })
          .select()
          .single();

        if (createError) throw createError;
        setPipelines([newPipeline]);
        setActivePipelineId(newPipeline.id);
      } else {
        // Funis marcados como "Sem acesso" nas permissões da pessoa somem do seletor.
        const { data: blocked } = await (supabase as any)
          .from('user_pipeline_access').select('pipeline_id')
          .eq('user_id', currentUser.id).eq('access', 'none');
        const blockedIds = new Set(((blocked ?? []) as { pipeline_id: string }[]).map(b => b.pipeline_id));
        data = data.filter(p => !blockedIds.has(p.id));
        setPipelines(data);
        if (data.length === 0) {
          // Sem acesso a nenhum funil: não mostra nenhum.
          setActivePipelineId(null as any);
          return;
        }
        // Read the persisted value directly from localStorage to avoid stale closure
        const userId = currentUser?.id;
        let persistedId: string | null = null;
        if (userId) {
          try {
            const saved = localStorage.getItem(`roy_filters_${userId}_salesPipeline_activePipelineId`);
            if (saved) persistedId = JSON.parse(saved);
          } catch { /* ignore */ }
        }
        const currentId = persistedId || activePipelineId;
        if (!currentId || !data.find(p => p.id === currentId)) {
          setActivePipelineId(data[0].id);
        } else if (currentId !== activePipelineId) {
          setActivePipelineId(currentId);
        }
      }
    } catch (error: any) {
      console.error('Error fetching pipelines:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id, currentUser?.id]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const createPipeline = async (name: string, description?: string, color?: string): Promise<Pipeline | null> => {
    if (!currentUser?.account_id) return null;

    try {
      const maxOrder = Math.max(...pipelines.map(p => p.display_order), -1);

      const { data, error } = await supabase
        .from('pipelines')
        .insert({
          account_id: currentUser.account_id,
          name,
          description: description || null,
          color: color || '#3b82f6',
          display_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      setPipelines(prev => [...prev, data]);
      toast.success(`Funil "${name}" criado com sucesso`);
      return data;
    } catch (error: any) {
      console.error('Error creating pipeline:', error);
      toast.error('Erro ao criar funil');
      return null;
    }
  };

  const updatePipeline = async (id: string, updates: { name?: string; description?: string; color?: string }): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('pipelines')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setPipelines(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      toast.success('Funil atualizado');
      return true;
    } catch (error: any) {
      console.error('Error updating pipeline:', error);
      toast.error('Erro ao atualizar funil');
      return false;
    }
  };

  const deletePipeline = async (id: string): Promise<boolean> => {
    if (pipelines.length <= 1) {
      toast.error('Você precisa ter pelo menos um funil');
      return false;
    }

    try {
      const { error } = await supabase
        .from('pipelines')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setPipelines(prev => prev.filter(p => p.id !== id));
      if (activePipelineId === id) {
        const remaining = pipelines.filter(p => p.id !== id);
        setActivePipelineId(remaining[0]?.id || null);
      }
      toast.success('Funil removido');
      return true;
    } catch (error: any) {
      console.error('Error deleting pipeline:', error);
      toast.error('Erro ao remover funil');
      return false;
    }
  };

  const reorderPipelines = async (orderedIds: string[]): Promise<boolean> => {
    if (!currentUser?.account_id) return false;
    try {
      const changes = buildPipelineOrderChanges(pipelines, orderedIds);
      const updatedAt = new Date().toISOString();
      // Existing authenticated UPDATE/RLS path; compare saved order to avoid overwriting a concurrent edit.
      const results = await Promise.allSettled(changes.map(async change => {
        const { data, error } = await supabase.from('pipelines')
          .update({ display_order: change.display_order, updated_at: updatedAt })
          .eq('account_id', currentUser.account_id)
          .eq('id', change.id)
          .eq('is_active', true)
          .eq('display_order', change.previous_order)
          .select('id, display_order')
          .single();
        if (error) throw error;
        if (!data || data.display_order !== change.display_order) throw new Error('A ordem do funil mudou ou não pode ser alterada.');
      }));
      if (results.some(result => result.status === 'rejected')) {
        await fetchPipelines();
        toast.error('A ordem não foi salva por completo. Confira a lista e tente novamente.');
        return false;
      }
      const savedOrder = new Map(changes.map(change => [change.id, change.display_order]));
      setPipelines(previous => orderedIds.flatMap(id => {
        const pipeline = previous.find(item => item.id === id);
        return pipeline ? [{ ...pipeline, display_order: savedOrder.get(id) ?? pipeline.display_order }] : [];
      }));
      toast.success('Ordem dos funis salva');
      return true;
    } catch (error) {
      console.error('Error reordering pipelines:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a ordem dos funis.');
      return false;
    }
  };

  const activePipeline = pipelines.find(p => p.id === activePipelineId) || null;

  return {
    pipelines,
    loading,
    activePipelineId,
    activePipeline,
    setActivePipelineId,
    createPipeline,
    updatePipeline,
    deletePipeline,
    reorderPipelines,
    fetchPipelines,
  };
}
