import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import {
  PDA_DEFAULTS_BY_FIELD, type PdaFieldKey, type PdaOption,
} from "@/lib/rh/pda";

export interface PdaOptionRow {
  id: string;
  field_key: string;
  value: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

/**
 * Opções do PDA por conta. Enquanto um campo não tiver opções salvas,
 * usamos a lista padrão do sistema.
 */
export function useHRPdaOptions() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [rows, setRows] = useState<PdaOptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOptions = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("hr_pda_options")
      .select("id, field_key, value, label, color, sort_order, is_active")
      .eq("account_id", accountId)
      .order("sort_order");
    if (error) console.error(error);
    setRows((data || []) as PdaOptionRow[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { fetchOptions(); }, [fetchOptions]);

  const byField = useMemo(() => {
    const map: Record<string, PdaOptionRow[]> = {};
    rows.forEach((r) => {
      (map[r.field_key] ||= []).push(r);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => a.sort_order - b.sort_order));
    return map;
  }, [rows]);

  /** Opções ativas de um campo (com fallback para o padrão do sistema). */
  const optionsFor = useCallback(
    (key: PdaFieldKey): PdaOption[] => {
      const custom = byField[key];
      if (!custom || custom.length === 0) return PDA_DEFAULTS_BY_FIELD[key] || [];
      return custom
        .filter((r) => r.is_active)
        .map((r) => ({ value: r.value, label: r.label, color: r.color }));
    },
    [byField],
  );

  /** Lista completa (inclusive inativas) para a tela de gerenciamento. */
  const editableFor = useCallback(
    (key: PdaFieldKey): PdaOption[] & { __fromDefaults?: boolean } => {
      const custom = byField[key];
      if (!custom || custom.length === 0) return (PDA_DEFAULTS_BY_FIELD[key] || []).map((o) => ({ ...o }));
      return custom.map((r) => ({ value: r.value, label: r.label, color: r.color }));
    },
    [byField],
  );

  /** Substitui a lista de opções de um campo. */
  const saveField = useCallback(
    async (key: PdaFieldKey, options: PdaOption[]) => {
      if (!accountId) return false;
      const { error: delError } = await supabase
        .from("hr_pda_options")
        .delete()
        .eq("account_id", accountId)
        .eq("field_key", key);
      if (delError) {
        toast.error("Não foi possível salvar as opções");
        return false;
      }
      if (options.length > 0) {
        const { error } = await supabase.from("hr_pda_options").insert(
          options.map((o, i) => ({
            account_id: accountId,
            field_key: key,
            value: o.value,
            label: o.label,
            color: o.color,
            sort_order: i,
            is_active: true,
          })),
        );
        if (error) {
          toast.error("Não foi possível salvar as opções");
          return false;
        }
      }
      await fetchOptions();
      return true;
    },
    [accountId, fetchOptions],
  );

  return { loading, optionsFor, editableFor, saveField, refetch: fetchOptions };
}
