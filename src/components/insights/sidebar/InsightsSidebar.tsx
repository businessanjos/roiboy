import { ScrollArea } from "@/components/ui/scroll-area";
import { useInsightsPanels } from "@/hooks/useInsightsPanels";
import { InsightsSidebarHeader } from "./InsightsSidebarHeader";
import { InsightsPanelList } from "./InsightsPanelList";
import { Skeleton } from "@/components/ui/skeleton";

export function InsightsSidebar() {
  const {
    myPanels,
    sharedPanels,
    activePanelId,
    setActivePanelId,
    deletePanel,
    renamePanel,
    isLoading,
  } = useInsightsPanels();

  return (
    <div className="w-64 min-w-64 border-r bg-muted/30 flex flex-col h-full">
      <InsightsSidebarHeader />

      <ScrollArea className="flex-1">
        {/* Section: My Panels */}
        <div className="p-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase px-2 mb-2 tracking-wide">
            Meus Painéis
          </h3>
          {isLoading ? (
            <div className="space-y-2 px-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : myPanels.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-4">
              Nenhum painel criado ainda. Clique em "Criar" para começar.
            </p>
          ) : (
            <InsightsPanelList
              panels={myPanels}
              activePanelId={activePanelId}
              onSelect={setActivePanelId}
              onDelete={deletePanel}
              onRename={renamePanel}
            />
          )}
        </div>

        {/* Section: Shared with me */}
        {sharedPanels.length > 0 && (
          <div className="p-2 border-t">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase px-2 mb-2 tracking-wide">
              Compartilhado Comigo
            </h3>
            <InsightsPanelList
              panels={sharedPanels}
              activePanelId={activePanelId}
              onSelect={setActivePanelId}
              readOnly
            />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
