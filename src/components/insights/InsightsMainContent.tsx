import { useState, useCallback } from "react";
import { BarChart3, Plus } from "lucide-react";
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { InsightsFilterBar } from "./InsightsFilterBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddVisualModal } from "./AddVisualModal";
import { InsightsGrid } from "./grid/InsightsGrid";

export function InsightsMainContent() {
  const { 
    activeDashboard, 
    activeDashboardId, 
    dashboards, 
    visuals,
    isLoading,
    isLoadingVisuals,
    createDashboard, 
    isCreating,
    updateVisual,
  } = useInsightsDashboards();

  const handleLayoutChange = useCallback(
    async (layouts: Array<{ id: string; layout: any }>) => {
      for (const { id, layout } of layouts) {
        await updateVisual(id, { layout });
      }
    },
    [updateVisual]
  );
  
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  // If no panels exist, show create panel state
  if (dashboards.length === 0 && !activeDashboardId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Crie seu primeiro painel</h2>
          <p className="text-muted-foreground mb-6">
            Organize seus insights em painéis personalizados com gráficos e indicadores.
          </p>
          <Button
            onClick={() => createDashboard("Meu Primeiro Painel")}
            disabled={isCreating}
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Painel
          </Button>
        </div>
      </div>
    );
  }

  // If no active panel selected
  if (!activeDashboardId || !activeDashboard) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <p>Selecione um painel na barra lateral</p>
        </div>
      </div>
    );
  }

  const hasVisuals = visuals && visuals.length > 0;

  return (
    <div className="flex-1 overflow-auto">
      <AddVisualModal open={isBuilderOpen} onOpenChange={setIsBuilderOpen} />
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{activeDashboard.name}</h1>
          </div>
          {hasVisuals && (
            <Button onClick={() => setIsBuilderOpen(true)} disabled={isLoadingVisuals}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Visual
            </Button>
          )}
        </div>

        {/* Filters */}
        <InsightsFilterBar />

        {/* Grid or Empty State */}
        {isLoadingVisuals ? (
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        ) : hasVisuals ? (
          <InsightsGrid 
            visuals={visuals} 
            onLayoutChange={handleLayoutChange} 
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Este painel está vazio</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Adicione gráficos e indicadores para visualizar seus dados de vendas e negócios.
            </p>
            <Button onClick={() => setIsBuilderOpen(true)} disabled={isLoadingVisuals}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Visual
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
