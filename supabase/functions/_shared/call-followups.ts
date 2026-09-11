// @ts-nocheck
// Fecha o ciclo da ligação no cadastro do lead/negociação — vale para os dois motores
// (3C Plus, com resumo da nossa IA, e Call Ryka, com o post_call deles).
//
// 1. Grava resumo/temperatura no lead (sem sobrescrever edição manual do vendedor).
// 2. Atualiza a última interação do lead.
// 3. Cria/atualiza UMA tarefa de follow-up por ligação quando o resumo trouxer
//    próximos passos ou compromissos agendados.

const FOLLOWUP_TYPE_NAME = "Follow-up de ligação";

export interface CallSummary {
  resumo?: string | null;
  temperatura?: string | null;
  proximos_passos?: unknown;
  compromissos_agendados?: unknown;
  [key: string]: unknown;
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

/** Normaliza o post_call do Call Ryka para o mesmo formato do resumo da nossa IA. */
export function summaryFromRykaPostCall(post: any): CallSummary | null {
  if (!post) return null;
  if (typeof post === "string") return { resumo: post };
  return {
    resumo: post.summary || post.resumo || post.text || null,
    temperatura: post.temperature || post.temperatura || null,
    dores: post.pains || post.dores,
    objecoes: post.objections || post.objecoes,
    proximos_passos: post.next_steps || post.proximos_passos || post.nextSteps,
    compromissos_agendados: post.appointments || post.compromissos_agendados || post.scheduled || post.follow_up_at,
  };
}

/** Tenta extrair data/hora de um texto tipo "reunião 15/09 às 14h". */
function parseWhen(text: string, base: Date): { date: string; time: string } | null {
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (iso) {
    return { date: `${iso[1]}-${iso[2]}-${iso[3]}`, time: `${iso[4] || "09"}:${iso[5] || "00"}` };
  }
  const br = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  const hour = text.match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/i);
  if (br) {
    const day = br[1].padStart(2, "0");
    const month = br[2].padStart(2, "0");
    let year = br[3] ? Number(br[3]) : base.getUTCFullYear();
    if (year < 100) year += 2000;
    const time = hour ? `${hour[1].padStart(2, "0")}:${(hour[2] || "00").padStart(2, "0")}` : "09:00";
    return { date: `${year}-${month}-${day}`, time };
  }
  return null;
}

function nextDayAt9(base: Date) {
  const d = new Date(base.getTime() + 24 * 3600 * 1000);
  return { date: d.toISOString().slice(0, 10), time: "09:00" };
}

function shortTitle(contact: string, step: string) {
  const clean = step.replace(/\s+/g, " ").trim();
  const cut = clean.length > 60 ? `${clean.slice(0, 57)}...` : clean;
  return `Retornar para ${contact} — ${cut}`.slice(0, 140);
}

async function followupTypeId(supabase: any, accountId: string): Promise<string | null> {
  const { data } = await supabase
    .from("activity_types")
    .select("id")
    .eq("account_id", accountId)
    .eq("name", FOLLOWUP_TYPE_NAME)
    .maybeSingle();
  if (data?.id) return data.id;
  const { data: created } = await supabase
    .from("activity_types")
    .insert({
      account_id: accountId,
      name: FOLLOWUP_TYPE_NAME,
      sector_id: "vendas",
      icon: "phone",
      color: "#2563eb",
      is_active: true,
    })
    .select("id")
    .maybeSingle();
  return created?.id ?? null;
}

export interface ApplyCallInsightsInput {
  accountId: string;
  /** Registro de threecplus_call_logs (com id, lead_id, deal_id, client_id, user_id...). */
  call: any;
  summary: CallSummary | null;
  /** Rótulo do motor para os textos: "3C" ou "Call Ryka". */
  engineLabel?: string;
}

export async function applyCallInsights(
  supabase: any,
  { accountId, call, summary, engineLabel = "3C" }: ApplyCallInsightsInput,
) {
  const result: { lead_updated: boolean; task_id: string | null; task_title: string | null } = {
    lead_updated: false,
    task_id: null,
    task_title: null,
  };
  if (!call?.id) return result;

  const startedAt = call.started_at || call.created_at || new Date().toISOString();
  const contact = call.contact_name || call.phone || "o contato";

  // 1 + 2. Temperatura e última interação no cadastro do lead.
  if (call.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, temperature, temperature_manual_at, last_contact_at")
      .eq("id", call.lead_id)
      .maybeSingle();
    if (lead) {
      const patch: Record<string, unknown> = {};
      const manualAfterCall =
        lead.temperature_manual_at && new Date(lead.temperature_manual_at) > new Date(startedAt);
      const temp = String(summary?.temperatura || "").toLowerCase();
      if (["frio", "morno", "quente"].includes(temp) && !manualAfterCall) {
        patch.temperature = temp;
        patch.temperature_updated_at = startedAt;
      }
      if (!lead.last_contact_at || new Date(lead.last_contact_at) < new Date(startedAt)) {
        patch.last_contact_at = startedAt;
      }
      if (Object.keys(patch).length) {
        await supabase.from("leads").update(patch).eq("id", lead.id);
        result.lead_updated = true;
      }
    }
  }

  // 3. Tarefa de follow-up.
  const steps = asList(summary?.proximos_passos);
  const commitments = asList(summary?.compromissos_agendados);
  if (!steps.length && !commitments.length) return result;

  const { data: settings } = await supabase
    .from("account_settings")
    .select("calls_auto_tasks")
    .eq("account_id", accountId)
    .maybeSingle();
  if (settings && settings.calls_auto_tasks === false) return result;

  if (!call.lead_id && !call.deal_id) return result;

  const base = new Date(startedAt);
  const when = commitments.map((c) => parseWhen(c, base)).find(Boolean) || nextDayAt9(base);
  const headline = commitments[0] || steps[0];
  const title = shortTitle(contact, headline);
  const description = [
    summary?.resumo ? `Resumo da ligação (${engineLabel}): ${summary.resumo}` : null,
    steps.length ? `Próximos passos:\n${steps.map((s) => `• ${s}`).join("\n")}` : null,
    commitments.length ? `Compromissos: ${commitments.join("; ")}` : null,
    call.activity_id ? `Atividade da ligação: ${call.activity_id}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const typeId = await followupTypeId(supabase, accountId);
  const payload: Record<string, unknown> = {
    account_id: accountId,
    title,
    description,
    status: "pending",
    priority: "medium",
    due_date: when.date,
    due_time: when.time,
    lead_id: call.lead_id || null,
    deal_id: call.deal_id || null,
    client_id: call.client_id || null,
    assigned_to: call.user_id || null,
    created_by: call.user_id || null,
    activity_type_id: typeId,
    contact_channel: "ligacao",
  };

  let taskId: string | null = call.followup_task_id || null;
  if (taskId) {
    const { error } = await supabase
      .from("internal_tasks")
      .update({ title, description, due_date: when.date, due_time: when.time })
      .eq("id", taskId);
    if (error) taskId = null;
  }
  if (!taskId) {
    const { data: created, error } = await supabase
      .from("internal_tasks")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[call-followups] tarefa:", error.message);
      return result;
    }
    taskId = created?.id ?? null;
  }
  if (!taskId) return result;

  result.task_id = taskId;
  result.task_title = title;

  await supabase
    .from("threecplus_call_logs")
    .update({
      followup_task_id: taskId,
      metadata: { ...(call.metadata || {}), followup_task: { id: taskId, title } },
    })
    .eq("id", call.id);

  // Mostra a tarefa dentro da atividade da ligação.
  if (call.activity_id) {
    const { data: activity } = await supabase
      .from("deal_activities")
      .select("content")
      .eq("id", call.activity_id)
      .maybeSingle();
    const content = String(activity?.content || "").split("\n\nTarefa criada:")[0];
    await supabase
      .from("deal_activities")
      .update({ content: `${content}\n\nTarefa criada: ${title} [task:${taskId}]` })
      .eq("id", call.activity_id);
  }

  return result;
}
