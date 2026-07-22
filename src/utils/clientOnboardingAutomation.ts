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

  // IDEMPOTÊNCIA: se já existirem tarefas com esses títulos pro cliente, não recriar.
  const AUTO_TITLES = [
    "Implementação da Clínica Ryka",
    "Apresentação do Plano de Ação",
  ];
  const { data: existing } = await supabase
    .from("internal_tasks")
    .select("title")
    .eq("client_id", clientId)
    .in("title", AUTO_TITLES);

  const existingTitles = new Set((existing || []).map((t) => t.title));
  const missingTitles = AUTO_TITLES.filter((t) => !existingTitles.has(t));

  if (missingTitles.length === 0) {
    console.log("[OnboardingAutomation] Tasks já existem, pulando criação:", clientId);
    return;
  }

  // STEP 1: Fetch activity_types apenas para os títulos que faltam
  const { data: activityTypes } = await supabase
    .from("activity_types")
    .select("id, name")
    .eq("account_id", accountId)
    .in("name", missingTitles);

  const typeByName = new Map((activityTypes || []).map((at) => [at.name, at.id]));

  const TASK_TEMPLATES: Record<string, { description: string | null }> = {
    "Implementação da Clínica Ryka": { description: null },
    "Apresentação do Plano de Ação": {
      description: "Reunião para apresenta o Plano de Ação e tirar dúvidas.",
    },
  };

  const tasksToInsert = missingTitles.map((title) => ({
    account_id: accountId,
    client_id: clientId,
    title,
    description: TASK_TEMPLATES[title]?.description ?? null,
    activity_type_id: typeByName.get(title) || null,
    assigned_to: null,
    due_date: null,
    priority: "medium" as const,
    status: "pending" as const,
    created_by: userId,
  }));

  const { error: tasksError } = await supabase
    .from("internal_tasks")
    .insert(tasksToInsert);

  if (tasksError) {
    console.error("[OnboardingAutomation] Error creating tasks:", tasksError);
    throw tasksError;
  }

  console.log("[OnboardingAutomation] Tasks created:", missingTitles, "para", clientId);

}
