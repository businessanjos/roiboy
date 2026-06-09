import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface HRServiceProvider {
  id: string;
  account_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  rg: string | null;
  cnpj: string | null;
  company_name: string | null;
  trade_name: string | null;
  birth_date: string | null;
  gender: string | null;
  marital_status: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  department: string | null;
  hr_department_id: string | null;
  service_type: string | null;
  position: string | null;
  hire_date: string | null;
  termination_date: string | null;
  fee_amount: number | null;
  payment_method: string | null;
  status: string | null;
  avatar_url: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_pix_key: string | null;
  contract_number: string | null;
  contract_total_value: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_down_payment: number | null;
  contract_installments_count: number | null;
  contract_installment_value: number | null;
  contract_auto_renewal: boolean | null;
  is_recruitment_partner: boolean | null;
  recruitment_commission_pct: number | null;
  recruitment_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type HRServiceProviderInsert = Omit<HRServiceProvider, "id" | "created_at" | "updated_at">;

export function useHRServiceProviders() {
  const { currentUser } = useCurrentUser();
  const [providers, setProviders] = useState<HRServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProviders = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("hr_service_providers")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .order("full_name");

      if (error) throw error;
      setProviders((data || []) as unknown as HRServiceProvider[]);
    } catch (err) {
      console.error("Error fetching service providers:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const createProvider = async (data: Partial<HRServiceProviderInsert>) => {
    if (!currentUser?.account_id) return null;
    try {
      const { data: created, error } = await supabase
        .from("hr_service_providers")
        .insert({
          ...data,
          account_id: currentUser.account_id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      toast.success("Prestador cadastrado com sucesso!");
      fetchProviders();
      return created;
    } catch (err: any) {
      toast.error("Erro ao cadastrar prestador: " + err.message);
      return null;
    }
  };

  const updateProvider = async (id: string, data: Partial<HRServiceProvider>, silent = false) => {
    try {
      const { error } = await supabase
        .from("hr_service_providers")
        .update(data as any)
        .eq("id", id);

      if (error) throw error;
      if (!silent) toast.success("Prestador atualizado!");
      fetchProviders();
      return true;
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
      return false;
    }
  };

  const deleteProvider = async (id: string) => {
    try {
      const { error } = await supabase
        .from("hr_service_providers")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Prestador removido!");
      fetchProviders();
      return true;
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
      return false;
    }
  };

  return { providers, loading, refetch: fetchProviders, createProvider, updateProvider, deleteProvider };
}
