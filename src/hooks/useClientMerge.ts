import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface MergedClientData {
  full_name: string;
  phone_e164: string;
  email: string | null;
  emails: string[] | null;
  additional_phones: string[] | null;
  cpf: string | null;
  cnpj: string | null;
  instagram: string | null;
  instagrams: string[] | null;
  company_name: string | null;
  birth_date: string | null;
  notes: string | null;
  tags: string[];
  responsible_user_id: string | null;
  status: string;
  // Address
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

export function useClientMerge() {
  const { currentUser } = useCurrentUser();

  const mergeClients = async (
    sourceClientId: string,
    targetClientId: string,
    mergedData: MergedClientData,
    sourceClientName: string
  ): Promise<boolean> => {
    if (!currentUser?.account_id) {
      toast.error("Usuário não autenticado");
      return false;
    }

    try {
      // Step 0: Neutralize source client phone to avoid unique constraint conflict
      const { error: neutralizeError } = await supabase
        .from("clients")
        .update({ phone_e164: `+0000${Date.now()}` })
        .eq("id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (neutralizeError) throw neutralizeError;

      // 1. Update target client with merged data
      const { error: updateError } = await supabase
        .from("clients")
        .update({
          full_name: mergedData.full_name,
          phone_e164: mergedData.phone_e164,
          email: mergedData.email,
          emails: mergedData.emails,
          additional_phones: mergedData.additional_phones,
          cpf: mergedData.cpf,
          cnpj: mergedData.cnpj,
          instagram: mergedData.instagram,
          instagrams: mergedData.instagrams,
          company_name: mergedData.company_name,
          birth_date: mergedData.birth_date,
          notes: mergedData.notes,
          tags: mergedData.tags,
          responsible_user_id: mergedData.responsible_user_id,
          status: mergedData.status as "active" | "churn_risk" | "churned" | "no_contract" | "paused",
          zip_code: mergedData.zip_code,
          street: mergedData.street,
          street_number: mergedData.street_number,
          complement: mergedData.complement,
          neighborhood: mergedData.neighborhood,
          city: mergedData.city,
          state: mergedData.state,
        })
        .eq("id", targetClientId)
        .eq("account_id", currentUser.account_id);

      if (updateError) throw updateError;

      // 2. Transfer client_field_values from source to target
      const { data: fieldValues } = await supabase
        .from("client_field_values")
        .select("*")
        .eq("client_id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (fieldValues && fieldValues.length > 0) {
        // Get existing field values for target
        const { data: existingTargetValues } = await supabase
          .from("client_field_values")
          .select("field_id")
          .eq("client_id", targetClientId)
          .eq("account_id", currentUser.account_id);

        const existingFieldIds = new Set(existingTargetValues?.map(v => v.field_id) || []);

        // Only transfer field values that don't exist in target
        const valuesToTransfer = fieldValues.filter(v => !existingFieldIds.has(v.field_id));

        if (valuesToTransfer.length > 0) {
          const { error: transferError } = await supabase
            .from("client_field_values")
            .insert(
              valuesToTransfer.map(v => ({
                account_id: currentUser.account_id,
                client_id: targetClientId,
                field_id: v.field_id,
                value_text: v.value_text,
                value_number: v.value_number,
                value_boolean: v.value_boolean,
                value_date: v.value_date,
                value_json: v.value_json,
              }))
            );

          if (transferError) {
            console.error("Error transferring field values:", transferError);
          }
        }
      }

      // 3. Transfer client_followups (timeline/notes)
      const { error: followupsError } = await supabase
        .from("client_followups")
        .update({ client_id: targetClientId })
        .eq("client_id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (followupsError) {
        console.error("Error transferring followups:", followupsError);
      }

      // 4. Transfer client_life_events
      const { error: lifeEventsError } = await supabase
        .from("client_life_events")
        .update({ client_id: targetClientId })
        .eq("client_id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (lifeEventsError) {
        console.error("Error transferring life events:", lifeEventsError);
      }

      // 5. Transfer client_contracts
      const { error: contractsError } = await supabase
        .from("client_contracts")
        .update({ client_id: targetClientId })
        .eq("client_id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (contractsError) {
        console.error("Error transferring contracts:", contractsError);
      }

      // 6. Transfer deals that reference the source client
      const { error: dealsError } = await supabase
        .from("deals")
        .update({ client_id: targetClientId })
        .eq("client_id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (dealsError) {
        console.error("Error transferring deals:", dealsError);
      }

      // 7. Transfer zapp_conversations (WhatsApp)
      const { error: conversationsError } = await supabase
        .from("zapp_conversations")
        .update({ client_id: targetClientId })
        .eq("client_id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (conversationsError) {
        console.error("Error transferring conversations:", conversationsError);
      }

      // 8. Transfer client_subscriptions
      const { error: subscriptionsError } = await supabase
        .from("client_subscriptions")
        .update({ client_id: targetClientId })
        .eq("client_id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (subscriptionsError) {
        console.error("Error transferring subscriptions:", subscriptionsError);
      }

      // 9. Transfer event_participants
      const { error: participantsError } = await supabase
        .from("event_participants")
        .update({ client_id: targetClientId })
        .eq("client_id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (participantsError) {
        console.error("Error transferring event participants:", participantsError);
      }

      // 10. Transfer internal_tasks
      const { error: tasksError } = await supabase
        .from("internal_tasks")
        .update({ client_id: targetClientId })
        .eq("client_id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (tasksError) {
        console.error("Error transferring tasks:", tasksError);
      }

      // 11. Transfer client_form_sends
      const { error: formSendsError } = await supabase
        .from("client_form_sends")
        .update({ client_id: targetClientId })
        .eq("client_id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (formSendsError) {
        console.error("Error transferring form sends:", formSendsError);
      }

      // 12. Transfer attendance records
      const { error: attendanceError } = await supabase
        .from("attendance")
        .update({ client_id: targetClientId })
        .eq("client_id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (attendanceError) {
        console.error("Error transferring attendance:", attendanceError);
      }


      // 15. Transfer boletos
      const { error: boletosError } = await supabase
        .from("boletos")
        .update({ client_id: targetClientId })
        .eq("client_id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (boletosError) {
        console.error("Error transferring boletos:", boletosError);
      }

      // 16. Transfer client_diagnostics (if exists - one to one)
      const { data: sourceDiagnostics } = await supabase
        .from("client_diagnostics")
        .select("*")
        .eq("client_id", sourceClientId)
        .eq("account_id", currentUser.account_id)
        .maybeSingle();

      if (sourceDiagnostics) {
        // Check if target has diagnostics
        const { data: targetDiagnostics } = await supabase
          .from("client_diagnostics")
          .select("id")
          .eq("client_id", targetClientId)
          .eq("account_id", currentUser.account_id)
          .maybeSingle();

        if (!targetDiagnostics) {
          // Transfer by update
          await supabase
            .from("client_diagnostics")
            .update({ client_id: targetClientId })
            .eq("client_id", sourceClientId)
            .eq("account_id", currentUser.account_id);
        } else {
          // Just delete source diagnostics
          await supabase
            .from("client_diagnostics")
            .delete()
            .eq("client_id", sourceClientId)
            .eq("account_id", currentUser.account_id);
        }
      }

      // 17. Handle client_relationships
      // Update where source is primary_client_id (avoiding self-reference)
      await supabase
        .from("client_relationships")
        .update({ primary_client_id: targetClientId })
        .eq("primary_client_id", sourceClientId)
        .eq("account_id", currentUser.account_id)
        .neq("related_client_id", targetClientId);

      // Update where source is related_client_id (avoiding self-reference)
      await supabase
        .from("client_relationships")
        .update({ related_client_id: targetClientId })
        .eq("related_client_id", sourceClientId)
        .eq("account_id", currentUser.account_id)
        .neq("primary_client_id", targetClientId);

      // Delete any self-referencing relationships
      await supabase
        .from("client_relationships")
        .delete()
        .eq("account_id", currentUser.account_id)
        .or(`and(primary_client_id.eq.${targetClientId},related_client_id.eq.${targetClientId}),and(primary_client_id.eq.${sourceClientId},related_client_id.eq.${sourceClientId})`);

      // 18. Transfer client_products (merge product associations)
      const { data: sourceProducts } = await supabase
        .from("client_products")
        .select("product_id")
        .eq("client_id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (sourceProducts && sourceProducts.length > 0) {
        const { data: targetProducts } = await supabase
          .from("client_products")
          .select("product_id")
          .eq("client_id", targetClientId)
          .eq("account_id", currentUser.account_id);

        const existingProductIds = new Set(targetProducts?.map(p => p.product_id) || []);
        const productsToAdd = sourceProducts.filter(p => !existingProductIds.has(p.product_id));

        if (productsToAdd.length > 0) {
          await supabase
            .from("client_products")
            .insert(
              productsToAdd.map(p => ({
                account_id: currentUser.account_id,
                client_id: targetClientId,
                product_id: p.product_id,
              }))
            );
        }

        // Delete source client products
        await supabase
          .from("client_products")
          .delete()
          .eq("client_id", sourceClientId)
          .eq("account_id", currentUser.account_id);
      }

      // 19. Add merge note to target client's followups
      await supabase
        .from("client_followups")
        .insert({
          account_id: currentUser.account_id,
          client_id: targetClientId,
          user_id: currentUser.id,
          type: "note",
          title: "Cliente mesclado",
          content: `O cliente "${sourceClientName}" foi mesclado a este cliente. Todos os dados e histórico foram transferidos.`,
        });

      // 20. Finally, delete the source client
      const { error: deleteError } = await supabase
        .from("clients")
        .delete()
        .eq("id", sourceClientId)
        .eq("account_id", currentUser.account_id);

      if (deleteError) throw deleteError;

      toast.success("Clientes mesclados com sucesso!");
      return true;
    } catch (error: any) {
      console.error("Error merging clients:", error);
      toast.error("Erro ao mesclar clientes: " + error.message);
      return false;
    }
  };

  return { mergeClients };
}
