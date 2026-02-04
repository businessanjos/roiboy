import { supabase } from "@/integrations/supabase/client";

interface OnboardingAutomationParams {
  clientId: string;
  accountId: string;
  userId: string;
}

/**
 * Creates automatic onboarding items for a new client after lead conversion:
 * - 1 "Onboarding" event with client as participant
 * - 2 tasks: "Implementação da Clínica Ryka" and "Apresentação do Plano de Ação"
 */
export async function createClientOnboardingItems({
  clientId,
  accountId,
  userId,
}: OnboardingAutomationParams): Promise<void> {
  console.log("[OnboardingAutomation] Starting for client:", clientId);

  // STEP 1: Create "Onboarding" event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      account_id: accountId,
      title: "Onboarding",
      description: "Onboarding Inicial",
      event_type: "live",
      modality: "online",
      scheduled_at: null, // Empty - to be filled manually
      category: "operation",
      created_by: userId,
    })
    .select("id")
    .single();

  if (eventError) {
    console.error("[OnboardingAutomation] Error creating event:", eventError);
    throw eventError;
  }

  console.log("[OnboardingAutomation] Event created:", event.id);

  // STEP 2: Link client to event as participant (rsvp_status: 'pending' = "Não participou")
  const { error: participantError } = await supabase
    .from("event_participants")
    .insert({
      account_id: accountId,
      event_id: event.id,
      client_id: clientId,
      rsvp_status: "pending",
      invited_by: userId,
    });

  if (participantError) {
    console.error("[OnboardingAutomation] Error adding participant:", participantError);
    // Continue - don't block for participant error
  }

  // STEP 3: Fetch activity_types for tasks
  const { data: activityTypes } = await supabase
    .from("activity_types")
    .select("id, name")
    .eq("account_id", accountId)
    .in("name", ["Implementação da Clínica Ryka", "Apresentação do Plano de Ação"]);

  const implementacaoType = activityTypes?.find(
    (at) => at.name === "Implementação da Clínica Ryka"
  );
  const apresentacaoType = activityTypes?.find(
    (at) => at.name === "Apresentação do Plano de Ação"
  );

  console.log("[OnboardingAutomation] Activity types found:", {
    implementacao: implementacaoType?.id,
    apresentacao: apresentacaoType?.id,
  });

  // STEP 4: Create tasks
  const tasksToInsert = [
    {
      account_id: accountId,
      client_id: clientId,
      title: "Implementação da Clínica Ryka",
      description: null,
      activity_type_id: implementacaoType?.id || null,
      assigned_to: null, // Empty - to be filled manually
      due_date: null, // Empty - to be filled manually
      priority: "medium" as const,
      status: "pending" as const,
      created_by: userId,
    },
    {
      account_id: accountId,
      client_id: clientId,
      title: "Apresentação do Plano de Ação",
      description: "Reunião para apresenta o Plano de Ação e tirar dúvidas.",
      activity_type_id: apresentacaoType?.id || null,
      assigned_to: null, // Empty - to be filled manually
      due_date: null, // Empty - to be filled manually
      priority: "medium" as const,
      status: "pending" as const,
      created_by: userId,
    },
  ];

  const { error: tasksError } = await supabase
    .from("internal_tasks")
    .insert(tasksToInsert);

  if (tasksError) {
    console.error("[OnboardingAutomation] Error creating tasks:", tasksError);
    throw tasksError;
  }

  console.log("[OnboardingAutomation] Tasks created successfully");
  console.log("[OnboardingAutomation] Completed for client:", clientId);
}
