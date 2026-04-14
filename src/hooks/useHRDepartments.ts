import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface HRDepartment {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  color: string;
  head_collaborator_id: string | null;
  parent_department_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useHRDepartments() {
  const { currentUser } = useCurrentUser();
  const [departments, setDepartments] = useState<HRDepartment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDepartments = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("hr_departments")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .order("name");

      if (error) throw error;
      setDepartments((data || []) as unknown as HRDepartment[]);
    } catch (err) {
      console.error("Error fetching HR departments:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const createDepartment = async (data: Partial<HRDepartment>) => {
    if (!currentUser?.account_id) return null;
    try {
      const { data: created, error } = await supabase
        .from("hr_departments")
        .insert({ ...data, account_id: currentUser.account_id } as any)
        .select()
        .single();
      if (error) throw error;
      toast.success("Departamento criado com sucesso!");
      fetchDepartments();
      return created;
    } catch (err: any) {
      toast.error("Erro ao criar departamento: " + err.message);
      return null;
    }
  };

  const updateDepartment = async (id: string, data: Partial<HRDepartment>) => {
    try {
      const { error } = await supabase
        .from("hr_departments")
        .update(data as any)
        .eq("id", id);
      if (error) throw error;
      toast.success("Departamento atualizado!");
      fetchDepartments();
      return true;
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
      return false;
    }
  };

  const deleteDepartment = async (id: string) => {
    try {
      const { error } = await supabase
        .from("hr_departments")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Departamento removido!");
      fetchDepartments();
      return true;
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
      return false;
    }
  };

  return { departments, loading, refetch: fetchDepartments, createDepartment, updateDepartment, deleteDepartment };
}
