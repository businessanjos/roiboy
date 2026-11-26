import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Check, Clock, GraduationCap, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  mentoringSessionStatus,
  orderMentoringSessions,
  type MentoringSession,
} from "@/lib/mentoring/sessionStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { usePagedList } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";

interface Props {
  clientId: string;
  /** Cliente atual + perfis vinculados (mesma regra do restante da agenda). */
  linkedClientIds: string[];
  accountId: string | null;
  renderLinkedBadge?: (itemClientId: string) => ReactNode;
}

function fmtDate(v: string): string {
  const d = parseISO(v);
  if (isNaN(d.getTime()) || d.getFullYear() < 1900 || d.getFullYear() > 2200) return "—";
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

/**
 * Mentorias Ao Vivo como item de entrega na agenda do cliente.
 * Lê e grava os mesmos registros da tela "Mentoria Ao Vivo": lança-se uma vez só.
 */
export function ClientMentoringDeliveries({ clientId, linkedClientIds, accountId, renderLinkedBadge }: Props) {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");

  const [mode, setMode] = useState<"record" | "schedule" | null>(null);
  const [sessionDate, setSessionDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [deleting, setDeleting] = useState<MentoringSession | null>(null);

  const ids = linkedClientIds.length ? linkedClientIds : [clientId];
  const queryKey = ["ec-mentoring-client", ids.slice().sort().join(",")];

  const { data: sessions = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<MentoringSession[]> => {
      const { data, error } = await supabase
        .from("ec_mentoring_attendance")
        .select("id, client_id, session_date, notes")
        .in("client_id", ids)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MentoringSession[];
    },
  });

  const ordered = orderMentoringSessions(sessions, today);
  const pg = usePagedList(ordered, { resetKey: ordered.length });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["ec-mentoring-client"] });
    qc.invalidateQueries({ queryKey: ["ec-mentoring-members"] });
    qc.invalidateQueries({ queryKey: ["ec-mentoring-history"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!accountId) throw new Error("Conta não identificada. Recarregue a página.");
      if (!sessionDate) throw new Error("Selecione a data da mentoria.");
      const { error } = await supabase.from("ec_mentoring_attendance").upsert(
        { account_id: accountId, client_id: clientId, session_date: sessionDate, notes: notes.trim() || null },
        { onConflict: "client_id,session_date" },
      );
      if (error) throw error;
      return sessionDate;
    },
    onSuccess: (date) => {
      toast.success(
        mentoringSessionStatus(date, today) === "scheduled" ? "Mentoria agendada" : "Participação registrada",
        { description: "Também aparece na tela Mentoria Ao Vivo." },
      );
      setMode(null);
      setNotes("");
      refreshAll();
    },
    onError: (err: any) => toast.error(err?.message || "Não foi possível salvar. Tente novamente."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ec_mentoring_attendance").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro de mentoria excluído");
      setDeleting(null);
      refreshAll();
    },
    onError: (err: any) => toast.error(err?.message || "Não foi possível excluir o registro"),
  });

  const open = (next: "record" | "schedule") => {
    setSessionDate(next === "schedule" ? tomorrow : today);
    setNotes("");
    setMode(next);
  };

  return (
    <div className="border-t pt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          Mentorias Ao Vivo
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/operations/mentoria-ec">Ver todas</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => open("schedule")} disabled={!accountId}>
            <CalendarClock className="h-4 w-4" />
            Agendar
          </Button>
          <Button size="sm" onClick={() => open("record")} disabled={!accountId}>
            <Check className="h-4 w-4" />
            Registrar participação
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Carregando mentorias...</p>
      ) : ordered.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/10">
          <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma mentoria ao vivo registrada para este cliente.</p>
          <p className="text-xs mt-1">O que for lançado aqui ou na tela Mentoria Ao Vivo aparece nos dois lugares.</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.items.map((s) => {
                  const done = mentoringSessionStatus(s.session_date, today) === "done";
                  return (
                    <TableRow key={s.id} className={cn(done && "bg-success/5")}>
                      <TableCell>
                        <Checkbox
                          checked={done}
                          disabled
                          aria-label={done ? "Entregue" : "Agendada"}
                          className="disabled:opacity-100"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Mentoria Ao Vivo</span>
                          {renderLinkedBadge?.(s.client_id)}
                        </div>
                        {s.notes && <p className="text-sm text-muted-foreground line-clamp-2">{s.notes}</p>}
                      </TableCell>
                      <TableCell>
                        <Badge>
                          <Users className="h-3 w-3 mr-1" />
                          Mentoria
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {fmtDate(s.session_date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {done ? (
                          <Badge variant="outline" className="text-success border-success/30 bg-success/10">
                            <Check className="h-3 w-3 mr-1" />
                            Participou
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-info border-info/30 bg-info/10">
                            <CalendarClock className="h-3 w-3 mr-1" />
                            Agendada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Excluir mentoria de ${fmtDate(s.session_date)}`}
                          onClick={() => setDeleting(s)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <PagerFor state={pg} itemLabel="mentorias" />
        </>
      )}

      <Dialog open={!!mode} onOpenChange={(o) => !o && !saveMutation.isPending && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "schedule" ? "Agendar mentoria" : "Registrar participação"}</DialogTitle>
            <DialogDescription>
              {mode === "schedule"
                ? "Escolha uma data futura. Ela aparece aqui e na tela Mentoria Ao Vivo como agendada."
                : "Informe a data em que a mentoria aconteceu. Ela entra aqui como entregue e na tela Mentoria Ao Vivo como realizada."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Data da mentoria</Label>
              <DateField
                required
                value={sessionDate}
                min={mode === "schedule" ? tomorrow : undefined}
                max={mode === "record" ? today : undefined}
                onChange={(e) => setSessionDate(e.target.value)}
                aria-label="Data da mentoria"
              />
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)} disabled={saveMutation.isPending}>
              Cancelar
            </Button>
            <Button disabled={saveMutation.isPending || !sessionDate} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta mentoria?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro de {deleting ? fmtDate(deleting.session_date) : ""} sai da agenda do cliente e da tela
              Mentoria Ao Vivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
