import { useState, useCallback, useMemo } from "react";
import { BarChart3, Plus, Pencil, Trash2, Trophy } from "lucide-react";
import { MarketingDateFilter } from "./MarketingDateFilter";
import { startOfMonth, endOfMonth } from "date-fns";
import { useMarketingDashboards } from "@/hooks/useMarketingDashboards";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { InsightsGrid } from "@/components/insights/grid/InsightsGrid";
import { AddVisualModal } from "@/components/insights/AddVisualModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function useCanManage() {
  const { currentUser } = useCurrentUser();
  if (!currentUser) return false;
  if (currentUser.role === "admin" || currentUser.is_also_admin) return true;
  if (["Admin", "Gestor"].includes(currentUser.team_role_name || "")) return true;
  return false;
}

export default function MarketingInsightsTab() {
  const canManage = useCanManage();
  const {
    dashboards,
    activeDashboard,
    activeDashboardId,
    visuals,
    isLoading,
    isLoadingVisuals,
    setActiveDashboardId,
    createDashboard,
    deleteDashboard,
    renameDashboard,
    addVisual,
    updateVisual,
    removeVisual,
    isCreating,
  } = useMarketingDashboards();

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Detect if visuals have a fixedDateRange and extract the year
  const fixedYear = useMemo(() => {
    const first = visuals.find((v) => {
      const cfg = v.config as any;
      return cfg?.fixedDateRange?.startDate;
    });
    if (!first) return null;
    const cfg = first.config as any;
    return new Date(cfg.fixedDateRange.startDate).getFullYear();
  }, [visuals]);

  // Override visuals' fixedDateRange when a month is selected
  const filteredVisuals = useMemo(() => {
    if (fixedYear === null || selectedMonth === null) return visuals;
    const monthStart = startOfMonth(new Date(fixedYear, selectedMonth, 1));
    const monthEnd = endOfMonth(monthStart);
    return visuals.map((v) => {
      const cfg = v.config as any;
      if (!cfg?.fixedDateRange) return v;
      return {
        ...v,
        config: {
          ...cfg,
          fixedDateRange: {
            startDate: monthStart.toISOString(),
            endDate: monthEnd.toISOString(),
          },
        },
      };
    });
  }, [visuals, fixedYear, selectedMonth]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    await createDashboard(createName.trim());
    setCreateName("");
    setCreateOpen(false);
  };

  const handleRename = async () => {
    if (!renameId || !renameName.trim()) return;
    await renameDashboard(renameId, renameName.trim());
    setRenameOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteDashboard(deleteId);
    setDeleteOpen(false);
  };

  const handleLayoutChange = useCallback((layouts: Array<{ id: string; layout: any }>) => {
    layouts.forEach(({ id, layout }) => {
      updateVisual(id, { layout: { x: layout.x, y: layout.y, w: layout.w, h: layout.h, scale: 48 } });
    });
  }, [updateVisual]);

  if (isLoading) {
    return (
      <div className="flex gap-4 h-[600px]">
        <Skeleton className="w-56 h-full" />
        <Skeleton className="flex-1 h-full" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 min-h-[600px]">
      {/* Sidebar */}
      <div className="w-56 shrink-0 border rounded-lg bg-card flex flex-col">
        <div className="p-3 border-b">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4" />
            Painéis
          </h3>
          {canManage && (
            <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Criar Painel
            </Button>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {dashboards.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">Nenhum painel criado</p>
            )}
            {dashboards.map((d) => (
              <div
                key={d.id}
                className={cn(
                  "group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
                  d.id === activeDashboardId
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted"
                )}
                onClick={() => setActiveDashboardId(d.id)}
              >
                <span className="truncate flex-1">{d.name}</span>
                {canManage && (
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameId(d.id);
                        setRenameName(d.name);
                        setRenameOpen(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(d.id);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {!activeDashboard ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <BarChart3 className="h-12 w-12 opacity-30" />
            <p>{dashboards.length === 0 ? "Crie seu primeiro painel de marketing" : "Selecione um painel"}</p>
          </div>
        ) : (
          <div className="space-y-4">
             <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-lg">{activeDashboard.name}</h3>
                {fixedYear !== null && (
                  <MarketingDateFilter
                    year={fixedYear}
                    selectedMonth={selectedMonth}
                    onMonthChange={setSelectedMonth}
                  />
                )}
                <Badge variant="outline" className="gap-1 border-emerald-500/50 text-emerald-600 bg-emerald-50 text-[10px] uppercase font-bold tracking-wider py-0 px-1.5 h-5">
                  <Trophy className="h-3 w-3" />
                  11 VENDAS
                </Badge>
              </div>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setBuilderOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Visual
                </Button>
              )}
            </div>

            {isLoadingVisuals ? (
              <Skeleton className="h-64 w-full" />
            ) : visuals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <BarChart3 className="h-10 w-10 opacity-30" />
                <p>Nenhum visual neste painel</p>
                {canManage && (
                  <Button variant="outline" size="sm" onClick={() => setBuilderOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Visual
                  </Button>
                )}
              </div>
            ) : (
              <InsightsGrid
                visuals={filteredVisuals}
                onLayoutChange={handleLayoutChange}
                readOnly={!canManage}
                onUpdateVisual={updateVisual}
                onRemoveVisual={removeVisual}
              />
            )}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Painel de Marketing</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome do painel"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isCreating || !createName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Painel</DialogTitle>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancelar</Button>
            <Button onClick={handleRename} disabled={!renameName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir painel?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os visuais deste painel serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Visual Modal - uses overrides to bypass InsightsDashboardsProvider */}
      <AddVisualModal
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        overrideDashboardId={activeDashboardId}
        overrideAddVisual={addVisual}
      />
    </div>
  );
}
