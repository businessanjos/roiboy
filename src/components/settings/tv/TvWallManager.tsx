import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Moon, MoreHorizontal, Power, PowerOff, RefreshCw, Undo2, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTvCanManage, useTvWall, sendTvCommand } from "@/hooks/useTvWall";
import { isRecent, tvVisualState } from "@/lib/tv/tvUrl";
import { TvScreenCard } from "./TvScreenCard";
import { TvDetailSheet } from "./TvDetailSheet";
import { TvScheduleSheet } from "./TvScheduleSheet";
import { TvRestSheet } from "./TvRestSheet";
import { runTv, useTvDashboards } from "./tvShared";
import { Hint, ReleaseMenu, TV_HINTS, returnTvs } from "./TvConnRelease";
import { isReleased } from "@/lib/tv/tvConn";

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
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(i); }, []);

  const summary = useMemo(() => {
    const c = { on: 0, saver: 0, off: 0, nocontact: 0, unpaired: 0 };
    data?.screens.forEach((s) => { c[tvVisualState(data.status.find((x) => x.slot === s.slot))]++; });
    return c;
  }, [data]);

  if (!loadingAccess && !canManage) return <p className="text-sm text-muted-foreground">Somente gestão/administração acessa as TVs.</p>;
  const loading = loadingAccess || isLoading || !data;

  const agentOnline = !!data?.status.some((s) => isRecent(s.last_seen));
  const wall = data?.screens.filter((s) => s.location === "Parede") ?? [];
  const others = (data?.screens.filter((s) => s.location !== "Parede") ?? []).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
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
    <TvScreenCard key={s.slot} screen={s} status={data!.status.find((x) => x.slot === s.slot)} dashboards={dashboards} settings={data!.settings} onOpen={() => setOpenSlot(s.slot)} />
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-background/95 backdrop-blur border-b flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm font-medium shrink-0">
              <span className={cn("h-2.5 w-2.5 rounded-full", loading ? "bg-muted" : agentOnline ? "bg-success" : "bg-destructive")} />
              {loading ? "Carregando…" : agentOnline ? "Computador das TVs ligado" : <Hint text={TV_HINTS.agentOffline} side="bottom"><span>Computador das TVs desligado</span></Hint>}
            </span>
            {!loading && <span className="text-xs text-muted-foreground truncate hidden sm:inline">{parts}</span>}
          </div>
          <div className="hidden md:flex flex-wrap justify-end gap-1.5 shrink-0">
            <Hint text={TV_HINTS.onAll} side="bottom"><Button size="sm" variant="outline" onClick={() => all("on")}><Power className="h-3.5 w-3.5 mr-1.5" />Ligar todas</Button></Hint>
            <Hint text={TV_HINTS.offAll} side="bottom"><Button size="sm" variant="outline" onClick={() => all("off")}><PowerOff className="h-3.5 w-3.5 mr-1.5" />Desligar todas</Button></Hint>
            <Hint text={TV_HINTS.reloadAll} side="bottom"><Button size="sm" variant="outline" onClick={() => all("reload")}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Recarregar todas</Button></Hint>
            <Hint text={TV_HINTS.releaseAll} side="bottom">
              <ReleaseMenu screens={enabledScreens} settings={data?.settings}>
                <Button size="sm" variant="outline" disabled={!enabledScreens.length}><Unlock className="h-3.5 w-3.5 mr-1.5" />Liberar todas</Button>
              </ReleaseMenu>
            </Hint>
            <Hint text={TV_HINTS.returnAll} side="bottom"><Button size="sm" variant="outline" disabled={!releasedSlots.length} onClick={() => returnTvs(releasedSlots)}><Undo2 className="h-3.5 w-3.5 mr-1.5" />Devolver todas</Button></Hint>
            <Hint text="Imagens, relógio e mensagens que aparecem nas TVs sem conteúdo." side="bottom"><Button size="sm" variant="outline" onClick={() => setRestOpen(true)}><Moon className="h-3.5 w-3.5 mr-1.5" />Tela de descanso</Button></Hint>
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
              <DropdownMenuItem onClick={() => setScheduleOpen(true)}><CalendarClock className="h-4 w-4 mr-2" />Horário</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
        {!loading && <p className="text-xs text-muted-foreground sm:hidden -mt-2">{parts}</p>}

        {loading ? (
          <div className={GRID}>{Array.from({ length: 10 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        ) : (
          <>
            {wall.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parede</h3>
                <div className={GRID}>{wall.map(renderCard)}</div>
              </section>
            )}
            {others.length > 0 && <div className={cn(GRID, wall.length > 0 && "pt-4 border-t")}>{others.map(renderCard)}</div>}
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
        <TvRestSheet open={restOpen} onOpenChange={setRestOpen} settings={data?.settings} />
        <TvScheduleSheet open={scheduleOpen} onOpenChange={setScheduleOpen} settings={data?.settings} />
      </div>
    </TooltipProvider>
  );
}
