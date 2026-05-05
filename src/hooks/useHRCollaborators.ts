import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface HRCollaborator {
  id: string;
  account_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  gender: string | null;
  marital_status: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  department: string | null;
  hr_department_id: string | null;
  position: string | null;
  hire_date: string | null;
  termination_date: string | null;
  employment_type: string | null;
  salary: number | null;
  status: string | null;
  avatar_url: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  // Extended payroll/charges/benefits fields
  neighborhood?: string | null;
  address_complement?: string | null;
  work_model?: string | null;
  unit?: string | null;
  registration_company?: string | null;
  cbo?: string | null;
  payroll_company?: string | null;
  net_salary?: number | null;
  base_salary?: number | null;
  commissions?: number | null;
  dsr_commissions?: number | null;
  total_salary?: number | null;
  inss_employer?: number | null;
  inss_third_parties?: number | null;
  inss_gilrat?: number | null;
  fgts?: number | null;
  vacation_provision?: number | null;
  vacation_third?: number | null;
  thirteenth_provision?: number | null;
  total_charges?: number | null;
  health_plan?: number | null;
  life_insurance?: number | null;
  meal_voucher?: number | null;
  transport_voucher?: number | null;
  home_office_allowance?: number | null;
  total_benefits?: number | null;
  other_costs?: number | null;
  total_cost?: number | null;
  cost_pct?: number | null;
  monthly_total_cost?: number | null;
  annual_total_cost?: number | null;
  source_note?: string | null;
  created_at: string;
  updated_at: string;
  // Extra fields from users table (when source is 'team')
  source: "hr" | "team";
  team_role_name?: string | null;
}

export type HRCollaboratorInsert = Omit<HRCollaborator, "id" | "created_at" | "updated_at" | "source" | "team_role_name">;

export function useHRCollaborators() {
  const { currentUser } = useCurrentUser();
  const [collaborators, setCollaborators] = useState<HRCollaborator[]>([]);
  const [loading, setLoading] = useState(true);

  const resolveDepartmentId = useCallback(async (departmentName: string | null | undefined) => {
    if (!currentUser?.account_id || !departmentName?.trim()) return null;

    const { data, error } = await supabase
      .from("hr_departments")
      .select("id")
      .eq("account_id", currentUser.account_id)
      .ilike("name", departmentName.trim())
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.id ?? null;
  }, [currentUser?.account_id]);

  const fetchCollaborators = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);
    try {
      const { data: hrData, error: hrError } = await supabase
        .from("hr_collaborators")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .order("full_name");

      if (hrError) throw hrError;

      const hrCollaborators: HRCollaborator[] = ((hrData || []) as any[]).map(c => ({
        ...c,
        source: "hr" as const,
      }));

      setCollaborators(hrCollaborators);
    } catch (err) {
      console.error("Error fetching collaborators:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  const createCollaborator = async (data: Partial<HRCollaboratorInsert>) => {
    if (!currentUser?.account_id) return null;
    try {
      const hrDepartmentId = await resolveDepartmentId(data.department);

      const { data: created, error } = await supabase
        .from("hr_collaborators")
        .insert({
          ...data,
          account_id: currentUser.account_id,
          hr_department_id: hrDepartmentId,
        } as any)
        .select()
        .single();

      if (error) throw error;
      toast.success("Colaborador cadastrado com sucesso!");
      fetchCollaborators();
      return created;
    } catch (err: any) {
      toast.error("Erro ao cadastrar colaborador: " + err.message);
      return null;
    }
  };

  const importFromTeam = async (userId: string, teamData: Partial<HRCollaboratorInsert>) => {
    if (!currentUser?.account_id) return null;
    try {
      const hrDepartmentId = await resolveDepartmentId(teamData.department);

      const { data: created, error } = await supabase
        .from("hr_collaborators")
        .insert({
          ...teamData,
          user_id: userId,
          account_id: currentUser.account_id,
          hr_department_id: hrDepartmentId,
        } as any)
        .select()
        .single();

      if (error) throw error;
      toast.success("Colaborador importado da equipe!");
      fetchCollaborators();
      return created;
    } catch (err: any) {
      toast.error("Erro ao importar colaborador: " + err.message);
      return null;
    }
  };

  const updateCollaborator = async (id: string, data: Partial<HRCollaborator>, silent = false) => {
    try {
      const { source, team_role_name, id: _id, created_at, updated_at, ...updatePayload } = data as any;

      if (Object.prototype.hasOwnProperty.call(data, "department")) {
        updatePayload.hr_department_id = await resolveDepartmentId(data.department);
      }

      const { error } = await supabase
        .from("hr_collaborators")
        .update(updatePayload as any)
        .eq("id", id);

      if (error) throw error;
      if (!silent) toast.success("Colaborador atualizado!");
      fetchCollaborators();
      return true;
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
      return false;
    }
  };

  const deleteCollaborator = async (id: string) => {
    try {
      const { error } = await supabase
        .from("hr_collaborators")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Colaborador removido!");
      fetchCollaborators();
      return true;
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
      return false;
    }
  };

  return { collaborators, loading, refetch: fetchCollaborators, createCollaborator, updateCollaborator, deleteCollaborator, importFromTeam };
}
