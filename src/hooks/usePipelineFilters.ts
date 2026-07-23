import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Deal } from "@/hooks/useDeals";
import { toast } from "sonner";

export interface FilterCondition {
  field: string;
  operator: string;
  value: any;
  include_empty?: boolean;
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
  {
    id: 'never_contacted',
    name: '🔴 Nunca contatado (sem nenhum registro)',
    description: 'Leads sem NENHUMA atividade humana registrada (totalActivities === 0): zero atividades em internal_tasks e zero registros em deal_activities (notas, ligações, WhatsApp, e-mails, reuniões, arquivos). Logs de sistema não contam. Mede falha de prospecção — o SDR nunca entrou na régua com esse lead.',
    conditions: [{ field: 'total_tasks', operator: 'equals', value: 0 }],
    match_type: 'all' as const
  },
  {
    id: 'no_next_activity',
    name: '🟡 Sem próximo passo agendado',
    description: 'Leads que têm histórico de contato, mas nenhuma atividade em aberto no futuro (pendingCount === 0). Espelha o "0 pendentes" exibido no card. Mede falha de cadência — o vendedor tocou o lead, mas não agendou o próximo passo.',
    conditions: [{ field: 'next_activity_date', operator: 'is_empty', value: null }],
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

// ---------------------------------------------------------------------------
// Debug / inspection helpers
// ---------------------------------------------------------------------------

export interface DealFilterExplanation {
  filterId: string;
  filterName: string;
  matches: boolean;
  reason: string;
}

export interface DealDebugContext {
  totalActivities: number;
  pendingCount: number;
  hasOverdue: boolean;
  nextDueDate: string | null;
}

/**
 * Explains, for each recommended activity-based filter, whether a given deal
 * matches and why — powered by the same data the filters themselves read.
 * Used by the pipeline "Inspecionar" mode so we can debug filter mismatches
 * without opening the DB.
 */
export function explainDealActivityFilters(ctx: DealDebugContext): DealFilterExplanation[] {
  const { totalActivities, pendingCount, hasOverdue, nextDueDate } = ctx;

  const neverContactedMatches = totalActivities === 0;
  const noNextStepMatches = pendingCount === 0;

  return [
    {
      filterId: 'never_contacted',
      filterName: '🔴 Nunca contatado (sem nenhum registro)',
      matches: neverContactedMatches,
      reason: neverContactedMatches
        ? `APARECE — totalActivities = 0 (nenhuma atividade em internal_tasks e nenhum registro humano em deal_activities).`
        : `NÃO aparece — totalActivities = ${totalActivities} (há atividades ou registros manuais como nota/ligação/WhatsApp/e-mail/reunião/arquivo). Precisa ser 0 para o lead aparecer neste filtro.`,
    },
    {
      filterId: 'no_next_activity',
      filterName: '🟡 Sem próximo passo agendado',
      matches: noNextStepMatches,
      reason: noNextStepMatches
        ? `APARECE — pendingCount = 0${
            totalActivities > 0 ? ` (o lead tem ${totalActivities} atividade(s) histórica(s), mas nenhuma atividade em aberto).` : ' (nenhuma atividade em aberto).'
          }`
        : `NÃO aparece — pendingCount = ${pendingCount} (há atividade(s) em aberto${
            nextDueDate ? `, próxima em ${nextDueDate}` : ''
          }${hasOverdue ? ', com pelo menos uma vencida' : ''}). Precisa ser 0 para o lead aparecer neste filtro.`,
    },
  ];
}

// Utility function to apply filters to deals
export type DealSearchMode = 'contains' | 'exact';

// Normaliza para busca: minúsculo + remove diacríticos (São Paulo -> "sao paulo").
// Exportado para permitir que o consumidor construa blobs com a mesma normalização.
export function normalizeForSearch(input: unknown): string {
  if (input === null || input === undefined) return '';
  const s = typeof input === 'string' ? input : String(input);
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function applyFilterToDeals(
  deals: Deal[],
  activeFilter: ActiveFilter | null,
  searchTerm?: string,
  dealProductMap?: Record<string, string>,
  dealCustomFieldValues?: Record<string, Record<string, string>>,
  dealNextActivityMap?: Record<string, string | null>,
  searchOptions?: { mode?: DealSearchMode; blobs?: Record<string, string> },
  dealTaskCountMap?: Record<string, number>,
  dealPendingCountMap?: Record<string, number>
): Deal[] {
  if (!activeFilter && !searchTerm?.trim()) return deals;

  let filtered = [...deals];

  if (searchTerm?.trim()) {
    const term = normalizeForSearch(searchTerm.trim());
    const mode: DealSearchMode = searchOptions?.mode ?? 'contains';
    const blobs = searchOptions?.blobs;
    const buildFallbackBlob = (deal: Deal) => {
      const normalized = normalizeForSearch([
        deal.title,
        deal.notes,
        deal.source,
        deal.contact_name,
        deal.contact_phone,
        deal.contact_email,
        deal.client?.full_name,
        deal.client?.phone_e164,
        deal.lead?.full_name,
        deal.lead?.phone,
        deal.lead?.email,
        deal.responsible_user?.name,
        deal.sdr_user?.name,
        deal.stage?.name,
        (deal.tags || []).join(' '),
        dealProductMap?.[deal.id] || '',
      ].filter(Boolean).join(' | '));
      const digits = normalized.replace(/\D/g, '');
      return digits ? `${normalized} | ${digits}` : normalized;
    };

    // Variante só-dígitos do termo: quando o usuário digita telefone com máscara
    // ("(11) 98765-4321"), casamos contra o apêndice de dígitos do blob.
    const termDigits = term.replace(/\D/g, '');
    const useDigits = termDigits.length >= 4 && /\d/.test(term);

    // Exact mode: casamento por fronteira de palavra/frase (aceita "sao paulo").
    // O blob já vem normalizado (sem diacríticos), então basta \w-boundary ASCII.
    let exactRe: RegExp | null = null;
    let exactDigitsRe: RegExp | null = null;
    if (mode === 'exact') {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      exactRe = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`);
      if (useDigits) {
        const escapedDigits = termDigits.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        exactDigitsRe = new RegExp(`(^|[^a-z0-9])${escapedDigits}($|[^a-z0-9])`);
      }
    }

    filtered = filtered.filter(deal => {
      const blob = blobs?.[deal.id] ?? buildFallbackBlob(deal);
      if (mode === 'exact' && exactRe) {
        if (exactRe.test(blob)) return true;
        return !!exactDigitsRe && exactDigitsRe.test(blob);
      }
      if (blob.includes(term)) return true;
      return useDigits && blob.includes(termDigits);
    });
  }

  if (!activeFilter) return filtered;

  if (activeFilter.type === 'salesperson') {
    return filtered.filter(deal => deal.responsible_user_id === activeFilter.id);
  }

  if (activeFilter.type === 'product') {
    if (!dealProductMap) return filtered;
    return filtered.filter(deal => dealProductMap[deal.id] === activeFilter.id);
  }

  const conditions = activeFilter.conditions || [];
  const matchType = activeFilter.match_type || 'all';

  if (conditions.length === 0) return filtered;

  return filtered.filter(deal => {
    const results = conditions.map(condition => evaluateCondition(deal, condition, dealCustomFieldValues, dealNextActivityMap, dealTaskCountMap, dealPendingCountMap));
    if (matchType === 'all') return results.every(Boolean);
    return results.some(Boolean);
  });
}


function toArray(value: any): any[] {
  if (Array.isArray(value)) return value.filter((v) => v !== null && v !== undefined && v !== "");
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function evaluateCondition(deal: Deal, condition: FilterCondition, dealCustomFieldValues?: Record<string, Record<string, string>>, dealNextActivityMap?: Record<string, string | null>, dealTaskCountMap?: Record<string, number>, dealPendingCountMap?: Record<string, number>): boolean {
  const { field, operator, value, include_empty } = condition;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Custom field lookup: field key is `custom:<field_id>`
  if (field.startsWith('custom:')) {
    const fieldId = field.slice('custom:'.length);
    const raw = dealCustomFieldValues?.[deal.id]?.[fieldId] ?? '';
    if (operator === 'is_empty') return !raw;
    if (operator === 'is_not_empty') return !!raw;
    // "Include empty" escape hatch — empty values pass the filter
    if (include_empty && !raw) return true;
    const values = toArray(value);
    // multi_select values are stored as `|val1|val2|`
    const isMulti = typeof raw === 'string' && raw.startsWith('|') && raw.endsWith('|');
    if (isMulti) {
      if (values.length === 0) return false;
      const hits = values.map((v) => raw.includes(`|${String(v)}|`));
      if (operator === 'contains' || operator === 'equals') return hits.some(Boolean);
      if (operator === 'not_contains' || operator === 'not_equals') return hits.every((h) => !h);
      return false;
    }
    if (['this_week', 'this_month', 'older_than_days', 'next_days', 'before', 'after'].includes(operator)) {
      return evaluateDateCondition(raw, operator, values[0] ?? value, today);
    }
    if (['greater_than', 'less_than', 'greater_or_equal', 'less_or_equal'].includes(operator)) {
      const n = Number(raw);
      if (Number.isNaN(n)) return false;
      return evaluateNumberCondition(n, operator, values[0] ?? value);
    }
    // text / select: OR across values
    if (values.length === 0) return evaluateTextCondition(raw, operator, value);
    const matches = values.map((v) => evaluateTextCondition(raw, operator, v));
    if (operator === 'not_contains' || operator === 'not_equals') return matches.every(Boolean);
    return matches.some(Boolean);
  }


  switch (field) {
    case 'title':
      return evaluateTextCondition(deal.title, operator, value);

    case 'value':
      return evaluateNumberCondition(deal.value || 0, operator, value);

    case 'responsible_user_id': {
      if (operator === 'is_empty') return !deal.responsible_user_id;
      if (operator === 'is_not_empty') return !!deal.responsible_user_id;
      const values = toArray(value);
      if (values.length === 0) return deal.responsible_user_id === value;
      const matches = values.includes(deal.responsible_user_id);
      return operator === 'not_equals' ? !matches : matches;
    }

    case 'stage_id': {
      const values = toArray(value);
      if (values.length === 0) return deal.stage_id === value;
      const matches = values.includes(deal.stage_id);
      return operator === 'not_equals' ? !matches : matches;
    }

    case 'tags': {
      if (operator === 'is_empty') return !deal.tags || deal.tags.length === 0;
      if (operator === 'is_not_empty') return !!(deal.tags && deal.tags.length > 0);
      const values = toArray(value);
      const dealTags = deal.tags || [];
      if (values.length === 0) {
        if (operator === 'contains') return dealTags.includes(value);
        if (operator === 'not_contains') return !dealTags.includes(value);
        return false;
      }
      const anyHit = values.some((v) => dealTags.includes(v));
      if (operator === 'contains') return anyHit;
      if (operator === 'not_contains') return !anyHit;
      return false;
    }

    case 'source': {
      if (operator === 'is_empty') return !deal.source;
      if (operator === 'is_not_empty') return !!deal.source;
      const values = toArray(value);
      if (values.length === 0) return deal.source === value;
      const matches = values.includes(deal.source);
      return operator === 'not_equals' ? !matches : matches;
    }

    case 'created_at':
      return evaluateDateCondition(deal.created_at, operator, value, today);

    case 'updated_at':
      return evaluateDateCondition(deal.updated_at, operator, value, today);

    case 'expected_close_date':
      if (!deal.expected_close_date) {
        return operator === 'is_empty';
      }
      return evaluateDateCondition(deal.expected_close_date, operator, value, today);

    case 'next_activity_date': {
      const nextDue = dealNextActivityMap?.[deal.id] ?? null;
      const pendingCount = dealPendingCountMap?.[deal.id] ?? 0;
      // is_empty / is_not_empty = deal SEM atividade em aberto (pendente).
      // Espelha o "X pendentes" mostrado no card: 0 pendentes ⇒ aparece no filtro.
      // Atividades já concluídas (Follow Up marcado, ligações registradas, etc.)
      // NÃO impedem o card de entrar, pois não há próximo passo agendado.
      if (operator === 'is_empty') return pendingCount === 0;
      if (operator === 'is_not_empty') return pendingCount > 0;
      if (!nextDue) return false;
      return evaluateDateCondition(nextDue, operator, value, today);
    }

    case 'total_tasks': {
      const count = dealTaskCountMap?.[deal.id] ?? 0;
      return evaluateNumberCondition(count, operator, value);
    }



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
  // Semana começa na segunda-feira (igual à toolbar: weekStartsOn: 1)
  const startOfWeek = new Date(today);
  const dow = today.getDay();
  const diffToMonday = (dow + 6) % 7;
  startOfWeek.setDate(today.getDate() - diffToMonday);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

  switch (operator) {
    case 'today': {
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);
      return date >= today && date <= endOfToday;
    }
    case 'this_week':
      return date >= startOfWeek && date <= endOfWeek;
    
    case 'this_month':
      return date >= startOfMonth && date <= endOfMonth;
    
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
