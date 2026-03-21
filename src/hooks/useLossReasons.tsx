import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LossReason {
  id: string;
  name: string;
  display_order: number;
}

export interface LossSubReason {
  id: string;
  loss_reason_id: string;
  name: string;
  display_order: number;
}

export function useLossReasons() {
  const { data: reasons = [], isLoading: reasonsLoading } = useQuery({
    queryKey: ["deal-loss-reasons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_loss_reasons")
        .select("id, name, display_order")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as LossReason[];
    },
  });

  const { data: subReasons = [], isLoading: subReasonsLoading } = useQuery({
    queryKey: ["deal-loss-sub-reasons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_loss_sub_reasons")
        .select("id, loss_reason_id, name, display_order")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as LossSubReason[];
    },
  });

  const getSubReasons = (reasonId: string) =>
    subReasons.filter((s) => s.loss_reason_id === reasonId);

  return {
    reasons,
    subReasons,
    getSubReasons,
    isLoading: reasonsLoading || subReasonsLoading,
  };
}
