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

  const fetchCollaborators = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);
    try {
      // Fetch HR collaborators
      const { data: hrData, error: hrError } = await supabase
        .from("hr_collaborators")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .order("full_name");

      if (hrError) throw hrError;

      // Fetch team users from users table
      const { data: teamData, error: teamError } = await supabase
        .from("users")
        .select("id, name, email, avatar_url, role, team_role_id, account_id")
        .eq("account_id", currentUser.account_id)
        .order("name");

      if (teamError) throw teamError;

      // Fetch team role names
      let roleMap: Record<string, string> = {};
      if (teamData && teamData.length > 0) {
        const roleIds = [...new Set(teamData.map(u => u.team_role_id).filter(Boolean))];
        if (roleIds.length > 0) {
          const { data: roles } = await supabase
            .from("team_roles")
            .select("id, name")
            .in("id", roleIds);
          if (roles) {
            roleMap = Object.fromEntries(roles.map(r => [r.id, r.name]));
          }
        }
      }

      const hrCollaborators: HRCollaborator[] = ((hrData || []) as any[]).map(c => ({
        ...c,
        source: "hr" as const,
      }));

      // IDs of users already linked in hr_collaborators
      const linkedUserIds = new Set(hrCollaborators.map(c => c.user_id).filter(Boolean));

      // Team members not yet in hr_collaborators
      const teamCollaborators: HRCollaborator[] = (teamData || [])
        .filter(u => !linkedUserIds.has(u.id))
        .map(u => ({
          id: u.id, // use user id as virtual id
          account_id: u.account_id,
          user_id: u.id,
          full_name: u.name || u.email || "Sem nome",
          email: u.email,
          phone: null,
          cpf: null,
          rg: null,
          birth_date: null,
          gender: null,
          marital_status: null,
          address: null,
          city: null,
          state: null,
          zip_code: null,
          department: u.team_role_id ? (roleMap[u.team_role_id]?.split(" · ")[0] || null) : null,
          position: u.team_role_id ? (roleMap[u.team_role_id] || null) : null,
          hire_date: null,
          termination_date: null,
          employment_type: null,
          salary: null,
          status: "active",
          avatar_url: u.avatar_url,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          notes: null,
          created_at: "",
          updated_at: "",
          source: "team" as const,
          team_role_name: u.team_role_id ? (roleMap[u.team_role_id] || null) : null,
        }));

      const merged = [...hrCollaborators, ...teamCollaborators].sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );

      setCollaborators(merged);
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
      const { data: created, error } = await supabase
        .from("hr_collaborators")
        .insert({ ...data, account_id: currentUser.account_id } as any)
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
      const { data: created, error } = await supabase
        .from("hr_collaborators")
        .insert({
          ...teamData,
          user_id: userId,
          account_id: currentUser.account_id,
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

  const updateCollaborator = async (id: string, data: Partial<HRCollaborator>) => {
    try {
      const { error } = await supabase
        .from("hr_collaborators")
        .update(data as any)
        .eq("id", id);

      if (error) throw error;
      toast.success("Colaborador atualizado!");
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
