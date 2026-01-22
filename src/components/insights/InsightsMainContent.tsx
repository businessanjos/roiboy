import { BarChart3, FileText, Plus } from "lucide-react";
import { useInsightsPanels } from "@/hooks/useInsightsPanels";
import { InsightsFilterBar } from "./InsightsFilterBar";
import { AddWidgetButton } from "./widgets/AddWidgetButton";
import { InsightsGridLayout } from "./grid/InsightsGridLayout";
import { Button } from "@/components/ui/button";

export function InsightsMainContent() {
  const { activePanel, activePanelId, myPanels, createPanel, isCreating } = useInsightsPanels();

  // If no panels exist, show create panel state
  if (myPanels.length === 0 && !activePanelId) {
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
            onClick={() => createPanel("Meu Primeiro Painel", "dashboard")}
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
  if (!activePanelId || !activePanel) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <p>Selecione um painel na barra lateral</p>
        </div>
      </div>
    );
  }

  const hasWidgets = activePanel.widgets && activePanel.widgets.length > 0;
  const PanelIcon = activePanel.type === "report" ? FileText : BarChart3;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <PanelIcon className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{activePanel.name}</h1>
          </div>
          <AddWidgetButton />
        </div>

        {/* Filters */}
        <InsightsFilterBar />

        {/* Grid or Empty State */}
        {hasWidgets ? (
          <InsightsGridLayout />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Este painel está vazio</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Adicione gráficos e indicadores para visualizar seus dados de vendas e negócios.
            </p>
            <AddWidgetButton />
          </div>
        )}
      </div>
    </div>
  );
}
