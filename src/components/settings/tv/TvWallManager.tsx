import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Check, GripVertical, RotateCcw, CalendarClock, Moon, Plus, MoreHorizontal, Power, PowerOff, RefreshCw, Undo2, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTvCanManage, useTvIsAdmin, useTvWall, sendTvCommand } from "@/hooks/useTvWall";
import { isRecent, tvVisualState } from "@/lib/tv/tvUrl";
import { TvScreenCard } from "./TvScreenCard";
import { TvDetailSheet } from "./TvDetailSheet";
import { TvScheduleSheet } from "./TvScheduleSheet";
import { TvRestSheet } from "./TvRestSheet";
import { TvAddSheet } from "./TvAddSheet";
import { agentIsOffline } from "@/lib/tv/addTv";
import { runTv, useTvDashboards } from "./tvShared";
import { Hint, ReleaseMenu, TV_HINTS, returnTvs } from "./TvConnRelease";
import { isReleased } from "@/lib/tv/tvConn";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ORDER_KEY = "tv-wall-order";
function loadOrder(): number[] { try { const v = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
function applyOrder<T extends { slot: number }>(list: T[], order: number[]) {
  if (!order.length) return list;
  const pos = (s: number) => { const i = order.indexOf(s); return i < 0 ? Infinity : i; };
  return list.map((x, i) => ({ x, i })).sort((a, b) => (pos(a.x.slot) - pos(b.x.slot)) || (a.i - b.i)).map((y) => y.x);
}

function SortableCard({ id, editing, children }: { id: number; editing: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !editing });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", editing && "cursor-grab active:cursor-grabbing touch-none", isDragging && "z-20 opacity-80 ring-2 ring-primary rounded-lg")}
      {...(editing ? { ...attributes, ...listeners, "aria-label": `Arrastar TV ${id}` } : {})}>
      {editing && <div className="pointer-events-none absolute inset-0 z-10 rounded-lg ring-1 ring-dashed ring-primary/60 bg-background/10" />}
      {editing && <span className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-10 h-9 w-9 flex items-center justify-center rounded-md bg-background/90 shadow"><GripVertical className="h-4 w-4" /></span>}
      <div className={cn(editing && "pointer-events-none")}>{children}</div>
    </div>
  );
}

const GRID = "grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5";

function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Skeleton className="aspect-video rounded-none" />
      <div className="p-2.5 space-y-1.5"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-6 w-full" /></div>
    </div>
  );
}

export function TvWallManager() {
  const { data: canManage, isLoading: loadingAccess } = useTvCanManage();
  const { data, isLoading } = useTvWall(!!canManage);
  const { data: dashboards = [] } = useTvDashboards();
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { data: isAdmin } = useTvIsAdmin();
  const [, tick] = useState(0);
  const [order, setOrder] = useState<number[]>(loadOrder);
  const [editing, setEditing] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const saveOrder = (o: number[]) => { setOrder(o); if (o.length) localStorage.setItem(ORDER_KEY, JSON.stringify(o)); else localStorage.removeItem(ORDER_KEY); };
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(i); }, []);

  const summary = useMemo(() => {
    const c = { on: 0, saver: 0, off: 0, nocontact: 0, unpaired: 0 };
    data?.screens.forEach((s) => { c[tvVisualState(data.status.find((x) => x.slot === s.slot))]++; });
    return c;
  }, [data]);

  if (!loadingAccess && !canManage) return <p className="text-sm text-muted-foreground">Somente gestão/administração acessa as TVs.</p>;
  const loading = loadingAccess || isLoading || !data;

  const addBlocked = !data || agentIsOffline(data.status);
  const ADD_OFF = "O agente das TVs está offline, então não dá para procurar TVs agora.";
  const agentOnline = !!data?.status.some((s) => isRecent(s.last_seen));
  const wall = applyOrder(data?.screens.filter((s) => s.location === "Parede") ?? [], order);
  const others = applyOrder((data?.screens.filter((s) => s.location !== "Parede") ?? []).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true })), order);
  const onDragEnd = (group: any[]) => (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = group.map((s) => s.slot);
    const moved = arrayMove(ids, ids.indexOf(Number(e.active.id)), ids.indexOf(Number(e.over.id)));
    const full = [...wall, ...others].map((s) => s.slot);
    const rest = full.filter((x) => !ids.includes(x));
    saveOrder(group === wall ? [...moved, ...rest] : [...rest, ...moved]);
  };
  const renderGroup = (group: any[]) => (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(group)}>
      <SortableContext items={group.map((s) => s.slot)} strategy={rectSortingStrategy}>
        <div className={GRID}>{group.map((s) => <SortableCard key={s.slot} id={s.slot} editing={editing}>{renderCard(s)}</SortableCard>)}</div>
      </SortableContext>
    </DndContext>
  );
  const open = data?.screens.find((s) => s.slot === openSlot) ?? null;
  const all = (c: string) => runTv(() => sendTvCommand(null, c));

  const unstable = data?.screens.filter((s) => { const c = data.status.find((x) => x.slot === s.slot)?.connection; return c === "instavel" || c === "ruim"; }).length ?? 0;
  const enabledScreens = data?.screens.filter((s) => s.enabled) ?? [];
  const releasedSlots = data?.screens.filter((s) => isReleased(s)).map((s) => s.slot) ?? [];
  const parts = [
    `${summary.on} ligada${summary.on === 1 ? "" : "s"}`,
    summary.saver && `${summary.saver} proteção de tela`,
    summary.off && `${summary.off} desligada${summary.off === 1 ? "" : "s"}`,
    summary.nocontact && `${summary.nocontact} sem contato`,
    summary.unpaired && `${summary.unpaired} não pareada${summary.unpaired === 1 ? "" : "s"}`,
    unstable && `${unstable} com conexão instável`,
  ].filter(Boolean).join(" · ");

  const renderCard = (s: any) => (
    <TvScreenCard key={s.slot} screen={s} status={data!.status.find((x) => x.slot === s.slot)} dashboards={dashboards} settings={data!.settings} castSince={data!.events.find((e) => e.slot === s.slot && e.kind === "casting")?.created_at ?? null} onOpen={() => setOpenSlot(s.slot)} />
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-background/95 backdrop-blur border-b flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm font-medium shrink-0">
              <span className={cn("h-2.5 w-2.5 rounded-full", loading ? "bg-muted" : agentOnline ? "bg-success" : "bg-destructive")} />
              {loading ? "Carregando…" : agentOnline ? "Computador das TVs ligado" : <Hint text={TV_HINTS.agentOffline} side="bottom"><span>Computador das TVs desligado</span></Hint>}
            </span>
            {!loading && <span className="text-xs text-muted-foreground truncate hidden sm:inline">{parts}</span>}
          </div>
          <div className="hidden md:flex flex-wrap justify-end gap-1.5 ml-auto">
            <Hint text={TV_HINTS.onAll} side="bottom"><Button size="sm" variant="outline" onClick={() => all("on")}><Power className="h-3.5 w-3.5 mr-1.5" />Ligar todas</Button></Hint>
            <Hint text={TV_HINTS.offAll} side="bottom"><Button size="sm" variant="outline" onClick={() => all("off")}><PowerOff className="h-3.5 w-3.5 mr-1.5" />Desligar todas</Button></Hint>
            <Hint text={TV_HINTS.reloadAll} side="bottom"><Button size="sm" variant="outline" onClick={() => all("reload")}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Recarregar todas</Button></Hint>
            <Hint text={TV_HINTS.releaseAll} side="bottom">
              <ReleaseMenu screens={enabledScreens} settings={data?.settings}>
                <Button size="sm" variant="outline" disabled={!enabledScreens.length}><Unlock className="h-3.5 w-3.5 mr-1.5" />Liberar todas</Button>
              </ReleaseMenu>
            </Hint>
            <Hint text={TV_HINTS.returnAll} side="bottom"><Button size="sm" variant="outline" disabled={!releasedSlots.length} onClick={() => returnTvs(releasedSlots)}><Undo2 className="h-3.5 w-3.5 mr-1.5" />Devolver todas</Button></Hint>
            <Hint text="Arte Eternum clara de dia e escura à noite; coloque todas as TVs em descanso." side="bottom"><Button size="sm" variant="outline" onClick={() => setRestOpen(true)}><Moon className="h-3.5 w-3.5 mr-1.5" />Tela de descanso</Button></Hint>
            {isAdmin && <Hint text={addBlocked ? ADD_OFF : "Conecte uma TV nova, passo a passo."} side="bottom"><span><Button size="sm" variant="outline" disabled={addBlocked} onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar TV</Button></span></Hint>}
            <Hint text="Arraste as TVs para mudar a ordem dos cartões." side="bottom"><Button size="sm" variant={editing ? "secondary" : "outline"} onClick={() => setEditing((v) => !v)}><ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />Organizar</Button></Hint>
            <Hint text={TV_HINTS.schedule} side="bottom"><Button size="sm" onClick={() => setScheduleOpen(true)}><CalendarClock className="h-3.5 w-3.5 mr-1.5" />Horário</Button></Hint>
          </div>
          <div className="flex md:hidden gap-1.5 shrink-0">
          <Hint text={TV_HINTS.releaseAll} side="bottom">
            <ReleaseMenu screens={enabledScreens} settings={data?.settings}>
              <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Liberar todas"><Unlock className="h-4 w-4" /></Button>
            </ReleaseMenu>
          </Hint>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" className="md:hidden h-8 w-8" aria-label="Ações gerais"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => all("on")}><Power className="h-4 w-4 mr-2" />Ligar todas</DropdownMenuItem>
              <DropdownMenuItem onClick={() => all("off")}><PowerOff className="h-4 w-4 mr-2" />Desligar todas</DropdownMenuItem>
              <DropdownMenuItem onClick={() => all("reload")}><RefreshCw className="h-4 w-4 mr-2" />Recarregar todas</DropdownMenuItem>
              <DropdownMenuItem disabled={!releasedSlots.length} onClick={() => returnTvs(releasedSlots)}><Undo2 className="h-4 w-4 mr-2" />Devolver todas</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRestOpen(true)}><Moon className="h-4 w-4 mr-2" />Tela de descanso</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditing((v) => !v)}><ArrowUpDown className="h-4 w-4 mr-2" />Organizar</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setScheduleOpen(true)}><CalendarClock className="h-4 w-4 mr-2" />Horário</DropdownMenuItem>
              {isAdmin && <DropdownMenuItem disabled={addBlocked} onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" />Adicionar TV</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
        {!loading && <p className="text-xs text-muted-foreground sm:hidden -mt-2">{parts}</p>}
        {!loading && editing && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {editing && <span className="mr-auto text-xs text-muted-foreground">Arraste as TVs para a posição que quiser. A ordem fica salva neste navegador.</span>}
            {editing && <Button size="sm" variant="ghost" disabled={!order.length} onClick={() => saveOrder([])}><RotateCcw className="h-3.5 w-3.5 mr-1.5" />Redefinir padrão</Button>}
            {editing && <Button size="sm" onClick={() => setEditing(false)}><Check className="h-3.5 w-3.5 mr-1.5" />Concluir</Button>}
          </div>
        )}

        {loading ? (
          <div className={GRID}>{Array.from({ length: 10 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        ) : (
          <>
            {wall.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parede</h3>
                {renderGroup(wall)}
              </section>
            )}
            {others.length > 0 && <div className={cn(wall.length > 0 && "pt-4 border-t")}>{renderGroup(others)}</div>}
          </>
        )}

        <TvDetailSheet
          screen={open}
          status={data?.status.find((x) => x.slot === openSlot)}
          events={data?.events.filter((e) => e.slot === openSlot || e.slot == null).slice(0, 30) ?? []}
          commands={data?.commands.filter((c) => c.slot === openSlot || c.slot == null).slice(0, 30) ?? []}
          dashboards={dashboards}
          settings={data?.settings}
          onOpenChange={(v) => !v && setOpenSlot(null)}
        />
        {isAdmin && addBlocked && <p className="text-xs text-muted-foreground md:hidden">{ADD_OFF}</p>}
        <TvAddSheet open={addOpen} onOpenChange={setAddOpen} screens={data?.screens ?? []} events={data?.events ?? []} />
        <TvRestSheet open={restOpen} onOpenChange={setRestOpen} settings={data?.settings} screens={data?.screens ?? []} />
        <TvScheduleSheet open={scheduleOpen} onOpenChange={setScheduleOpen} settings={data?.settings} />
      </div>
    </TooltipProvider>
  );
}
