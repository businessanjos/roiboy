import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { GraduationCap, CheckCircle2, Clock, CalendarClock, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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

type TabKey = "abertas" | "realizadas";
type OpenFilter = "all" | "pending" | "scheduled";
type DoneFilter = "all" | "recent";
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

// Regra de aba: quem tem próxima agendada volta para "Em aberto" (ciclo reaberto).
const isDone = (m: EcMember) => !!m.lastAttendance && !m.nextScheduled;

export default function MentoriaEC() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [openFilter, setOpenFilter] = useState<OpenFilter>("all");
  const [doneFilter, setDoneFilter] = useState<DoneFilter>("all");
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
  const tab: TabKey = searchParams.get("tab") === "realizadas" ? "realizadas" : "abertas";
  const setTab = (v: TabKey) => {
    const next = new URLSearchParams(searchParams);
    if (v === "abertas") next.delete("tab");
    else next.set("tab", v);
    setSearchParams(next, { replace: true });
  };

  const [dialogState, setDialogState] = useState<{ member: EcMember; mode: "record" | "schedule" } | null>(null);
  const [sessionDate, setSessionDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [sessionNotes, setSessionNotes] = useState("");
  const [attendanceSort, setAttendanceSort] = useState<"none" | "desc" | "asc">("none");
  const [practiceFilter, setPracticeFilter] = useState<string>("all");

  const today = format(new Date(), "yyyy-MM-dd");

  const membersQuery = useQuery({
    queryKey: ["ec-mentoring-members", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<EcMember[]> => {
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

      const todayStr = format(new Date(), "yyyy-MM-dd");
      const attMap = new Map<string, { last: string | null; next: string | null; count: number }>();
      (attendance || []).forEach((a) => {
        const cur = attMap.get(a.client_id) ?? { last: null, next: null, count: 0 };
        const isFuture = a.session_date > todayStr;
        if (isFuture) {
          if (!cur.next || a.session_date < cur.next) cur.next = a.session_date;
        } else {
          cur.count += 1;
          if (!cur.last || a.session_date > cur.last) cur.last = a.session_date;
        }
        attMap.set(a.client_id, cur);
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
          nextScheduled: att?.next ?? null,
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
          { account_id: accountId!, client_id: clientId, status },
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
    onSuccess: () => toast.success("Status atualizado"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["ec-mentoring-members", accountId] }),
  });

  const recordMutation = useMutation({
    mutationFn: async ({ clientId, date, notes }: { clientId: string; date: string; notes: string }) => {
      if (!accountId) throw new Error("Conta não identificada. Recarregue a página.");
      if (!date) throw new Error("Selecione a data da mentoria.");
      const { error } = await supabase.from("ec_mentoring_attendance").upsert(
        { account_id: accountId, client_id: clientId, session_date: date, notes: notes || null },
        { onConflict: "client_id,session_date" },
      );
      if (error) throw error;
      return { date };
    },
    onSuccess: (res) => {
      const future = !!res?.date && res.date > today;
      toast.success(future ? "Mentoria agendada" : "Participação registrada", {
        description: future
          ? "Continua na aba Em aberto até a data chegar."
          : "Movida para a aba Realizadas.",
      });
      qc.invalidateQueries({ queryKey: ["ec-mentoring-members", accountId] });
      setDialogState(null);
      setSessionNotes("");
    },
    onError: (err: any) => {
      const msg = err?.code === "23505" || err?.message?.includes("duplicate")
        ? "Já existe registro para esta data"
        : "Não foi possível salvar. Tente novamente.";
      console.error("[MentoriaEC] Erro ao salvar mentoria:", err);
      toast.error(msg);
    },
  });

  const members = membersQuery.data ?? [];

  const baseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (q && !m.fullName.toLowerCase().includes(q) && !(m.businessSegment ?? "").toLowerCase().includes(q))
        return false;
      if (mentorshipFilter !== "all" && m.mentorshipStatus !== mentorshipFilter) return false;
      if (programFilter !== "all" && m.program !== programFilter) return false;
      if (practiceFilter !== "all") {
        if (practiceFilter === "__none__") {
          if (m.businessSegment) return false;
        } else if ((m.businessSegment ?? "") !== practiceFilter) return false;
      }
      return true;
    });
  }, [members, search, mentorshipFilter, programFilter, practiceFilter]);

  const sortByDate = (list: EcMember[], key: "lastAttendance" | "nextScheduled") =>
    [...list].sort((a, b) => {
      if (attendanceSort !== "none") {
        const at = a[key] ? parseISO(a[key]!).getTime() : null;
        const bt = b[key] ? parseISO(b[key]!).getTime() : null;
        if (at === null && bt === null) return a.fullName.localeCompare(b.fullName, "pt-BR");
        if (at === null) return 1;
        if (bt === null) return -1;
        return attendanceSort === "desc" ? bt - at : at - bt;
      }
      return a.fullName.localeCompare(b.fullName, "pt-BR");
    });

  const openList = useMemo(() => {
    const list = baseFiltered.filter((m) => !isDone(m)).filter((m) => {
      if (openFilter === "pending") return !m.nextScheduled;
      if (openFilter === "scheduled") return !!m.nextScheduled;
      return true;
    });
    return sortByDate(list, "nextScheduled");
  }, [baseFiltered, openFilter, attendanceSort]);

  const doneList = useMemo(() => {
    const list = baseFiltered.filter(isDone).filter((m) => {
      if (doneFilter === "recent") {
        return differenceInCalendarDays(new Date(), parseISO(m.lastAttendance!)) <= 30;
      }
      return true;
    });
    return sortByDate(list, "lastAttendance");
  }, [baseFiltered, doneFilter, attendanceSort]);

  const { data: practiceAreas = [] } = usePracticeAreas();

  const practiceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    let noneCount = 0;
    members.forEach((m) => {
      const seg = (m.businessSegment ?? "").trim();
      if (!seg) noneCount += 1;
      else counts.set(seg, (counts.get(seg) ?? 0) + 1);
    });
    const seen = new Set<string>();
    const list = practiceAreas.map((pa) => {
      seen.add(pa.label);
      return { value: pa.label, label: pa.label, count: counts.get(pa.label) ?? 0 };
    });
    Array.from(counts.entries())
      .filter(([label]) => !seen.has(label))
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .forEach(([label, count]) => list.push({ value: label, label: `${label} (não cadastrada)`, count }));
    return { list, noneCount };
  }, [members, practiceAreas]);

  const totals = useMemo(() => {
    const total = members.length;
    const scheduled = members.filter((m) => !!m.nextScheduled).length;
    const done = members.filter(isDone).length;
    const pending = members.filter((m) => !m.lastAttendance && !m.nextScheduled).length;
    const ec = members.filter((m) => m.program === "EC").length;
    const rm = members.filter((m) => m.program === "RM").length;
    return { total, scheduled, done, pending, ec, rm };
  }, [members]);

  const rows = tab === "abertas" ? openList : doneList;
  const colSpan = 8;

  const openDialog = (member: EcMember, mode: "record" | "schedule") => {
    setDialogState({ member, mode });
    setSessionDate(format(new Date(), "yyyy-MM-dd"));
    setSessionNotes("");
  };

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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Membros ativos</div>
          <div className="text-2xl font-semibold mt-1">{totals.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Sem mentoria marcada</div>
          <div className="text-2xl font-semibold mt-1 text-red-600">{totals.pending}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Agendadas (futuras)</div>
          <div className="text-2xl font-semibold mt-1 text-violet-600">{totals.scheduled}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Realizadas</div>
          <div className="text-2xl font-semibold mt-1 text-emerald-600">{totals.done}</div>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="abertas">Em aberto e agendadas ({openList.length})</TabsTrigger>
          <TabsTrigger value="realizadas">Realizadas ({doneList.length})</TabsTrigger>
        </TabsList>
      </Tabs>

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
          {tab === "abertas" ? (
            <Select value={openFilter} onValueChange={(v) => setOpenFilter(v as OpenFilter)}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Situação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas em aberto</SelectItem>
                <SelectItem value="pending">Sem data marcada</SelectItem>
                <SelectItem value="scheduled">Agendadas</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Select value={doneFilter} onValueChange={(v) => setDoneFilter(v as DoneFilter)}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as realizadas</SelectItem>
                <SelectItem value="recent">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          )}
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
                    title="Ordenar por data"
                  >
                    {tab === "abertas" ? "Próxima mentoria" : "Data realizada"}
                    {attendanceSort === "desc" ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : attendanceSort === "asc" ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    )}
                  </button>
                </TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membersQuery.isLoading && (
                <TableRow><TableCell colSpan={colSpan} className="text-center py-10 text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!membersQuery.isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-10 text-muted-foreground">
                    {tab === "abertas"
                      ? "Nenhuma mentoria em aberto ou agendada com os filtros atuais."
                      : "Nenhuma mentoria realizada com os filtros atuais. Ao registrar uma data passada, o membro aparece aqui."}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((m) => {
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
                        <SelectTrigger className={cn("h-8 w-full text-xs", currentStatus && currentStatus.className)}>
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
                      {tab === "abertas" ? (
                        <div className="flex flex-col gap-1">
                          <span className={cn("text-sm", m.nextScheduled ? "text-violet-600 dark:text-violet-300 font-medium" : "text-muted-foreground")}>
                            {m.nextScheduled
                              ? format(parseISO(m.nextScheduled), "dd/MM/yyyy", { locale: ptBR })
                              : "Sem data marcada"}
                          </span>
                          {m.lastAttendance && (
                            <span className="text-xs text-muted-foreground">
                              Última: {format(parseISO(m.lastAttendance), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {format(parseISO(m.lastAttendance!), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          {m.attendanceCount > 0 && (
                            <span className="text-muted-foreground text-xs">({m.attendanceCount}x)</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {tab === "realizadas" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Realizada
                        </Badge>
                      ) : m.nextScheduled ? (
                        <Badge className="bg-violet-500/15 text-violet-700 border-violet-500/30 dark:text-violet-300 gap-1">
                          <CalendarClock className="h-3 w-3" /> Agendada
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300 gap-1">
                          <Clock className="h-3 w-3" /> Em aberto
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {tab === "abertas" ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openDialog(m, "schedule")}>
                              {m.nextScheduled ? "Remarcar" : "Agendar"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openDialog(m, "record")}>
                              Registrar participação
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => openDialog(m, "schedule")}>
                            Agendar próxima
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!dialogState} onOpenChange={(open) => !open && setDialogState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogState?.mode === "schedule" ? "Agendar mentoria" : "Registrar participação"} — {dialogState?.member.fullName}
            </DialogTitle>
            <DialogDescription>
              {dialogState?.mode === "schedule"
                ? "Escolha uma data futura. O membro continua na aba “Em aberto e agendadas” até a mentoria acontecer."
                : "Informe a data em que a mentoria aconteceu. O membro passa para a aba “Realizadas”."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Data da mentoria</Label>
              <Input
                type="date"
                value={sessionDate}
                min={dialogState?.mode === "schedule" ? today : undefined}
                max={dialogState?.mode === "record" ? today : undefined}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogState(null)}>Cancelar</Button>
            <Button
              disabled={recordMutation.isPending || !sessionDate}
              onClick={() => dialogState && recordMutation.mutate({
                clientId: dialogState.member.clientId,
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
