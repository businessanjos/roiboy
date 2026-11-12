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

/** Limite de mensagens por hora por atendente; o "só hoje" vence na meia-noite de Brasília. */
export function effectiveLimit(s?: { msg_hourly_limit?: number | null; msg_today_limit?: number | null; msg_today_date?: string | null } | null, today = todayBrasilia()) {
  const base = s?.msg_hourly_limit || ZAPP_LIMIT_DEFAULT;
  const eff = s?.msg_today_limit && s?.msg_today_date === today ? s.msg_today_limit : base;
  return Math.min(ZAPP_LIMIT_MAX, Math.max(ZAPP_LIMIT_MIN, eff));
}

export function useZappMessageLimit() {
  const { currentUser } = useCurrentUser() as any;
  const accountId: string | undefined = currentUser?.account_id;
  const canEdit = currentUser?.role === "admin" || currentUser?.role === "super_admin" || currentUser?.is_also_admin === true;
  const qc = useQueryClient();
  const key = ["zapp-msg-limit", accountId];

  const settings = useQuery({
    queryKey: key,
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zapp_account_settings")
        .select("msg_hourly_limit, msg_today_limit, msg_today_date")
        .eq("account_id", accountId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const usage = useQuery({
    queryKey: ["zapp-msg-usage", accountId],
    enabled: !!accountId && canEdit,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("zapp_message_usage_today");
      if (error) throw error;
      return (data || []) as { user_id: string; user_name: string; last_hour: number; today: number }[];
    },
  });

  const save = useMutation({
    mutationFn: async (patch: { msg_hourly_limit?: number; msg_today_limit?: number | null; msg_today_date?: string | null }) => {
      const { error } = await supabase.from("zapp_account_settings").upsert({
        account_id: accountId!,
        ...patch,
        updated_by: currentUser?.auth_user_id ?? null,
        updated_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Limite salvo."); },
    onError: () => toast.error("Não foi possível salvar. Só administradores podem alterar."),
  });

  const today = todayBrasilia();
  const s = settings.data;
  return {
    canEdit,
    base: s?.msg_hourly_limit || ZAPP_LIMIT_DEFAULT,
    todayLimit: s?.msg_today_limit && s?.msg_today_date === today ? s.msg_today_limit : null,
    effective: effectiveLimit(s, today),
    usage: usage.data || [],
    saving: save.isPending,
    setBase: (n: number) => save.mutate({ msg_hourly_limit: n }),
    setToday: (n: number | null) => save.mutate({ msg_today_limit: n, msg_today_date: n ? today : null }),
  };
}
