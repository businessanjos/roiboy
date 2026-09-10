import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireSector, toIso } from "../helpers";

export default defineTool({
  name: "events_overview",
  title: "Visão de eventos",
  description: "Analisa agenda, confirmações, presença, capacidade, orçamento e custos dos eventos permitidos ao usuário.",
  inputSchema: {
    start_date: z.string().describe("Início do período (YYYY-MM-DD)."),
    end_date: z.string().describe("Fim do período (YYYY-MM-DD)."),
    status: z.string().nullable().describe("Status do evento; null para todos."),
    limit: z.number().int().min(1).max(200).describe("Máximo de eventos retornados."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, status, limit }, ctx) => {
    const supabase = await requireSector(ctx, "eventos");
    let query = supabase.from("events")
      .select("id, title, description, event_type, scheduled_at, ends_at, duration_minutes, modality, address, status, budget, expected_attendees, max_capacity, category, goals")
      .gte("scheduled_at", toIso(start_date) ?? start_date).lte("scheduled_at", toIso(end_date, true) ?? end_date)
      .order("scheduled_at").limit(limit);
    if (status) query = query.eq("status", status);
    const eventsResult = await query; failIf(eventsResult.error);
    const events = eventsResult.data ?? []; const ids = events.map((event) => event.id);
    let participants: any[] = []; let costs: any[] = [];
    if (ids.length) {
      const [participantsResult, costsResult] = await Promise.all([
        supabase.from("event_participants").select("id, event_id, guest_name, rsvp_status, invited_at, rsvp_responded_at").in("event_id", ids).limit(1000),
        supabase.from("event_costs").select("id, event_id, description, category, estimated_value, actual_value, status, supplier, due_date, paid_at").in("event_id", ids).limit(1000),
      ]);
      failIf(participantsResult.error); failIf(costsResult.error);
      participants = participantsResult.data ?? []; costs = costsResult.data ?? [];
    }
    const rows = events.map((event) => {
      const eventParticipants = participants.filter((p) => p.event_id === event.id);
      const eventCosts = costs.filter((c) => c.event_id === event.id);
      return { ...event, participantes: { total: eventParticipants.length, confirmados: eventParticipants.filter((p) => ["confirmed", "attended"].includes(p.rsvp_status)).length, presentes: eventParticipants.filter((p) => p.rsvp_status === "attended").length, lista: eventParticipants }, custos: { estimado: eventCosts.reduce((s, c) => s + Number(c.estimated_value ?? 0), 0), realizado: eventCosts.reduce((s, c) => s + Number(c.actual_value ?? 0), 0), itens: eventCosts } };
    });
    return jsonResult({ periodo: { inicio: start_date, fim: end_date }, resumo: { eventos: rows.length, participantes: participants.length, custo_realizado: costs.reduce((s, c) => s + Number(c.actual_value ?? 0), 0) }, eventos: rows, observacao: events.length === limit ? `Resultado limitado a ${limit} eventos.` : null });
  },
});
