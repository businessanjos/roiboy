import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
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
import { useSalesGoals, type SalesGoal } from "@/hooks/useSalesGoals";
import { SalesGoalDialog } from "@/components/insights/goals/SalesGoalDialog";
import { SalesGoalProgressCard } from "@/components/insights/goals/SalesGoalProgressCard";

export default function InsightsGoals() {
  const { currentUser } = useCurrentUser();
  const { data: goals = [], isLoading, remove } = useSalesGoals();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SalesGoal | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const userIds = useMemo(
    () => Array.from(new Set(goals.map((g) => g.user_id))),
    [goals],
  );

  const { data: sellers = [] } = useQuery({
    queryKey: ["sellers-for-goals", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", userIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const sellerName = (id: string) => {
    const u = sellers.find((s: any) => s.id === id);
    return u?.name || u?.email || "Vendedor";
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (g: SalesGoal) => {
    setEditing(g);
    setDialogOpen(true);
  };

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link to="/insights"><ArrowLeft className="w-4 h-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Metas de vendedores
              </h1>
              <p className="text-sm text-muted-foreground">
                Defina metas semanais ou mensais por vendedor e acompanhe o progresso real
                com base nos negócios ganhos.
              </p>
            </div>
          </div>
          <Button onClick={openNew} disabled={!currentUser}>
            <Plus className="w-4 h-4 mr-1" />
            Nova meta
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando metas…</div>
        ) : goals.length === 0 ? (
          <div className="border border-dashed rounded-lg p-10 text-center space-y-3">
            <Target className="w-8 h-8 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhuma meta cadastrada ainda</p>
              <p className="text-sm text-muted-foreground">
                Crie a primeira meta para começar a acompanhar o progresso dos vendedores.
              </p>
            </div>
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" />
              Nova meta
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {goals.map((g) => (
              <SalesGoalProgressCard
                key={g.id}
                goal={g}
                sellerName={sellerName(g.user_id)}
                onEdit={() => openEdit(g)}
                onDelete={() => setDeleteId(g.id)}
              />
            ))}
          </div>
        )}
      </div>

      <SalesGoalDialog open={dialogOpen} onOpenChange={setDialogOpen} goal={editing} />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover meta?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O histórico de negócios ganhos não é afetado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteId) {
                  await remove.mutateAsync(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
