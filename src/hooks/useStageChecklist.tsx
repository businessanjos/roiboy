import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StageChecklistItem {
  id: string;
  stage_id: string;
  title: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  due_date: string | null;
  linked_task_id: string | null;
}

export interface ClientChecklistProgress {
  id: string;
  client_id: string;
  checklist_item_id: string;
  completed_at: string | null;
  completed_by: string | null;
}

export function useStageChecklistItems(stageIds: string[]) {
  return useQuery({
    queryKey: ["stage-checklist-items", stageIds],
    queryFn: async () => {
      if (stageIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("stage_checklist_items")
        .select("*")
        .in("stage_id", stageIds)
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      return data as StageChecklistItem[];
    },
    enabled: stageIds.length > 0,
  });
}

export function useClientChecklistProgress(clientIds: string[]) {
  return useQuery({
    queryKey: ["client-checklist-progress", clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("client_stage_checklist")
        .select("*")
        .in("client_id", clientIds);

      if (error) throw error;
      return data as ClientChecklistProgress[];
    },
    enabled: clientIds.length > 0,
  });
}

export function useToggleChecklistItem(options?: {
  onChecklistComplete?: (clientId: string, currentStageId: string | null) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      checklistItemId,
      accountId,
      completed,
      currentStageId,
      allStageItems,
      allProgress,
    }: {
      clientId: string;
      checklistItemId: string;
      accountId: string;
      completed: boolean;
      currentStageId?: string | null;
      allStageItems?: StageChecklistItem[];
      allProgress?: ClientChecklistProgress[];
    }) => {
      if (completed) {
        // Mark as completed
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("client_stage_checklist")
          .upsert({
            client_id: clientId,
            checklist_item_id: checklistItemId,
            account_id: accountId,
            completed_at: new Date().toISOString(),
            completed_by: user?.id,
          }, {
            onConflict: "client_id,checklist_item_id",
          });

        if (error) throw error;

        // Check if checklist is now complete for current stage
        if (currentStageId && allStageItems && allProgress && options?.onChecklistComplete) {
          const stageItems = allStageItems.filter(item => item.stage_id === currentStageId);
          const clientProgress = allProgress.filter(p => p.client_id === clientId);
          
          // Add the item we just completed to the count
          const completedCount = stageItems.filter(item => 
            item.id === checklistItemId || clientProgress.some(p => p.checklist_item_id === item.id && p.completed_at)
          ).length;

          if (stageItems.length > 0 && completedCount === stageItems.length) {
            options.onChecklistComplete(clientId, currentStageId);
          }
        }
      } else {
        // Mark as incomplete (delete the record)
        const { error } = await supabase
          .from("client_stage_checklist")
          .delete()
          .eq("client_id", clientId)
          .eq("checklist_item_id", checklistItemId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-checklist-progress"] });
    },
  });
}

export function useManageChecklistItems(accountId: string) {
  const queryClient = useQueryClient();

  const addItem = useMutation({
    mutationFn: async ({
      stageId,
      title,
      description,
      dueDate,
    }: {
      stageId: string;
      title: string;
      description?: string;
      dueDate?: string;
    }) => {
      // Get max display_order
      const { data: existingItems } = await supabase
        .from("stage_checklist_items")
        .select("display_order")
        .eq("stage_id", stageId)
        .order("display_order", { ascending: false })
        .limit(1);

      const maxOrder = existingItems?.[0]?.display_order ?? -1;

      const { error } = await supabase
        .from("stage_checklist_items")
        .insert({
          account_id: accountId,
          stage_id: stageId,
          title,
          description: description || null,
          due_date: dueDate || null,
          display_order: maxOrder + 1,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-checklist-items"] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({
      itemId,
      title,
      description,
      dueDate,
    }: {
      itemId: string;
      title: string;
      description?: string;
      dueDate?: string | null;
    }) => {
      const { error } = await supabase
        .from("stage_checklist_items")
        .update({
          title,
          description: description || null,
          due_date: dueDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-checklist-items"] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("stage_checklist_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-checklist-items"] });
    },
  });

  return { addItem, updateItem, deleteItem };
}

// Create or update linked task for a checklist item
export async function syncChecklistToTask({
  checklistItem,
  clientId,
  clientName,
  accountId,
  stageName,
}: {
  checklistItem: StageChecklistItem;
  clientId: string;
  clientName: string;
  accountId: string;
  stageName: string;
}): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get user record
  const { data: userData } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!userData) return null;

  // Check if task already exists
  if (checklistItem.linked_task_id) {
    // Update existing task
    await supabase
      .from("internal_tasks")
      .update({
        title: `[${stageName}] ${checklistItem.title}`,
        description: checklistItem.description || `Item do checklist de onboarding: ${checklistItem.title}`,
        due_date: checklistItem.due_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", checklistItem.linked_task_id);

    return checklistItem.linked_task_id;
  }

  // Create new task
  const { data: newTask, error } = await supabase
    .from("internal_tasks")
    .insert({
      account_id: accountId,
      title: `[${stageName}] ${checklistItem.title}`,
      description: checklistItem.description || `Item do checklist de onboarding: ${checklistItem.title}`,
      status: "pending",
      priority: "medium",
      due_date: checklistItem.due_date,
      client_id: clientId,
      created_by: userData.id,
      checklist_item_id: checklistItem.id,
    })
    .select("id")
    .single();

  if (error || !newTask) return null;

  // Link task back to checklist item
  await supabase
    .from("stage_checklist_items")
    .update({ linked_task_id: newTask.id })
    .eq("id", checklistItem.id);

  return newTask.id;
}

// Hook to sync checklist items to tasks for a specific client
export function useSyncChecklistToTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      items,
      clientId,
      clientName,
      accountId,
      stageName,
    }: {
      items: StageChecklistItem[];
      clientId: string;
      clientName: string;
      accountId: string;
      stageName: string;
    }) => {
      // Only sync items that have due dates
      const itemsWithDates = items.filter(item => item.due_date);
      
      for (const item of itemsWithDates) {
        await syncChecklistToTask({
          checklistItem: item,
          clientId,
          clientName,
          accountId,
          stageName,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-checklist-items"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// Helper to calculate checklist completion status
export function getChecklistStatus(
  clientId: string,
  stageId: string,
  allItems: StageChecklistItem[],
  allProgress: ClientChecklistProgress[]
) {
  const stageItems = allItems.filter(item => item.stage_id === stageId);
  const clientProgress = allProgress.filter(p => p.client_id === clientId);
  
  const completedCount = stageItems.filter(item => 
    clientProgress.some(p => p.checklist_item_id === item.id && p.completed_at)
  ).length;

  return {
    total: stageItems.length,
    completed: completedCount,
    isComplete: stageItems.length > 0 && completedCount === stageItems.length,
    hasItems: stageItems.length > 0,
  };
}

// Check if client has pending items in previous stages
export function hasPendingInPreviousStages(
  clientId: string,
  currentStageOrder: number,
  stages: { id: string; display_order: number }[],
  allItems: StageChecklistItem[],
  allProgress: ClientChecklistProgress[]
): boolean {
  const previousStages = stages.filter(s => s.display_order < currentStageOrder);
  
  for (const stage of previousStages) {
    const status = getChecklistStatus(clientId, stage.id, allItems, allProgress);
    if (status.hasItems && !status.isComplete) {
      return true;
    }
  }
  
  return false;
}

// Get next stage after current stage
export function getNextStage(
  currentStageId: string | null,
  stages: { id: string; display_order: number }[]
): { id: string; display_order: number } | null {
  if (!currentStageId) {
    // If no current stage, return first stage
    const sortedStages = [...stages].sort((a, b) => a.display_order - b.display_order);
    return sortedStages[0] || null;
  }
  
  const currentStage = stages.find(s => s.id === currentStageId);
  if (!currentStage) return null;
  
  const nextStages = stages
    .filter(s => s.display_order > currentStage.display_order)
    .sort((a, b) => a.display_order - b.display_order);
  
  return nextStages[0] || null;
}
