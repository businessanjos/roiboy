import { supabase } from "@/integrations/supabase/client";

/**
 * Lista canônica de consultoras (CS Ops).
 * Match por início do nome para evitar falsos positivos
 * (ex.: "Fernanda Sant'Anna" não pode casar com "ana").
 */
// Tokens são casados como PALAVRA INTEIRA (\b...\b) para evitar falsos
// positivos como "Fernanda Santana" casar com "ana".
// "ana maria" é uma frase de 2 palavras (também por palavra inteira).
export const CONSULTANT_NAMES = [
  "andréia",
  "andreia",
  "dayara",
  "michele",
  "ana maria",
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$1");

export const matchesConsultantName = (fullName: string | null | undefined) => {
  const n = (fullName || "").trim().toLowerCase();
  if (!n) return false;
  return CONSULTANT_NAMES.some((k) => {
    const re = new RegExp(`\\b${escapeRegex(k)}\\b`, "i");
    return re.test(n);
  });
};

export type ActiveConsultant = {
  id: string; // user_id
  name: string;
  email: string | null;
  base_salary: number;
  position: string | null;
  role_label: string;
};

/**
 * Deriva o cargo padronizado (CS Júnior / CS Pleno / CS Sênior / Líder)
 * a partir do campo `position` do RH.
 */
export const getConsultantRoleLabel = (position: string | null | undefined): string => {
  const p = (position || "").trim().toLowerCase();
  if (!p) return "CS";
  if (/(l[ií]der|coordenador|gerente|head)/i.test(p)) return "Líder";
  if (/(s[eê]nior|\bsr\b)/i.test(p)) return "CS Sênior";
  if (/(pleno|\bpl\b)/i.test(p)) return "CS Pleno";
  if (/(j[uú]nior|\bjr\b)/i.test(p)) return "CS Júnior";
  return "CS";
};

/**
 * Deriva a chave de senioridade (junior|pleno|senior|lead) a partir do `position`.
 * Usada para casar com `products.consultant_seniority`.
 */
export const getConsultantSeniorityKey = (
  position: string | null | undefined
): "junior" | "pleno" | "senior" | "lead" | null => {
  const p = (position || "").trim().toLowerCase();
  if (!p) return null;
  if (/(l[ií]der|coordenador|gerente|head)/i.test(p)) return "lead";
  if (/(s[eê]nior|\bsr\b)/i.test(p)) return "senior";
  if (/(pleno|\bpl\b)/i.test(p)) return "pleno";
  if (/(j[uú]nior|\bjr\b)/i.test(p)) return "junior";
  return null;
};

/**
 * Busca somente consultoras ATIVAS no RH (status='active') com user_id vinculado.
 * Fonte única de verdade para Plano de Incentivo e Premiação & Bônus.
 */
export async function fetchActiveConsultants(): Promise<ActiveConsultant[]> {
  const { data } = await supabase
    .from("hr_collaborators")
    .select("user_id, full_name, email, status, base_salary, position")
    .eq("status", "active")
    .not("user_id", "is", null)
    .order("full_name");

  return (data || [])
    .filter((c: any) => matchesConsultantName(c.full_name))
    .map((c: any) => ({
      id: c.user_id,
      name: c.full_name,
      email: c.email,
      base_salary: Number(c.base_salary) || 0,
      position: c.position ?? null,
      role_label: getConsultantRoleLabel(c.position),
    }));
}
