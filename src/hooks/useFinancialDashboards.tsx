import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import type { InsightsVisual } from "@/hooks/useInsightsDashboards";

export interface FinancialDashboard {
  id: string;
  name: string;
  folder: string | null;
  user_id: string;
  account_id: string;
  created_at: string | null;
  sector: string;
}

const SECTOR = "financeiro";
const FOLDER = "Financeiro";

export function useFinancialDashboards() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(null);

  const { data: dashboards = [], isLoading } = useQuery({
    queryKey: ["financial-dashboards", currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];
      const { data, error } = await (supabase
        .from("insights_dashboards")
        .select("*")
        .eq("account_id", currentUser.account_id) as any)
        .eq("sector", SECTOR)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as FinancialDashboard[];
    },
    enabled: !!currentUser?.account_id,
  });

  const effectiveId = activeDashboardId && dashboards.some(d => d.id === activeDashboardId)
    ? activeDashboardId
    : dashboards[0]?.id ?? null;

  const activeDashboard = useMemo(
    () => dashboards.find(d => d.id === effectiveId) ?? null,
    [dashboards, effectiveId]
  );

  const { data: visuals = [], isLoading: isLoadingVisuals } = useQuery({
    queryKey: ["financial-visuals", effectiveId],
    queryFn: async () => {
      if (!effectiveId) return [];
      const { data, error } = await supabase
        .from("insights_visuals")
        .select("*")
        .eq("dashboard_id", effectiveId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data.map(v => ({
        ...v,
        config: v.config as Record<string, any> | null,
        layout: v.layout as { x: number; y: number; w: number; h: number; scale?: number } | null,
      })) as InsightsVisual[];
    },
    enabled: !!effectiveId,
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!currentUser?.account_id || !currentUser?.id) throw new Error("Usuário não autenticado");
      const { data, error } = await supabase
        .from("insights_dashboards")
        .insert({ name, account_id: currentUser.account_id, user_id: currentUser.id, folder: FOLDER, sector: SECTOR } as any)
        .select()
        .single();
      if (error) throw error;
      return data as FinancialDashboard;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["financial-dashboards"] });
      setActiveDashboardId(d.id);
      toast.success("Painel criado com sucesso!");
    },
    onError: () => toast.error("Erro ao criar painel"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("insights_dashboards").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["financial-dashboards"] });
      if (deletedId === effectiveId) setActiveDashboardId(null);
      toast.success("Painel excluído");
    },
    onError: () => toast.error("Erro ao excluir painel"),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("insights_dashboards").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-dashboards"] });
      toast.success("Painel renomeado");
    },
    onError: () => toast.error("Erro ao renomear painel"),
  });

  const addVisualMutation = useMutation({
    mutationFn: async (visual: Omit<InsightsVisual, "id" | "created_at">) => {
      const { error } = await supabase.from("insights_visuals").insert({
        dashboard_id: visual.dashboard_id,
        title: visual.title,
        chart_type: visual.chart_type,
        config: visual.config,
        layout: visual.layout,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-visuals", effectiveId] });
      toast.success("Visual adicionado");
    },
    onError: () => toast.error("Erro ao adicionar visual"),
  });

  const removeVisualMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("insights_visuals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-visuals", effectiveId] });
      toast.success("Visual removido");
    },
    onError: () => toast.error("Erro ao remover visual"),
  });

  const updateVisualMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InsightsVisual> }) => {
      const { error } = await supabase.from("insights_visuals").update({
        title: updates.title,
        chart_type: updates.chart_type,
        config: updates.config,
        layout: updates.layout,
      }).eq("id", id);
      if (error) throw error;
      return { id, updates };
    },
    onSuccess: ({ id, updates }) => {
      const isLayoutOnly = Object.keys(updates).length === 1 && updates.layout !== undefined;
      if (isLayoutOnly) {
        queryClient.setQueryData(["financial-visuals", effectiveId], (old: InsightsVisual[] | undefined) => {
          if (!old) return old;
          return old.map(v => v.id === id ? { ...v, layout: updates.layout! } : v);
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["financial-visuals", effectiveId] });
      }
    },
    onError: () => toast.error("Erro ao atualizar visual"),
  });

  return {
    dashboards,
    activeDashboard,
    activeDashboardId: effectiveId,
    isLoading,
    visuals,
    isLoadingVisuals,
    setActiveDashboardId,
    createDashboard: useCallback(async (name: string) => { await createMutation.mutateAsync(name); }, [createMutation]),
    deleteDashboard: useCallback(async (id: string) => { await deleteMutation.mutateAsync(id); }, [deleteMutation]),
    renameDashboard: useCallback(async (id: string, name: string) => { await renameMutation.mutateAsync({ id, name }); }, [renameMutation]),
    addVisual: useCallback(async (visual: Omit<InsightsVisual, "id" | "created_at">) => { await addVisualMutation.mutateAsync(visual); }, [addVisualMutation]),
    removeVisual: useCallback(async (id: string) => { await removeVisualMutation.mutateAsync(id); }, [removeVisualMutation]),
    updateVisual: useCallback(async (id: string, updates: Partial<InsightsVisual>) => { await updateVisualMutation.mutateAsync({ id, updates }); }, [updateVisualMutation]),
    isCreating: createMutation.isPending,
  };
}
