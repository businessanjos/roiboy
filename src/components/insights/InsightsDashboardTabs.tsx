import { useState, useRef, useEffect } from "react";
import { Plus, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { CreateDashboardDialog } from "./sidebar/CreateDashboardDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";

export function InsightsDashboardTabs() {
  const {
    dashboards,
    activeDashboardId,
    navigateToDashboard,
    deleteDashboard,
    renameDashboard,
    duplicateDashboard,
  } = useInsightsDashboards();

  const [createOpen, setCreateOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll);
      const observer = new ResizeObserver(checkScroll);
      observer.observe(el);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        observer.disconnect();
      };
    }
  }, [dashboards]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  const handleRenameSubmit = async () => {
    if (renameId && renameName.trim()) {
      await renameDashboard(renameId, renameName.trim());
      setRenameId(null);
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteDashboard(deleteId);
      setDeleteId(null);
    }
  };

  if (dashboards.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-1 border-b bg-muted/30 px-2">
        {/* Scroll left */}
        {canScrollLeft && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => scroll("left")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Tabs */}
        <div
          ref={scrollRef}
          className="flex items-center gap-0.5 overflow-x-auto scrollbar-none flex-1 py-1"
        >
          {dashboards.map((d) => {
            const isActive = d.id === activeDashboardId;
            return (
              <div key={d.id} className="group flex items-center shrink-0">
                <button
                  onClick={() => navigateToDashboard(d.id)}
                  className={cn(
                    "px-4 py-1.5 text-sm rounded-md whitespace-nowrap transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-md"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  )}
                >
                  {d.name}
                </button>

                {/* Context menu on active tab */}
                {isActive && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity -ml-1"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuItem onClick={() => {
                        setRenameId(d.id);
                        setRenameName(d.name);
                      }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Renomear
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicateDashboard(d.id)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(d.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>

        {/* Scroll right */}
        {canScrollRight && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => scroll("right")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        {/* Add new */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <CreateDashboardDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Rename dialog */}
      <AlertDialog open={!!renameId} onOpenChange={(o) => !o && setRenameId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renomear Painel</AlertDialogTitle>
            <AlertDialogDescription>Digite o novo nome para o painel.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenameSubmit} disabled={!renameName.trim()}>
              Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Painel</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este painel? Todos os visuais serão removidos. Esta ação não pode ser desfeita.
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
    </>
  );
}
