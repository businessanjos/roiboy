import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Deal } from "@/hooks/useDeals";
import { toast } from "sonner";

export interface FilterCondition {
  field: string;
  operator: string;
  value: any;
}

export interface PipelineFilter {
  id: string;
  account_id: string;
  name: string;
  conditions: FilterCondition[];
  match_type: 'all' | 'any';
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ActiveFilter {
  type: 'salesperson' | 'recommended' | 'custom' | 'product';
  id: string;
  name: string;
  conditions?: FilterCondition[];
  match_type?: 'all' | 'any';
}

// Recommended filters (predefined system filters)
export const RECOMMENDED_FILTERS = [
  {
    id: 'created_today',
    name: 'Criados hoje',
    conditions: [{ field: 'created_at', operator: 'today', value: null }],
    match_type: 'all' as const
  },
  {
    id: 'created_this_week',
    name: 'Criados esta semana',
    conditions: [{ field: 'created_at', operator: 'this_week', value: null }],
    match_type: 'all' as const
  },
  {
    id: 'created_this_month',
    name: 'Criados este mês',
    conditions: [{ field: 'created_at', operator: 'this_month', value: null }],
    match_type: 'all' as const
  },
  {
    id: 'high_value',
    name: 'Valor acima de R$ 10.000',
    conditions: [{ field: 'value', operator: 'greater_than', value: 10000 }],
    match_type: 'all' as const
  },
  {
    id: 'no_activity_7_days',
    name: 'Sem atividade há 7 dias',
    conditions: [{ field: 'updated_at', operator: 'older_than_days', value: 7 }],
    match_type: 'all' as const
  },
  {
    id: 'closing_soon',
    name: 'Fechamento previsto em 7 dias',
    conditions: [{ field: 'expected_close_date', operator: 'next_days', value: 7 }],
    match_type: 'all' as const
  },
  {
    id: 'has_tags',
    name: 'Com tags',
    conditions: [{ field: 'tags', operator: 'is_not_empty', value: null }],
    match_type: 'all' as const
  },
  {
    id: 'no_responsible',
    name: 'Sem vendedor atribuído',
    conditions: [{ field: 'responsible_user_id', operator: 'is_empty', value: null }],
    match_type: 'all' as const
  },
];

export function usePipelineFilters() {
  const { currentUser } = useCurrentUser();
  const [filters, setFilters] = useState<PipelineFilter[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFilters = useCallback(async () => {
    if (!currentUser?.account_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pipeline_filters")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .order("name");

      if (error) throw error;

      setFilters((data || []).map(f => ({
        ...f,
        conditions: Array.isArray(f.conditions) ? f.conditions as unknown as FilterCondition[] : [],
        match_type: f.match_type as 'all' | 'any'
      })));
    } catch (error) {
      console.error("Error fetching pipeline filters:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id]);

  const createFilter = useCallback(async (
    name: string,
    conditions: FilterCondition[],
    matchType: 'all' | 'any',
    isPublic: boolean
  ) => {
    if (!currentUser?.account_id || !currentUser?.id) {
      toast.error("Usuário não autenticado");
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("pipeline_filters")
        .insert({
          account_id: currentUser.account_id,
          name,
          conditions: conditions as any,
          match_type: matchType,
          is_public: isPublic,
          created_by: currentUser.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Filtro criado com sucesso");
      await fetchFilters();
      return data;
    } catch (error) {
      console.error("Error creating filter:", error);
      toast.error("Erro ao criar filtro");
      return null;
    }
  }, [currentUser, fetchFilters]);

  const updateFilter = useCallback(async (
    id: string,
    updates: Partial<Pick<PipelineFilter, 'name' | 'conditions' | 'match_type' | 'is_public'>>
  ) => {
    try {
      const { error } = await supabase
        .from("pipeline_filters")
        .update({
          ...updates,
          conditions: updates.conditions as any,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Filtro atualizado");
      await fetchFilters();
      return true;
    } catch (error) {
      console.error("Error updating filter:", error);
      toast.error("Erro ao atualizar filtro");
      return false;
    }
  }, [fetchFilters]);

  const deleteFilter = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("pipeline_filters")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Filtro excluído");
      await fetchFilters();
      return true;
    } catch (error) {
      console.error("Error deleting filter:", error);
      toast.error("Erro ao excluir filtro");
      return false;
    }
  }, [fetchFilters]);

  return {
    filters,
    loading,
    fetchFilters,
    createFilter,
    updateFilter,
    deleteFilter,
  };
}

// Utility function to apply filters to deals
export function applyFilterToDeals(
  deals: Deal[],
  activeFilter: ActiveFilter | null,
  searchTerm?: string,
  dealProductMap?: Record<string, string>
): Deal[] {
  if (!activeFilter && !searchTerm?.trim()) return deals;

  let filtered = [...deals];

  // Apply search term first
  if (searchTerm?.trim()) {
    const term = searchTerm.toLowerCase().trim();
    filtered = filtered.filter(deal =>
      deal.title.toLowerCase().includes(term) ||
      deal.contact_name?.toLowerCase().includes(term) ||
      deal.contact_phone?.toLowerCase().includes(term) ||
      deal.client?.full_name?.toLowerCase().includes(term) ||
      deal.client?.phone_e164?.toLowerCase().includes(term)
    );
  }

  if (!activeFilter) return filtered;

  // Salesperson filter
  if (activeFilter.type === 'salesperson') {
    return filtered.filter(deal => deal.responsible_user_id === activeFilter.id);
  }

  // Product filter
  if (activeFilter.type === 'product') {
    if (!dealProductMap) return filtered;
    return filtered.filter(deal => dealProductMap[deal.id] === activeFilter.id);
  }

  // Recommended or Custom filters
  const conditions = activeFilter.conditions || [];
  const matchType = activeFilter.match_type || 'all';

  if (conditions.length === 0) return filtered;

  return filtered.filter(deal => {
    const results = conditions.map(condition => evaluateCondition(deal, condition));
    
    if (matchType === 'all') {
      return results.every(Boolean);
    } else {
      return results.some(Boolean);
    }
  });
}

function evaluateCondition(deal: Deal, condition: FilterCondition): boolean {
  const { field, operator, value } = condition;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (field) {
    case 'title':
      return evaluateTextCondition(deal.title, operator, value);
    
    case 'value':
      return evaluateNumberCondition(deal.value || 0, operator, value);
    
    case 'responsible_user_id':
      if (operator === 'is_empty') return !deal.responsible_user_id;
      if (operator === 'is_not_empty') return !!deal.responsible_user_id;
      return deal.responsible_user_id === value;
    
    case 'stage_id':
      return deal.stage_id === value;
    
    case 'tags':
      if (operator === 'is_empty') return !deal.tags || deal.tags.length === 0;
      if (operator === 'is_not_empty') return deal.tags && deal.tags.length > 0;
      if (operator === 'contains') return deal.tags?.includes(value) || false;
      if (operator === 'not_contains') return !deal.tags?.includes(value);
      return false;
    
    case 'source':
      if (operator === 'is_empty') return !deal.source;
      if (operator === 'is_not_empty') return !!deal.source;
      return deal.source === value;
    
    case 'created_at':
      return evaluateDateCondition(deal.created_at, operator, value, today);
    
    case 'updated_at':
      return evaluateDateCondition(deal.updated_at, operator, value, today);
    
    case 'expected_close_date':
      if (!deal.expected_close_date) {
        return operator === 'is_empty';
      }
      return evaluateDateCondition(deal.expected_close_date, operator, value, today);
    
    default:
      return true;
  }
}

function evaluateTextCondition(fieldValue: string | null | undefined, operator: string, value: any): boolean {
  const text = (fieldValue || '').toLowerCase();
  const searchValue = String(value || '').toLowerCase();

  switch (operator) {
    case 'contains': return text.includes(searchValue);
    case 'not_contains': return !text.includes(searchValue);
    case 'equals': return text === searchValue;
    case 'not_equals': return text !== searchValue;
    case 'is_empty': return !fieldValue;
    case 'is_not_empty': return !!fieldValue;
    default: return true;
  }
}

function evaluateNumberCondition(fieldValue: number, operator: string, value: any): boolean {
  const numValue = Number(value) || 0;

  switch (operator) {
    case 'equals': return fieldValue === numValue;
    case 'not_equals': return fieldValue !== numValue;
    case 'greater_than': return fieldValue > numValue;
    case 'less_than': return fieldValue < numValue;
    case 'greater_or_equal': return fieldValue >= numValue;
    case 'less_or_equal': return fieldValue <= numValue;
    case 'is_empty': return fieldValue === 0 || fieldValue === null;
    case 'is_not_empty': return fieldValue !== 0 && fieldValue !== null;
    default: return true;
  }
}

function evaluateDateCondition(fieldValue: string | null | undefined, operator: string, value: any, today: Date): boolean {
  if (!fieldValue && operator !== 'is_empty') return false;
  if (operator === 'is_empty') return !fieldValue;
  if (operator === 'is_not_empty') return !!fieldValue;

  const date = new Date(fieldValue!);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  switch (operator) {
    case 'this_week':
      return date >= startOfWeek && date <= today;
    
    case 'this_month':
      return date >= startOfMonth && date <= today;
    
    case 'older_than_days':
      const daysAgo = new Date(today);
      daysAgo.setDate(today.getDate() - Number(value));
      return date < daysAgo;
    
    case 'next_days':
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + Number(value));
      return date >= today && date <= futureDate;
    
    case 'before':
      return date < new Date(value);
    
    case 'after':
      return date > new Date(value);
    
    case 'equals':
      return date.toDateString() === new Date(value).toDateString();
    
    default:
      return true;
  }
}
