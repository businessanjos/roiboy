import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

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
      // 1. Update target deal with merged data
      const { error: updateError } = await supabase
        .from("deals")
        .update({
          title: mergedData.title,
          value: mergedData.value,
          probability: mergedData.probability,
          expected_close_date: mergedData.expected_close_date,
          source: mergedData.source,
          responsible_user_id: mergedData.responsible_user_id,
          notes: mergedData.notes,
          tags: mergedData.tags,
        })
        .eq("id", targetDealId)
        .eq("account_id", currentUser.account_id);

      if (updateError) throw updateError;

      // 2. Transfer deal_activities from source to target
      const { error: activitiesError } = await supabase
        .from("deal_activities")
        .update({ deal_id: targetDealId })
        .eq("deal_id", sourceDealId)
        .eq("account_id", currentUser.account_id);

      if (activitiesError) {
        console.error("Error transferring activities:", activitiesError);
      }

      // 3. Transfer internal_tasks from source to target
      const { error: tasksError } = await supabase
        .from("internal_tasks")
        .update({ deal_id: targetDealId })
        .eq("deal_id", sourceDealId)
        .eq("account_id", currentUser.account_id);

      if (tasksError) {
        console.error("Error transferring tasks:", tasksError);
      }

      // 4. Transfer deal_field_values from source to target
      const { data: fieldValues } = await supabase
        .from("deal_field_values")
        .select("*")
        .eq("deal_id", sourceDealId)
        .eq("account_id", currentUser.account_id);

      if (fieldValues && fieldValues.length > 0) {
        // Get existing field values for target
        const { data: existingTargetValues } = await supabase
          .from("deal_field_values")
          .select("field_id")
          .eq("deal_id", targetDealId)
          .eq("account_id", currentUser.account_id);

        const existingFieldIds = new Set(existingTargetValues?.map(v => v.field_id) || []);

        // Only transfer field values that don't exist in target
        const valuesToTransfer = fieldValues.filter(v => !existingFieldIds.has(v.field_id));

        if (valuesToTransfer.length > 0) {
          const { error: transferError } = await supabase
            .from("deal_field_values")
            .insert(
              valuesToTransfer.map(v => ({
                ...v,
                id: undefined, // Let DB generate new ID
                deal_id: targetDealId,
              }))
            );

          if (transferError) {
            console.error("Error transferring field values:", transferError);
          }
        }
      }

      // 5. Add merge event to deal_activities
      const { error: mergeEventError } = await supabase
        .from("deal_activities")
        .insert({
          account_id: currentUser.account_id,
          deal_id: targetDealId,
          type: "note",
          title: "Negócio mesclado",
          content: `O negócio "${sourceDealTitle}" foi mesclado a este negócio. Todas as atividades e tarefas foram transferidas.`,
          user_id: currentUser.id,
        });

      if (mergeEventError) {
        console.error("Error creating merge event:", mergeEventError);
      }

      // 6. Delete the source deal
      const { error: deleteError } = await supabase
        .from("deals")
        .delete()
        .eq("id", sourceDealId)
        .eq("account_id", currentUser.account_id);

      if (deleteError) throw deleteError;

      toast.success("Negócios mesclados com sucesso!");
      return true;
    } catch (error: any) {
      console.error("Error merging deals:", error);
      toast.error("Erro ao mesclar negócios: " + error.message);
      return false;
    }
  };

  return { mergeDeals };
}
