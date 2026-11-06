import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

export interface TourStep { target?: string; text: string; primary?: string; secondary?: string }

export function GuidedTour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];

  useEffect(() => { if (open) setI(0); }, [open]);
  useLayoutEffect(() => {
    if (!open || !step?.target) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const update = () => setRect(el.getBoundingClientRect());
    const t = setTimeout(update, 300); update();
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    return () => { clearTimeout(t); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open, i, step?.target]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  if (!open || !step) return null;
  const last = i === steps.length - 1;
  const next = () => (last ? onClose() : setI(i + 1));
  const pad = 8;
  const bubbleTop = rect ? Math.min(window.innerHeight - 200, rect.bottom + 14) : undefined;
  const bubbleLeft = rect ? Math.max(12, Math.min(window.innerWidth - 332, rect.left)) : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      {rect ? (
        <div className="pointer-events-none absolute rounded-xl transition-all duration-300"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px hsl(var(--background) / 0.75), 0 0 0 2px hsl(var(--primary))" }} />
      ) : <div className="absolute inset-0 bg-background/75 backdrop-blur-sm" />}
      <div
        className={`absolute w-80 animate-in fade-in zoom-in-95 rounded-2xl border bg-popover p-5 shadow-xl ${rect ? "" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"}`}
        style={rect ? { top: bubbleTop, left: bubbleLeft } : undefined}
      >
        <p className="whitespace-pre-line text-sm leading-relaxed">{step.text}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{i + 1} de {steps.length}</span>
          <div className="flex gap-2">
            {step.secondary ? <Button size="sm" variant="ghost" onClick={onClose}>{step.secondary}</Button>
              : !last && <Button size="sm" variant="ghost" onClick={onClose}>Pular tour</Button>}
            {i > 0 && !step.primary && <Button size="sm" variant="outline" onClick={() => setI(i - 1)}>Voltar</Button>}
            <Button size="sm" autoFocus onClick={next}>{step.primary ?? (last ? "Concluir" : "Próximo")}</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
