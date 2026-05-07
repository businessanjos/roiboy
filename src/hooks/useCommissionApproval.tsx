import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export type ApprovalAction =
  | "requested"
  | "approved"
  | "rejected"
  | "marked_paid"
  | "reverted"
  | "note";

export interface CommissionApprovalHistoryItem {
  id: string;
  entry_id: string;
  action: ApprovalAction;
  performed_by: string | null;
  performed_by_name: string | null;
  reason: string | null;
  previous_status: string | null;
  new_status: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export function useCommissionApproval(entryId?: string) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const accountId = currentUser?.account_id;

  const historyQuery = useQuery({
    queryKey: ["commission-approval-history", entryId],
    enabled: !!entryId && !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_approval_history" as any)
        .select("*")
        .eq("entry_id", entryId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CommissionApprovalHistoryItem[];
    },
  });

  const logAction = async (
    entry: { id: string; commission_status?: string; approval_status?: string },
    action: ApprovalAction,
    reason: string | null,
    newStatus: string,
  ) => {
    if (!accountId) throw new Error("Sem conta");
    const { error } = await supabase.from("commission_approval_history" as any).insert({
      account_id: accountId,
      entry_id: entry.id,
      action,
      performed_by: currentUser?.id ?? null,
      performed_by_name: currentUser?.name ?? currentUser?.email ?? null,
      reason: reason || null,
      previous_status: entry.approval_status ?? entry.commission_status ?? null,
      new_status: newStatus,
      metadata: {},
    });
    if (error) throw error;
  };

  const requestApproval = useMutation({
    mutationFn: async ({ entry, reason }: { entry: any; reason: string }) => {
      const { error } = await supabase
        .from("commission_deal_entries")
        .update({
          approval_status: "pending_approval",
          approval_requested_at: new Date().toISOString(),
          approval_requested_by: currentUser?.id ?? null,
          approval_requested_reason: reason || null,
        } as any)
        .eq("id", entry.id);
      if (error) throw error;
      await logAction(entry, "requested", reason, "pending_approval");
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message || "Erro ao solicitar aprovação"),
  });

  const approve = useMutation({
    mutationFn: async ({ entry, reason }: { entry: any; reason: string }) => {
      const { error } = await supabase
        .from("commission_deal_entries")
        .update({
          approval_status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: currentUser?.id ?? null,
          approval_reason: reason || null,
          commission_status: "paid",
          paid_at: new Date().toISOString(),
        } as any)
        .eq("id", entry.id);
      if (error) throw error;
      await logAction(entry, "approved", reason, "approved");
      await logAction(entry, "marked_paid", reason, "paid");
    },
    onSuccess: () => {
      invalidate();
      toast.success("Comissão aprovada e marcada como paga");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao aprovar"),
  });

  const reject = useMutation({
    mutationFn: async ({ entry, reason }: { entry: any; reason: string }) => {
      if (!reason?.trim()) throw new Error("Motivo da rejeição é obrigatório");
      const { error } = await supabase
        .from("commission_deal_entries")
        .update({
          approval_status: "rejected",
          rejected_at: new Date().toISOString(),
          rejected_by: currentUser?.id ?? null,
          rejection_reason: reason,
        } as any)
        .eq("id", entry.id);
      if (error) throw error;
      await logAction(entry, "rejected", reason, "rejected");
    },
    onSuccess: () => {
      invalidate();
      toast.success("Solicitação rejeitada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao rejeitar"),
  });

  const revert = useMutation({
    mutationFn: async ({ entry, reason }: { entry: any; reason: string }) => {
      if (!reason?.trim()) throw new Error("Motivo da reversão é obrigatório");
      const { error } = await supabase
        .from("commission_deal_entries")
        .update({
          approval_status: "not_requested",
          approval_requested_at: null,
          approval_requested_by: null,
          approval_requested_reason: null,
          approved_at: null,
          approved_by: null,
          approval_reason: null,
          rejected_at: null,
          rejected_by: null,
          rejection_reason: null,
          commission_status: "released",
          paid_at: null,
        } as any)
        .eq("id", entry.id);
      if (error) throw error;
      await logAction(entry, "reverted", reason, "released");
    },
    onSuccess: () => {
      invalidate();
      toast.success("Pagamento revertido");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao reverter"),
  });

  const addNote = useMutation({
    mutationFn: async ({ entry, reason }: { entry: any; reason: string }) => {
      if (!reason?.trim()) throw new Error("Anotação vazia");
      await logAction(entry, "note", reason, entry.approval_status || "not_requested");
    },
    onSuccess: () => {
      invalidate();
      toast.success("Anotação registrada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar anotação"),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["commission-approval-history"] });
    qc.invalidateQueries({ queryKey: ["commission-deal-entries"] });
    qc.invalidateQueries({ queryKey: ["commission-entries"] });
  }

  return {
    history: historyQuery.data ?? [],
    isLoading: historyQuery.isLoading,
    requestApproval,
    approve,
    reject,
    revert,
    addNote,
  };
}
