import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Copy, Loader2, Trash2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RulerEnrollment, RulerTouch } from "@/hooks/useZappRulers";
import { RULER_TOUCH_PHASE_LABEL, rulerTouchPhases, type RulerTouchPhase } from "@/lib/zappRulerFilters";

interface Props {
  enrollment: RulerEnrollment | null;
  onOpenChange: (open: boolean) => void;
  onComplete: (touchId: string) => Promise<void>;
  onDelete: (touchId: string) => Promise<void>;
  onCancelEnrollment: (enrollmentId: string) => Promise<void>;
}

const PHASE_STYLE: Record<RulerTouchPhase, string> = {
  done: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  skipped: "border-border bg-muted text-muted-foreground",
  current: "border-primary/40 bg-primary/15 text-primary",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  future: "border-border bg-background text-muted-foreground",
};

const ENROLLMENT_STATUS: Record<string, string> = {
  active: "Ativa",
  completed: "Concluída",
  cancelled: "Cancelada",
};

function fullDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function dateLine(touch: RulerTouch, phase: RulerTouchPhase, now: number) {
  if (phase === "done" && touch.sent_at) return `Concluída em ${fullDate(touch.sent_at)}`;
  const late = touch.status === "pending" && new Date(touch.scheduled_at).getTime() <= now;
  return `${late ? "Venceu em" : "Prevista para"} ${fullDate(touch.scheduled_at)}`;
}

/** Abre a régua de um contato: todas as atividades com data, situação e ações. */
export function RulerEnrollmentDetailDialog({
  enrollment,
  onOpenChange,
  onComplete,
  onDelete,
  onCancelEnrollment,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const now = Date.now();
  const touches = enrollment
    ? [...enrollment.touches].sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
      )
    : [];
  const phases = rulerTouchPhases(touches, now);
  const done = touches.filter((t) => phases[t.id] === "done").length;
  const open = touches.filter((t) => t.status === "pending").length;

  const run = async (touchId: string, action: (id: string) => Promise<void>) => {
    setBusyId(touchId);
    try {
      await action(touchId);
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <Dialog
      open={!!enrollment}
      onOpenChange={(o) => {
        if (!o) setConfirmDeleteId(null);
        onOpenChange(o);
      }}
    >
      <DialogContent className="flex max-h-[86vh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-3 p-4 sm:p-6">
        <DialogHeader className="space-y-1 pr-6 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <span className="min-w-0 break-words">
              {enrollment?.contact_name || enrollment?.contact_phone}
            </span>
            {enrollment && (
              <Badge variant={enrollment.status === "active" ? "default" : "secondary"}>
                {ENROLLMENT_STATUS[enrollment.status] || enrollment.status}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {[enrollment?.template_name, enrollment?.contact_name ? enrollment?.contact_phone : null]
              .filter(Boolean)
              .join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <strong className="font-semibold text-foreground">{touches.length}</strong>{" "}
            {touches.length === 1 ? "atividade" : "atividades"}
          </span>
          <span>
            <strong className="font-semibold text-foreground">{done}</strong> {done === 1 ? "concluída" : "concluídas"}
          </span>
          <span>
            <strong className="font-semibold text-foreground">{open}</strong> em aberto
          </span>
        </div>

        <div className="-mx-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1">
          {touches.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Esta régua não tem mais atividades.
            </p>
          ) : (
            touches.map((touch) => {
              const phase = phases[touch.id];
              const isOpen = touch.status === "pending";
              const busy = busyId === touch.id;
              const confirming = confirmDeleteId === touch.id;
              return (
                <div
                  key={touch.id}
                  className={cn(
                    "rounded-lg border border-border bg-card p-3",
                    phase === "current" && "border-primary/50 bg-primary/5",
                    !isOpen && "opacity-75",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={cn("text-[10px]", PHASE_STYLE[phase])}>
                          {RULER_TOUCH_PHASE_LABEL[phase]}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          D+{touch.offset_days}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {touch.is_task ? "Atividade" : touch.auto_send ? "Mensagem automática" : "Mensagem"}
                        </Badge>
                      </div>
                      <p className="mt-1.5 break-words text-sm font-medium">{touch.title}</p>
                      <p className="text-xs text-muted-foreground">{dateLine(touch, phase, now)}</p>
                      {!touch.is_task && touch.message && (
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                          {touch.message}
                        </p>
                      )}
                    </div>

                    {isOpen && (
                      <div className="flex shrink-0 items-center gap-1">
                        {confirming ? (
                          <>
                            <span className="text-xs text-muted-foreground">Excluir?</span>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => run(touch.id, onDelete)}
                            >
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, excluir"}
                            </Button>
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDeleteId(null)}>
                              Não
                            </Button>
                          </>
                        ) : (
                          <>
                            {!touch.is_task && touch.message && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                aria-label="Copiar mensagem"
                                onClick={() => {
                                  navigator.clipboard?.writeText(touch.message);
                                  toast.success("Mensagem copiada");
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="sm" disabled={busy} onClick={() => run(touch.id, onComplete)}>
                              {busy ? (
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="mr-1 h-4 w-4" />
                              )}
                              Concluir
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              aria-label="Excluir atividade"
                              disabled={busy}
                              onClick={() => setConfirmDeleteId(touch.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          {enrollment?.status === "active" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={closing}
              onClick={async () => {
                if (!enrollment) return;
                setClosing(true);
                try {
                  await onCancelEnrollment(enrollment.id);
                } finally {
                  setClosing(false);
                }
              }}
            >
              {closing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <XCircle className="mr-1 h-4 w-4" />}
              Encerrar régua
            </Button>
          ) : (
            <span />
          )}
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
