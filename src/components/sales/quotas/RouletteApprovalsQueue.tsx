import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Check, X, Clock, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isManagementUser } from "@/lib/access/managementRoles";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingRequest {
  id: string;
  spiff_id: string;
  user_id: string;
  requested_by: string | null;
  created_at: string;
  spiff_name?: string;
  user_name?: string;
  requester_name?: string;
}

export function RouletteApprovalsQueue() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const isManager = isManagementUser(currentUser as any);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: pending = [] } = useQuery({
    queryKey: ["spiff-spin-requests-pending", currentUser?.account_id],
    enabled: !!currentUser?.account_id && isManager,
    queryFn: async (): Promise<PendingRequest[]> => {
      const { data, error } = await supabase
        .from("spiff_spin_requests" as any)
        .select("id, spiff_id, user_id, requested_by, created_at")
        .eq("account_id", currentUser!.account_id)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      if (rows.length === 0) return [];

      const spiffIds = [...new Set(rows.map((r) => r.spiff_id))];
      const userIds = [
        ...new Set(rows.flatMap((r) => [r.user_id, r.requested_by]).filter(Boolean)),
      ];
      const [spiffsRes, usersRes] = await Promise.all([
        supabase.from("sales_spiffs").select("id, name").in("id", spiffIds),
        supabase.from("users").select("id, name").in("id", userIds),
      ]);
      const spiffMap = new Map((spiffsRes.data ?? []).map((s: any) => [s.id, s.name]));
      const userMap = new Map((usersRes.data ?? []).map((u: any) => [u.id, u.name]));
      return rows.map((r) => ({
        id: r.id,
        spiff_id: r.spiff_id,
        user_id: r.user_id,
        requested_by: r.requested_by,
        created_at: r.created_at,
        spiff_name: spiffMap.get(r.spiff_id) ?? "SPIFF",
        user_name: userMap.get(r.user_id) ?? "Vendedor",
        requester_name: r.requested_by ? userMap.get(r.requested_by) : null,
      }));
    },
  });

  // Realtime: refetch on any change for managers
  useEffect(() => {
    if (!isManager || !currentUser?.account_id) return;
    const channel = supabase
      .channel(`spin-requests-queue-${currentUser.account_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "spiff_spin_requests",
          filter: `account_id=eq.${currentUser.account_id}`,
        },
        (payload: any) => {
          queryClient.invalidateQueries({ queryKey: ["spiff-spin-requests-pending"] });
          if (payload.eventType === "INSERT" && payload.new?.status === "pending") {
            toast.info("Nova solicitação de giro de roleta aguardando aprovação", {
              icon: "🎰",
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isManager, currentUser?.account_id, queryClient]);

  if (!isManager) return null;
  if (pending.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="py-4">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
            <Inbox className="h-4 w-4" />
            Fila de Aprovação de Roletas
          </CardTitle>
          <CardDescription className="text-xs">
            Nenhuma solicitação pendente no momento.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const approve = async (id: string) => {
    if (!currentUser?.id) return;
    setBusyId(id);
    const { error } = await supabase
      .from("spiff_spin_requests" as any)
      .update({
        status: "approved",
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    setBusyId(null);
    if (error) {
      toast.error("Erro ao aprovar: " + error.message);
      return;
    }
    toast.success("Giro liberado!");
    queryClient.invalidateQueries({ queryKey: ["spiff-spin-requests-pending"] });
  };

  const openReject = (id: string) => {
    setRejectId(id);
    setRejectReason("");
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectId || !currentUser?.id) return;
    setBusyId(rejectId);
    const { error } = await supabase
      .from("spiff_spin_requests" as any)
      .update({
        status: "rejected",
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectReason.trim() || null,
      })
      .eq("id", rejectId);
    setBusyId(null);
    setRejectOpen(false);
    if (error) {
      toast.error("Erro ao rejeitar: " + error.message);
      return;
    }
    toast.success("Solicitação rejeitada.");
    queryClient.invalidateQueries({ queryKey: ["spiff-spin-requests-pending"] });
  };

  return (
    <>
      <Card className="border-amber-300 bg-amber-50/40 dark:bg-amber-950/10">
        <CardHeader className="py-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            Fila de Aprovação de Roletas
            <Badge className="bg-amber-500 text-white">{pending.length}</Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Solicitações de giro aguardando sua aprovação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {r.user_name}{" "}
                  <span className="text-muted-foreground font-normal">
                    quer girar
                  </span>{" "}
                  {r.spiff_name}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(r.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                  {r.requester_name && r.requester_name !== r.user_name && (
                    <span>• solicitado por {r.requester_name}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => openReject(r.id)}
                  disabled={busyId === r.id}
                >
                  <X className="h-3.5 w-3.5" />
                  Rejeitar
                </Button>
                <Button
                  size="sm"
                  className="h-8 gap-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => approve(r.id)}
                  disabled={busyId === r.id}
                >
                  <Check className="h-3.5 w-3.5" />
                  Aprovar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar solicitação</DialogTitle>
            <DialogDescription>
              Opcionalmente informe um motivo. O vendedor verá esta mensagem.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason" className="text-xs">
              Motivo (opcional)
            </Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex.: meta da semana ainda não foi atingida"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmReject}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Rejeitar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
