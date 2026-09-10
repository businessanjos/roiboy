import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireRhAccess } from "../helpers";

export default defineTool({
  name: "hr_overview",
  title: "Indicadores de RH",
  description: "Retorna quadro de pessoas, admissões, desligamentos e férias sem salários, documentos ou dados pessoais sensíveis.",
  inputSchema: {
    status: z.enum(["active", "inactive", "all"]).describe("Status dos colaboradores."),
    department: z.string().nullable().describe("Departamento exato; null para todos."),
    include_people: z.boolean().describe("Incluir lista profissional resumida de colaboradores."),
    limit: z.number().int().min(1).max(300).describe("Máximo de registros por bloco."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, department, include_people, limit }, ctx) => {
    const supabase = await requireRhAccess(ctx);
    let peopleQuery = supabase.from("hr_collaborators")
      .select("id, full_name, department, position, hire_date, termination_date, employment_type, status, work_model, unit")
      .order("full_name").limit(limit);
    if (status !== "all") peopleQuery = peopleQuery.eq("status", status);
    if (department) peopleQuery = peopleQuery.eq("department", department);
    const [peopleResult, vacationsResult, admissionsResult, offboardingsResult] = await Promise.all([
      peopleQuery,
      supabase.from("hr_vacation_requests").select("id, collaborator_id, request_type, start_date, end_date, days_count, status").order("start_date", { ascending: false }).limit(limit),
      supabase.from("hr_admissions").select("id, candidate_name, position_title, department, contract_type, start_date, stage, admitted_at").order("start_date", { ascending: false }).limit(limit),
      supabase.from("hr_offboardings").select("id, collaborator_id, termination_type, last_day_worked, termination_date, notice_type, stage, will_replace, completed_at").order("termination_date", { ascending: false }).limit(limit),
    ]);
    failIf(peopleResult.error); failIf(vacationsResult.error); failIf(admissionsResult.error); failIf(offboardingsResult.error);
    const people = peopleResult.data ?? [];
    const departments = new Map<string, number>();
    people.forEach((person) => departments.set(person.department ?? "Não informado", (departments.get(person.department ?? "Não informado") ?? 0) + 1));
    return jsonResult({
      resumo: { colaboradores: people.length, ativos: people.filter((p) => p.status === "active").length, por_departamento: Object.fromEntries(departments), ferias: vacationsResult.data?.length ?? 0, admissoes: admissionsResult.data?.length ?? 0, desligamentos: offboardingsResult.data?.length ?? 0 },
      colaboradores: include_people ? people : undefined,
      ferias: vacationsResult.data ?? [],
      admissoes: admissionsResult.data ?? [],
      desligamentos: offboardingsResult.data ?? [],
      privacidade: "Salários, documentos, CPF, RG, endereço, dados médicos e contatos pessoais não são disponibilizados.",
    });
  },
});
