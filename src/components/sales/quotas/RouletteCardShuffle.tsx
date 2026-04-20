import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export interface ShuffleCard {
  id: string | null;
  label: string;
  cash_value: number;
  color: string | null;
}

interface Props {
  options: ShuffleCard[];
  winner: ShuffleCard;
  onRevealComplete?: () => void;
  soundEnabled?: boolean;
  /** Quantidade de cartas exibidas no leque. Default 7. */
  cardCount?: number;
  /** Tamanho visual: normal (modal) ou xl (tela cheia / TV). */
  size?: "normal" | "xl";
}

/**
 * Audio engine usando Web Audio API — gera tic-tic durante o shuffle e
 * fanfarra ao revelar, sem necessidade de arquivos externos ou créditos.
 */
function useGameSounds(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureCtx = () => {
    if (!enabled) return null;
    if (!ctxRef.current) {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  };

  const tick = () => {
    const ctx = ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(900 + Math.random() * 200, ctx.currentTime);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  };

  const fanfare = () => {
    const ctx = ensureCtx();
    if (!ctx) return;
    // Acorde maior + arpejo ascendente
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.75);
    });
  };

  /** Som de decepção: "aaaaah" descendente — trombone triste / sad trombone. */
  const sadTrombone = () => {
    const ctx = ensureCtx();
    if (!ctx) return;
    // 4 notas descendentes em escala cromática (clássico wah-wah-wah-waaah)
    const notes = [
      { freq: 392.0, dur: 0.25 }, // G4
      { freq: 369.99, dur: 0.25 }, // F#4
      { freq: 349.23, dur: 0.25 }, // F4
      { freq: 311.13, dur: 1.1 },  // Eb4 (a longa final, "waaaah")
    ];
    let t = ctx.currentTime;
    notes.forEach(({ freq, dur }, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      // sawtooth + filtro = timbre nasal de trombone
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t);

      // Pequeno "bend" descendente na nota final pra dar o ar triste
      if (i === notes.length - 1) {
        osc.frequency.linearRampToValueAtTime(freq * 0.92, t + dur);
      }

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1100;
      filter.Q.value = 6;

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
      gain.gain.setValueAtTime(0.22, t + dur - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
      t += dur - 0.02; // leve sobreposição entre notas
    });
  };

  return { tick, fanfare, sadTrombone };
}

type Phase = "shuffling" | "fanned" | "picked" | "revealed";

export function RouletteCardShuffle({
  options,
  winner,
  onRevealComplete,
  soundEnabled = true,
  cardCount = 7,
  size = "normal",
}: Props) {
  const [phase, setPhase] = useState<Phase>("shuffling");
  const { tick, fanfare, sadTrombone } = useGameSounds(soundEnabled);
  const confettiFiredRef = useRef(false);

  // Indices das cartas no leque — embaralhamos para exibir aleatoriamente
  const fanCards = useMemo(() => {
    const arr = Array.from({ length: cardCount }, (_, i) => i);
    return arr.sort(() => Math.random() - 0.5);
  }, [cardCount]);

  // Carta sorteada (centro do leque)
  const winnerIndex = Math.floor(cardCount / 2);

  // Fase 1: shuffling (1.4s) — cartas embaralhando
  useEffect(() => {
    setPhase("shuffling");
    confettiFiredRef.current = false;

    // Tic-tic durante o shuffle
    const tickInterval = window.setInterval(() => tick(), 110);

    const t1 = window.setTimeout(() => {
      window.clearInterval(tickInterval);
      setPhase("fanned");
    }, 1400);

    // Fase 2: fanned (0.9s) — leque aberto, hover na do meio
    const t2 = window.setTimeout(() => {
      setPhase("picked");
      tick();
    }, 1400 + 900);

    // Fase 3: picked → revelar (0.5s flip)
    const t3 = window.setTimeout(() => {
      setPhase("revealed");
      if (!confettiFiredRef.current) {
        confettiFiredRef.current = true;
        const isZero = !winner.cash_value || winner.cash_value <= 0;

        if (isZero) {
          // 😞 Prêmio zero → trombone triste, sem confetes
          sadTrombone();
        } else {
          // 🎉 Prêmio com valor → fanfarra + confete
          fanfare();
          const fire = (origin: { x: number; y: number }) =>
            confetti({
              particleCount: 120,
              spread: 90,
              startVelocity: 45,
              origin,
              colors: ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444"],
              zIndex: 9999,
            });
          fire({ x: 0.3, y: 0.6 });
          fire({ x: 0.7, y: 0.6 });
          window.setTimeout(
            () => confetti({ particleCount: 80, spread: 120, origin: { x: 0.5, y: 0.4 }, zIndex: 9999 }),
            250,
          );
        }
      }
      onRevealComplete?.();
    }, 1400 + 900 + 500);

    return () => {
      window.clearInterval(tickInterval);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner.id, winner.label]);

  const dims = size === "xl"
    ? { card: "w-40 h-56 md:w-48 md:h-64", radius: 240, label: "text-3xl md:text-5xl", value: "text-xl md:text-2xl" }
    : { card: "w-24 h-32 md:w-28 md:h-40", radius: 140, label: "text-xl md:text-2xl", value: "text-sm md:text-base" };

  return (
    <div className={cn("relative w-full flex items-center justify-center", size === "xl" ? "min-h-[420px]" : "min-h-[280px]")}>
      {/* Cartas em leque (visíveis enquanto shuffling/fanned/picked) */}
      <div className={cn("relative w-full h-full flex items-center justify-center", phase === "revealed" && "opacity-0 transition-opacity duration-300")}>
        {fanCards.map((_, i) => {
          const isWinner = i === winnerIndex;
          // Distribuição em arco
          const total = fanCards.length;
          const mid = (total - 1) / 2;
          const offset = i - mid;
          const angleRange = 50; // graus totais do leque
          const angle = (offset / mid) * (angleRange / 2);
          const tx = Math.sin((angle * Math.PI) / 180) * dims.radius;
          const ty = Math.abs(offset) * 6;

          let style: React.CSSProperties = {
            transform: `translate(${tx}px, ${ty}px) rotate(${angle}deg)`,
            transition: "transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            zIndex: isWinner && phase === "picked" ? 50 : 10 + i,
          };

          if (phase === "shuffling") {
            // Cartas empilhadas com leve tremor aleatório
            style = {
              transform: `translate(${(Math.random() - 0.5) * 30}px, ${(Math.random() - 0.5) * 20}px) rotate(${(Math.random() - 0.5) * 30}deg)`,
              transition: "transform 120ms ease-out",
              zIndex: 10 + i,
            };
          }

          if (isWinner && phase === "picked") {
            style = {
              transform: `translate(0px, -40px) rotate(0deg) scale(1.15)`,
              transition: "transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              zIndex: 50,
            };
          }

          return (
            <div
              key={i}
              className={cn(
                "absolute rounded-xl border-2 shadow-2xl flex items-center justify-center",
                dims.card,
                "bg-gradient-to-br from-primary/90 via-primary to-primary/70 border-amber-400/60",
                isWinner && phase === "picked" && "ring-4 ring-amber-400 ring-offset-2 ring-offset-background",
              )}
              style={style}
            >
              {/* Padrão decorativo nas costas das cartas */}
              <div className="absolute inset-2 rounded-lg border border-amber-400/30 flex items-center justify-center">
                <Sparkles className={cn("text-amber-300/80", size === "xl" ? "h-12 w-12" : "h-8 w-8")} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Carta vencedora revelada (centro) */}
      {phase === "revealed" && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            "animate-in fade-in zoom-in-50 duration-500",
          )}
        >
          <div
            className={cn(
              "rounded-2xl border-4 shadow-2xl flex flex-col items-center justify-center text-center px-6",
              dims.card,
              "bg-card",
            )}
            style={{
              borderColor: winner.color || "#f59e0b",
              backgroundColor: `${winner.color || "#f59e0b"}10`,
              transform: "scale(1.4)",
            }}
          >
            <Sparkles
              className={cn("mb-2", size === "xl" ? "h-10 w-10" : "h-6 w-6")}
              style={{ color: winner.color || "#f59e0b" }}
            />
            <p
              className={cn("font-bold leading-tight break-words", dims.label)}
              style={{ color: winner.color || "#f59e0b" }}
            >
              {winner.label}
            </p>
            {winner.cash_value > 0 && winner.label !== `R$ ${winner.cash_value}` && (
              <p className={cn("text-muted-foreground mt-1 tabular-nums", dims.value)}>
                R$ {winner.cash_value.toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
