import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { GraduationCap, CheckCircle2, Clock, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { usePracticeAreas } from "@/hooks/usePracticeAreas";
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

// Produtos elegíveis para a mentoria ao vivo (Eternum Club + Rykas Mentoring)
const MENTORING_PRODUCTS: { id: string; label: string; program: "EC" | "RM"; className: string }[] = [
  { id: "b8c50eca-6fd9-41ac-a1d3-f78086daaea7", label: "Eternum Club", program: "EC", className: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300" },
  { id: "6f74bb43-a1be-410f-a708-6abab066bb38", label: "Eternum Club", program: "EC", className: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300" },
  { id: "8d3e9bb6-054b-44b3-952f-5920e0ed8775", label: "Rykas Mentoring", program: "RM", className: "bg-pink-500/15 text-pink-700 border-pink-500/30 dark:text-pink-300" },
  { id: "eae406e9-6076-41eb-96ed-df0ab187a11c", label: "Rykas Mentoring", program: "RM", className: "bg-pink-500/15 text-pink-700 border-pink-500/30 dark:text-pink-300" },
];
const MENTORING_PRODUCT_IDS = MENTORING_PRODUCTS.map((p) => p.id);
const PRODUCT_META = new Map(MENTORING_PRODUCTS.map((p) => [p.id, p]));

type ProgramFilter = "all" | "EC" | "RM";

type MentorshipStatus =
  | "novata"
  | "agendado"
  | "realizada_agendar_proxima"
  | "remarcar"
  | "nao_quer_agendar"
  | "nao_respondeu";

type StatusFilter = "all" | "never" | "attended" | "recent";
type MentorshipStatusFilter = "all" | MentorshipStatus;

interface EcMember {
  clientId: string;
  fullName: string;
  logoUrl: string | null;
  businessSegment: string | null;
  contractEnd: string | null;
  lastAttendance: string | null;
  nextScheduled: string | null;
  attendanceCount: number;
  mentorshipStatus: MentorshipStatus | null;
  productId: string | null;
  program: "EC" | "RM" | null;
  productLabel: string | null;
}

const MENTORSHIP_STATUS_OPTIONS: { value: MentorshipStatus; label: string; className: string }[] = [
  { value: "novata", label: "Novata", className: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300" },
  { value: "agendado", label: "Agendado", className: "bg-violet-500/10 text-violet-700 border-violet-500/30 dark:text-violet-300" },
  { value: "realizada_agendar_proxima", label: "Realizada – Agendar a próxima", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300" },
  { value: "remarcar", label: "Remarcar", className: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300" },
  { value: "nao_quer_agendar", label: "Não quer agendar", className: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-300" },
  { value: "nao_respondeu", label: "Não respondeu", className: "bg-gray-500/10 text-gray-700 border-gray-500/30 dark:text-gray-300" },
];

const STATUS_MAP = new Map(MENTORSHIP_STATUS_OPTIONS.map((o) => [o.value, o]));

export default function MentoriaEC() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [mentorshipFilter, setMentorshipFilter] = useState<MentorshipStatusFilter>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const programFilter = ((): ProgramFilter => {
    const v = searchParams.get("program");
    return v === "EC" || v === "RM" ? v : "all";
  })();
  const setProgramFilter = (v: ProgramFilter) => {
    const next = new URLSearchParams(searchParams);
    if (v === "all") next.delete("program");
    else next.set("program", v);
    setSearchParams(next, { replace: true });
  };
  const [recordingFor, setRecordingFor] = useState<EcMember | null>(null);
  const [sessionDate, setSessionDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [sessionNotes, setSessionNotes] = useState("");
  const [attendanceSort, setAttendanceSort] = useState<"none" | "desc" | "asc">("none");
  const [practiceFilter, setPracticeFilter] = useState<string>("all");

  const membersQuery = useQuery({
    queryKey: ["ec-mentoring-members", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<EcMember[]> => {
      // Active EC contracts
      const { data: contracts, error: cErr } = await supabase
        .from("client_contracts")
        .select("client_id, end_date, status, product_id")
        .eq("account_id", accountId!)
        .in("product_id", MENTORING_PRODUCT_IDS)
        .eq("status", "active");
      if (cErr) throw cErr;

      const byClient = new Map<string, { endDate: string | null; productId: string }>();
      (contracts || []).forEach((c: any) => {
        const prev = byClient.get(c.client_id);
        if (!prev || (c.end_date && (!prev.endDate || c.end_date > prev.endDate))) {
          byClient.set(c.client_id, { endDate: c.end_date, productId: c.product_id });
        }
      });

      const clientIds = Array.from(byClient.keys());
      if (clientIds.length === 0) return [];

      const [
        { data: clients, error: clErr },
        { data: attendance, error: aErr },
        { data: statuses, error: sErr },
      ] = await Promise.all([
        supabase
          .from("clients")
          .select("id, full_name, logo_url, business_segment")
          .in("id", clientIds),
        supabase
          .from("ec_mentoring_attendance")
          .select("client_id, session_date")
          .in("client_id", clientIds)
          .order("session_date", { ascending: false }),
        supabase
          .from("ec_mentoring_client_status")
          .select("client_id, status")
          .eq("account_id", accountId!)
          .in("client_id", clientIds),
      ]);
      if (clErr) throw clErr;
      if (aErr) throw aErr;
      if (sErr) throw sErr;

      const attMap = new Map<string, { last: string; count: number }>();
      (attendance || []).forEach((a) => {
        const cur = attMap.get(a.client_id);
        if (!cur) attMap.set(a.client_id, { last: a.session_date, count: 1 });
        else {
          cur.count += 1;
          if (a.session_date > cur.last) cur.last = a.session_date;
        }
      });

      const statusMap = new Map<string, MentorshipStatus>();
      (statuses || []).forEach((s: any) => statusMap.set(s.client_id, s.status as MentorshipStatus));

      return (clients || []).map((c) => {
        const info = byClient.get(c.id);
        const att = attMap.get(c.id);
        const meta = info?.productId ? PRODUCT_META.get(info.productId) : null;
        return {
          clientId: c.id,
          fullName: c.full_name || "Sem nome",
          logoUrl: c.logo_url,
          businessSegment: c.business_segment,
          contractEnd: info?.endDate ?? null,
          lastAttendance: att?.last ?? null,
          attendanceCount: att?.count ?? 0,
          mentorshipStatus: statusMap.get(c.id) ?? null,
          productId: info?.productId ?? null,
          program: meta?.program ?? null,
          productLabel: meta?.label ?? null,
        };
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ clientId, status }: { clientId: string; status: MentorshipStatus }) => {
      const { error } = await supabase
        .from("ec_mentoring_client_status")
        .upsert(
          {
            account_id: accountId!,
            client_id: clientId,
            status,
          },
          { onConflict: "account_id,client_id" },
        );
      if (error) throw error;
    },
    onMutate: async ({ clientId, status }) => {
      await qc.cancelQueries({ queryKey: ["ec-mentoring-members", accountId] });
      const prev = qc.getQueryData<EcMember[]>(["ec-mentoring-members", accountId]);
      if (prev) {
        qc.setQueryData<EcMember[]>(
          ["ec-mentoring-members", accountId],
          prev.map((m) => (m.clientId === clientId ? { ...m, mentorshipStatus: status } : m)),
        );
      }
      return { prev };
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["ec-mentoring-members", accountId], ctx.prev);
      toast.error(err?.message || "Erro ao atualizar status");
    },
    onSuccess: () => {
      toast.success("Status atualizado");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["ec-mentoring-members", accountId] });
    },
  });

  const recordMutation = useMutation({
    mutationFn: async ({ clientId, date, notes }: { clientId: string; date: string; notes: string }) => {
      if (!accountId) throw new Error("Conta não identificada. Recarregue a página.");
      if (!date) throw new Error("Selecione a data da mentoria.");
      // upsert: registrar a mesma data novamente apenas atualiza (nunca quebra)
      const { error } = await supabase.from("ec_mentoring_attendance").upsert(
        {
          account_id: accountId,
          client_id: clientId,
          session_date: date,
          notes: notes || null,
        },
        { onConflict: "client_id,session_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Participação registrada");
      qc.invalidateQueries({ queryKey: ["ec-mentoring-members", accountId] });
      setRecordingFor(null);
      setSessionNotes("");
    },
    onError: (err: any) => {
      const msg = err?.code === "23505" || err?.message?.includes("duplicate")
        ? "Já existe registro para esta data"
        : "Não foi possível registrar a participação. Tente novamente.";
      console.error("[MentoriaEC] Erro ao registrar participação:", err);
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
        if (mentorshipFilter !== "all" && m.mentorshipStatus !== mentorshipFilter) return false;
        if (programFilter !== "all" && m.program !== programFilter) return false;
        if (practiceFilter !== "all") {
          if (practiceFilter === "__none__") {
            if (m.businessSegment) return false;
          } else if ((m.businessSegment ?? "") !== practiceFilter) return false;
        }
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
        if (attendanceSort !== "none") {
          const at = a.lastAttendance ? parseISO(a.lastAttendance).getTime() : null;
          const bt = b.lastAttendance ? parseISO(b.lastAttendance).getTime() : null;
          if (at === null && bt === null) return a.fullName.localeCompare(b.fullName, "pt-BR");
          if (at === null) return 1;
          if (bt === null) return -1;
          return attendanceSort === "desc" ? bt - at : at - bt;
        }
        return a.fullName.localeCompare(b.fullName, "pt-BR");
      });
  }, [members, search, statusFilter, mentorshipFilter, programFilter, practiceFilter, attendanceSort]);

  const { data: practiceAreas = [] } = usePracticeAreas();

  const practiceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    let noneCount = 0;
    members.forEach((m) => {
      const seg = (m.businessSegment ?? "").trim();
      if (!seg) noneCount += 1;
      else counts.set(seg, (counts.get(seg) ?? 0) + 1);
    });
    // Base: áreas cadastradas em practice_areas (mesmo com 0 membros)
    const seen = new Set<string>();
    const list = practiceAreas.map((pa) => {
      seen.add(pa.label);
      return { value: pa.label, label: pa.label, count: counts.get(pa.label) ?? 0 };
    });
    // Extras: valores presentes em membros mas ainda não cadastrados
    Array.from(counts.entries())
      .filter(([label]) => !seen.has(label))
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .forEach(([label, count]) => list.push({ value: label, label: `${label} (não cadastrada)`, count }));
    return { list, noneCount };
  }, [members, practiceAreas]);

  const totals = useMemo(() => {
    const total = members.length;
    const never = members.filter((m) => !m.lastAttendance).length;
    const attended = total - never;
    const ec = members.filter((m) => m.program === "EC").length;
    const rm = members.filter((m) => m.program === "RM").length;
    return { total, never, attended, ec, rm };
  }, [members]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-amber-600" />
            <h1 className="text-2xl font-semibold">Mentoria Ao Vivo</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Membros ativos do Eternum Club e do Rykas Mentoring, com o histórico de participação nas mentorias ao vivo (segundas e quintas, 7h).
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
            <SelectTrigger className="w-[190px]"><SelectValue placeholder="Participação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as participações</SelectItem>
              <SelectItem value="never">Nunca participaram</SelectItem>
              <SelectItem value="attended">Já participaram</SelectItem>
              <SelectItem value="recent">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={programFilter} onValueChange={(v) => setProgramFilter(v as ProgramFilter)}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Programa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os programas ({totals.total})</SelectItem>
              <SelectItem value="EC">Eternum Club ({totals.ec})</SelectItem>
              <SelectItem value="RM">Rykas Mentoring ({totals.rm})</SelectItem>
            </SelectContent>
          </Select>
          <Select value={practiceFilter} onValueChange={setPracticeFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Atuação" /></SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value="all">Todas as atuações ({totals.total})</SelectItem>
              {practiceOptions.noneCount > 0 && (
                <SelectItem value="__none__">Sem atuação ({practiceOptions.noneCount})</SelectItem>
              )}
              {practiceOptions.list.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label} ({o.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={mentorshipFilter} onValueChange={(v) => setMentorshipFilter(v as MentorshipStatusFilter)}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="Status da mentoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {MENTORSHIP_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
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
                <TableHead>Programa</TableHead>
                <TableHead>Atuação</TableHead>
                <TableHead>Fim do contrato</TableHead>
                <TableHead className="w-[280px]">Status</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() =>
                      setAttendanceSort((s) => (s === "none" ? "desc" : s === "desc" ? "asc" : "none"))
                    }
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    title="Ordenar por última participação"
                  >
                    Última participação
                    {attendanceSort === "desc" ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : attendanceSort === "asc" ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    )}
                  </button>
                </TableHead>
                <TableHead>Participação</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membersQuery.isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!membersQuery.isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum membro encontrado</TableCell></TableRow>
              )}
              {filtered.map((m) => {
                const currentStatus = m.mentorshipStatus ? STATUS_MAP.get(m.mentorshipStatus) : null;
                return (
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
                      {m.productLabel ? (
                        <Badge variant="outline" className={cn("text-xs", PRODUCT_META.get(m.productId ?? "")?.className)}>
                          {m.productLabel}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
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
                      <Select
                        value={m.mentorshipStatus ?? ""}
                        onValueChange={(v) => statusMutation.mutate({ clientId: m.clientId, status: v as MentorshipStatus })}
                      >
                        <SelectTrigger
                          className={cn(
                            "h-8 w-full text-xs",
                            currentStatus && currentStatus.className,
                          )}
                        >
                          <SelectValue placeholder="Selecionar status" />
                        </SelectTrigger>
                        <SelectContent>
                          {MENTORSHIP_STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={m.lastAttendance ?? ""}
                          max={format(new Date(new Date().setMonth(new Date().getMonth() + 12)), "yyyy-MM-dd")}
                          onChange={(e) => {
                            const date = e.target.value;
                            if (!date) return;
                            if (date === m.lastAttendance) return;
                            recordMutation.mutate({ clientId: m.clientId, date, notes: "" });
                          }}
                          className="h-8 w-[150px] text-xs"
                        />
                        {m.attendanceCount > 0 && (
                          <span className="text-muted-foreground text-xs">({m.attendanceCount}x)</span>
                        )}
                      </div>
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
                );
              })}
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
