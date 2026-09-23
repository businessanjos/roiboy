import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

function decodeSub(authHeader: string | null): string | null {
  try {
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Loads the account's sales knowledge base (methodology, documents and
 * corrections) and renders it as a prompt block. Returns "" when nothing
 * is configured so callers keep their default behaviour.
 */
export async function buildKnowledgeBlock(req: Request): Promise<string> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return "";

    const authUserId = decodeSub(req.headers.get("Authorization"));
    if (!authUserId) return "";

    const admin = createClient(url, key, { auth: { persistSession: false } });

    const { data: userRow } = await admin
      .from("users")
      .select("account_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    const accountId = userRow?.account_id;
    if (!accountId) return "";

    const [settingsRes, correctionsRes, docsRes] = await Promise.all([
      admin.from("ai_knowledge_settings").select("*").eq("account_id", accountId).maybeSingle(),
      admin
        .from("ai_knowledge_corrections")
        .select("lead_message, incorrect_response, problem_identified, expected_response")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .limit(30),
      admin
        .from("ai_knowledge_documents")
        .select("id, title, extracted_text, chunks_count")
        .eq("account_id", accountId)
        .eq("status", "completed")
        .limit(20),

    ]);

    const s = settingsRes.data as Record<string, unknown> | null;
    const corrections = correctionsRes.data ?? [];
    const docs = docsRes.data ?? [];
    if (!s && corrections.length === 0 && docs.length === 0) return "";

    const parts: string[] = ["\n\n=== MANUAL OFICIAL DE VENDAS DA EMPRESA (siga estritamente) ==="];

    if (s) {
      if (s.business_summary) parts.push(`Negócio: ${s.business_summary}`);
      if (s.target_audience) parts.push(`Público-alvo: ${s.target_audience}`);
      if (s.offer_type) parts.push(`Oferta: ${s.offer_type}`);
      if (s.selling_to) parts.push(`Vende para: ${s.selling_to}`);
      if (s.average_ticket) parts.push(`Ticket médio: ${s.average_ticket}`);
      if (s.tone_of_voice) parts.push(`Tom de voz obrigatório: ${s.tone_of_voice}`);
      const competitors = (s.competitors as string[]) ?? [];
      if (competitors.length) parts.push(`Concorrentes: ${competitors.join(", ")}`);

      const stages = (s.stages as Array<Record<string, string>>) ?? [];
      const filled = stages.filter((st) => st?.goal || st?.guidelines);
      if (filled.length) {
        parts.push("Etapas do processo comercial:");
        filled.forEach((st, i) =>
          parts.push(`${i + 1}. ${st.label}${st.goal ? ` — objetivo: ${st.goal}` : ""}${st.guidelines ? ` — como conduzir: ${st.guidelines}` : ""}`)
        );
      }

      const questions = (s.discovery_questions as string[]) ?? [];
      if (questions.length) parts.push(`Perguntas de descoberta obrigatórias:\n- ${questions.join("\n- ")}`);

      const criteria = (s.qualification_criteria as string[]) ?? [];
      if (criteria.length) parts.push(`Critérios de qualificação:\n- ${criteria.join("\n- ")}`);

      const scripts = (s.opening_scripts as Record<string, string>) ?? {};
      if (scripts.organic) parts.push(`Abertura para lead orgânico: ${scripts.organic}`);
      if (scripts.form) parts.push(`Abertura para lead de formulário: ${scripts.form}`);
    }

    if (corrections.length) {
      parts.push("Correções aprendidas (NUNCA repetir a abordagem incorreta):");
      corrections.forEach((c) =>
        parts.push(
          `- Situação: ${c.lead_message ?? "—"} | NÃO dizer: ${c.incorrect_response ?? "—"} | Motivo: ${c.problem_identified ?? "—"} | Dizer: ${c.expected_response}`
        )
      );
    }

    if (docs.length) {
      // Preferir os fragmentos indexados (arquivos grandes), com fallback no texto bruto.
      const docIds = docs.map((d) => d.id);
      const { data: chunkRows } = await admin
        .from("ai_knowledge_chunks")
        .select("document_id, chunk_index, content")
        .in("document_id", docIds)
        .order("chunk_index", { ascending: true })
        .limit(40);

      const titleById = new Map(docs.map((d) => [d.id, d.title]));
      const chunks = chunkRows ?? [];

      if (chunks.length) {
        parts.push("Trechos de materiais oficiais:");
        let budget = 24000;
        for (const c of chunks) {
          if (budget <= 0) break;
          const text = String(c.content).slice(0, Math.min(1500, budget));
          budget -= text.length;
          parts.push(`- [${titleById.get(c.document_id) ?? "Material"}] ${text}`);
        }
      } else {
        const withText = docs.filter((d) => d.extracted_text);
        if (withText.length) {
          parts.push("Trechos de materiais oficiais:");
          withText.forEach((d) =>
            parts.push(`- ${d.title}: ${String(d.extracted_text).slice(0, 1500)}`)
          );
        } else {
          parts.push(`Materiais cadastrados: ${docs.map((d) => d.title).join(", ")}`);
        }
      }
    }


    parts.push("=== FIM DO MANUAL ===");
    return parts.join("\n");
  } catch (_e) {
    return "";
  }
}
