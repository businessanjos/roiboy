// Núcleo do resumo diário de conversas (Customer Success + grupos vinculados).
// 1 registro por cliente por dia de Brasília (source "ai_whatsapp"); reexecução atualiza o mesmo registro.

// Grupos internos da equipe nunca entram no resumo individual.
// (Nome com "Rykas/Eternum Mentoring" é comum em grupos de acompanhamento, então não exclui.)
const INTERNAL_GROUP_RE =
  /(financeiro|bugs?\s*roy|tech supor|cancelamento|congelamento)/i;
// Grupos gigantes (20+ clientes vinculados) são comunitários e ficam de fora.
const MAX_LINKED_CLIENTS = 19;

const BRT_OFFSET_MS = 3 * 3600_000;

export function brtDayKey(iso: string | Date): string {
  const d = new Date(new Date(iso).getTime() - BRT_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

export function brtDayRange(dayKey: string): { start: string; end: string } {
  const start = new Date(`${dayKey}T03:00:00Z`);
  const end = new Date(start.getTime() + 24 * 3600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export class AiBlockedError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

export type SummaryResult = "created" | "updated" | "unchanged" | "empty";

export async function summarizeClientDay(
  supabase: any,
  apiKey: string,
  clientId: string,
  dayKey: string,
): Promise<{ result: SummaryResult; summary?: string }> {
  const { start, end } = brtDayRange(dayKey);

  const { data: client } = await supabase
    .from("clients").select("id, account_id, full_name").eq("id", clientId).maybeSingle();
  if (!client?.account_id) return { result: "empty" };

  // Conversas individuais de CS
  const { data: indiv } = await supabase
    .from("zapp_conversations").select("id, contact_name")
    .eq("client_id", clientId).eq("is_group", false).eq("sector_id", "operacoes")
    .eq("account_id", client.account_id).limit(50);

  // Grupos vinculados (exceto internos/comunitários)
  const { data: links } = await supabase
    .from("zapp_group_clients").select("conversation_id")
    .eq("client_id", clientId).eq("account_id", client.account_id).limit(50);
  const groupIds = (links || []).map((l: any) => l.conversation_id);
  let groups: any[] = [];
  if (groupIds.length) {
    const { data } = await supabase
      .from("zapp_conversations").select("id, contact_name").in("id", groupIds).eq("is_group", true);
    groups = (data || []).filter((g: any) => !INTERNAL_GROUP_RE.test(g.contact_name || ""));
    if (groups.length) {
      const { data: allLinks } = await supabase
        .from("zapp_group_clients").select("conversation_id")
        .in("conversation_id", groups.map((g: any) => g.id)).limit(2000);
      const counts = new Map<string, number>();
      for (const l of allLinks || []) counts.set(l.conversation_id, (counts.get(l.conversation_id) || 0) + 1);
      groups = groups.filter((g: any) => (counts.get(g.id) || 0) <= MAX_LINKED_CLIENTS);
    }
  }

  const convs = [
    ...(indiv || []).map((c: any) => ({ id: c.id, label: "Conversa individual", group: false })),
    ...groups.map((g: any) => ({ id: g.id, label: `Grupo "${g.contact_name || "sem nome"}"`, group: true })),
  ];
  if (!convs.length) return { result: "empty" };

  const blocks: string[] = [];
  let total = 0;
  let firstAt: string | null = null;
  let firstDir: string | null = null;
  let lastAt: string | null = null;

  for (const conv of convs) {
    const msgs: any[] = [];
    for (let from = 0; from < 2000; from += 500) {
      const { data, error } = await supabase
        .from("zapp_messages")
        .select("id, direction, content, transcription, media_type, sender_name, sent_at, is_deleted")
        .eq("zapp_conversation_id", conv.id)
        .gte("sent_at", start).lt("sent_at", end)
        .order("sent_at", { ascending: true }).order("id", { ascending: true })
        .range(from, from + 499);
      if (error) throw error;
      msgs.push(...(data || []));
      if (!data || data.length < 500) break;
    }
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const m of msgs) {
      if (m.is_deleted || seen.has(m.id)) continue;
      seen.add(m.id);
      let text = (m.content || m.transcription || "").trim();
      if (text.length < 2) {
        if (m.media_type) text = `[${m.media_type} sem texto, não analisável]`;
        else continue;
      }
      const inbound = m.direction === "inbound" || m.direction === "client_to_team";
      const who = inbound
        ? (conv.group ? (m.sender_name || "Participante") : client.full_name)
        : "Equipe";
      const hh = new Date(new Date(m.sent_at).getTime() - BRT_OFFSET_MS).toISOString().slice(11, 16);
      lines.push(`[${hh}] ${who}: ${text.slice(0, 400)}`);
      total++;
      if (!firstAt || m.sent_at < firstAt) { firstAt = m.sent_at; firstDir = inbound ? "cliente" : "consultor"; }
      if (!lastAt || m.sent_at > lastAt) lastAt = m.sent_at;
    }
    if (lines.length) blocks.push(`### ${conv.label}\n${lines.slice(-80).join("\n")}`);
  }

  if (!total || !lastAt) return { result: "empty" };

  const { data: existing } = await supabase
    .from("client_checkins").select("id, message_count")
    .eq("client_id", clientId).eq("source", "ai_whatsapp")
    .gte("happened_at", start).lt("happened_at", end)
    .order("happened_at", { ascending: true }).limit(1).maybeSingle();
  if (existing && existing.message_count === total) return { result: "unchanged" };

  // Contexto: último resumo anterior para dar continuidade (pendências em aberto).
  const { data: prev } = await supabase
    .from("client_checkins").select("summary, happened_at")
    .eq("client_id", clientId).eq("source", "ai_whatsapp")
    .lt("happened_at", start).order("happened_at", { ascending: false }).limit(1).maybeSingle();
  const prevBlock = prev?.summary
    ? `\n\nResumo anterior (${brtDayKey(prev.happened_at)}), use só para continuidade:\n${String(prev.summary).slice(0, 800)}`
    : "";

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: [
            "Você é analista sênior de Customer Success de uma mentoria para profissionais da saúde (Eternum/Rykas).",
            "Leia as conversas do dia entre a equipe e a cliente e produza uma análise útil para a consultora que vai assumir o próximo contato.",
            "Raciocine antes de escrever: qual era o objetivo real da conversa, o que a cliente precisa, como ela está (engajada, insegura, frustrada, satisfeita), o que ficou resolvido e o que ficou em aberto.",
            "Regras: use SOMENTE fatos das mensagens; nunca invente datas, valores ou promessas. Ignore saudações, 'ok', figurinhas e conversa social sem conteúdo.",
            "Em grupos, atribua cada fala a quem disse (cliente, sócio/cônjuge ou equipe); nunca atribua à cliente o que outra pessoa falou.",
            "Se o resumo anterior trouxer pendências, diga se foram resolvidas hoje, quando houver evidência.",
            "Formato: uma linha por conversa, começando com o rótulo entre colchetes ([Individual] ou [Grupo Nome]), em texto corrido e objetivo:",
            "contexto e assuntos -> o que foi decidido/entregue -> pendências com responsável (equipe ou cliente).",
            "Termine com uma linha [Leitura CS] contendo: humor/engajamento percebido, sinais de risco (insatisfação, sumiço, cobrança, menção a cancelar/pausar) ou de oportunidade (resultado, elogio, interesse em renovar/upsell), e a próxima ação recomendada. Se não houver sinal, diga 'sem sinais de risco'.",
            "Se a equipe escreveu e a cliente não respondeu, registre isso. Português do Brasil, sem emojis, sem markdown. Máximo 1100 caracteres.",
          ].join(" "),
        },
        { role: "user", content: `Cliente: ${client.full_name}\nDia: ${dayKey}${prevBlock}\n\nConversas de hoje:\n\n${blocks.join("\n\n")}` },
      ],
    }),
  });
  if (aiRes.status === 402 || aiRes.status === 403 || aiRes.status === 429) {
    throw new AiBlockedError(aiRes.status, `IA indisponível (${aiRes.status})`);
  }
  if (!aiRes.ok) throw new Error(`IA ${aiRes.status}`);
  const aiJson = await aiRes.json();
  const summary = String(aiJson?.choices?.[0]?.message?.content || "").trim().slice(0, 1400);
  if (!summary) throw new Error("IA não retornou resumo");

  const row = {
    happened_at: lastAt,
    initiated_by: firstDir || "consultor",
    summary,
    message_count: total,
  };
  if (existing) {
    const { error } = await supabase.from("client_checkins").update(row).eq("id", existing.id);
    if (error) throw error;
    return { result: "updated", summary };
  }
  const { error } = await supabase.from("client_checkins").insert({
    ...row, account_id: client.account_id, client_id: clientId, user_id: null,
    channel: "whatsapp", kind: "contato", source: "ai_whatsapp",
  });
  if (error) throw error;
  return { result: "created", summary };
}
