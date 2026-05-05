import { supabase } from "@/integrations/supabase/client";

/**
 * Lista canônica de consultoras (CS Ops).
 * Match por início do nome para evitar falsos positivos
 * (ex.: "Fernanda Sant'Anna" não pode casar com "ana").
 */
export const CONSULTANT_NAMES = [
  "andréia",
  "andreia",
  "dayara",
  "michele",
  "ana maria",
];

export const matchesConsultantName = (fullName: string | null | undefined) => {
  const n = (fullName || "").trim().toLowerCase();
  return CONSULTANT_NAMES.some((k) => n.startsWith(k));
};

export type ActiveConsultant = {
  id: string; // user_id
  name: string;
  email: string | null;
  base_salary: number;
};

/**
 * Busca somente consultoras ATIVAS no RH (status='active') com user_id vinculado.
 * Fonte única de verdade para Plano de Incentivo e Premiação & Bônus.
 */
export async function fetchActiveConsultants(): Promise<ActiveConsultant[]> {
  const { data } = await supabase
    .from("hr_collaborators")
    .select("user_id, full_name, email, status, base_salary")
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
    }));
}
