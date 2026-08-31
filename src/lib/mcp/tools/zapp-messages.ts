import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireUser, toIso } from "../helpers";

export default defineTool({
  name: "zapp_messages",
  title: "Mensagens de uma conversa",
  description:
    "Retorna as mensagens de uma conversa do RoyZapp (texto e transcrição de áudio) em ordem cronológica, para análise de atendimento.",
  inputSchema: {
    conversation_id: z.string().uuid().describe("ID da conversa (obtido em zapp_conversations)."),
    start_date: z.string().nullable().describe("Data inicial (YYYY-MM-DD). null = sem limite."),
    end_date: z.string().nullable().describe("Data final (YYYY-MM-DD). null = sem limite."),
    limit: z.number().int().min(1).max(500).describe("Máximo de mensagens retornadas (ex.: 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ conversation_id, start_date, end_date, limit }, ctx) => {
    const supabase = requireUser(ctx);
    let query = supabase
      .from("zapp_messages")
      .select(
        "id, direction, content, transcription, message_type, media_type, sender_name, sender_phone, sender_user_id, delivery_status, sent_at",
      )
      .eq("zapp_conversation_id", conversation_id)
      .is("deleted_at", null)
      .order("sent_at", { ascending: true })
      .limit(limit);

    const startIso = toIso(start_date);
    const endIso = toIso(end_date, true);
    if (startIso) query = query.gte("sent_at", startIso);
    if (endIso) query = query.lte("sent_at", endIso);

    const { data, error } = await query;
    failIf(error);

    const msgs = data ?? [];
    return jsonResult({
      conversation_id,
      total: msgs.length,
      recebidas: msgs.filter((m) => m.direction === "inbound").length,
      enviadas: msgs.filter((m) => m.direction === "outbound").length,
      mensagens: msgs,
    });
  },
});
