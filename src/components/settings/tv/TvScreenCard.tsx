import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Cast, Camera, Power, PowerOff, RefreshCw, Tv, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { sendTvCommand } from "@/hooks/useTvWall";
import { tvCapabilities, tvContentKind, tvVisualState } from "@/lib/tv/tvUrl";
import tvSemCaptura from "@/assets/tv-sem-captura.png.asset.json";
import { useTrafficAgencies } from "./TrafficHubFields";
import { STATE, STATE_HINT, describeContent, runTv } from "./tvShared";
import { isReleased } from "@/lib/tv/tvConn";
import { monthStartActive, toAnnualUrl } from "../../../../supabase/functions/_shared/tvMonthStart";
import { Hint, ReleaseMenu, ReturnButton, SignalWithTip, TV_HINTS, hhmm } from "./TvConnRelease";

interface Props { screen: any; status?: any; dashboards: { id: string; name: string }[]; settings?: any; castSince?: string | null; onOpen: () => void }

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={label}
          onClick={(e) => { e.stopPropagation(); onClick(); }}>{children}</Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TvScreenCard({ screen, status, dashboards, settings, castSince, onOpen }: Props) {
  const { data: agencies } = useTrafficAgencies();
  const state = tvVisualState(status);
  const caps = tvCapabilities(screen.slot);
  const isOn = state === "on" || state === "saver";
  const released = isReleased(screen);
  const casting = status?.casting && tvContentKind(screen.url) !== "playlist" ? String(status.casting) : null;
  const castApp = casting && /chrome/i.test(casting) ? "Chrome" : casting;
  const annual = monthStartActive(settings, screen) && toAnnualUrl(screen.url) !== screen.url;
  const cmd = (c: string) => runTv(() => sendTvCommand(screen.slot, c));

  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={cn("group rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden cursor-pointer transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !screen.enabled && "opacity-50")}>
      <div className="relative aspect-video overflow-hidden bg-muted">
        {caps.screenshot && status?.screenshot_url ? (
          <img src={status.screenshot_url} alt={`Tela da ${screen.name}`} className="absolute inset-0 h-full w-full scale-[1.04] object-cover" loading="lazy" />
        ) : !caps.screenshot ? (
          <img src={tvSemCaptura.url} alt="Esse modelo de TV não possui suporte a capturas" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <Tv className="h-6 w-6" />
          </div>
        )}
        {released && <Badge variant="outline" className="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0 h-5 bg-background/90 text-foreground border-border">Liberada até {hhmm(screen.released_until)}</Badge>}
        {casting && (
          <Hint text={`Recebendo transmissão do ${castApp}${castSince ? ` desde ${hhmm(castSince)}` : ""}`} side="bottom" className={cn("absolute left-1.5", released ? "top-8" : "top-1.5")}>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-1 bg-background/90 text-foreground border-primary/50"><Cast className="h-3 w-3 text-primary" />Transmitindo</Badge>
          </Hint>
        )}
        {STATE_HINT[state]
          ? <Hint text={STATE_HINT[state]!} side="bottom" className="absolute top-1.5 right-1.5"><Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", STATE[state].cls)}>{STATE[state].label}</Badge></Hint>
          : <Badge variant="outline" className={cn("absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0 h-5", STATE[state].cls)}>{STATE[state].label}</Badge>}
      </div>
      <div className="p-2.5 space-y-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-semibold truncate">{screen.name}</p>
          <SignalWithTip status={status} />
        </div>
        <p className="text-xs text-muted-foreground truncate">{describeContent(screen.url, dashboards, agencies)}</p>
        {annual && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-primary/50 text-foreground">Visão anual até dia {settings?.month_start_days ?? 5}</Badge>}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px] text-muted-foreground truncate">
            {caps.screenshot && status?.screenshot_at ? <><span className="hidden sm:inline">captura </span>{formatDistanceToNowStrict(new Date(status.screenshot_at), { locale: ptBR, addSuffix: true })}</> : "\u00a0"}
          </span>
          <div className="flex shrink-0 -mr-1">
            {!released && (
              <Hint text={TV_HINTS.releaseOne}>
                <ReleaseMenu screens={[screen]} settings={settings}>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Liberar para uso manual"><Unlock className="h-3.5 w-3.5" /></Button>
                </ReleaseMenu>
              </Hint>
            )}
            <IconAction label="Atualizar a página" onClick={() => cmd("reload")}><RefreshCw className="h-3.5 w-3.5" /></IconAction>
            {caps.screenshot && <IconAction label="Ver a tela agora" onClick={() => cmd("screenshot")}><Camera className="h-3.5 w-3.5" /></IconAction>}
            <IconAction label={isOn ? "Desligar a TV" : "Ligar a TV"} onClick={() => cmd(isOn ? "off" : "on")}>
              {isOn ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            </IconAction>
          </div>
        </div>
        {released && <ReturnButton slots={[screen.slot]} size="xs" className="w-full mt-1" />}
      </div>
    </div>
  );
}
