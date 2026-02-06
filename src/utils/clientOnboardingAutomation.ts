import { supabase } from "@/integrations/supabase/client";

interface OnboardingAutomationParams {
  clientId: string;
  accountId: string;
  userId: string;
}

/**
 * Creates automatic onboarding tasks for a new client after lead conversion:
 * - "Implementação da Clínica Ryka"
 * - "Apresentação do Plano de Ação"
 */
export async function createClientOnboardingTasks({
  clientId,
  accountId,
  userId,
}: OnboardingAutomationParams): Promise<void> {
  console.log("[OnboardingAutomation] Starting for client:", clientId);

  // STEP 1: Fetch activity_types for tasks
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

  // STEP 2: Create tasks
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

  console.log("[OnboardingAutomation] Tasks created successfully for client:", clientId);
}
