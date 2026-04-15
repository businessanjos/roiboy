import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface HRPartner {
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
  ownership_percentage: number | null;
  join_date: string | null;
  exit_date: string | null;
  pro_labore: number | null;
  status: string | null;
  avatar_url: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  nationality: string | null;
  profession: string | null;
  pis_pasep: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_pix_key: string | null;
  marital_property_regime: string | null;
  holding_cnpj: string | null;
  partner_type: string | null;
  social_contract_number: string | null;
  created_at: string;
  updated_at: string;
}

export type HRPartnerInsert = Omit<HRPartner, "id" | "created_at" | "updated_at">;

export function useHRPartners() {
  const { currentUser } = useCurrentUser();
  const [partners, setPartners] = useState<HRPartner[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPartners = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("hr_partners")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .order("full_name");

      if (error) throw error;
      setPartners((data || []) as unknown as HRPartner[]);
    } catch (err) {
      console.error("Error fetching partners:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const createPartner = async (data: Partial<HRPartnerInsert>) => {
    if (!currentUser?.account_id) return null;
    try {
      const { data: created, error } = await supabase
        .from("hr_partners")
        .insert({
          ...data,
          account_id: currentUser.account_id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      toast.success("Sócio cadastrado com sucesso!");
      fetchPartners();
      return created;
    } catch (err: any) {
      toast.error("Erro ao cadastrar sócio: " + err.message);
      return null;
    }
  };

  const updatePartner = async (id: string, data: Partial<HRPartner>, silent = false) => {
    try {
      const { id: _id, created_at, updated_at, ...updatePayload } = data as any;
      const { error } = await supabase
        .from("hr_partners")
        .update(updatePayload as any)
        .eq("id", id);

      if (error) throw error;
      if (!silent) toast.success("Sócio atualizado!");
      fetchPartners();
      return true;
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
      return false;
    }
  };

  const deletePartner = async (id: string) => {
    try {
      const { error } = await supabase
        .from("hr_partners")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Sócio removido!");
      fetchPartners();
      return true;
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
      return false;
    }
  };

  return { partners, loading, refetch: fetchPartners, createPartner, updatePartner, deletePartner };
}
