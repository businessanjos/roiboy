import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface RulerTemplateStep {
  id?: string;
  offset_days: number;
  title: string;
  message: string;
  sort_order: number;
}

export interface RulerTemplate {
  id: string;
  account_id: string;
  sector_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  default_auto_send: boolean;
  send_window_start: number;
  send_window_end: number;
  stop_on_reply: boolean;
  steps: RulerTemplateStep[];
}

export interface RulerTouch {
  id: string;
  enrollment_id: string;
  offset_days: number;
  sort_order: number;
  title: string;
  message: string;
  scheduled_at: string;
  auto_send: boolean;
  status: string;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
}

export interface RulerEnrollment {
  id: string;
  account_id: string;
  sector_id: string | null;
  template_id: string | null;
  template_name: string | null;
  conversation_id: string | null;
  contact_name: string | null;
  contact_phone: string;
  assigned_to: string | null;
  start_date: string;
  due_time: string;
  auto_send: boolean;
  send_window_start: number;
  send_window_end: number;
  stop_on_reply: boolean;
  status: string;
  cancel_reason: string | null;
  created_at: string;
  touches: RulerTouch[];
}

/** Presets prontos, no mesmo espírito da régua da Clínica Ryka. */
export const RULER_PRESETS: Array<{ id: string; label: string; steps: RulerTemplateStep[] }> = [
  {
    id: "curta",
    label: "Curta — 3 toques (D+1, D+3, D+7)",
    steps: [
      { offset_days: 1, title: "Toque 1 — Retomar contato", message: "Oi {primeiro_nome}! Passando para retomar nossa conversa. Ficou alguma dúvida que eu possa esclarecer?", sort_order: 0 },
      { offset_days: 3, title: "Toque 2 — Trazer valor", message: "Oi {primeiro_nome}! Separei um material que pode te ajudar a decidir. Posso te enviar?", sort_order: 1 },
      { offset_days: 7, title: "Toque 3 — Chamada de decisão", message: "Oi {primeiro_nome}! Vamos definir o próximo passo? Consigo te encaixar ainda esta semana.", sort_order: 2 },
    ],
  },
  {
    id: "padrao",
    label: "Padrão — 5 toques (D+1, D+3, D+7, D+14, D+21)",
    steps: [
      { offset_days: 1, title: "Toque 1 — Retomar contato", message: "Oi {primeiro_nome}! Retomando nossa conversa: como posso te ajudar no próximo passo?", sort_order: 0 },
      { offset_days: 3, title: "Toque 2 — Reforçar benefícios", message: "Oi {primeiro_nome}! Queria reforçar o que faz mais diferença no seu caso. Posso te explicar rapidinho?", sort_order: 1 },
      { offset_days: 7, title: "Toque 3 — Quebrar objeção", message: "Oi {primeiro_nome}! Se o que travou foi prazo ou investimento, tenho alternativas. Quer ver?", sort_order: 2 },
      { offset_days: 14, title: "Toque 4 — Prova social", message: "Oi {primeiro_nome}! Tenho resultados de quem estava no mesmo ponto que você. Posso compartilhar?", sort_order: 3 },
      { offset_days: 21, title: "Toque 5 — Última chamada", message: "Oi {primeiro_nome}! Vou deixar sua proposta em aberto por mais alguns dias. Quer aproveitar?", sort_order: 4 },
    ],
  },
  {
    id: "relacionamento",
    label: "Relacionamento CS — 4 toques (D+7, D+30, D+60, D+90)",
    steps: [
      { offset_days: 7, title: "Toque 1 — Como está sendo?", message: "Oi {primeiro_nome}! Como está sendo sua experiência até aqui? Quero saber se posso ajudar em algo.", sort_order: 0 },
      { offset_days: 30, title: "Toque 2 — Check-in do mês", message: "Oi {primeiro_nome}! Fechando o mês: quais foram os principais avanços? Posso te apoiar em algo?", sort_order: 1 },
      { offset_days: 60, title: "Toque 3 — Ajuste de rota", message: "Oi {primeiro_nome}! Vamos revisar as metas e ajustar a rota juntos?", sort_order: 2 },
      { offset_days: 90, title: "Toque 4 — Resultado do trimestre", message: "Oi {primeiro_nome}! Fechamos um trimestre. Quer marcar uma conversa para revisar os resultados?", sort_order: 3 },
    ],
  },
  {
    id: "longa",
    label: "Longa — 7 toques (D+1 a D+45)",
    steps: [
      { offset_days: 1, title: "Toque 1", message: "Oi {primeiro_nome}! Retomando nossa conversa, tudo bem por aí?", sort_order: 0 },
      { offset_days: 3, title: "Toque 2", message: "Oi {primeiro_nome}! Consegui pensar em uma alternativa que pode fazer sentido para você. Posso te contar?", sort_order: 1 },
      { offset_days: 7, title: "Toque 3", message: "Oi {primeiro_nome}! Alguma dúvida que ficou pendente para decidir?", sort_order: 2 },
      { offset_days: 14, title: "Toque 4", message: "Oi {primeiro_nome}! Tenho um caso parecido com o seu para te mostrar. Quer ver?", sort_order: 3 },
      { offset_days: 21, title: "Toque 5", message: "Oi {primeiro_nome}! Ainda faz sentido retomarmos essa conversa?", sort_order: 4 },
      { offset_days: 30, title: "Toque 6", message: "Oi {primeiro_nome}! Temos novidades por aqui que combinam com o que você buscava.", sort_order: 5 },
      { offset_days: 45, title: "Toque 7 — Encerramento", message: "Oi {primeiro_nome}! Vou encerrar seu acompanhamento por aqui, mas é só me chamar quando quiser retomar.", sort_order: 6 },
    ],
  },
];

export function useZappRulers(sectorId?: string | null) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const [templates, setTemplates] = useState<RulerTemplate[]>([]);
  const [enrollments, setEnrollments] = useState<RulerEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
    if (!accountId) return;
    if (!opts?.silent) setLoading(true);
    try {
      const tplQuery = supabase
        .from("zapp_ruler_templates")
        .select("*, steps:zapp_ruler_template_steps(*)")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      const enrQuery = supabase
        .from("zapp_ruler_enrollments")
        .select("*, touches:zapp_ruler_touches(*)")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(300);

      const [tplRes, enrRes] = await Promise.all([
        sectorId ? tplQuery.or(`sector_id.eq.${sectorId},sector_id.is.null`) : tplQuery,
        sectorId ? enrQuery.eq("sector_id", sectorId) : enrQuery,
      ]);

      if (tplRes.error) throw tplRes.error;
      if (enrRes.error) throw enrRes.error;

      setTemplates(
        ((tplRes.data || []) as any[]).map((t) => ({
          ...t,
          steps: (t.steps || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
        })) as RulerTemplate[],
      );
      setEnrollments(
        ((enrRes.data || []) as any[]).map((e) => ({
          ...e,
          touches: (e.touches || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
        })) as RulerEnrollment[],
      );
    } catch (err) {
      console.error("[ZappRulers] fetch failed", err);
      toast.error("Erro ao carregar as réguas de relacionamento");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [accountId, sectorId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const saveTemplate = useCallback(
    async (input: {
      id?: string;
      name: string;
      description?: string | null;
      default_auto_send: boolean;
      send_window_start: number;
      send_window_end: number;
      stop_on_reply: boolean;
      steps: RulerTemplateStep[];
    }) => {
      if (!accountId) return null;

      try {
        const base = {
          name: input.name.trim(),
          description: input.description?.trim() || null,
          default_auto_send: input.default_auto_send,
          send_window_start: input.send_window_start,
          send_window_end: input.send_window_end,
          stop_on_reply: input.stop_on_reply,
          updated_at: new Date().toISOString(),
        };

        let templateId = input.id;
        if (templateId) {
          // Edição: nunca reatribuir account_id/sector_id/created_by — isso movia
          // o modelo de setor e o fazia sumir da lista após salvar.
          const { data, error } = await supabase
            .from("zapp_ruler_templates")
            .update(base)
            .eq("id", templateId)
            .select("id");
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error("Você não tem permissão para editar esta régua neste setor.");
          }
          const { error: delError } = await supabase
            .from("zapp_ruler_template_steps")
            .delete()
            .eq("template_id", templateId);
          if (delError) throw delError;
        } else {
          const { data, error } = await supabase
            .from("zapp_ruler_templates")
            .insert({
              ...base,
              account_id: accountId,
              sector_id: sectorId || null,
              created_by: currentUser?.id || null,
            })
            .select("id")
            .single();
          if (error) throw error;
          templateId = data.id;
        }

        const steps = input.steps.map((s, idx) => ({
          template_id: templateId!,
          offset_days: Number.isFinite(s.offset_days) ? s.offset_days : 0,
          title: s.title.trim() || `Toque ${idx + 1}`,
          message: s.message,
          sort_order: idx,
        }));
        if (steps.length) {
          const { error } = await supabase.from("zapp_ruler_template_steps").insert(steps);
          if (error) throw error;
        }

        // Atualização otimista: reflete a alteração instantaneamente na lista
        // e no detalhe antes do fetchAll finalizar (sem overlay de loading).
        setTemplates((prev) => {
          const existing = prev.find((t) => t.id === templateId);
          const optimistic: RulerTemplate = {
            ...(existing || {
              account_id: accountId,
              sector_id: sectorId || null,
              created_at: new Date().toISOString(),
              is_active: true,
            }),
            id: templateId!,
            name: base.name,
            description: base.description,
            default_auto_send: base.default_auto_send,
            send_window_start: base.send_window_start,
            send_window_end: base.send_window_end,
            stop_on_reply: base.stop_on_reply,
            steps: input.steps.map((s, idx) => ({
              ...s,
              template_id: templateId!,
              sort_order: idx,
            })),
          };
          const next = prev.filter((t) => t.id !== templateId);
          return [optimistic, ...next];
        });

        await fetchAll({ silent: true });

        const action = input.id ? "atualizada" : "criada";
        toast.success(`Régua "${input.name.trim()}" ${action} com ${steps.length} toque${steps.length === 1 ? "" : "s"}.`);

        return templateId;
      } catch (err: any) {
        console.error("[ZappRulers] save template failed", err);
        toast.error(err?.message || "Erro ao salvar a régua de relacionamento");
        throw err;
      }
    },
    [accountId, sectorId, currentUser?.id, fetchAll],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      try {
        const { data, error } = await supabase
          .from("zapp_ruler_templates")
          .delete()
          .eq("id", id)
          .select("id");
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Você não tem permissão para excluir esta régua neste setor.");
        }
        await fetchAll();
        toast.success("Régua excluída");
      } catch (err: any) {
        console.error("[ZappRulers] delete template failed", err);
        toast.error(err?.message || "Erro ao excluir a régua");
        throw err;
      }
    },
    [fetchAll],
  );

  const cancelEnrollment = useCallback(
    async (id: string, reason = "cancelada manualmente") => {
      await supabase
        .from("zapp_ruler_touches")
        .update({ status: "cancelled", last_error: reason })
        .eq("enrollment_id", id)
        .eq("status", "pending");
      const { error } = await supabase
        .from("zapp_ruler_enrollments")
        .update({ status: "cancelled", cancel_reason: reason })
        .eq("id", id);
      if (error) throw error;
      await fetchAll();
    },
    [fetchAll],
  );

  const markTouchDone = useCallback(
    async (touchId: string) => {
      const { error } = await supabase
        .from("zapp_ruler_touches")
        .update({ status: "sent", sent_at: new Date().toISOString(), sent_by: currentUser?.id || null })
        .eq("id", touchId);
      if (error) throw error;
      await fetchAll();
    },
    [currentUser?.id, fetchAll],
  );

  const skipTouch = useCallback(
    async (touchId: string) => {
      const { error } = await supabase
        .from("zapp_ruler_touches")
        .update({ status: "cancelled", last_error: "pulado manualmente" })
        .eq("id", touchId);
      if (error) throw error;
      await fetchAll();
    },
    [fetchAll],
  );

  const activeEnrollments = useMemo(
    () => enrollments.filter((e) => e.status === "active"),
    [enrollments],
  );

  /** Toques manuais que já venceram e ainda esperam ação do atendente. */
  const pendingManualTouches = useMemo(() => {
    const now = Date.now();
    const rows: Array<{ touch: RulerTouch; enrollment: RulerEnrollment }> = [];
    for (const e of enrollments) {
      if (e.status !== "active") continue;
      for (const t of e.touches) {
        if (t.status !== "pending" || t.auto_send) continue;
        if (new Date(t.scheduled_at).getTime() <= now) rows.push({ touch: t, enrollment: e });
      }
    }
    return rows.sort(
      (a, b) => new Date(a.touch.scheduled_at).getTime() - new Date(b.touch.scheduled_at).getTime(),
    );
  }, [enrollments]);

  return {
    loading,
    templates,
    enrollments,
    activeEnrollments,
    pendingManualTouches,
    fetchAll,
    saveTemplate,
    deleteTemplate,
    cancelEnrollment,
    markTouchDone,
    skipTouch,
  };
}
