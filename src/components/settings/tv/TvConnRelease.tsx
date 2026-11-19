import { Unlock, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { releaseTvs } from "@/hooks/useTvWall";
import { connTooltip, endOfDayFor, tvConn, type TvConn } from "@/lib/tv/tvConn";
import { runTv } from "./tvShared";

/** Explicação curta mostrada ao passar o mouse. Funciona em qualquer lugar da tela. */
export function Hint({ text, children, className, side = "top" }: { text: string; children: React.ReactNode; className?: string; side?: "top" | "bottom" }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex", className)}>{children}</span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-64 text-xs leading-snug">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const TV_HINTS = {
  releaseOne: "Pausa a automação para usar a TV pelo controle. Ela volta ao conteúdo sozinha no horário escolhido.",
  releaseAll: "Liberar todas: as TVs ficam livres para o controle remoto, sem a automação voltar o dashboard.",
  returnOne: "Devolver para automação: a TV volta a abrir o conteúdo programado em até 30 segundos.",
  returnAll: "Devolver todas: as TVs liberadas voltam ao conteúdo programado em até 30 segundos.",
  onAll: "Liga as TVs que estiverem desligadas.",
  offAll: "Desliga todas as TVs.",
  reloadAll: "Atualiza a página aberta em cada TV."
  ,agentOffline: "As TVs seguem como estão, mas não recebem mudanças até ele voltar.",
  schedule: "Define o horário em que as TVs ligam e desligam sozinhas.",
};

const BAR_CLS: Record<TvConn, string> = { boa: "bg-success", instavel: "bg-warning", ruim: "bg-destructive", offline: "bg-muted-foreground/50" };
const LEVEL: Record<TvConn, number> = { boa: 4, instavel: 2, ruim: 1, offline: 0 };

export function SignalBars({ status, className, size = "sm" }: { status?: any; className?: string; size?: "sm" | "lg" }) {
  const c = tvConn(status);
  const lvl = c ? LEVEL[c] : 0;
  const h = size === "lg" ? [6, 10, 14, 18] : [4, 6, 8, 10];
  return (
    <span className={cn("inline-flex items-end gap-[2px]", className)} aria-label={connTooltip(status)} role="img">
      {h.map((px, i) => (
        <span key={i} style={{ height: px }} className={cn(size === "lg" ? "w-[4px]" : "w-[3px]", "rounded-sm",
          c && (c === "offline" || i < lvl) ? BAR_CLS[c] : "bg-muted-foreground/20")} />
      ))}
    </span>
  );
}

export function SignalWithTip({ status }: { status?: any }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><span className="inline-flex p-0.5" onClick={(e) => e.stopPropagation()}><SignalBars status={status} /></span></TooltipTrigger>
      <TooltipContent>{connTooltip(status)}</TooltipContent>
    </Tooltip>
  );
}

export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Dropdown with 30 min / 1 h / 2 h / Até o fim do dia. `screens` = TVs affected. */
export function ReleaseMenu({ screens, settings, children, align = "end" }: { screens: any[]; settings: any; children: React.ReactNode; align?: "start" | "end" }) {
  const release = (fn: (s: any) => Date) => runTv(async () => {
    if (screens.length === 1) { await releaseTvs([screens[0].slot], fn(screens[0]).toISOString()); return; }
    // group by end time (end of day can differ per TV)
    const groups = new Map<string, number[]>();
    screens.forEach((s) => { const k = fn(s).toISOString(); groups.set(k, [...(groups.get(k) ?? []), s.slot]); });
    for (const [until, slots] of groups) await releaseTvs(slots, until);
  }, screens.length === 1 ? "TV liberada" : "TVs liberadas");
  const plus = (min: number) => () => new Date(Date.now() + min * 60_000);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground max-w-56">Para usar pelo controle sem a automação voltar o dashboard.</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => release(plus(30))}>30 min</DropdownMenuItem>
        <DropdownMenuItem onClick={() => release(plus(60))}>1 h</DropdownMenuItem>
        <DropdownMenuItem onClick={() => release(plus(120))}>2 h</DropdownMenuItem>
        <DropdownMenuItem onClick={() => release((s) => endOfDayFor(s, settings))}>
          Até o fim do dia{screens.length === 1 ? ` (${hhmm(endOfDayFor(screens[0], settings).toISOString())})` : ""}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function returnTvs(slots: number[]) {
  return runTv(() => releaseTvs(slots, null), "Devolvida — volta ao conteúdo em até 30 s");
}

export function ReleaseButton({ screen, settings, className }: { screen: any; settings: any; className?: string }) {
  return (
    <Hint text={TV_HINTS.releaseOne} className={className}>
      <ReleaseMenu screens={[screen]} settings={settings}>
        <Button size="sm" variant="outline" className={cn("w-full", className)}><Unlock className="h-3.5 w-3.5 mr-1.5" />Liberar TV</Button>
      </ReleaseMenu>
    </Hint>
  );
}

export function ReturnButton({ slots, className, size = "sm", hintSide = "top" }: { slots: number[]; className?: string; size?: "sm" | "xs"; hintSide?: "top" | "bottom" }) {
  return (
    <Hint text={TV_HINTS.returnOne} className={className} side={hintSide}>
      <Button size="sm" variant="outline" className={cn(size === "xs" && "h-6 px-2 text-[11px]", className)}
        onClick={(e) => { e.stopPropagation(); returnTvs(slots); }}>
        <Undo2 className={cn(size === "xs" ? "h-3 w-3 mr-1" : "h-3.5 w-3.5 mr-1.5")} />Devolver para automação
      </Button>
    </Hint>
  );
}
