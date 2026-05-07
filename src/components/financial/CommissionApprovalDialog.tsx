import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  CheckCircle2,
  XCircle,
  Undo2,
  StickyNote,
  Clock,
  ShieldCheck,
  ShieldX,
  CircleDashed,
} from "lucide-react";
import { useCommissionApproval, type ApprovalAction } from "@/hooks/useCommissionApproval";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry: any | null;
}

const APPROVAL_BADGE: Record<string, { label: string; className: string; icon: any }> = {
  not_requested: { label: "Sem solicitação", className: "bg-muted text-muted-foreground", icon: CircleDashed },
  pending_approval: { label: "Aguardando aprovação", className: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Clock },
  approved: { label: "Aprovada", className: "bg-green-500/10 text-green-600 border-green-500/30", icon: ShieldCheck },
  rejected: { label: "Rejeitada", className: "bg-red-500/10 text-red-600 border-red-500/30", icon: ShieldX },
};

const ACTION_LABEL: Record<ApprovalAction, { label: string; icon: any; tone: string }> = {
  requested: { label: "Solicitação enviada", icon: Send, tone: "text-amber-600" },
  approved: { label: "Aprovada", icon: ShieldCheck, tone: "text-green-600" },
  rejected: { label: "Rejeitada", icon: ShieldX, tone: "text-red-600" },
  marked_paid: { label: "Marcada como paga", icon: CheckCircle2, tone: "text-green-700" },
  reverted: { label: "Pagamento revertido", icon: Undo2, tone: "text-blue-600" },
  note: { label: "Anotação", icon: StickyNote, tone: "text-muted-foreground" },
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export function CommissionApprovalDialog({ open, onOpenChange, entry }: Props) {
  const [reason, setReason] = useState("");
  const { history, isLoading, requestApproval, approve, reject, revert, addNote } =
    useCommissionApproval(entry?.id);

  if (!entry) return null;

  const status = entry.approval_status || "not_requested";
  const badge = APPROVAL_BADGE[status];
  const StatusIcon = badge.icon;
  const busy =
    requestApproval.isPending ||
    approve.isPending ||
    reject.isPending ||
    revert.isPending ||
    addNote.isPending;

  const after = (p: Promise<any>) => p.then(() => setReason("")).catch(() => {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Aprovação de Comissão
            <Badge variant="outline" className={cn("gap-1", badge.className)}>
              <StatusIcon className="h-3 w-3" />
              {badge.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {entry.user_name} — {entry.deal_title || entry.client_name || "negócio"} ·{" "}
            <span className="font-semibold text-foreground">{fmtBRL(entry.commission_total)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo / Justificativa</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explique o motivo da ação (obrigatório para rejeitar e reverter)"
              rows={3}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {status === "not_requested" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => after(requestApproval.mutateAsync({ entry, reason }))}
              >
                <Send className="h-4 w-4 mr-1.5" /> Solicitar aprovação
              </Button>
            )}
            {status === "pending_approval" && (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => after(approve.mutateAsync({ entry, reason }))}
                >
                  <ShieldCheck className="h-4 w-4 mr-1.5" /> Aprovar e marcar como paga
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy || !reason.trim()}
                  onClick={() => after(reject.mutateAsync({ entry, reason }))}
                >
                  <ShieldX className="h-4 w-4 mr-1.5" /> Rejeitar
                </Button>
              </>
            )}
            {status === "approved" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !reason.trim()}
                onClick={() => after(revert.mutateAsync({ entry, reason }))}
              >
                <Undo2 className="h-4 w-4 mr-1.5" /> Reverter pagamento
              </Button>
            )}
            {status === "rejected" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => after(requestApproval.mutateAsync({ entry, reason }))}
              >
                <Send className="h-4 w-4 mr-1.5" /> Reenviar para aprovação
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || !reason.trim()}
              onClick={() => after(addNote.mutateAsync({ entry, reason }))}
            >
              <StickyNote className="h-4 w-4 mr-1.5" /> Adicionar anotação
            </Button>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-2">Histórico / Auditoria</h4>
            <ScrollArea className="h-64 rounded-md border">
              {isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
              ) : history.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  Nenhuma ação registrada ainda.
                </div>
              ) : (
                <ul className="divide-y">
                  {history.map((h) => {
                    const meta = ACTION_LABEL[h.action] || ACTION_LABEL.note;
                    const Icon = meta.icon;
                    return (
                      <li key={h.id} className="p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", meta.tone)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className={cn("font-medium", meta.tone)}>{meta.label}</span>
                              <span className="text-xs text-muted-foreground">
                                por {h.performed_by_name || "—"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(h.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            {h.reason && (
                              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                                {h.reason}
                              </p>
                            )}
                            {(h.previous_status || h.new_status) && h.action !== "note" && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {h.previous_status} → {h.new_status}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
