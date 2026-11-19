import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Camera, Power, PowerOff, RefreshCw, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { sendTvCommand } from "@/hooks/useTvWall";
import { tvCapabilities, tvVisualState } from "@/lib/tv/tvUrl";
import { STATE, describeContent, runTv } from "./tvShared";

interface Props { screen: any; status?: any; dashboards: { id: string; name: string }[]; onOpen: () => void }

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

export function TvScreenCard({ screen, status, dashboards, onOpen }: Props) {
  const state = tvVisualState(status);
  const caps = tvCapabilities(screen.slot);
  const isOn = state === "on" || state === "saver";
  const cmd = (c: string) => runTv(() => sendTvCommand(screen.slot, c));

  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={cn("group rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden cursor-pointer transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !screen.enabled && "opacity-50")}>
      <div className="relative aspect-video bg-muted">
        {caps.screenshot && status?.screenshot_url ? (
          <img src={status.screenshot_url} alt={`Tela da ${screen.name}`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <Tv className="h-6 w-6" />
            {!caps.screenshot && <span className="text-[10px]">Sem captura nesta TV</span>}
          </div>
        )}
        <Badge variant="outline" className={cn("absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0 h-5", STATE[state].cls)}>{STATE[state].label}</Badge>
      </div>
      <div className="p-2.5 space-y-0.5">
        <p className="text-sm font-semibold truncate">{screen.name}</p>
        <p className="text-xs text-muted-foreground truncate">{describeContent(screen.url, dashboards)}</p>
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px] text-muted-foreground truncate">
            {caps.screenshot && status?.screenshot_at ? `captura ${formatDistanceToNow(new Date(status.screenshot_at), { locale: ptBR, addSuffix: true })}` : "\u00a0"}
          </span>
          <div className="flex shrink-0 -mr-1">
            <IconAction label="Recarregar" onClick={() => cmd("reload")}><RefreshCw className="h-3.5 w-3.5" /></IconAction>
            {caps.screenshot && <IconAction label="Ver tela agora" onClick={() => cmd("screenshot")}><Camera className="h-3.5 w-3.5" /></IconAction>}
            <IconAction label={isOn ? "Desligar" : "Ligar"} onClick={() => cmd(isOn ? "off" : "on")}>
              {isOn ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            </IconAction>
          </div>
        </div>
      </div>
    </div>
  );
}
