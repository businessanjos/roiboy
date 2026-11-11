import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";
import { buildKnowledgeBlockForAccount } from "../_shared/aiKnowledge.ts";
import { runSalesCallAnalysis, SalesCallAnalysisError } from "../_shared/salesCallAnalysis.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Poucas calls por vez: a fila esvazia em várias rodadas, sem estourar o limite da IA. */
const BATCH_PER_ACCOUNT = 3;
const MAX_ACCOUNTS_PER_RUN = 3;
const LEASE_MINUTES = 9;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function setState(admin: any, accountId: string, patch: Record<string, unknown>) {
  await admin
    .from("meet_analysis_state")
    .upsert({ account_id: accountId, updated_at: new Date().toISOString(), ...patch }, {
      onConflict: "account_id",
    });
}

/** Trava de execução: só uma rodada por vez, com prazo para não travar para sempre. */
async function acquireLease(admin: any, accountId: string, paused: boolean): Promise<boolean> {
  const now = new Date();
  const { data: state } = await admin
    .from("meet_analysis_state")
    .select("lease_until")
    .eq("account_id", accountId)
    .maybeSingle();

  if (state?.lease_until && new Date(state.lease_until) > now) return false;

  await setState(admin, accountId, {
    lease_until: new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString(),
    last_run_at: now.toISOString(),
    status: "running",
    is_paused: paused,
  });
  return true;
}

async function releaseLease(admin: any, accountId: string, patch: Record<string, unknown>) {
  await setState(admin, accountId, { lease_until: null, ...patch });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authFailure = authenticateCronRequest(req);
  if (authFailure) return authFailure;

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!url || !serviceKey) return json({ error: "Backend não configurado" }, 500);
  if (!apiKey) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const { data: pending, error: pendingError } = await admin
      .from("video_call_sessions")
      .select("id, account_id")
      .eq("source", "meet_drive")
      .eq("analysis_status", "pending")
      .not("transcription", "is", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_PER_ACCOUNT * MAX_ACCOUNTS_PER_RUN * 4);

    if (pendingError) return json({ error: pendingError.message }, 500);

    const accounts = [...new Set((pending ?? []).map((p: any) => p.account_id))].slice(0, MAX_ACCOUNTS_PER_RUN);
    if (accounts.length === 0) return json({ ok: true, analyzed: 0, reason: "nada pendente" });

    let analyzed = 0;
    let failed = 0;
    let pausedReason: string | null = null;

    for (const accountId of accounts) {
      const { data: stateRow } = await admin
        .from("meet_analysis_state")
        .select("is_paused, paused_reason")
        .eq("account_id", accountId)
        .maybeSingle();

      // Estando pausada, só um item é testado por rodada para não gastar créditos à toa.
      const probeOnly = !!stateRow?.is_paused;
      const limit = probeOnly ? 1 : BATCH_PER_ACCOUNT;

      const ids = (pending ?? [])
        .filter((p: any) => p.account_id === accountId)
        .slice(0, limit)
        .map((p: any) => p.id);
      if (ids.length === 0) continue;

      if (!(await acquireLease(admin, accountId, !!stateRow?.is_paused))) continue;

      try {
        const knowledgeBlock = await buildKnowledgeBlockForAccount(admin, accountId);

        for (const sessionId of ids) {
          // Reivindicação atômica: se outra rodada já pegou a call, ela não é processada de novo.
          const { data: claimed } = await admin
            .from("video_call_sessions")
            .update({ analysis_status: "analyzing" })
            .eq("id", sessionId)
            .eq("analysis_status", "pending")
            .select("id, transcription");

          const session = claimed?.[0];
          if (!session?.transcription) continue;

          try {
            const { analysis } = await runSalesCallAnalysis({
              transcript: session.transcription,
              knowledgeBlock,
              apiKey,
            });
            await admin
              .from("video_call_sessions")
              .update({ analysis, analysis_status: "completed" })
              .eq("id", sessionId);
            analyzed++;
            if (probeOnly) {
              await setState(admin, accountId, { is_paused: false, paused_reason: null });
            }
          } catch (e) {
            const status = e instanceof SalesCallAnalysisError ? e.status : 0;
            const outcome = e instanceof SalesCallAnalysisError ? e.outcome : "fail";
            const message = e instanceof Error ? e.message : "erro desconhecido";

            if (outcome === "pause") {
              // Sem créditos ou acesso negado: para a fila e avisa o motivo no estado.
              pausedReason = `IA indisponível (${status}): ${message}`;
              await admin.from("video_call_sessions").update({ analysis_status: "pending" }).eq("id", sessionId);
              await setState(admin, accountId, { is_paused: true, paused_reason: pausedReason, last_error: message });
              break;
            }
            if (outcome === "retry") {
              // Falha temporária: devolve para a fila e tenta na próxima rodada.
              await admin.from("video_call_sessions").update({ analysis_status: "pending" }).eq("id", sessionId);
              await releaseLease(admin, accountId, { status: "retry", last_error: `${status}: ${message}` });
              break;
            }
            await admin
              .from("video_call_sessions")
              .update({ analysis_status: "analysis_failed" })
              .eq("id", sessionId);
            failed++;
          }
        }

        if (!pausedReason) {
          await releaseLease(admin, accountId, {
            status: failed ? "partial" : "ok",
            last_error: failed ? `${failed} call(s) com análise com falha` : null,
          });
        }
      } catch (e) {
        await releaseLease(admin, accountId, {
          status: "error",
          last_error: e instanceof Error ? e.message : "erro desconhecido",
        });
      }

      if (pausedReason) break;
    }

    return json({ ok: !pausedReason, analyzed, failed, paused: !!pausedReason, paused_reason: pausedReason });
  } catch (error) {
    console.error("meet-call-auto-analyze error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      500
    );
  }
});
