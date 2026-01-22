import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export interface InsightsPanel {
  id: string;
  name: string;
  type: "dashboard" | "report";
  layout: Json;
  widgets: Json;
  is_default: boolean;
  user_id: string;
  account_id: string;
  shared_with: string[];
  created_at: string;
  updated_at: string;
}

interface InsightsPanelsContextType {
  myPanels: InsightsPanel[];
  sharedPanels: InsightsPanel[];
  activePanelId: string | null;
  activePanel: InsightsPanel | null;
  setActivePanelId: (id: string | null) => void;
  createPanel: (name: string, type: "dashboard" | "report") => Promise<InsightsPanel | null>;
  renamePanel: (id: string, name: string) => Promise<void>;
  deletePanel: (id: string) => Promise<void>;
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: boolean;
}

const InsightsPanelsContext = createContext<InsightsPanelsContextType | null>(null);

export function InsightsPanelsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [activePanelId, setActivePanelId] = useState<string | null>(null);

  // Fetch my panels
  const myPanelsQuery = useQuery({
    queryKey: ["insights-panels", "mine", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("insights_layouts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        type: (item.type as "dashboard" | "report") || "dashboard",
        shared_with: (item.shared_with as string[]) || [],
      })) as InsightsPanel[];
    },
    enabled: !!user?.id,
  });

  // Fetch shared panels
  const sharedPanelsQuery = useQuery({
    queryKey: ["insights-panels", "shared", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("insights_layouts")
        .select("*")
        .contains("shared_with", [user.id])
        .neq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        type: (item.type as "dashboard" | "report") || "dashboard",
        shared_with: (item.shared_with as string[]) || [],
      })) as InsightsPanel[];
    },
    enabled: !!user?.id,
  });

  // Create panel mutation
  const createPanelMutation = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: "dashboard" | "report" }) => {
      if (!user?.id || !currentUser?.account_id) {
        throw new Error("Usuário não autenticado");
      }

      const { data, error } = await supabase
        .from("insights_layouts")
        .insert({
          name,
          type,
          user_id: user.id,
          account_id: currentUser.account_id,
          layout: [],
          widgets: [],
          is_default: false,
          shared_with: [],
        })
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        type: (data.type as "dashboard" | "report") || "dashboard",
        shared_with: (data.shared_with as string[]) || [],
      } as InsightsPanel;
    },
    onSuccess: (newPanel) => {
      queryClient.invalidateQueries({ queryKey: ["insights-panels"] });
      setActivePanelId(newPanel.id);
      toast.success(`${newPanel.type === "dashboard" ? "Painel" : "Relatório"} criado com sucesso`);
    },
    onError: (error) => {
      toast.error("Erro ao criar painel: " + error.message);
    },
  });

  // Rename panel mutation
  const renamePanelMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("insights_layouts")
        .update({ name })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insights-panels"] });
      toast.success("Painel renomeado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao renomear painel: " + error.message);
    },
  });

  // Delete panel mutation
  const deletePanelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("insights_layouts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["insights-panels"] });
      if (activePanelId === deletedId) {
        setActivePanelId(null);
      }
      toast.success("Painel excluído com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao excluir painel: " + error.message);
    },
  });

  const createPanel = useCallback(
    async (name: string, type: "dashboard" | "report") => {
      return createPanelMutation.mutateAsync({ name, type });
    },
    [createPanelMutation]
  );

  const renamePanel = useCallback(
    async (id: string, name: string) => {
      await renamePanelMutation.mutateAsync({ id, name });
    },
    [renamePanelMutation]
  );

  const deletePanel = useCallback(
    async (id: string) => {
      await deletePanelMutation.mutateAsync(id);
    },
    [deletePanelMutation]
  );

  const myPanels = myPanelsQuery.data || [];
  const sharedPanels = sharedPanelsQuery.data || [];

  const activePanel = useMemo(() => {
    if (!activePanelId) return null;
    return (
      myPanels.find((p) => p.id === activePanelId) ||
      sharedPanels.find((p) => p.id === activePanelId) ||
      null
    );
  }, [activePanelId, myPanels, sharedPanels]);

  // Auto-select first panel if none selected
  useEffect(() => {
    if (!activePanelId && myPanels.length > 0) {
      setActivePanelId(myPanels[0].id);
    }
  }, [activePanelId, myPanels]);

  const value = useMemo(
    () => ({
      myPanels,
      sharedPanels,
      activePanelId,
      activePanel,
      setActivePanelId,
      createPanel,
      renamePanel,
      deletePanel,
      isLoading: myPanelsQuery.isLoading || sharedPanelsQuery.isLoading,
      isCreating: createPanelMutation.isPending,
      isDeleting: deletePanelMutation.isPending,
    }),
    [
      myPanels,
      sharedPanels,
      activePanelId,
      activePanel,
      setActivePanelId,
      createPanel,
      renamePanel,
      deletePanel,
      myPanelsQuery.isLoading,
      sharedPanelsQuery.isLoading,
      createPanelMutation.isPending,
      deletePanelMutation.isPending,
    ]
  );

  return (
    <InsightsPanelsContext.Provider value={value}>
      {children}
    </InsightsPanelsContext.Provider>
  );
}

export function useInsightsPanels() {
  const context = useContext(InsightsPanelsContext);
  if (!context) {
    throw new Error("useInsightsPanels must be used within InsightsPanelsProvider");
  }
  return context;
}
