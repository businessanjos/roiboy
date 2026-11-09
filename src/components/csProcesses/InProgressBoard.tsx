import { useMemo, useState } from "react";
import { Hourglass, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCsInProgress } from "@/hooks/useCsInProgress";
import { isManagementUser } from "@/lib/access/managementRoles";
import { sinceLabel, type BoardCard } from "@/lib/csInProgress";
import { stepTitle } from "@/lib/csProcessActions";
import type { Process } from "@/lib/csProcesses";
import { cn } from "@/lib/utils";

const borders = ["border-l-purple-500", "border-l-teal-500", "border-l-blue-500"];
const fills = ["bg-purple-500", "bg-teal-500", "bg-blue-500"];
const rings = ["ring-purple-500/40", "ring-teal-500/40", "ring-blue-500/40"];
const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
const phaseName = (t: string) => t.replace(/^Fase\s+\d+\s*[—-]\s*/i, "");
const NONE = "none";

export function InProgressBoard({ processes, onOpenCard }: { processes: Process[]; onOpenCard: (processIndex: number, card: BoardCard) => void }) {
  const { currentUser } = useCurrentUser();
  const isMgr = isManagementUser(currentUser as any);
  const isMobile = useIsMobile();
  const { boards, users, loading, today } = useCsInProgress();
  const [pi, setPi] = useState(0);
  const [owner, setOwner] = useState<string>("mine");
  const [q, setQ] = useState("");
  const [onlyWaiting, setOnlyWaiting] = useState(false);
  const [mobileCol, setMobileCol] = useState(0);
  const proc = processes[pi];
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  const cards = (boards[pi] ?? []).filter((c) =>
    (c.kind === "event" || owner === "all" || c.ownerId === (owner === "mine" ? currentUser?.id : owner)) &&
    (!q.trim() || norm(c.name).includes(norm(q))) && (!onlyWaiting || c.waiting));

  const columns = useMemo(() => {
    if (!proc) return [];
    const cols = proc.phases.map((ph, i) => ({ id: String(i), title: phaseName(ph.title), cards: cards.filter((c) => c.stepKey?.startsWith(`${i}-`)) }));
    const loose = cards.filter((c) => !c.stepKey);
    if (loose.length) cols.unshift({ id: NONE, title: "Sem fase definida", cards: loose });
    return cols;
  }, [proc, cards]);

  return (
    <div className="space-y-4" data-tour="board">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border p-0.5">
          {processes.map((p, i) => (
            <button key={p.id} onClick={() => { setPi(i); setMobileCol(0); }}
              className={cn("rounded-md px-3 py-1.5 text-sm transition", i === pi ? "bg-secondary font-medium" : "text-muted-foreground hover:text-foreground")}>
              <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", fills[i % 3])} />
              {p.title.replace(/^.*—\s*/, "").replace(/ do cliente sócio/i, "")}
            </button>
          ))}
        </div>
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={pi === 0 ? "Buscar cliente" : "Buscar encontro"} className="h-9 pl-8" />
        </div>
        {pi === 0 && (
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mine">Minhas clientes</SelectItem>
              {isMgr && <SelectItem value="all">Todas</SelectItem>}
              {isMgr && users.filter((u) => u.id !== currentUser?.id).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {pi === 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={onlyWaiting} onCheckedChange={setOnlyWaiting} /> Só aguardando cliente
          </label>
        )}
      </div>

      {isMobile && columns.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {columns.map((c, i) => (
            <button key={c.id} onClick={() => setMobileCol(i)}
              className={cn("shrink-0 rounded-full border px-3 py-1 text-xs", i === mobileCol ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground")}>
              {c.title} · {c.cards.length}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 w-72 shrink-0 rounded-xl" />)}</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.filter((_, i) => !isMobile || i === Math.min(mobileCol, columns.length - 1)).map((col) => (
            <div key={col.id} className={cn("flex shrink-0 flex-col rounded-xl bg-muted/40 p-2", isMobile ? "w-full" : "w-72")}>
              <div className="px-1.5 pb-2 pt-1 text-sm font-medium">{col.title} <span className="text-muted-foreground">· {col.cards.length}</span></div>
              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-0.5">
                {col.cards.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Ninguém nesta fase agora</p>}
                {col.cards.map((c) => {
                  const [cp, cs] = c.stepKey ? c.stepKey.split("-").map(Number) : [-1, -1];
                  const phase = cp >= 0 ? proc.phases[cp] : null;
                  const st = phase?.steps[cs];
                  const owner = c.ownerId ? userMap.get(c.ownerId) : undefined;
                  return (
                    <button key={c.id} onClick={() => onOpenCard(pi, c)}
                      className={cn("w-full rounded-xl border border-l-4 bg-card p-3 text-left shadow-sm transition hover:shadow-md", borders[pi % 3])}>
                      <div className="flex items-center gap-2">
                        {c.kind === "client" && (
                          <Avatar className="h-8 w-8"><AvatarImage src={c.avatar ?? undefined} /><AvatarFallback className="text-[10px]">{initials(c.name)}</AvatarFallback></Avatar>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{c.name}</div>
                          {c.dateLabel && <div className="text-xs text-muted-foreground">{c.dateLabel}</div>}
                        </div>
                        {owner && (
                          <Avatar className="h-6 w-6" title={owner.name}><AvatarImage src={owner.avatar_url ?? undefined} /><AvatarFallback className="text-[9px]">{initials(owner.name)}</AvatarFallback></Avatar>
                        )}
                      </div>
                      <div className="mt-2 text-xs">
                        {st ? <span className="font-medium">{cp + 1}.{cs + 1} {stepTitle(st.title)}</span>
                          : <span className="text-muted-foreground">Etapa na ficha: {c.stageLabel}</span>}
                      </div>
                      {phase && (
                        <div className="mt-2 flex items-center gap-1">
                          {phase.steps.map((_, i) => (
                            <span key={i} className={cn("h-2 w-2 rounded-full", i < cs ? fills[pi % 3] : i === cs ? cn(fills[pi % 3], "ring-2 ring-offset-1 ring-offset-card", rings[pi % 3]) : "bg-muted-foreground/25")} />
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {c.since && <span>{sinceLabel(c.since, today)}</span>}
                        {c.waiting && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary"><Hourglass className="h-3 w-3" />Aguardando cliente</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
