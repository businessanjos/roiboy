import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export interface MergedDealData {
  title: string;
  value: number;
  probability: number;
  expected_close_date: string | null;
  source: string | null;
  responsible_user_id: string | null;
  notes: string | null;
  tags: string[];
}

export function useDealMerge() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const undoMerge = async (actionId: string): Promise<boolean> => {
    const { error } = await supabase.rpc("undo_deal_merge", { p_action: actionId });
    if (error) {
      toast.error(error.message.includes("alterações após")
        ? "Os negócios foram alterados depois da mesclagem. Para não perder informações, não é possível desfazer automaticamente."
        : "Não foi possível desfazer esta mesclagem. Confira seu acesso e tente novamente.");
      return false;
    }
    await queryClient.invalidateQueries();
    toast.success("Mesclagem desfeita. Os dois negócios foram restaurados.");
    return true;
  };

  const mergeDeals = async (
    sourceDealId: string,
    targetDealId: string,
    mergedData: MergedDealData,
    sourceDealTitle: string
  ): Promise<boolean> => {
    if (!currentUser?.account_id) {
      toast.error("Usuário não autenticado");
      return false;
    }

    try {
      const { data: actionId, error } = await supabase.rpc("merge_deals_reversible", {
        p_source: sourceDealId,
        p_target: targetDealId,
        p_data: { ...mergedData },
      });
      if (error) throw error;
      if (!actionId) throw new Error("Mesclagem não confirmada");
      await queryClient.invalidateQueries();
      toast.success("Negócios mesclados com sucesso!", {
        duration: 15000,
        action: { label: "Desfazer", onClick: () => { void undoMerge(actionId); } },
      });
      return true;
    } catch (error: any) {
      console.error("Error merging deals:", error);
      toast.error("Não foi possível mesclar os negócios. Nenhuma mudança foi salva. Confira seu acesso e tente novamente.");
      return false;
    }
  };

  return { mergeDeals, undoMerge };
}
