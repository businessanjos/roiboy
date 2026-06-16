import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { withRetry } from "@/lib/retryFetch";
import { DEAL_FIELD_IDS } from "@/utils/dealToClientContractMapping";

export interface DealStage {
  id: string;
  account_id: string;
  name: string;
  color: string;
  display_order: number;
  is_active: boolean;
  probability: number;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  account_id: string;
  title: string;
  client_id: string | null;
  lead_id: string | null;
  pipeline_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  stage_id: string | null;
  value: number;
  currency: string;
  expected_close_date: string | null;
  probability: number;
  source: string | null;
  responsible_user_id: string | null;
  sdr_user_id: string | null;
  notes: string | null;
  status: 'open' | 'won' | 'lost';
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  loss_reason_id: string | null;
  loss_sub_reason_id: string | null;
  loss_notes: string | null;
  tags: string[];
  has_second_seat?: boolean;
  second_seat_name?: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  client?: {
    id: string;
    full_name: string;
    phone_e164: string;
    avatar_url: string | null;
  } | null;
  lead?: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  responsible_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
  sdr_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
  stage?: DealStage | null;
}

export interface DealActivity {
  id: string;
  account_id: string;
  deal_id: string;
  type: 'note' | 'call' | 'email' | 'meeting' | 'task' | 'stage_change' | 'status_change';
  title: string | null;
  content: string | null;
  old_value: string | null;
  new_value: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  user_id: string | null;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface CreateDealData {
  title: string;
  client_id?: string;
  lead_id?: string;
  pipeline_id?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  stage_id?: string;
  value?: number;
  expected_close_date?: string;
  probability?: number;
  source?: string;
  responsible_user_id?: string;
  notes?: string;
  tags?: string[];
  product_id?: string; // Item da Venda - será salvo em deal_field_values
}

interface UpdateDealData extends Partial<CreateDealData> {
  status?: 'open' | 'won' | 'lost';
  lost_reason?: string;
  won_at?: string | null;
  lost_at?: string | null;
}

const DEFAULT_STAGES: Omit<DealStage, 'id' | 'account_id' | 'created_at' | 'updated_at'>[] = [
  { name: 'Novo Lead', color: '#6b7280', display_order: 0, is_active: true, probability: 10 },
  { name: 'Qualificação', color: '#3b82f6', display_order: 1, is_active: true, probability: 25 },
  { name: 'Proposta', color: '#f59e0b', display_order: 2, is_active: true, probability: 50 },
  { name: 'Negociação', color: '#8b5cf6', display_order: 3, is_active: true, probability: 75 },
  { name: 'Fechamento', color: '#10b981', display_order: 4, is_active: true, probability: 90 },
];

export function useDeals(pipelineId?: string | null) {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const [stages, setStages] = useState<DealStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [stagesLoading, setStagesLoading] = useState(true);

  const fetchStages = useCallback(async () => {
    if (!currentUser?.account_id) return;
    
    setStagesLoading(true);
    try {
      let query = supabase
        .from('deal_stages')
        .select('*')
        .eq('account_id', currentUser.account_id)
        .order('display_order', { ascending: true });

      if (pipelineId) {
        query = query.eq('pipeline_id', pipelineId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // If no stages exist for this pipeline, create defaults
      if ((!data || data.length === 0) && pipelineId) {
        const stagesToCreate = DEFAULT_STAGES.map((stage, index) => ({
          ...stage,
          account_id: currentUser.account_id,
          pipeline_id: pipelineId,
          display_order: index,
        }));

        const { data: createdStages, error: createError } = await supabase
          .from('deal_stages')
          .insert(stagesToCreate)
          .select();

        if (createError) throw createError;
        setStages(createdStages || []);
      } else {
        setStages(data || []);
      }
    } catch (error: any) {
      console.error('Error fetching stages:', error);
      toast({
        title: "Erro ao carregar stages",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setStagesLoading(false);
    }
  }, [currentUser?.account_id, pipelineId, toast]);

  const fetchDeals = useCallback(async () => {
    if (!currentUser?.account_id) return;
    
    setLoading(true);
    try {
      const selectQuery = `
          id, account_id, title, client_id, lead_id, pipeline_id, contact_name, contact_phone, contact_email,
          stage_id, value, currency, expected_close_date, probability, source,
          responsible_user_id, sdr_user_id, notes, status, won_at, lost_at, lost_reason,
          loss_reason_id, loss_sub_reason_id, loss_notes, tags, created_at, updated_at,
          client:clients(id, full_name, phone_e164, avatar_url),
          lead:leads(id, full_name, phone, email, avatar_url),
          responsible_user:users!deals_responsible_user_id_fkey(id, name, avatar_url),
          sdr_user:users!deals_sdr_user_id_fkey(id, name, avatar_url)
        `;

      // Paginate to fetch ALL deals (Supabase default limit is 1000)
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const batch = await withRetry(async () => {
          let query = supabase
            .from('deals')
            .select(selectQuery)
            .eq('account_id', currentUser.account_id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

          if (pipelineId) {
            query = query.eq('pipeline_id', pipelineId);
          }

          const { data, error } = await query;
          if (error) throw error;
          return data || [];
        }, 3, 1500);

        allData = allData.concat(batch);

        if (batch.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          from += PAGE_SIZE;
        }
      }

      const formattedDeals: Deal[] = allData.map(deal => ({
        ...deal,
        status: deal.status as 'open' | 'won' | 'lost',
        tags: Array.isArray(deal.tags) ? deal.tags as string[] : [],
        stage: deal.stage_id ? stages.find(s => s.id === deal.stage_id) || null : null,
      }));

      setDeals(formattedDeals);
    } catch (error: any) {
      console.error('Error fetching deals:', error);
      toast({
        title: "Erro ao carregar negociações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id, pipelineId, toast]);

  useEffect(() => {
    fetchStages();
    fetchDeals();
  }, [fetchStages, fetchDeals]);

  const createDeal = async (data: CreateDealData): Promise<Deal | null> => {
    if (!currentUser?.account_id) return null;

    try {
      // Convert empty strings to null for UUID fields
      const cleanData: any = { ...data };
      const uuidFields = ['client_id', 'lead_id', 'pipeline_id', 'stage_id', 'responsible_user_id'];
      uuidFields.forEach(field => {
        if (cleanData[field] === '') {
          cleanData[field] = null;
        }
      });

      // Convert empty strings to null for date fields
      const dateFields = ['expected_close_date'];
      dateFields.forEach(field => {
        if (cleanData[field] === '') {
          cleanData[field] = null;
        }
      });

      // Extract product_id before inserting (it goes to deal_field_values, not deals table)
      const productId = cleanData.product_id;
      delete cleanData.product_id;

      const explicitPipelineId = cleanData.pipeline_id;
      delete cleanData.pipeline_id;

      // George's user ID - his manually created deals go to SDR pipeline
      const GEORGE_USER_ID = 'cefc44c7-d2e2-4937-94ac-069c1c94731b';
      const isGeorgeCreating = currentUser.id === GEORGE_USER_ID;

      // Determine pipeline/stage and guarantee both are always persisted together
      let targetPipelineId = explicitPipelineId || pipelineId;
      let targetStageId = cleanData.stage_id;

      if (!targetPipelineId && isGeorgeCreating) {
        const { data: sdrPipeline } = await supabase
          .from('pipelines')
          .select('id')
          .eq('account_id', currentUser.account_id)
          .eq('name', 'SDR')
          .eq('is_active', true)
          .single();

        if (sdrPipeline) {
          targetPipelineId = sdrPipeline.id;

          if (!targetStageId) {
            const { data: firstStage } = await supabase
              .from('deal_stages')
              .select('id')
              .eq('pipeline_id', sdrPipeline.id)
              .order('display_order', { ascending: true })
              .limit(1)
              .single();

            if (firstStage) targetStageId = firstStage.id;
          }
        }
      }

      if (!targetPipelineId && targetStageId) {
        const { data: stageData, error: stageError } = await supabase
          .from('deal_stages')
          .select('pipeline_id')
          .eq('id', targetStageId)
          .eq('account_id', currentUser.account_id)
          .single();

        if (stageError) throw stageError;
        targetPipelineId = stageData.pipeline_id;
      }

      if (!targetPipelineId) {
        const { data: fallbackPipeline, error: pipelineError } = await supabase
          .from('pipelines')
          .select('id')
          .eq('account_id', currentUser.account_id)
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .limit(1)
          .single();

        if (pipelineError) throw pipelineError;
        targetPipelineId = fallbackPipeline.id;
      }

      if (!targetStageId) {
        const { data: firstStage, error: firstStageError } = await supabase
          .from('deal_stages')
          .select('id')
          .eq('account_id', currentUser.account_id)
          .eq('pipeline_id', targetPipelineId)
          .order('display_order', { ascending: true })
          .limit(1)
          .single();

        if (firstStageError) throw firstStageError;
        targetStageId = firstStage.id;
      }

      const insertPayload: any = {
        ...cleanData,
        account_id: currentUser.account_id,
        pipeline_id: targetPipelineId,
        tags: data.tags || [],
        responsible_user_id: cleanData.responsible_user_id ?? currentUser.id,
        stage_id: targetStageId,
        ...(isGeorgeCreating ? { sdr_user_id: GEORGE_USER_ID } : {}),
      };

      const { data: newDeal, error } = await supabase
        .from('deals')
        .insert(insertPayload)
        .select(`
          *,
          client:clients(id, full_name, phone_e164, avatar_url),
          lead:leads(id, full_name, phone, email, avatar_url),
          responsible_user:users!deals_responsible_user_id_fkey(id, name, avatar_url),
          sdr_user:users!deals_sdr_user_id_fkey(id, name, avatar_url),
          stage:deal_stages(*)
        `)
        .single();

      if (error) throw error;

      // Save product_id (Item da Venda) to deal_field_values if provided
      if (productId && newDeal?.id) {
        console.log('[useDeals] Saving Item da Venda product_id:', productId, 'for deal:', newDeal.id);
        const { error: fieldError } = await supabase
          .from('deal_field_values')
          .upsert({
            account_id: currentUser.account_id,
            deal_id: newDeal.id,
            field_id: DEAL_FIELD_IDS.ITEM_VENDA,
            value_text: productId,
          }, { onConflict: 'deal_id,field_id' });
        
        if (fieldError) {
          console.error('[useDeals] Error saving Item da Venda:', fieldError);
        } else {
          console.log('[useDeals] Item da Venda saved successfully');
        }
      }

      const formattedDeal: Deal = {
        ...newDeal,
        status: newDeal.status as 'open' | 'won' | 'lost',
        tags: Array.isArray(newDeal.tags) ? newDeal.tags as string[] : [],
      };

      setDeals(prev => [formattedDeal, ...prev]);

      // Log activity
      await supabase.from('deal_activities').insert({
        account_id: currentUser.account_id,
        deal_id: newDeal.id,
        type: 'note',
        title: 'Negociação criada',
        content: `Negociação "${data.title}" foi criada`,
        user_id: currentUser.id,
      });

      toast({
        title: "Negociação criada",
        description: `"${data.title}" foi adicionada ao pipeline`,
      });

      return formattedDeal;
    } catch (error: any) {
      console.error('Error creating deal:', error);
      toast({
        title: "Erro ao criar negociação",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateDeal = async (dealId: string, data: UpdateDealData): Promise<boolean> => {
    if (!currentUser?.account_id) return false;

    try {
      const updateData: any = { ...data };

      // Extract product_id before sending to deals table (same pattern as createDeal)
      const productId = updateData.product_id;
      delete updateData.product_id;
      
      // Convert empty strings to null for UUID fields
      const uuidFields = ['client_id', 'lead_id', 'pipeline_id', 'stage_id', 'responsible_user_id'];
      uuidFields.forEach(field => {
        if (updateData[field] === '') {
          updateData[field] = null;
        }
      });

      // Convert empty strings to null for date fields
      const dateFields = ['expected_close_date'];
      dateFields.forEach(field => {
        if (updateData[field] === '') {
          updateData[field] = null;
        }
      });
      
      // Handle status changes
      let statusChanged = false;
      let newStatus = '';
      
      if (data.status === 'won' && !data.won_at) {
        updateData.won_at = new Date().toISOString();
        statusChanged = true;
        newStatus = 'won';
      } else if (data.status === 'lost' && !data.lost_at) {
        updateData.lost_at = new Date().toISOString();
        statusChanged = true;
        newStatus = 'lost';
      }

      const { error } = await supabase
        .from('deals')
        .update(updateData)
        .eq('id', dealId)
        .eq('account_id', currentUser.account_id);

      if (error) throw error;

      // Registrar mudança de status no histórico
      if (statusChanged) {
        const statusLabels: Record<string, string> = {
          won: 'Ganho',
          lost: 'Perdido',
          open: 'Em aberto'
        };
        
        await supabase.from('deal_activities').insert({
          account_id: currentUser.account_id,
          deal_id: dealId,
          type: 'status_change',
          title: newStatus === 'won' ? 'Negócio ganho' : 'Negócio perdido',
          old_value: 'Em aberto',
          new_value: statusLabels[newStatus],
          content: newStatus === 'lost' ? (data.lost_reason || null) : null,
          user_id: currentUser.id,
        });
      }

      // Save product_id (Item da Venda) to deal_field_values if provided
      if (productId !== undefined) {
        if (productId && productId !== '') {
          await supabase
            .from('deal_field_values')
            .upsert({
              account_id: currentUser.account_id,
              deal_id: dealId,
              field_id: DEAL_FIELD_IDS.ITEM_VENDA,
              value_text: productId,
            }, { onConflict: 'deal_id,field_id' });
        } else {
          await supabase
            .from('deal_field_values')
            .delete()
            .eq('deal_id', dealId)
            .eq('field_id', DEAL_FIELD_IDS.ITEM_VENDA);
        }
      }

      // Refresh deals
      await fetchDeals();

      return true;
    } catch (error: any) {
      console.error('Error updating deal:', error);
      toast({
        title: "Erro ao atualizar negociação",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const moveDeal = async (dealId: string, newStageId: string, newPipelineId?: string): Promise<boolean> => {
    if (!currentUser?.account_id) return false;

    const deal = deals.find(d => d.id === dealId);
    const oldStage = stages.find(s => s.id === deal?.stage_id);
    // Look up newStage from local stages first, then query DB if not found (cross-pipeline)
    let newStage = stages.find(s => s.id === newStageId);
    if (!newStage) {
      const { data: dbStage } = await supabase
        .from('deal_stages')
        .select('id, name, display_order, is_active, probability, color, account_id, created_at, updated_at')
        .eq('id', newStageId)
        .single();
      if (dbStage) newStage = dbStage as DealStage;
    }

    try {
      // Resolve the deal's current pipeline: use hook pipelineId, or newPipelineId, or query from deal's stage
      const resolvedPipelineId = pipelineId || newPipelineId || deal?.stage_id
        ? await (async () => {
            if (pipelineId) return pipelineId;
            if (newPipelineId) return newPipelineId;
            // Fallback: get pipeline from deal's current stage
            if (deal?.stage_id) {
              const { data: stageData } = await supabase
                .from('deal_stages')
                .select('pipeline_id')
                .eq('id', deal.stage_id)
                .single();
              return stageData?.pipeline_id || null;
            }
            return null;
          })()
        : null;

      // Check if moving to "Reunião Agendada" in SDR pipeline → auto-transfer to Closer
      if (newStage?.name === 'Reunião Agendada' && resolvedPipelineId) {
        // Get current pipeline info
        const { data: currentPipeline } = await supabase
          .from('pipelines')
          .select('name')
          .eq('id', resolvedPipelineId)
          .single();

        if (currentPipeline?.name === 'SDR') {
          // Find the Closer pipeline
          const { data: closerPipeline } = await supabase
            .from('pipelines')
            .select('id')
            .eq('account_id', currentUser.account_id)
            .eq('name', 'Closer')
            .eq('is_active', true)
            .single();

          if (closerPipeline) {
            // Find "Reunião Agendada" stage in Closer pipeline
            const { data: closerStage } = await supabase
              .from('deal_stages')
              .select('id, name, probability')
              .eq('pipeline_id', closerPipeline.id)
              .eq('name', 'Reunião Agendada')
              .single();

            if (closerStage) {
              // Transfer deal to Closer pipeline
              const { error } = await supabase
                .from('deals')
                .update({
                  pipeline_id: closerPipeline.id,
                  stage_id: closerStage.id,
                  probability: closerStage.probability || 0,
                })
                .eq('id', dealId)
                .eq('account_id', currentUser.account_id);

              if (error) throw error;

              // Log the transfer activity
              await supabase.from('deal_activities').insert({
                account_id: currentUser.account_id,
                deal_id: dealId,
                type: 'stage_change',
                title: 'Transferido do SDR para Closer',
                old_value: oldStage?.name || 'Sem etapa',
                new_value: `Reunião Agendada (Closer)`,
                user_id: currentUser.id,
              });

              // Remove from local state (it's now in another pipeline)
              setDeals(prev => prev.filter(d => d.id !== dealId));

              toast({
                title: "Deal transferido para o Closer",
                description: `"${deal?.title}" foi movido para Reunião Agendada no pipeline Closer.`,
              });

              return true;
            }
          }
        }
      }

      // Cross-pipeline or same-pipeline stage move
      const updatePayload: any = { 
        stage_id: newStageId,
        probability: newStage?.probability || 0,
      };

      // If a new pipeline is specified, update pipeline_id too
      if (newPipelineId) {
        updatePayload.pipeline_id = newPipelineId;
      }

      const { error } = await supabase
        .from('deals')
        .update(updatePayload)
        .eq('id', dealId)
        .eq('account_id', currentUser.account_id);

      if (error) throw error;

      // Fetch the new stage info if cross-pipeline (newStage may be null since it's from another pipeline)
      let resolvedNewStage = newStage;
      if (!resolvedNewStage && newStageId) {
        const { data: stageInfo } = await supabase
          .from('deal_stages')
          .select('*')
          .eq('id', newStageId)
          .single();
        resolvedNewStage = stageInfo || undefined;
      }

      // Log stage change activity
      const isOtherPipeline = newPipelineId && newPipelineId !== pipelineId;
      await supabase.from('deal_activities').insert({
        account_id: currentUser.account_id,
        deal_id: dealId,
        type: 'stage_change',
        title: isOtherPipeline ? 'Transferido entre funis' : 'Mudança de etapa',
        old_value: oldStage?.name || 'Sem etapa',
        new_value: resolvedNewStage?.name || 'Sem etapa',
        user_id: currentUser.id,
      });

      if (isOtherPipeline) {
        // Remove from local state since it moved to another pipeline
        setDeals(prev => prev.filter(d => d.id !== dealId));
      } else {
        // Update local state immediately for better UX
        setDeals(prev => prev.map(d => 
          d.id === dealId 
            ? { ...d, stage_id: newStageId, stage: resolvedNewStage, probability: resolvedNewStage?.probability || 0 }
            : d
        ));
      }

      return true;
    } catch (error: any) {
      console.error('Error moving deal:', error);
      toast({
        title: "Erro ao mover negociação",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteDeal = async (dealId: string): Promise<boolean> => {
    if (!currentUser?.account_id) return false;

    try {
      // Soft-delete: marca deleted_at em vez de remover do banco.
      // Permite restaurar e filtrar "Excluído" nos Insights.
      const { error } = await supabase
        .from('deals')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: currentUser.auth_user_id ?? null,
        })
        .eq('id', dealId)
        .eq('account_id', currentUser.account_id);

      if (error) throw error;

      setDeals(prev => prev.filter(d => d.id !== dealId));

      toast({
        title: "Negociação excluída",
        description: "A negociação foi removida do pipeline (pode ser restaurada por um admin).",
      });

      return true;
    } catch (error: any) {
      console.error('Error deleting deal:', error);
      toast({
        title: "Erro ao excluir negociação",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const restoreDeal = async (dealId: string): Promise<boolean> => {
    if (!currentUser?.account_id) return false;
    try {
      const { error } = await supabase
        .from('deals')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', dealId)
        .eq('account_id', currentUser.account_id);

      if (error) throw error;

      await fetchDeals();

      toast({
        title: "Negociação restaurada",
        description: "A negociação voltou para o pipeline.",
      });

      return true;
    } catch (error: any) {
      console.error('Error restoring deal:', error);
      toast({
        title: "Erro ao restaurar negociação",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const markAsWon = async (dealId: string): Promise<boolean> => {
    return updateDeal(dealId, { status: 'won' });
  };

  const markAsLost = async (dealId: string, reason?: string, lossData?: { lossReasonId?: string; lossSubReasonId?: string; lossNotes?: string }): Promise<boolean> => {
    const updates: Record<string, any> = { status: 'lost', lost_reason: reason };
    if (lossData?.lossReasonId) updates.loss_reason_id = lossData.lossReasonId;
    if (lossData?.lossSubReasonId) updates.loss_sub_reason_id = lossData.lossSubReasonId;
    if (lossData?.lossNotes) updates.loss_notes = lossData.lossNotes;
    return updateDeal(dealId, updates);
  };

  const reopenDeal = async (dealId: string): Promise<boolean> => {
    if (!currentUser?.account_id) return false;

    // Buscar status atual do negócio antes de reabrir
    const currentDeal = deals.find(d => d.id === dealId);
    const previousStatus = currentDeal?.status === 'won' ? 'Ganho' : 'Perdido';

    try {
      // If deal was WON, we need to reverse the contract and client triage status
      if (currentDeal?.status === 'won') {
        // 1. Delete the contract linked to this deal
        const { error: contractDeleteError } = await supabase
          .from('client_contracts')
          .delete()
          .eq('deal_id', dealId)
          .eq('account_id', currentUser.account_id);

        if (contractDeleteError) {
          console.error('[reopenDeal] Error deleting linked contract:', contractDeleteError);
          // Non-blocking - continue even if no contract was found
        } else {
          console.log('[reopenDeal] Linked contract deleted successfully');
        }

        // 2. Remove responsible_user_id from client (returns to triage queue)
        if (currentDeal.client_id) {
          const { error: clientUpdateError } = await supabase
            .from('clients')
            .update({ responsible_user_id: null })
            .eq('id', currentDeal.client_id)
            .eq('account_id', currentUser.account_id);

          if (clientUpdateError) {
            console.error('[reopenDeal] Error clearing client responsible:', clientUpdateError);
          } else {
            console.log('[reopenDeal] Client returned to triage queue');
          }
        }
      }

      // 3. Reopen the deal
      const { error } = await supabase
        .from('deals')
        .update({ 
          status: 'open',
          won_at: null,
          lost_at: null,
          lost_reason: null,
        })
        .eq('id', dealId)
        .eq('account_id', currentUser.account_id);

      if (error) throw error;

      // Registrar reabertura no histórico
      await supabase.from('deal_activities').insert({
        account_id: currentUser.account_id,
        deal_id: dealId,
        type: 'status_change',
        title: 'Negócio reaberto',
        old_value: previousStatus,
        new_value: 'Em aberto',
        user_id: currentUser.id,
      });

      await fetchDeals();

      toast({
        title: "Negociação reaberta",
        description: currentDeal?.status === 'won' 
          ? "A negociação voltou ao pipeline e o contrato foi removido"
          : "A negociação voltou ao pipeline",
      });

      return true;
    } catch (error: any) {
      console.error('Error reopening deal:', error);
      toast({
        title: "Erro ao reabrir negociação",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  // Stage management
  const createStage = async (data: { name: string; color: string; probability?: number }): Promise<DealStage | null> => {
    if (!currentUser?.account_id) return null;

    try {
      const maxOrder = Math.max(...stages.map(s => s.display_order), -1);

      const insertData: any = {
          account_id: currentUser.account_id,
          name: data.name,
          color: data.color,
          probability: data.probability || 0,
          display_order: maxOrder + 1,
        };
      if (pipelineId) {
        insertData.pipeline_id = pipelineId;
      }

      const { data: newStage, error } = await supabase
        .from('deal_stages')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      setStages(prev => [...prev, newStage]);

      toast({
        title: "Etapa criada",
        description: `"${data.name}" foi adicionada ao pipeline`,
      });

      return newStage;
    } catch (error: any) {
      console.error('Error creating stage:', error);
      toast({
        title: "Erro ao criar etapa",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateStage = async (stageId: string, data: { name?: string; color?: string; probability?: number }): Promise<boolean> => {
    if (!currentUser?.account_id) return false;

    try {
      const { error } = await supabase
        .from('deal_stages')
        .update(data)
        .eq('id', stageId)
        .eq('account_id', currentUser.account_id);

      if (error) throw error;

      setStages(prev => prev.map(s => 
        s.id === stageId ? { ...s, ...data } : s
      ));

      return true;
    } catch (error: any) {
      console.error('Error updating stage:', error);
      toast({
        title: "Erro ao atualizar etapa",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteStage = async (stageId: string): Promise<boolean> => {
    if (!currentUser?.account_id) return false;

    // Check if there are deals in this stage
    const dealsInStage = deals.filter(d => d.stage_id === stageId);
    if (dealsInStage.length > 0) {
      toast({
        title: "Não é possível excluir",
        description: `Existem ${dealsInStage.length} negociações nesta etapa`,
        variant: "destructive",
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('deal_stages')
        .delete()
        .eq('id', stageId)
        .eq('account_id', currentUser.account_id);

      if (error) throw error;

      setStages(prev => prev.filter(s => s.id !== stageId));

      toast({
        title: "Etapa excluída",
        description: "A etapa foi removida do pipeline",
      });

      return true;
    } catch (error: any) {
      console.error('Error deleting stage:', error);
      toast({
        title: "Erro ao excluir etapa",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const reorderStages = async (orderedStageIds: string[]): Promise<boolean> => {
    if (!currentUser?.account_id) return false;

    try {
      const updates = orderedStageIds.map((id, index) => ({
        id,
        display_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('deal_stages')
          .update({ display_order: update.display_order })
          .eq('id', update.id)
          .eq('account_id', currentUser.account_id);

        if (error) throw error;
      }

      // Update local state
      setStages(prev => {
        const stageMap = new Map(prev.map(s => [s.id, s]));
        return orderedStageIds
          .map((id, index) => {
            const stage = stageMap.get(id);
            return stage ? { ...stage, display_order: index } : null;
          })
          .filter(Boolean) as DealStage[];
      });

      return true;
    } catch (error: any) {
      console.error('Error reordering stages:', error);
      toast({
        title: "Erro ao reordenar etapas",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  // Computed values - memoized to prevent new references each render
  const openDeals = useMemo(() => deals.filter(d => d.status === 'open'), [deals]);
  const wonDeals = useMemo(() => deals.filter(d => d.status === 'won'), [deals]);
  const lostDeals = useMemo(() => deals.filter(d => d.status === 'lost'), [deals]);
  
  const totalPipelineValue = useMemo(() => openDeals.reduce((sum, d) => sum + (d.value || 0), 0), [openDeals]);
  const weightedPipelineValue = useMemo(() => openDeals.reduce((sum, d) => {
    const stageProbability = (d as any).stage?.probability ?? 0;
    const probability = (d.probability && d.probability > 0) ? d.probability : stageProbability;
    return sum + ((d.value || 0) * probability / 100);
  }, 0), [openDeals]);
  const totalWonValue = useMemo(() => wonDeals.reduce((sum, d) => sum + (d.value || 0), 0), [wonDeals]);

  return {
    stages,
    deals,
    loading,
    stagesLoading,
    openDeals,
    wonDeals,
    lostDeals,
    totalPipelineValue,
    weightedPipelineValue,
    totalWonValue,
    fetchStages,
    fetchDeals,
    createDeal,
    updateDeal,
    moveDeal,
    deleteDeal,
    restoreDeal,
    markAsWon,
    markAsLost,
    reopenDeal,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
  };
}
