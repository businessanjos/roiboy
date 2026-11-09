import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOnboardingClientsData } from "@/hooks/useOnboardingHub";
import { eventStep, showInCsConsultantFilter, stepOfStage, type BoardCard } from "@/lib/csInProgress";
import { spDate } from "@/lib/csToday";

/** Cartões do quadro "Em andamento" (somente leitura, campos existentes). */
export function useCsInProgress() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const today = spDate();
  const { stagesQuery, clientsQuery } = useOnboardingClientsData(!!accountId);

  const clientIds = (clientsQuery.data ?? []).map((c) => c.id);
  const { data: extra } = useQuery({
    queryKey: ["cs-in-progress", accountId, clientIds.length],
    enabled: !!accountId, staleTime: 120_000,
    queryFn: async () => {
      const [waits, events, users] = await Promise.all([
        supabase.from("cs_process_waits").select("client_id").is("resolved_at", null),
        supabase.from("events").select("id, title, modality, event_type, scheduled_at, status")
          .gte("scheduled_at", new Date(Date.now() - 8 * 86400000).toISOString())
          .lte("scheduled_at", new Date(Date.now() + 61 * 86400000).toISOString()),
        supabase.from("users").select("id, name, avatar_url, user_team_roles(team_roles(name))").eq("account_id", accountId!).eq("is_active", true),
      ]);
      return {
        waiting: new Set((waits.data ?? []).map((w) => w.client_id as string)),
        events: (events.data ?? []).filter((e: any) => e.status !== "cancelled"),
        users: ((users.data ?? []) as any[]).map((u) => ({ ...u, isCs: (u.user_team_roles ?? []).some((r: any) => /^(Consultor|CX|Supervisor CX)$/i.test(r.team_roles?.name ?? "")) })) as { id: string; name: string; avatar_url: string | null; isCs: boolean }[],
      };
    },
  });

  const boards = useMemo(() => {
    const stages = new Map((stagesQuery.data ?? []).map((s) => [s.id, s.name]));
    const onboarding: BoardCard[] = (clientsQuery.data ?? []).map((c: any) => {
      const stageName = c.stage_id ? stages.get(c.stage_id) : null;
      return {
        id: c.id, kind: "client", name: c.full_name, avatar: c.avatar_url || c.logo_url,
        stepKey: stepOfStage(stageName), stageLabel: stageName ?? "Aguardando início",
        since: (c.stage_changed_at || c.onboarding_started_at || c.created_at) ? spDate(new Date(c.stage_changed_at || c.onboarding_started_at || c.created_at)) : null,
        ownerId: c.responsible_user_id, waiting: extra?.waiting.has(c.id),
      };
    });
    const online: BoardCard[] = [], presencial: BoardCard[] = [];
    for (const e of (extra?.events ?? []) as any[]) {
      const st = eventStep(e, today); if (!st) continue;
      const day = spDate(new Date(e.scheduled_at));
      const card: BoardCard = { id: e.id, kind: "event", name: e.title, stepKey: st.stepKey, since: st.since, eventDay: day,
        dateLabel: new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) };
      (st.processIndex === 1 ? online : presencial).push(card);
    }
    return [onboarding, online, presencial];
  }, [stagesQuery.data, clientsQuery.data, extra, today]);

  return { boards, users: extra?.users ?? [], loading: clientsQuery.isLoading || !extra, today };
}
