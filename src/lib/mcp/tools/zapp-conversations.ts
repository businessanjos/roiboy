import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireUser, toIso } from "../helpers";

export default defineTool({
  name: "zapp_conversations",
  title: "Conversas do RoyZapp",
  description:
    "Lista conversas do RoyZapp (WhatsApp) com contato, setor, última mensagem e volume, filtrando por período ou busca.",
  inputSchema: {
    start_date: z.string().nullable().describe("Data inicial da última mensagem (YYYY-MM-DD). null = sem limite."),
    end_date: z.string().nullable().describe("Data final da última mensagem (YYYY-MM-DD). null = sem limite."),
    search: z.string().nullable().describe("Busca parcial por nome do contato ou telefone. null = sem busca."),
    include_groups: z.boolean().describe("Incluir grupos além de conversas individuais."),
    limit: z.number().int().min(1).max(200).describe("Máximo de conversas retornadas (ex.: 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, search, include_groups, limit }, ctx) => {
    const supabase = requireUser(ctx);
    let query = supabase
      .from("zapp_conversations")
      .select(
        "id, contact_name, phone_e164, channel, sector_id, client_id, deal_id, lead_id, is_group, unread_count, last_message_at, last_message_preview, created_at",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    const startIso = toIso(start_date);
    const endIso = toIso(end_date, true);
    if (startIso) query = query.gte("last_message_at", startIso);
    if (endIso) query = query.lte("last_message_at", endIso);
    if (!include_groups) query = query.eq("is_group", false);
    if (search) query = query.or(`contact_name.ilike.%${search}%,phone_e164.ilike.%${search}%`);

    const { data, error } = await query;
    failIf(error);

    return jsonResult({ total: data?.length ?? 0, conversas: data ?? [] });
  },
});
