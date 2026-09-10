import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireSector } from "../helpers";

export default defineTool({
  name: "marketing_overview",
  title: "Projetos e conteúdo de Marketing",
  description: "Analisa projetos, tarefas e calendário de conteúdo de Marketing dentro das permissões do usuário.",
  inputSchema: {
    start_date: z.string().describe("Início do período (YYYY-MM-DD)."),
    end_date: z.string().describe("Fim do período (YYYY-MM-DD)."),
    project_status: z.string().nullable().describe("Status de projeto; null para todos."),
    limit: z.number().int().min(1).max(300).describe("Máximo de registros por bloco."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, project_status, limit }, ctx) => {
    const supabase = await requireSector(ctx, "marketing");
    let projectsQuery = supabase.from("marketing_projects")
      .select("id, name, description, status, start_date, target_date, budget_planned, budget_actual, owner_user_id")
      .lte("start_date", end_date).order("target_date").limit(limit);
    if (project_status) projectsQuery = projectsQuery.eq("status", project_status);
    const [projectsResult, tasksResult, contentResult] = await Promise.all([
      projectsQuery,
      supabase.from("marketing_tasks").select("id, title, description, priority, status, due_date, is_completed, completed_at, assignee_id").gte("due_date", start_date).lte("due_date", end_date).order("due_date").limit(limit),
      supabase.from("content_pieces").select("id, title, platform, format, scheduled_date, status, hook, cta, published_url, talent_id, pillar_id").gte("scheduled_date", start_date).lte("scheduled_date", end_date).order("scheduled_date").limit(limit),
    ]);
    failIf(projectsResult.error); failIf(tasksResult.error); failIf(contentResult.error);
    const projects = projectsResult.data ?? []; const tasks = tasksResult.data ?? []; const content = contentResult.data ?? [];
    return jsonResult({
      periodo: { inicio: start_date, fim: end_date },
      resumo: { projetos: projects.length, orcamento_planejado: projects.reduce((s, p) => s + Number(p.budget_planned ?? 0), 0), orcamento_realizado: projects.reduce((s, p) => s + Number(p.budget_actual ?? 0), 0), tarefas: tasks.length, tarefas_concluidas: tasks.filter((t) => t.is_completed).length, conteudos: content.length, conteudos_publicados: content.filter((c) => c.status === "published").length },
      projetos: projects, tarefas: tasks, conteudos: content,
      observacao: projects.length === limit || tasks.length === limit || content.length === limit ? "Resultado limitado; reduza o período para continuar." : null,
    });
  },
});
