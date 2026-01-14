import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import type { MergedLeadData } from "@/components/leads/MergeLeadDialog";

export function useLeadMerge() {
  const { currentUser } = useCurrentUser();

  const mergeLeads = async (
    sourceLeadId: string,
    targetLeadId: string,
    mergedData: MergedLeadData,
    sourceLeadName: string
  ): Promise<boolean> => {
    if (!currentUser?.account_id) {
      toast.error("Usuário não autenticado");
      return false;
    }

    try {
      // 1. Update target lead with merged data
      const { error: updateError } = await supabase
        .from("leads")
        .update({
          full_name: mergedData.full_name,
          phone: mergedData.phone,
          email: mergedData.email,
          emails: mergedData.emails,
          additional_phones: mergedData.additional_phones,
          instagram: mergedData.instagram,
          instagrams: mergedData.instagrams,
          source: mergedData.source,
          notes: mergedData.notes,
          status: mergedData.status,
          tags: mergedData.tags,
          revenue_range: mergedData.revenue_range,
          responsible_user_id: mergedData.responsible_user_id,
        })
        .eq("id", targetLeadId)
        .eq("account_id", currentUser.account_id);

      if (updateError) throw updateError;

      // 2. Transfer lead_field_values from source to target
      const { data: fieldValues } = await supabase
        .from("lead_field_values")
        .select("*")
        .eq("lead_id", sourceLeadId)
        .eq("account_id", currentUser.account_id);

      if (fieldValues && fieldValues.length > 0) {
        // Get existing field values for target
        const { data: existingTargetValues } = await supabase
          .from("lead_field_values")
          .select("field_id")
          .eq("lead_id", targetLeadId)
          .eq("account_id", currentUser.account_id);

        const existingFieldIds = new Set(existingTargetValues?.map(v => v.field_id) || []);

        // Only transfer field values that don't exist in target
        const valuesToTransfer = fieldValues.filter(v => !existingFieldIds.has(v.field_id));

        if (valuesToTransfer.length > 0) {
          const { error: transferError } = await supabase
            .from("lead_field_values")
            .insert(
              valuesToTransfer.map(v => ({
                ...v,
                id: undefined, // Let DB generate new ID
                lead_id: targetLeadId,
              }))
            );

          if (transferError) {
            console.error("Error transferring field values:", transferError);
          }
        }
      }

      // 3. Transfer lead timeline events (if exists)
      const { error: timelineError } = await supabase
        .from("lead_timeline")
        .update({ lead_id: targetLeadId })
        .eq("lead_id", sourceLeadId)
        .eq("account_id", currentUser.account_id);

      if (timelineError) {
        console.error("Error transferring timeline:", timelineError);
      }

      // 4. Update deals that reference the source lead
      const { error: dealsError } = await supabase
        .from("deals")
        .update({ lead_id: targetLeadId })
        .eq("lead_id", sourceLeadId)
        .eq("account_id", currentUser.account_id);

      if (dealsError) {
        console.error("Error updating deals:", dealsError);
      }

      // 5. Add merge event to timeline
      const { error: mergeEventError } = await supabase
        .from("lead_timeline")
        .insert({
          account_id: currentUser.account_id,
          lead_id: targetLeadId,
          event_type: "note",
          title: "Lead mesclado",
          description: `O lead "${sourceLeadName}" foi mesclado a este lead.`,
          user_id: currentUser.id,
          metadata: {
            type: "merge",
            merged_lead_id: sourceLeadId,
            merged_lead_name: sourceLeadName,
            merged_at: new Date().toISOString(),
          },
        });

      if (mergeEventError) {
        console.error("Error creating merge event:", mergeEventError);
      }

      // 6. Delete the source lead
      const { error: deleteError } = await supabase
        .from("leads")
        .delete()
        .eq("id", sourceLeadId)
        .eq("account_id", currentUser.account_id);

      if (deleteError) throw deleteError;

      toast.success("Leads mesclados com sucesso!");
      return true;
    } catch (error: any) {
      console.error("Error merging leads:", error);
      toast.error("Erro ao mesclar leads: " + error.message);
      return false;
    }
  };

  return { mergeLeads };
}
