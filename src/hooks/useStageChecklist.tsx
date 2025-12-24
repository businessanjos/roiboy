import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StageChecklistItem {
  id: string;
  stage_id: string;
  title: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
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

export function useToggleChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      checklistItemId,
      accountId,
      completed,
    }: {
      clientId: string;
      checklistItemId: string;
      accountId: string;
      completed: boolean;
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
    }: {
      stageId: string;
      title: string;
      description?: string;
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
    }: {
      itemId: string;
      title: string;
      description?: string;
    }) => {
      const { error } = await supabase
        .from("stage_checklist_items")
        .update({
          title,
          description: description || null,
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
