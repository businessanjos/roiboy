// O nome do funil é só um rótulo: o roteamento padrão procura primeiro o papel
// fixo (pipelines.system_role), depois os nomes conhecidos e, por fim, os nomes
// anteriores (pipelines.previous_names). Assim uma troca de nome não deixa lead
// sem negócio.
export const MQL_PIPELINE_NAMES = ["Closer", "Funil Mentoria", "%Mentoria%", "%Closer%"];
export const NON_MQL_PIPELINE_NAMES = [
  "TP - Eternum Pass", "E-Pass / Clinica Ryka", "E-Pass", "%E-Pass%", "%Eternum Pass%",
];

export type PipelineRole = "sdr" | "closer" | "low_ticket";
export type PipelineRow = {
  id: string;
  name: string;
  system_role?: string | null;
  previous_names?: string[] | null;
};

const norm = (value: unknown) => String(value ?? "").trim().toLowerCase();

function matchesPattern(name: string, pattern: string): boolean {
  const wanted = norm(pattern);
  if (!wanted.includes("%")) return norm(name) === wanted;
  const source = wanted.split("%").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${source}$`).test(norm(name));
}

const hadName = (row: PipelineRow, name: string) =>
  (row.previous_names ?? []).some((former) => norm(former) === norm(name));

/** Nome atual primeiro; se ninguém usa mais esse nome, o funil que já se chamou assim. */
export function pickPipelineByName<T extends PipelineRow>(rows: T[], name: string): T | null {
  if (!norm(name)) return null;
  return rows.find((row) => norm(row.name) === norm(name))
    ?? rows.find((row) => hadName(row, name))
    ?? null;
}

/** Papel fixo → nomes conhecidos (aceita %) → nomes anteriores. */
export function pickDefaultPipeline<T extends PipelineRow>(rows: T[], role: PipelineRole, patterns: string[]): T | null {
  const byRole = rows.find((row) => row.system_role === role);
  if (byRole) return byRole;
  for (const pattern of patterns) {
    const hit = rows.find((row) => matchesPattern(row.name, pattern));
    if (hit) return hit;
  }
  for (const pattern of patterns) {
    if (pattern.includes("%")) continue;
    const hit = rows.find((row) => hadName(row, pattern));
    if (hit) return hit;
  }
  return null;
}

/** Funis ativos da conta, do mais antigo para o mais novo. */
export async function loadActivePipelines(supabase: any, accountId: string): Promise<PipelineRow[]> {
  const { data } = await supabase
    .from("pipelines")
    .select("id, name, system_role, previous_names")
    .eq("account_id", accountId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  return Array.isArray(data) ? data : [];
}
