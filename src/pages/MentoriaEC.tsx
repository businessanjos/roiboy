import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { GraduationCap, CheckCircle2, Clock, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Both Eternum Club product ids (novo + renovação)
const EC_PRODUCT_IDS = [
  "b8c50eca-6fd9-41ac-a1d3-f78086daaea7",
  "6f74bb43-a1be-410f-a708-6abab066bb38",
];

type Priority = "alta" | "media" | "baixa";
type StatusFilter = "all" | "never" | "attended" | "recent";
type PriorityFilter = "all" | Priority;

interface EcMember {
  clientId: string;
  fullName: string;
  logoUrl: string | null;
  businessSegment: string | null;
  contractEnd: string | null;
  lastAttendance: string | null;
  attendanceCount: number;
  priority: Priority;
}

function computePriority(contractEnd: string | null, lastAttendance: string | null): Priority {
  const daysToEnd = contractEnd
    ? differenceInCalendarDays(parseISO(contractEnd), new Date())
    : null;
  if (!lastAttendance) {
    if (daysToEnd !== null && daysToEnd <= 90) return "alta";
    return "media";
  }
  const daysSince = differenceInCalendarDays(new Date(), parseISO(lastAttendance));
  if (daysSince > 120) return "media";
  return "baixa";
}

const PRIORITY_STYLE: Record<Priority, string> = {
  alta: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-300",
  media: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  baixa: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export default function MentoriaEC() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [recordingFor, setRecordingFor] = useState<EcMember | null>(null);
  const [sessionDate, setSessionDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [sessionNotes, setSessionNotes] = useState("");

  const membersQuery = useQuery({
    queryKey: ["ec-mentoring-members", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<EcMember[]> => {
      // Active EC contracts
      const { data: contracts, error: cErr } = await supabase
        .from("client_contracts")
        .select("client_id, end_date, status")
        .eq("account_id", accountId!)
        .in("product_id", EC_PRODUCT_IDS)
        .eq("status", "active");
      if (cErr) throw cErr;

      const byClient = new Map<string, string | null>();
      (contracts || []).forEach((c) => {
        const prev = byClient.get(c.client_id);
        // keep latest end_date
        if (!prev || (c.end_date && (!prev || c.end_date > prev))) {
          byClient.set(c.client_id, c.end_date);
        }
      });

      const clientIds = Array.from(byClient.keys());
      if (clientIds.length === 0) return [];

      const [{ data: clients, error: clErr }, { data: attendance, error: aErr }] = await Promise.all([
        supabase
          .from("clients")
          .select("id, full_name, logo_url, business_segment")
          .in("id", clientIds),
        supabase
          .from("ec_mentoring_attendance")
          .select("client_id, session_date")
          .in("client_id", clientIds)
          .order("session_date", { ascending: false }),
      ]);
      if (clErr) throw clErr;
      if (aErr) throw aErr;

      const attMap = new Map<string, { last: string; count: number }>();
      (attendance || []).forEach((a) => {
        const cur = attMap.get(a.client_id);
        if (!cur) attMap.set(a.client_id, { last: a.session_date, count: 1 });
        else {
          cur.count += 1;
          if (a.session_date > cur.last) cur.last = a.session_date;
        }
      });

      return (clients || []).map((c) => {
        const contractEnd = byClient.get(c.id) ?? null;
        const att = attMap.get(c.id);
        return {
          clientId: c.id,
          fullName: c.full_name || "Sem nome",
          logoUrl: c.logo_url,
          businessSegment: c.business_segment,
          contractEnd,
          lastAttendance: att?.last ?? null,
          attendanceCount: att?.count ?? 0,
          priority: computePriority(contractEnd, att?.last ?? null),
        };
      });
    },
  });

  const recordMutation = useMutation({
    mutationFn: async ({ clientId, date, notes }: { clientId: string; date: string; notes: string }) => {
      const { error } = await supabase.from("ec_mentoring_attendance").insert({
        account_id: accountId!,
        client_id: clientId,
        session_date: date,
        notes: notes || null,
        recorded_by: currentUser?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Participação registrada");
      qc.invalidateQueries({ queryKey: ["ec-mentoring-members", accountId] });
      setRecordingFor(null);
      setSessionNotes("");
    },
    onError: (err: any) => {
      const msg = err?.message?.includes("duplicate")
        ? "Já existe registro para esta data"
        : err?.message || "Erro ao registrar";
      toast.error(msg);
    },
  });

  const members = membersQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter((m) => {
        if (q && !m.fullName.toLowerCase().includes(q) && !(m.businessSegment ?? "").toLowerCase().includes(q))
          return false;
        if (priorityFilter !== "all" && m.priority !== priorityFilter) return false;
        if (statusFilter === "never" && m.lastAttendance) return false;
        if (statusFilter === "attended" && !m.lastAttendance) return false;
        if (statusFilter === "recent") {
          if (!m.lastAttendance) return false;
          const days = differenceInCalendarDays(new Date(), parseISO(m.lastAttendance));
          if (days > 30) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const order: Record<Priority, number> = { alta: 0, media: 1, baixa: 2 };
        if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
        return a.fullName.localeCompare(b.fullName, "pt-BR");
      });
  }, [members, search, statusFilter, priorityFilter]);

  const totals = useMemo(() => {
    const total = members.length;
    const never = members.filter((m) => !m.lastAttendance).length;
    const attended = total - never;
    return { total, never, attended };
  }, [members]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-amber-600" />
            <h1 className="text-2xl font-semibold">Mentoria Eternum Club</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Membros ativos do Eternum Club e o histórico de participação nas mentorias ao vivo (segundas e quintas, 7h).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Membros ativos</div>
          <div className="text-2xl font-semibold mt-1">{totals.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Já participaram</div>
          <div className="text-2xl font-semibold mt-1 text-emerald-600">{totals.attended}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Nunca participaram</div>
          <div className="text-2xl font-semibold mt-1 text-red-600">{totals.never}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou atuação"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[190px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="never">Nunca participaram</SelectItem>
              <SelectItem value="attended">Já participaram</SelectItem>
              <SelectItem value="recent">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as prioridades</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Nome</TableHead>
                <TableHead>Atuação</TableHead>
                <TableHead>Fim do contrato</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Última participação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membersQuery.isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!membersQuery.isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum membro encontrado</TableCell></TableRow>
              )}
              {filtered.map((m) => (
                <TableRow key={m.clientId}>
                  <TableCell>
                    <Link to={`/clients/${m.clientId}`} className="flex items-center gap-2 hover:underline">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.logoUrl ?? undefined} />
                        <AvatarFallback>{m.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{m.fullName}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {m.businessSegment ? (
                      <Badge variant="outline" className="text-xs">{m.businessSegment}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {m.contractEnd ? format(parseISO(m.contractEnd), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs", PRIORITY_STYLE[m.priority])}>
                      {PRIORITY_LABEL[m.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {m.lastAttendance ? (
                      <div className="text-sm">
                        {format(parseISO(m.lastAttendance), "dd/MM/yyyy", { locale: ptBR })}
                        {m.attendanceCount > 1 && (
                          <span className="text-muted-foreground text-xs ml-1">({m.attendanceCount}x)</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">Nunca participou</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {m.lastAttendance ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Já participou
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300 gap-1">
                        <Clock className="h-3 w-3" /> Pendente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => {
                      setRecordingFor(m);
                      setSessionDate(format(new Date(), "yyyy-MM-dd"));
                      setSessionNotes("");
                    }}>
                      Registrar participação
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!recordingFor} onOpenChange={(open) => !open && setRecordingFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar participação — {recordingFor?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Data da mentoria</Label>
              <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordingFor(null)}>Cancelar</Button>
            <Button
              disabled={recordMutation.isPending || !sessionDate}
              onClick={() => recordingFor && recordMutation.mutate({
                clientId: recordingFor.clientId,
                date: sessionDate,
                notes: sessionNotes,
              })}
            >
              {recordMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
