import { Clock, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateTvSettings } from "@/hooks/useTvWall";
import { useOfficeCountdown } from "@/hooks/useOfficeCountdown";
import {
  AGENT_STALE_MS, extendOneHour, isFinalStretch, lastAgentSync, ownScheduleCount, progressOf,
  shortDay, splitRemaining, timeOf, fmtRemaining, type Countdown,
} from "@/lib/tv/officeCountdown";
import { runTv } from "./tvShared";

const pad = (n: number) => String(n).padStart(2, "0");
type Props = { settings: any; status?: { last_seen?: string | null }[]; screens?: { schedule_mode?: string | null }[] };

function useView({ settings, status = [] }: Props) {
  const { c, now } = useOfficeCountdown(settings);
  const last = lastAgentSync(status);
  const offline = !last || now - last > AGENT_STALE_MS;
  const final = isFinalStretch(c, now);
  const remaining = c.target == null ? 0 : c.target - now;
  return { c, now, last, offline, final, remaining, progress: progressOf(c, now) };
}
const extend = (c: Countdown) => { const v = extendOneHour(c); if (v) runTv(() => updateTvSettings({ keep_on_until: v }), "Estendido por 1 hora"); };
const context = (c: Countdown) => [c.label, c.why].filter(Boolean).join(" · ");

/** Compact block at the top of the "Horário do escritório" panel. */
export function OfficeCountdownCompact(props: Props) {
  const { c, offline, final, remaining, progress, last } = useView(props);
  const own = ownScheduleCount(props.screens);
  return (
    <div className={cn("rounded-xl border p-4 space-y-2", c.on ? (final ? "border-countdown-amber/40 bg-countdown-amber/5" : "border-primary/30 bg-primary/5") : "bg-muted/40")}>
      <p className="text-xs font-medium text-muted-foreground" aria-live="polite">{c.on ? "TVs ligadas · desligam em" : "TVs desligadas · ligam em"}</p>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className={cn("text-3xl font-semibold tabular-nums tracking-tight", final && "text-countdown-amber", offline && "opacity-60")}>
          {c.target == null ? c.label : fmtRemaining(remaining)}
        </span>
        {final && <Button size="sm" variant="outline" onClick={() => extend(c)}>Estender 1h</Button>}
      </div>
      {c.target != null && <p className="text-xs text-muted-foreground">{context(c)}</p>}
      <div className="h-1 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full transition-[width] duration-1000", final ? "bg-countdown-amber" : c.on ? "bg-primary" : "bg-muted-foreground/50")} style={{ width: `${progress * 100}%` }} /></div>
      {offline && <p className="text-xs text-destructive">O controle das TVs está offline{last ? ` desde ${timeOf(last)}` : ""} — elas não vão ligar/desligar sozinhas até ele voltar.</p>}
      {own > 0 && <p className="text-[11px] text-muted-foreground">{own} TV{own === 1 ? " segue" : "s seguem"} horário próprio e não {own === 1 ? "entra" : "entram"} nesta contagem.</p>}
    </div>
  );
}

function Digit({ v, label, big }: { v: string; label: string; big: string }) {
  return (
    <div className="flex flex-col items-center">
      <span key={v} className={cn(big, "font-light tabular-nums leading-none tracking-tight animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none")}>{v}</span>
      <span className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
    </div>
  );
}
const Colon = ({ big }: { big: string }) => <span className={cn(big, "font-light leading-none opacity-30 -mt-5")}>:</span>;

function Ring({ progress, accent, time, day }: { progress: number; accent: string; time: string; day: string }) {
  const r = 52, len = 2 * Math.PI * r;
  return (
    <div className="relative h-32 w-32 lg:h-40 lg:w-40 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="6" strokeLinecap="round" className={cn(accent, "transition-[stroke-dashoffset] duration-1000 motion-reduce:transition-none")}
          strokeDasharray={len} strokeDashoffset={len * (1 - progress)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl lg:text-2xl font-medium tabular-nums">{time}</span>
        <span className="text-xs text-muted-foreground">{day}</span>
      </div>
    </div>
  );
}

/** Hero strip at the top of Configurações > TVs. */
export function OfficeCountdownHero(props: Props & { onAdjust: () => void }) {
  const { c, now, offline, final, remaining, progress, last } = useView(props);
  const r = splitRemaining(remaining);
  const big = "text-5xl sm:text-6xl lg:text-8xl";
  const accentText = final ? "text-countdown-amber" : c.on ? "text-primary" : "text-muted-foreground";
  const accentStroke = final ? "stroke-countdown-amber" : c.on ? "stroke-primary" : "stroke-muted-foreground/60";
  return (
    <section
      aria-label="Contagem do horário das TVs"
      className={cn(
        "relative overflow-hidden rounded-2xl border shadow-sm px-5 py-6 sm:px-8 sm:min-h-[200px]",
        c.on ? "bg-gradient-to-br from-primary/10 via-card to-background" : "bg-gradient-to-br from-muted/60 via-card to-background",
        final && "from-countdown-amber/10",
        offline && "border-destructive/40",
      )}
    >
      <button onClick={props.onAdjust} className="absolute right-4 top-3 text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">Ajustar horário</button>
      <div className="flex flex-col items-center gap-5 text-center md:flex-row md:items-center md:justify-between md:text-left">
        <div className="flex flex-col items-center md:items-start gap-3 min-w-0">
          <div className="space-y-1" aria-live="polite">
            <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium", c.on ? "border-primary/40 bg-primary/10" : "bg-muted")}>
              <span className="relative flex h-2 w-2">
                {c.on && !offline && <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping [animation-duration:2s] motion-reduce:animate-none", final ? "bg-countdown-amber" : "bg-primary")} />}
                <span className={cn("relative inline-flex h-2 w-2 rounded-full", c.on ? (final ? "bg-countdown-amber" : "bg-primary") : "bg-muted-foreground/60")} />
              </span>
              {c.on ? "Ao vivo · TVs ligadas" : "TVs desligadas"}
            </span>
            <p className="text-sm text-muted-foreground">{c.on ? "Desligam em" : "Ligam em"}</p>
          </div>
          {c.target == null ? (
            <p className="text-2xl sm:text-3xl font-light">{c.label}</p>
          ) : (
            <div className={cn("flex flex-wrap items-end justify-center md:justify-start gap-x-4 gap-y-3", offline && "opacity-50")}>
              <div className={cn("flex items-start gap-1.5 sm:gap-3", accentText === "text-muted-foreground" ? "text-foreground/80" : "text-foreground")}>
                {r.d > 0 && <><Digit v={String(r.d)} label="dias" big={big} /><Colon big={big} /></>}
                <Digit v={pad(r.h)} label="horas" big={big} /><Colon big={big} />
                <Digit v={pad(r.m)} label="minutos" big={big} /><Colon big={big} />
                <Digit v={pad(r.s)} label="segundos" big={big} />
              </div>
              {final && <Button size="sm" variant="outline" className="mb-6 border-countdown-amber/50 text-countdown-amber" onClick={() => extend(c)}>Estender 1h</Button>}
            </div>
          )}
          {c.target != null && <p className="text-sm text-muted-foreground">{context(c)}</p>}
          {c.target != null && (
            <div className="h-1 w-full max-w-xs rounded-full bg-muted overflow-hidden md:hidden">
              <div className={cn("h-full rounded-full", final ? "bg-countdown-amber" : c.on ? "bg-primary" : "bg-muted-foreground/50")} style={{ width: `${progress * 100}%` }} />
            </div>
          )}
          {offline && <p className="flex items-center gap-1.5 text-xs text-destructive"><WifiOff className="h-3.5 w-3.5" />Controle das TVs offline{last ? ` desde ${timeOf(last)}` : ""} — o horário não está sendo aplicado</p>}
        </div>
        {c.target != null && <div className="hidden md:block"><Ring progress={progress} accent={accentStroke} time={timeOf(c.target)} day={shortDay(c.target, now)} /></div>}
        {c.target == null && <Clock className="hidden md:block h-16 w-16 text-muted-foreground/40" />}
      </div>
    </section>
  );
}
