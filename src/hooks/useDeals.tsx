import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";

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
  notes: string | null;
  status: 'open' | 'won' | 'lost';
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  tags: string[];
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

export function useDeals() {
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
      const { data, error } = await supabase
        .from('deal_stages')
        .select('*')
        .eq('account_id', currentUser.account_id)
        .order('display_order', { ascending: true });

      if (error) throw error;

      // If no stages exist, create defaults
      if (!data || data.length === 0) {
        const stagesToCreate = DEFAULT_STAGES.map((stage, index) => ({
          ...stage,
          account_id: currentUser.account_id,
          display_order: index,
        }));

        const { data: createdStages, error: createError } = await supabase
          .from('deal_stages')
          .insert(stagesToCreate)
          .select();

        if (createError) throw createError;
        setStages(createdStages || []);
      } else {
        setStages(data);
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
  }, [currentUser?.account_id, toast]);

  const fetchDeals = useCallback(async () => {
    if (!currentUser?.account_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deals')
        .select(`
          *,
          client:clients(id, full_name, phone_e164, avatar_url),
          lead:leads(id, full_name, phone, email, avatar_url),
          responsible_user:users!deals_responsible_user_id_fkey(id, name, avatar_url),
          stage:deal_stages(*)
        `)
        .eq('account_id', currentUser.account_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedDeals: Deal[] = (data || []).map(deal => ({
        ...deal,
        status: deal.status as 'open' | 'won' | 'lost',
        tags: Array.isArray(deal.tags) ? deal.tags as string[] : [],
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
  }, [currentUser?.account_id, toast]);

  useEffect(() => {
    fetchStages();
    fetchDeals();
  }, [fetchStages, fetchDeals]);

  const createDeal = async (data: CreateDealData): Promise<Deal | null> => {
    if (!currentUser?.account_id) return null;

    try {
      // Convert empty strings to null for UUID fields
      const cleanData: any = { ...data };
      const uuidFields = ['client_id', 'lead_id', 'stage_id', 'responsible_user_id'];
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

      const { data: newDeal, error } = await supabase
        .from('deals')
        .insert({
          ...cleanData,
          account_id: currentUser.account_id,
          tags: data.tags || [],
        })
        .select(`
          *,
          client:clients(id, full_name, phone_e164, avatar_url),
          lead:leads(id, full_name, phone, email, avatar_url),
          responsible_user:users!deals_responsible_user_id_fkey(id, name, avatar_url),
          stage:deal_stages(*)
        `)
        .single();

      if (error) throw error;

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
      
      // Convert empty strings to null for UUID fields
      const uuidFields = ['client_id', 'lead_id', 'stage_id', 'responsible_user_id'];
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
      if (data.status === 'won' && !data.won_at) {
        updateData.won_at = new Date().toISOString();
      } else if (data.status === 'lost' && !data.lost_at) {
        updateData.lost_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('deals')
        .update(updateData)
        .eq('id', dealId)
        .eq('account_id', currentUser.account_id);

      if (error) throw error;

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

  const moveDeal = async (dealId: string, newStageId: string): Promise<boolean> => {
    if (!currentUser?.account_id) return false;

    const deal = deals.find(d => d.id === dealId);
    const oldStage = stages.find(s => s.id === deal?.stage_id);
    const newStage = stages.find(s => s.id === newStageId);

    try {
      const { error } = await supabase
        .from('deals')
        .update({ 
          stage_id: newStageId,
          probability: newStage?.probability || 0,
        })
        .eq('id', dealId)
        .eq('account_id', currentUser.account_id);

      if (error) throw error;

      // Log stage change activity
      await supabase.from('deal_activities').insert({
        account_id: currentUser.account_id,
        deal_id: dealId,
        type: 'stage_change',
        title: 'Mudança de etapa',
        old_value: oldStage?.name || 'Sem etapa',
        new_value: newStage?.name || 'Sem etapa',
        user_id: currentUser.id,
      });

      // Update local state immediately for better UX
      setDeals(prev => prev.map(d => 
        d.id === dealId 
          ? { ...d, stage_id: newStageId, stage: newStage, probability: newStage?.probability || 0 }
          : d
      ));

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
      const { error } = await supabase
        .from('deals')
        .delete()
        .eq('id', dealId)
        .eq('account_id', currentUser.account_id);

      if (error) throw error;

      setDeals(prev => prev.filter(d => d.id !== dealId));

      toast({
        title: "Negociação excluída",
        description: "A negociação foi removida do pipeline",
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

  const markAsWon = async (dealId: string): Promise<boolean> => {
    return updateDeal(dealId, { status: 'won' });
  };

  const markAsLost = async (dealId: string, reason?: string): Promise<boolean> => {
    return updateDeal(dealId, { status: 'lost', lost_reason: reason });
  };

  const reopenDeal = async (dealId: string): Promise<boolean> => {
    if (!currentUser?.account_id) return false;

    try {
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

      await fetchDeals();

      toast({
        title: "Negociação reaberta",
        description: "A negociação voltou ao pipeline",
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

      const { data: newStage, error } = await supabase
        .from('deal_stages')
        .insert({
          account_id: currentUser.account_id,
          name: data.name,
          color: data.color,
          probability: data.probability || 0,
          display_order: maxOrder + 1,
        })
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

  // Computed values
  const openDeals = deals.filter(d => d.status === 'open');
  const wonDeals = deals.filter(d => d.status === 'won');
  const lostDeals = deals.filter(d => d.status === 'lost');
  
  const totalPipelineValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const weightedPipelineValue = openDeals.reduce((sum, d) => sum + ((d.value || 0) * (d.probability || 0) / 100), 0);
  const totalWonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);

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
    markAsWon,
    markAsLost,
    reopenDeal,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
  };
}
