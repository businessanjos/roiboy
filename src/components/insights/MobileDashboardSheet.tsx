import { useState } from "react";
import { LayoutDashboard, Plus, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { CreateDashboardDialog } from "./sidebar/CreateDashboardDialog";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export function MobileDashboardSheet() {
  const {
    dashboards,
    activeDashboardId,
    activeDashboard,
    navigateToDashboard,
    isLoading,
  } = useInsightsDashboards();

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const handleSelect = (id: string) => {
    navigateToDashboard(id);
    setOpen(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 max-w-[200px]">
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span className="truncate text-sm">
              {activeDashboard?.name || "Painéis"}
            </span>
            <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[300px] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-left">Meus Painéis</SheetTitle>
          </SheetHeader>

          <div className="p-3 border-b">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Criar Painel
            </Button>
          </div>

          <ScrollArea className="flex-1 h-[calc(100vh-140px)]">
            <div className="p-2 space-y-1">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Carregando...
                </div>
              ) : dashboards.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum painel criado ainda.
                </div>
              ) : (
                dashboards.map((dashboard) => {
                  const isActive = dashboard.id === activeDashboardId;
                  return (
                    <button
                      key={dashboard.id}
                      onClick={() => handleSelect(dashboard.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted/50 text-foreground"
                      )}
                    >
                      <LayoutDashboard className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate text-sm">
                        {dashboard.name}
                      </span>
                      {isActive && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <CreateDashboardDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
