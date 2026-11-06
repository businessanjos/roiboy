import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, Clock, Copy, Hourglass, MessageCircle, Rocket, Repeat, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCsTodayTasks } from "@/hooks/useCsTodayTasks";
import { isManagementUser } from "@/lib/access/managementRoles";
import { addDays, daysBetween, type TodayFilter, type TodayTask } from "@/lib/csToday";
import { toast } from "sonner";

const PROC = [
  { name: "Onboarding", dot: "bg-purple-500" },
  { name: "Encontro Online", dot: "bg-teal-500" },
  { name: "Encontro Presencial", dot: "bg-blue-500" },
];
const KIND_ICON = { onboarding: Rocket, wait: Hourglass, contact: MessageCircle, event: CalendarDays, monthly: Repeat } as const;
const FILTERS: { v: TodayFilter | "all"; l: string }[] = [
  { v: "all", l: "Todas" }, { v: "onboarding", l: "Onboarding" }, { v: "events", l: "Encontros" }, { v: "monthly", l: "Acompanhamento mensal" },
];

function dueLabel(today: string, due: string) {
  const d = daysBetween(today, due);
  if (d === 0) return "Hoje";
  if (d === 1) return "Amanhã";
  if (d === -1) return "Ontem";
  if (d < 0) return `Há ${-d} dias`;
  return new Date(`${due}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function TaskRow({ t, today, overdue, onOpen, setState }: { t: TodayTask; today: string; overdue?: boolean; onOpen: (t: TodayTask) => void; setState: (k: string, s: "done" | "snoozed", d?: string) => Promise<void> }) {
  const Icon = KIND_ICON[t.kind];
  const [pick, setPick] = useState(false);
  const [showList, setShowList] = useState(false);
  const snooze = async (d: string) => { setPick(false); await setState(t.key, "snoozed", d); toast.success(`Adiada para ${dueLabel(today, d).toLowerCase()}`); };
  return (
    <li className={`rounded-xl border bg-card p-3 shadow-sm ${overdue ? "border-destructive/40" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${overdue ? "bg-destructive/10 text-destructive" : "bg-primary/15 text-primary"}`}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{t.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            <span className="truncate">{t.subject}</span>
            <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${PROC[t.processIndex].dot}`} />{PROC[t.processIndex].name}</span>
            <span className={`inline-flex items-center gap-1 ${overdue ? "font-medium text-destructive" : ""}`}><Clock className="h-3.5 w-3.5" />{dueLabel(today, t.due)}</span>
            {!!t.list?.length && <button type="button" className="text-primary hover:underline" onClick={() => setShowList(!showList)}>{showList ? "Esconder lista" : "Ver lista"}</button>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {t.copyText && <Button size="sm" variant="outline" className="gap-1" onClick={() => { navigator.clipboard.writeText(t.copyText!); toast.success("Mensagem copiada ✓"); }}><Copy className="h-3.5 w-3.5" />Copiar lembrete</Button>}
          <Button size="sm" variant="outline" className="gap-1" onClick={() => onOpen(t)}>Abrir<ArrowRight className="h-3.5 w-3.5" /></Button>
          <Button size="sm" className="gap-1" onClick={async () => { await setState(t.key, "done"); toast.success("Tarefa concluída ✓"); }}><CheckCircle2 className="h-3.5 w-3.5" />Concluir</Button>
          <Popover open={pick} onOpenChange={setPick}>
            <PopoverTrigger asChild><Button size="sm" variant="ghost">Adiar</Button></PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-2">
              <div className="flex gap-1.5 pb-2">
                <Button size="sm" variant="secondary" onClick={() => snooze(addDays(today, 1))}>Amanhã</Button>
                <Button size="sm" variant="secondary" onClick={() => snooze(addDays(today, 3))}>Em 3 dias</Button>
              </div>
              <Calendar mode="single" locale={ptBR} disabled={(d) => d < new Date(`${addDays(today, 1)}T00:00:00`)}
                onSelect={(d) => d && snooze(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {showList && !!t.list?.length && <ul className="mt-2 grid gap-1 border-t pt-2 text-sm sm:grid-cols-2">{t.list.map((n) => <li key={n}>• {n}</li>)}</ul>}
    </li>
  );
}

export function TodayView({ onOpen }: { onOpen: (t: TodayTask) => void }) {
  const { currentUser } = useCurrentUser();
  const isManager = isManagementUser(currentUser as any);
  const [who, setWho] = useState<string>("me");
  const [filter, setFilter] = useState<TodayFilter | "all">("all");
  const scope = who === "me" ? currentUser?.id : who;
  const { buckets, loading, setState, today } = useCsTodayTasks(scope);
  const { data: team = [] } = useQuery({
    queryKey: ["cs-today-team", currentUser?.account_id], enabled: isManager && !!currentUser?.account_id,
    queryFn: async () => (await supabase.from("users").select("id, name").eq("account_id", currentUser!.account_id).order("name")).data ?? [],
  });
  const f = (l: TodayTask[]) => filter === "all" ? l : l.filter((t) => t.filter === filter);
  const overdue = f(buckets.overdue), todays = f(buckets.today), next = f(buckets.next);
  const first = ((currentUser as any)?.name ?? "").trim().split(/\s+/)[0];
  const row = (t: TodayTask, o?: boolean) => <TaskRow key={t.key} t={t} today={today} overdue={o} onOpen={onOpen} setState={setState} />;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <p className="text-xl font-semibold">Olá{who === "me" && first ? `, ${first}` : ""}!</p>
        <p className="text-muted-foreground">
          {loading ? "Carregando suas tarefas…" : overdue.length + todays.length === 0 ? "Nada pendente para hoje." :
            `${who === "me" ? "Você tem" : "São"} ${todays.length} ${todays.length === 1 ? "tarefa" : "tarefas"} hoje${overdue.length ? ` e ${overdue.length} ${overdue.length === 1 ? "atrasada" : "atrasadas"}` : ""}.`}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap gap-1 rounded-lg border p-0.5">
          {FILTERS.map((x) => <Button key={x.v} size="sm" variant={filter === x.v ? "secondary" : "ghost"} onClick={() => setFilter(x.v)}>{x.l}</Button>)}
        </div>
        {isManager && (
          <Select value={who} onValueChange={setWho}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="me">Minhas tarefas</SelectItem>
              <SelectItem value="all">Todas as consultoras</SelectItem>
              {team.filter((u: any) => u.id !== currentUser?.id).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {!loading && overdue.length + todays.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-card py-10 text-center">
          <p className="text-3xl">🎉</p>
          <p className="mt-2 text-lg font-semibold">Tudo em dia</p>
          <p className="text-sm text-muted-foreground">Nenhuma tarefa atrasada ou para hoje.</p>
        </div>
      )}
      {overdue.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />Atrasadas · {overdue.length}</h3>
          <ul className="space-y-2">{overdue.map((t) => row(t, true))}</ul>
        </section>
      )}
      {todays.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">Hoje · {todays.length}</h3>
          <ul className="space-y-2">{todays.map((t) => row(t))}</ul>
        </section>
      )}
      {next.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="group flex items-center gap-2 font-semibold text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />Próximos 7 dias · {next.length}
          </CollapsibleTrigger>
          <CollapsibleContent><ul className="mt-2 space-y-2">{next.map((t) => row(t))}</ul></CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
