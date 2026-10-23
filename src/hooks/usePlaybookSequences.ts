import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export const SEQUENCE_MAX_STEPS = 15;
export const SEQUENCE_MIN_DELAY = 1;
export const SEQUENCE_MAX_DELAY = 300;

export interface SequenceStep {
  id?: string;
  playbook_item_id: string;
  delay_seconds: number;
}

export interface PlaybookSequence {
  id: string;
  name: string;
  visibility: "personal" | "sector";
  sector_id: string | null;
  created_by: string | null;
  steps: SequenceStep[];
}

export function clampDelay(v: number) {
  if (!Number.isFinite(v)) return 5;
  return Math.min(SEQUENCE_MAX_DELAY, Math.max(SEQUENCE_MIN_DELAY, Math.round(v)));
}

const db = supabase as any;

export function usePlaybookSequences(sectorId?: string | null) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const accountId = currentUser?.account_id;
  const key = ["playbook-sequences", accountId, sectorId];

  const { data: sequences = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!accountId,
    queryFn: async (): Promise<PlaybookSequence[]> => {
      let q = db.from("playbook_sequences")
        .select("id, name, visibility, sector_id, created_by, playbook_sequence_steps(id, playbook_item_id, delay_seconds, position)")
        .order("name");
      if (sectorId) q = q.eq("sector_id", sectorId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        steps: (s.playbook_sequence_steps || [])
          .sort((a: any, b: any) => a.position - b.position)
          .map((st: any) => ({ id: st.id, playbook_item_id: st.playbook_item_id, delay_seconds: st.delay_seconds })),
      }));
    },
  });

  const save = useMutation({
    mutationFn: async (input: { id?: string; name: string; visibility: "personal" | "sector"; steps: SequenceStep[] }) => {
      if (!accountId || !currentUser?.id) throw new Error("Usuário não carregado");
      const steps = input.steps.filter((s) => s.playbook_item_id).slice(0, SEQUENCE_MAX_STEPS);
      if (!input.name.trim()) throw new Error("Dê um nome para a sequência");
      if (steps.length === 0) throw new Error("Adicione ao menos uma mensagem");
      let id = input.id;
      if (id) {
        const { error } = await db.from("playbook_sequences")
          .update({ name: input.name.trim(), visibility: input.visibility, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
        const { error: delErr } = await db.from("playbook_sequence_steps").delete().eq("sequence_id", id);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await db.from("playbook_sequences").insert({
          account_id: accountId, sector_id: sectorId || null, name: input.name.trim(),
          visibility: input.visibility, created_by: currentUser.id,
        }).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      const { error: stepErr } = await db.from("playbook_sequence_steps").insert(
        normalizeSequenceSteps(steps).map((s, i) => ({ sequence_id: id, account_id: accountId, playbook_item_id: s.playbook_item_id, position: i, delay_seconds: s.delay_seconds })),
      );
      if (stepErr) throw stepErr;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Sequência salva"); },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar sequência"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("playbook_sequences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Sequência excluída"); },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir"),
  });

  return { sequences, isLoading, save: save.mutateAsync, isSaving: save.isPending, remove: remove.mutate };
}

/** Espera ANTES de cada passo: o primeiro é sempre instantâneo. */
export function effectiveDelay(delays: number[], i: number): number {
  return i === 0 ? 0 : clampDelay(delays[i]);
}

/** Horário estimado de cada passo: o primeiro sai já; cada seguinte espera o próprio intervalo. */
export function computeSequenceSchedule(delays: number[], startMs: number): number[] {
  const out: number[] = [];
  let t = startMs;
  delays.forEach((_, i) => {
    t += effectiveDelay(delays, i) * 1000;
    out.push(t);
  });
  return out;
}

/** Garante que, após reordenar/remover, o novo primeiro passo fique instantâneo e os demais tenham espera válida. */
export function normalizeSequenceSteps<T extends { delay_seconds: number }>(steps: T[]): T[] {
  return steps.map((s, i) => ({ ...s, delay_seconds: i === 0 ? 0 : clampDelay(s.delay_seconds || 5) }));
}

/**
 * Linhas dos passos de uma execução. `delay_seconds` é a espera ANTES do passo,
 * contada pelo envio confirmado do anterior — precisa ir gravado, senão o envio sai sem pausa.
 */
export function buildRunStepRows(
  steps: StartRunInput["steps"], runId: string, accountId: string, startMs: number,
) {
  const delays = steps.map((s) => s.delay_seconds);
  const times = computeSequenceSchedule(delays, startMs);
  return steps.map((s, i) => ({
    run_id: runId, account_id: accountId, position: i, name: s.name, content_type: s.content_type,
    text_content: s.text_content, media_url: s.media_url, media_filename: s.media_filename, media_caption: s.media_caption,
    delay_seconds: effectiveDelay(delays, i),
    scheduled_at: new Date(times[i]).toISOString(),
  }));
}

export interface StartRunInput {
  conversationId: string;
  sequence: { id: string | null; name: string };
  steps: Array<{
    name: string; content_type: string; text_content: string | null;
    media_url: string | null; media_filename: string | null; media_caption: string | null; delay_seconds: number;
  }>;
}

export async function startSequenceRun(input: StartRunInput, user: { id: string; name: string; account_id: string }) {
  const steps = input.steps.slice(0, SEQUENCE_MAX_STEPS);
  const { data: run, error } = await db.from("zapp_sequence_runs").insert({
    account_id: user.account_id, conversation_id: input.conversationId, sequence_id: input.sequence.id,
    sequence_name: input.sequence.name, triggered_by: user.id, triggered_by_name: user.name, total_steps: steps.length,
  }).select("id").single();
  if (error) {
    if (String(error.code) === "23505") throw new Error("Já existe uma sequência em andamento nesta conversa.");
    throw error;
  }
  const { error: stepErr } = await db.from("zapp_sequence_run_steps").insert(
    buildRunStepRows(steps, run.id, user.account_id, Date.now()),
  );
  if (stepErr) {
    await db.from("zapp_sequence_runs").update({ status: "cancelled", cancel_reason: "erro ao agendar" }).eq("id", run.id);
    throw stepErr;
  }
  const { error: fnErr } = await supabase.functions.invoke("zapp-sequence-dispatcher", { body: { run_id: run.id } });
  if (fnErr) console.warn("[sequence] dispatcher invoke", fnErr);
  return run.id as string;
}
