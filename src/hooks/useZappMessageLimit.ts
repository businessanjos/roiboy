import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export const ZAPP_LIMIT_DEFAULT = 80;
export const ZAPP_LIMIT_SAFE_MAX = 100;
export const ZAPP_LIMIT_MIN = 20;
export const ZAPP_LIMIT_MAX = 300;

export function todayBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Valor dentro da faixa permitida (20 a 300). */
export function clampLimit(n: number) {
  return Math.min(ZAPP_LIMIT_MAX, Math.max(ZAPP_LIMIT_MIN, Math.round(n || 0)));
}

/** Acima do teto seguro o pedido de ciência aparece só depois do clique em salvar/aplicar. */
export function needsLimitConfirmation(n: number) {
  return clampLimit(n) > ZAPP_LIMIT_SAFE_MAX;
}

/** Limite de mensagens por hora por atendente; o "só hoje" vence na meia-noite de Brasília. */
export function effectiveLimit(s?: { hourly_limit?: number | null; today_limit?: number | null; today_date?: string | null } | null, today = todayBrasilia()) {
  const base = s?.hourly_limit || ZAPP_LIMIT_DEFAULT;
  const eff = s?.today_limit && s?.today_date === today ? s.today_limit : base;
  return Math.min(ZAPP_LIMIT_MAX, Math.max(ZAPP_LIMIT_MIN, eff));
}

export type ZappLimitHistoryRow = {
  id: string; changed_by_name: string | null; changed_at: string;
  old_hourly: number | null; new_hourly: number | null;
  old_today: number | null; new_today: number | null; today_date: string | null;
};

/** Só gestor/admin do próprio setor (ou admin da conta) altera; admin de outro setor não. */
export function useZappMessageLimit(sectorId: string | null | undefined) {
  const { currentUser } = useCurrentUser() as any;
  const accountId: string | undefined = currentUser?.account_id;
  const qc = useQueryClient();
  const key = ["zapp-sector-msg-limit", accountId, sectorId];
  const enabled = !!accountId && !!sectorId;

  const role = useQuery({
    queryKey: ["zapp-sector-role", sectorId, currentUser?.auth_user_id],
    enabled: enabled && !!currentUser?.auth_user_id,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("zapp_sector_role", { _auth_user_id: currentUser.auth_user_id, _sector_id: sectorId });
      return data as string | null;
    },
  });
  const canEdit = role.data === "admin" || role.data === "manager";

  const settings = useQuery({
    queryKey: key,
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("zapp_sector_message_limits")
        .select("hourly_limit, today_limit, today_date")
        .eq("account_id", accountId!)
        .eq("sector_id", sectorId!)
        .maybeSingle();
      if (error) throw error;
      return data as { hourly_limit: number; today_limit: number | null; today_date: string | null } | null;
    },
  });

  const usage = useQuery({
    queryKey: ["zapp-sector-msg-usage", accountId, sectorId],
    enabled: enabled && canEdit,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("zapp_sector_message_usage_today", { p_sector_id: sectorId });
      if (error) throw error;
      return (data || []) as { user_id: string; user_name: string; last_hour: number; today: number }[];
    },
  });

  const history = useQuery({
    queryKey: ["zapp-sector-msg-history", accountId, sectorId],
    enabled: enabled && canEdit,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("zapp_sector_message_limit_history")
        .select("id, changed_by_name, changed_at, old_hourly, new_hourly, old_today, new_today, today_date")
        .eq("sector_id", sectorId!)
        .order("changed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as ZappLimitHistoryRow[];
    },
  });

  const today = todayBrasilia();
  const s = settings.data;
  const save = useMutation({
    mutationFn: async (patch: { hourly_limit?: number; today_limit?: number | null; today_date?: string | null }) => {
      const { error } = await (supabase as any).from("zapp_sector_message_limits").upsert({
        account_id: accountId!,
        sector_id: sectorId!,
        hourly_limit: s?.hourly_limit ?? ZAPP_LIMIT_DEFAULT,
        today_limit: s?.today_limit ?? null,
        today_date: s?.today_date ?? null,
        ...patch,
        updated_by: currentUser?.auth_user_id ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["zapp-sector-msg-history", accountId, sectorId] });
      toast.success("Limite salvo.");
    },
    onError: () => toast.error("Não foi possível salvar. Só gestor ou admin deste setor pode alterar."),
  });

  return {
    canEdit,
    base: s?.hourly_limit || ZAPP_LIMIT_DEFAULT,
    todayLimit: s?.today_limit && s?.today_date === today ? s.today_limit : null,
    effective: effectiveLimit(s, today),
    usage: usage.data || [],
    history: history.data || [],
    saving: save.isPending,
    setBase: (n: number) => save.mutate({ hourly_limit: n }),
    setToday: (n: number | null) => save.mutate({ today_limit: n, today_date: n ? today : null }),
  };
}
