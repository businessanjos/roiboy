import { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

// Types based on Supabase schema
export interface InsightsDashboard {
  id: string;
  name: string;
  folder: string | null;
  user_id: string;
  account_id: string;
  created_at: string | null;
}

export interface InsightsVisual {
  id: string;
  dashboard_id: string;
  title: string | null;
  chart_type: string | null;
  config: Record<string, any> | null;
  layout: { x: number; y: number; w: number; h: number; scale?: number } | null;
  created_at: string | null;
}

interface InsightsDashboardsContextType {
  // Dashboard state
  dashboards: InsightsDashboard[];
  activeDashboard: InsightsDashboard | null;
  activeDashboardId: string | null;
  isLoading: boolean;
  
  // Visual state
  visuals: InsightsVisual[];
  isLoadingVisuals: boolean;
  
  // Dashboard actions
  createDashboard: (name: string) => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;
  renameDashboard: (id: string, name: string) => Promise<void>;
  duplicateDashboard: (id: string) => Promise<void>;
  reorderDashboards: (orderedIds: string[]) => Promise<void>;
  navigateToDashboard: (id: string) => void;
  setActiveDashboardId: (id: string | null) => void;
  
  // Visual actions
  addVisual: (visual: Omit<InsightsVisual, "id" | "created_at">) => Promise<void>;
  removeVisual: (id: string) => Promise<void>;
  updateVisual: (id: string, updates: Partial<InsightsVisual>) => Promise<void>;
  
  // Mutations loading state
  isCreating: boolean;
}

const InsightsDashboardsContext = createContext<InsightsDashboardsContextType | null>(null);

interface InsightsDashboardsProviderProps {
  children: ReactNode;
}

export function InsightsDashboardsProvider({ children }: InsightsDashboardsProviderProps) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { dashboardId } = useParams<{ dashboardId?: string }>();
  
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(dashboardId || null);

  // Sync URL param with state
  useEffect(() => {
    if (dashboardId && dashboardId !== activeDashboardId) {
      setActiveDashboardId(dashboardId);
    }
  }, [dashboardId]);

  // Fetch dashboards
  const { data: dashboards = [], isLoading } = useQuery({
    queryKey: ["insights-dashboards", currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];
      
      const { data, error } = await (supabase
        .from("insights_dashboards")
        .select("*")
        .eq("account_id", currentUser.account_id) as any)
        .eq("sector", "vendas")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as InsightsDashboard[];
    },
    enabled: !!currentUser?.account_id,
  });

  // Fetch visuals for active dashboard
  const { data: visuals = [], isLoading: isLoadingVisuals } = useQuery({
    queryKey: ["insights-visuals", activeDashboardId],
    queryFn: async () => {
      if (!activeDashboardId) return [];
      
      const { data, error } = await supabase
        .from("insights_visuals")
        .select("*")
        .eq("dashboard_id", activeDashboardId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data.map(v => ({
        ...v,
        config: v.config as Record<string, any> | null,
        layout: v.layout as { x: number; y: number; w: number; h: number; scale?: number } | null,
      })) as InsightsVisual[];
    },
    enabled: !!activeDashboardId,
  });

  // Auto-select first dashboard if none selected
  useEffect(() => {
    if (!isLoading && dashboards.length > 0 && !activeDashboardId && !dashboardId) {
      const firstDashboard = dashboards[0];
      navigate(`/insights/${firstDashboard.id}`, { replace: true });
    }
  }, [isLoading, dashboards, activeDashboardId, dashboardId, navigate]);

  // Active dashboard computed
  const activeDashboard = useMemo(() => {
    if (!activeDashboardId) return null;
    return dashboards.find(d => d.id === activeDashboardId) || null;
  }, [dashboards, activeDashboardId]);

  // Create dashboard mutation
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!currentUser?.account_id || !currentUser?.id) {
        throw new Error("Usuário não autenticado");
      }
      
      const { data, error } = await supabase
        .from("insights_dashboards")
        .insert({
          name,
          account_id: currentUser.account_id,
          user_id: currentUser.id,
          folder: "Meus Painéis",
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as InsightsDashboard;
    },
    onSuccess: (newDashboard) => {
      queryClient.invalidateQueries({ queryKey: ["insights-dashboards"] });
      toast.success("Painel criado com sucesso!");
      navigate(`/insights/${newDashboard.id}`);
    },
    onError: (error) => {
      console.error("Error creating dashboard:", error);
      toast.error("Erro ao criar painel");
    },
  });

  // Delete dashboard mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("insights_dashboards")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["insights-dashboards"] });
      toast.success("Painel excluído");
      
      // If deleted the active dashboard, navigate to first remaining or /insights
      if (deletedId === activeDashboardId) {
        const remaining = dashboards.filter(d => d.id !== deletedId);
        if (remaining.length > 0) {
          navigate(`/insights/${remaining[0].id}`, { replace: true });
        } else {
          navigate("/insights", { replace: true });
          setActiveDashboardId(null);
        }
      }
    },
    onError: (error) => {
      console.error("Error deleting dashboard:", error);
      toast.error("Erro ao excluir painel");
    },
  });

  // Rename dashboard mutation
  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("insights_dashboards")
        .update({ name })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insights-dashboards"] });
      toast.success("Painel renomeado");
    },
    onError: (error) => {
      console.error("Error renaming dashboard:", error);
      toast.error("Erro ao renomear painel");
    },
  });

  // Add visual mutation
  const addVisualMutation = useMutation({
    mutationFn: async (visual: Omit<InsightsVisual, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("insights_visuals")
        .insert({
          dashboard_id: visual.dashboard_id,
          title: visual.title,
          chart_type: visual.chart_type,
          config: visual.config,
          layout: visual.layout,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insights-visuals", activeDashboardId] });
      toast.success("Visual adicionado");
    },
    onError: (error) => {
      console.error("Error adding visual:", error);
      toast.error("Erro ao adicionar visual");
    },
  });

  // Remove visual mutation
  const removeVisualMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("insights_visuals")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insights-visuals", activeDashboardId] });
      toast.success("Visual removido");
    },
    onError: (error) => {
      console.error("Error removing visual:", error);
      toast.error("Erro ao remover visual");
    },
  });

  // Update visual mutation
  const updateVisualMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InsightsVisual> }) => {
      const { error } = await supabase
        .from("insights_visuals")
        .update({
          title: updates.title,
          chart_type: updates.chart_type,
          config: updates.config,
          layout: updates.layout,
        })
        .eq("id", id);
      
      if (error) throw error;
      return { id, updates };
    },
    onSuccess: ({ id, updates }) => {
      const isLayoutOnly = Object.keys(updates).length === 1 && updates.layout !== undefined;
      
      if (isLayoutOnly) {
        // Optimistic update: patch cache directly without refetch to prevent snap-back
        queryClient.setQueryData(
          ["insights-visuals", activeDashboardId],
          (old: InsightsVisual[] | undefined) => {
            if (!old) return old;
            return old.map(v => v.id === id ? { ...v, layout: updates.layout! } : v);
          }
        );
      } else {
        queryClient.invalidateQueries({ queryKey: ["insights-visuals", activeDashboardId] });
      }
    },
    onError: (error) => {
      console.error("Error updating visual:", error);
      toast.error("Erro ao atualizar visual");
    },
  });

  // Duplicate dashboard mutation
  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentUser?.account_id || !currentUser?.id) {
        throw new Error("Usuário não autenticado");
      }

      // Get original dashboard
      const original = dashboards.find(d => d.id === id);
      if (!original) throw new Error("Painel não encontrado");

      // Create new dashboard
      const { data: newDashboard, error: dashError } = await supabase
        .from("insights_dashboards")
        .insert({
          name: `${original.name} (cópia)`,
          account_id: currentUser.account_id,
          user_id: currentUser.id,
          folder: original.folder,
        })
        .select()
        .single();

      if (dashError) throw dashError;

      // Copy visuals
      const { data: originalVisuals, error: visualsError } = await supabase
        .from("insights_visuals")
        .select("*")
        .eq("dashboard_id", id);

      if (visualsError) throw visualsError;

      if (originalVisuals && originalVisuals.length > 0) {
        const copies = originalVisuals.map(v => ({
          dashboard_id: (newDashboard as any).id,
          title: v.title,
          chart_type: v.chart_type,
          config: v.config,
          layout: v.layout,
        }));

        const { error: copyError } = await supabase
          .from("insights_visuals")
          .insert(copies);

        if (copyError) throw copyError;
      }

      return newDashboard as InsightsDashboard;
    },
    onSuccess: (newDashboard) => {
      queryClient.invalidateQueries({ queryKey: ["insights-dashboards"] });
      toast.success("Painel duplicado com sucesso!");
      navigate(`/insights/${newDashboard.id}`);
    },
    onError: (error) => {
      console.error("Error duplicating dashboard:", error);
      toast.error("Erro ao duplicar painel");
    },
  });

  // Reorder dashboards mutation
  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase
          .from("insights_dashboards")
          .update({ display_order: index } as any)
          .eq("id", id)
      );
      const results = await Promise.all(updates);
      const failed = results.find(r => r.error);
      if (failed?.error) throw failed.error;
    },
    onError: (error) => {
      console.error("Error reordering dashboards:", error);
      toast.error("Erro ao reordenar painéis");
      queryClient.invalidateQueries({ queryKey: ["insights-dashboards"] });
    },
  });

  // Action handlers
  const createDashboard = useCallback(async (name: string) => {
    await createMutation.mutateAsync(name);
  }, [createMutation]);

  const deleteDashboard = useCallback(async (id: string) => {
    await deleteMutation.mutateAsync(id);
  }, [deleteMutation]);

  const renameDashboard = useCallback(async (id: string, name: string) => {
    await renameMutation.mutateAsync({ id, name });
  }, [renameMutation]);

  const duplicateDashboard = useCallback(async (id: string) => {
    await duplicateMutation.mutateAsync(id);
  }, [duplicateMutation]);

  const navigateToDashboard = useCallback((id: string) => {
    navigate(`/insights/${id}`);
  }, [navigate]);

  const addVisual = useCallback(async (visual: Omit<InsightsVisual, "id" | "created_at">) => {
    await addVisualMutation.mutateAsync(visual);
  }, [addVisualMutation]);

  const removeVisual = useCallback(async (id: string) => {
    await removeVisualMutation.mutateAsync(id);
  }, [removeVisualMutation]);

  const updateVisual = useCallback(async (id: string, updates: Partial<InsightsVisual>) => {
    await updateVisualMutation.mutateAsync({ id, updates });
  }, [updateVisualMutation]);

  const reorderDashboards = useCallback(async (orderedIds: string[]) => {
    // Optimistic update
    queryClient.setQueryData(
      ["insights-dashboards", currentUser?.account_id],
      (old: InsightsDashboard[] | undefined) => {
        if (!old) return old;
        return orderedIds.map((id, index) => {
          const d = old.find(d => d.id === id);
          return d ? { ...d } : null;
        }).filter(Boolean) as InsightsDashboard[];
      }
    );
    await reorderMutation.mutateAsync(orderedIds);
  }, [reorderMutation, queryClient, currentUser?.account_id]);

  const value = useMemo<InsightsDashboardsContextType>(() => ({
    dashboards,
    activeDashboard,
    activeDashboardId,
    isLoading,
    visuals,
    isLoadingVisuals,
    createDashboard,
    deleteDashboard,
    renameDashboard,
    reorderDashboards,
    navigateToDashboard,
    setActiveDashboardId,
    addVisual,
    removeVisual,
    updateVisual,
    isCreating: createMutation.isPending,
  }), [
    dashboards,
    activeDashboard,
    activeDashboardId,
    isLoading,
    visuals,
    isLoadingVisuals,
    createDashboard,
    deleteDashboard,
    renameDashboard,
    reorderDashboards,
    navigateToDashboard,
    addVisual,
    removeVisual,
    updateVisual,
    createMutation.isPending,
  ]);

  return (
    <InsightsDashboardsContext.Provider value={value}>
      {children}
    </InsightsDashboardsContext.Provider>
  );
}

export function useInsightsDashboards() {
  const context = useContext(InsightsDashboardsContext);
  if (!context) {
    throw new Error("useInsightsDashboards must be used within InsightsDashboardsProvider");
  }
  return context;
}

export function useInsightsDashboardsSafe() {
  return useContext(InsightsDashboardsContext);
}
