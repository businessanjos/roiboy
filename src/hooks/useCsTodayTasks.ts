import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOnboardingClientsData } from "@/hooks/useOnboardingHub";
import { parseProcesses, defaultProcessesText } from "@/lib/csProcesses";
import { stepTitle } from "@/lib/csProcessActions";
import { isCycle } from "@/components/csProcesses/ProcessFlow";
import { addDays, bucketTasks, contactTasks, daysBetween, eventTasks, monthlyTasks, spDate, waitReminder, type TaskState, type TodayTask } from "@/lib/csToday";

/** Tarefas do dia dos Processos Eternum. scope: id da consultora ou "all" (todas). */
export function useCsTodayTasks(scope: string | "all" | undefined) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();
  const userFilter = scope === "all" ? null : scope;
  const enabled = !!accountId && scope !== undefined;
  const today = spDate();
  const { clientsQuery } = useOnboardingClientsData();

  const { data: customText } = useQuery({
    queryKey: ["cs-process-content", accountId], enabled: !!accountId,
    queryFn: async () => ((await supabase.from("cs_process_content").select("content").eq("account_id", accountId!).maybeSingle()).data?.content as string | undefined) ?? null,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["cs-today", accountId, userFilter, today],
    enabled, staleTime: 120_000,
    queryFn: async () => {
      const ym = today.slice(0, 7);
      const [contacts, waits, settings, events, states, goals] = await Promise.all([
        supabase.rpc("cs_last_contacts", { p_user_id: userFilter as any }),
        supabase.from("cs_process_waits").select("id, client_id, process_id, step_key, action_index, label, started_at").is("resolved_at", null),
        supabase.from("cs_process_wait_settings").select("wait_key, alert_days"),
        supabase.from("events").select("id, title, modality, event_type, scheduled_at, status").gte("scheduled_at", new Date(Date.now() - 10 * 86400000).toISOString()).lte("scheduled_at", new Date(Date.now() + 70 * 86400000).toISOString()),
        supabase.from("cs_today_task_states").select("task_key, status, snooze_until"),
        supabase.from("client_clinic_goals").select("client_id, goal_amount, actual_amount, month").in("month", [ym, `${ym}-01`]),
      ]);
      const waitClientIds = [...new Set((waits.data ?? []).map((w) => w.client_id))];
      const waitClients = waitClientIds.length ? (await supabase.from("clients").select("id, full_name, responsible_user_id").in("id", waitClientIds)).data ?? [] : [];
      return { contacts: contacts.data ?? [], waits: waits.data ?? [], settings: settings.data ?? [], events: (events.data ?? []).filter((e: any) => e.status !== "cancelled"), states: (states.data ?? []) as TaskState[], goals: goals.data ?? [], waitClients };
    },
  });

  const onboardingIds = useMemo(() => (clientsQuery.data ?? []).filter((c) => !userFilter || c.responsible_user_id === userFilter), [clientsQuery.data, userFilter]);
  const { data: progress = [] } = useQuery({
    queryKey: ["cs-today-progress", onboardingIds.map((c) => c.id).join(",")],
    enabled: enabled && onboardingIds.length > 0,
    queryFn: async () => (await supabase.from("cs_process_progress").select("target_id, step_key").eq("target_type", "client").eq("process_id", "1").in("target_id", onboardingIds.map((c) => c.id))).data ?? [],
  });

  const tasks = useMemo(() => {
    if (!data) return [] as TodayTask[];
    const procs = parseProcesses(customText || defaultProcessesText);
    const onboarding = procs.length ? procs[0] : parseProcesses(defaultProcessesText)[0];
    const stepKeys = onboarding.phases.flatMap((ph, pi) => ph.steps.map((s, si) => ({ k: `${pi}-${si}`, s, n: `${pi + 1}.${si + 1}` }))).filter(({ s }) => !isCycle(s));
    const waitsByClient = new Set(data.waits.map((w) => w.client_id));
    const out: TodayTask[] = [];
    const done = new Map<string, Set<string>>();
    for (const p of progress) { if (!done.has(p.target_id)) done.set(p.target_id, new Set()); done.get(p.target_id)!.add(p.step_key); }
    for (const c of onboardingIds) {
      if (waitsByClient.has(c.id)) continue;
      const next = stepKeys.find(({ k }) => !done.get(c.id)?.has(k));
      if (!next) continue;
      out.push({ key: `ob:${c.id}:${next.k}`, kind: "onboarding", filter: "onboarding", title: `${next.n} ${stepTitle(next.s.title)}`, subject: c.full_name, processIndex: 0, due: today, stepKey: next.k, clientId: c.id });
    }
    const days = new Map(data.settings.map((s) => [s.wait_key, s.alert_days]));
    const wc = new Map(data.waitClients.map((c) => [c.id, c]));
    for (const w of data.waits) {
      const c = wc.get(w.client_id); if (!c || (userFilter && c.responsible_user_id !== userFilter)) continue;
      const alert = days.get(`${w.process_id}:${w.step_key}:${w.action_index}`) ?? 2;
      const start = spDate(new Date(w.started_at));
      const since = daysBetween(start, today);
      const first = c.full_name.trim().split(/\s+/)[0];
      out.push({ key: `w:${w.id}`, kind: "wait", filter: "onboarding", title: `Cobrar ${first}: aguardando ${w.label} há ${since} ${since === 1 ? "dia" : "dias"}`, subject: c.full_name, processIndex: Math.max(0, Number(w.process_id) - 1), due: addDays(start, alert), stepKey: w.step_key, clientId: c.id, copyText: waitReminder(first, w.label) });
    }
    out.push(...contactTasks(today, data.contacts as any));
    out.push(...eventTasks(data.events as any));
    const mine = new Map((data.contacts as any[]).map((r) => [r.client_id, r.full_name]));
    const far = data.goals.filter((g: any) => mine.has(g.client_id) && Number(g.goal_amount) > 0 && Number(g.actual_amount ?? 0) < Number(g.goal_amount) * 0.7).map((g: any) => mine.get(g.client_id) as string);
    out.push(...monthlyTasks(today, far));
    return out;
  }, [data, progress, onboardingIds, customText, today, userFilter]);

  const buckets = useMemo(() => bucketTasks(tasks, data?.states ?? [], today), [tasks, data, today]);

  const setState = async (key: string, status: "done" | "snoozed", snoozeUntil?: string) => {
    await supabase.from("cs_today_task_states").upsert({ account_id: accountId!, task_key: key, status, snooze_until: snoozeUntil ?? null, updated_by: currentUser?.id, updated_at: new Date().toISOString() });
    qc.invalidateQueries({ queryKey: ["cs-today"] });
  };

  return { buckets, loading: isLoading || clientsQuery.isLoading, setState, today };
}
