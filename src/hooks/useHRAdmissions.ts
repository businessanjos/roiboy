import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export type AdmissionStage =
  | "accepted"
  | "documents"
  | "medical_exam"
  | "contract"
  | "onboarding"
  | "admitted";

export const ADMISSION_STAGES: AdmissionStage[] = [
  "accepted",
  "documents",
  "medical_exam",
  "contract",
  "onboarding",
  "admitted",
];

export const ADMISSION_STAGE_LABELS: Record<AdmissionStage, string> = {
  accepted: "Proposta Aceita",
  documents: "Documentos Solicitados",
  medical_exam: "Exame Admissional",
  contract: "Contrato Assinado",
  onboarding: "Integração Agendada",
  admitted: "Admitido",
};

export const ADMISSION_STAGE_COLORS: Record<AdmissionStage, string> = {
  accepted: "bg-indigo-500/10 text-indigo-700 border-indigo-200",
  documents: "bg-amber-500/10 text-amber-700 border-amber-200",
  medical_exam: "bg-rose-500/10 text-rose-700 border-rose-200",
  contract: "bg-blue-500/10 text-blue-700 border-blue-200",
  onboarding: "bg-violet-500/10 text-violet-700 border-violet-200",
  admitted: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
};

export interface HRAdmission {
  id: string;
  account_id: string;
  offer_id: string | null;
  job_id: string | null;
  candidate_name: string;
  candidate_email: string | null;
  candidate_phone: string | null;
  candidate_photo_url: string | null;
  position_title: string | null;
  department: string | null;
  contract_type: string;
  start_date: string | null;
  stage: AdmissionStage;
  exam_clinic: string | null;
  exam_scheduled_at: string | null;
  exam_result: string | null;
  exam_done_at: string | null;
  contract_signed_at: string | null;
  onboarding_scheduled_at: string | null;
  admitted_at: string | null;
  notes: string | null;
  responsible_user_id: string | null;
  public_token: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}


export interface HRAdmissionDocument {
  id: string;
  admission_id: string;
  doc_key: string;
  label: string;
  required: boolean;
  status: "pending" | "received" | "approved" | "rejected";
  file_url: string | null;
  file_name: string | null;
  uploaded_at: string | null;
  uploaded_via: "rh" | "candidate" | null;
  attachments: Array<{ name: string; url: string; path: string | null; uploaded_at: string | null; uploaded_via: "rh" | "candidate" | null }> | null;
  notes: string | null;
  sort_order: number;
}

export function useHRAdmissions() {
  const { currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ["hr-admissions", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_admissions" as any)
        .select("*")
        .eq("account_id", currentUser!.account_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as HRAdmission[];
    },
  });
}

export function useHRAdmission(id: string | undefined) {
  return useQuery({
    queryKey: ["hr-admission", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_admissions" as any)
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as HRAdmission | null;
    },
  });
}

export function useHRAdmissionDocuments(admissionId: string | undefined) {
  return useQuery({
    queryKey: ["hr-admission-docs", admissionId],
    enabled: !!admissionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_admission_documents" as any)
        .select("*")
        .eq("admission_id", admissionId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as HRAdmissionDocument[];
    },
  });
}

export function useUpdateAdmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<HRAdmission>) => {
      const { error } = await supabase.from("hr_admissions" as any).update(patch as any).eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["hr-admissions"] });
      qc.invalidateQueries({ queryKey: ["hr-admission", id] });
    },
    onError: (e: any) => toast.error("Erro ao atualizar admissão: " + e.message),
  });
}

export function useUpdateAdmissionDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, admission_id, ...patch }: { id: string; admission_id: string } & Partial<HRAdmissionDocument>) => {
      const { error } = await supabase.from("hr_admission_documents" as any).update(patch as any).eq("id", id);
      if (error) throw error;
      return admission_id;
    },
    onSuccess: (admission_id) => {
      qc.invalidateQueries({ queryKey: ["hr-admission-docs", admission_id] });
    },
    onError: (e: any) => toast.error("Erro ao atualizar documento: " + e.message),
  });
}

export function useDeleteAdmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_admissions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-admissions"] });
      toast.success("Admissão removida");
    },
    onError: (e: any) => toast.error("Erro ao remover: " + e.message),
  });
}
