import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireSector } from "../helpers";

export default defineTool({
  name: "tasks_overview",
  title: "Atividades e pendências",
  description: "Lista e resume atividades internas permitidas ao usuário, com responsáveis, prazos, prioridades e vínculos.",
  inputSchema: {
    start_date: z.string().nullable().describe("Prazo inicial (YYYY-MM-DD); null sem limite."),
    end_date: z.string().nullable().describe("Prazo final (YYYY-MM-DD); null sem limite."),
    status: z.enum(["pending", "in_progress", "done", "overdue", "cancelled", "all"]).describe("Status da atividade."),
    assigned_to: z.string().uuid().nullable().describe("Responsável específico; null para todos os permitidos."),
    limit: z.number().int().min(1).max(300).describe("Máximo de atividades."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, status, assigned_to, limit }, ctx) => {
    const supabase = await requireSector(ctx, "operacoes");
    let query = supabase.from("internal_tasks")
      .select("id, title, description, status, priority, due_date, due_time, assigned_to, client_id, deal_id, lead_id, activity_type_id, completed_at, created_at, contact_channel")
      .order("due_date", { ascending: true, nullsFirst: false }).limit(limit);
    if (start_date) query = query.gte("due_date", start_date);
    if (end_date) query = query.lte("due_date", end_date);
    if (status !== "all") query = query.eq("status", status);
    if (assigned_to) query = query.eq("assigned_to", assigned_to);
    const { data, error } = await query; failIf(error);
    const tasks = data ?? []; const today = new Date().toISOString().slice(0, 10);
    return jsonResult({ resumo: { atividades: tasks.length, concluidas: tasks.filter((t) => t.status === "done").length, vencidas: tasks.filter((t) => t.status !== "done" && t.status !== "cancelled" && t.due_date && t.due_date < today).length }, atividades: tasks, observacao: tasks.length === limit ? `Resultado limitado a ${limit} atividades.` : null });
  },
});
