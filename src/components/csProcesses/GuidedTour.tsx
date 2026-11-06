import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

export interface TourStep { target?: string; text: string; primary?: string; secondary?: string; onEnter?: () => void }

const W = 320, GAP = 14, PAD = 8;

export function GuidedTour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [bh, setBh] = useState(180);
  const bubble = useRef<HTMLDivElement>(null);
  const step = steps[i];
  const stepsRef = useRef(steps); stepsRef.current = steps;

  useEffect(() => { if (open) setI(0); }, [open]);
  useLayoutEffect(() => {
    const step = stepsRef.current[i];
    if (!open || !step) return;
    step.onEnter?.();
    if (!step.target) { setRect(null); return; }
    let el: HTMLElement | null = null;
    const update = () => { if (el) setRect(el.getBoundingClientRect()); };
    const find = setTimeout(() => {
      el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      update(); setTimeout(update, 350);
    }, 120);
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    return () => { clearTimeout(find); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open, i]);
  useLayoutEffect(() => { if (bubble.current) setBh(bubble.current.offsetHeight); });
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  if (!open || !step) return null;
  const last = i === steps.length - 1;
  const next = () => (last ? onClose() : setI(i + 1));
  const vw = window.innerWidth, vh = window.innerHeight, w = Math.min(W, vw - 24);

  // Escolhe o lado com espaço para o balão não cobrir o elemento destacado.
  let pos: { top: number; left: number; side: "top" | "bottom" | "left" | "right" } | null = null;
  if (rect) {
    const below = vh - rect.bottom - PAD, above = rect.top - PAD, right = vw - rect.right - PAD, left = rect.left - PAD;
    const clampX = (x: number) => Math.max(12, Math.min(vw - w - 12, x));
    const clampY = (y: number) => Math.max(12, Math.min(vh - bh - 12, y));
    if (right >= w + GAP + 12) pos = { side: "right", left: rect.right + PAD + GAP, top: clampY(rect.top + rect.height / 2 - bh / 2) };
    else if (below >= bh + GAP + 12) pos = { side: "bottom", top: rect.bottom + PAD + GAP, left: clampX(rect.left + rect.width / 2 - w / 2) };
    else if (above >= bh + GAP + 12) pos = { side: "top", top: rect.top - PAD - GAP - bh, left: clampX(rect.left + rect.width / 2 - w / 2) };
    else if (left >= w + GAP + 12) pos = { side: "left", left: rect.left - PAD - GAP - w, top: clampY(rect.top + rect.height / 2 - bh / 2) };
    else pos = { side: "bottom", top: vh - bh - 12, left: clampX(rect.left) };
  }
  const arrow = pos && rect ? (pos.side === "bottom" || pos.side === "top"
    ? { left: Math.max(16, Math.min(w - 16, rect.left + rect.width / 2 - pos.left)), [pos.side === "bottom" ? "top" : "bottom"]: -6 }
    : { top: Math.max(16, Math.min(bh - 16, rect.top + rect.height / 2 - pos.top)), [pos.side === "right" ? "left" : "right"]: -6 }) : null;

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      {rect ? (
        <div className="pointer-events-none absolute rounded-xl transition-all duration-300"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: "0 0 0 3px hsl(var(--primary)), 0 0 22px 4px hsl(var(--primary) / 0.45), 0 0 0 9999px hsl(var(--tour-overlay) / 0.82)" }} />
      ) : <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "hsl(var(--tour-overlay) / 0.82)" }} />}
      <div ref={bubble}
        className={`absolute animate-in fade-in zoom-in-95 rounded-2xl border bg-popover p-5 shadow-xl transition-[top,left] duration-300 ${pos ? "" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"}`}
        style={{ width: w, ...(pos ? { top: pos.top, left: pos.left } : {}) }}>
        {arrow && <span className="absolute h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t bg-popover" style={{ ...arrow, transform: `translate(${pos!.side === "bottom" || pos!.side === "top" ? "-50%" : "0"}, ${pos!.side === "left" || pos!.side === "right" ? "-50%" : "0"}) rotate(${({ bottom: 45, top: 225, right: -45, left: 135 } as const)[pos!.side]}deg)` }} />}
        <p className="whitespace-pre-line text-sm leading-relaxed">{step.text}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="flex gap-1" aria-label={`Passo ${i + 1} de ${steps.length}`}>
            {steps.map((_, k) => <span key={k} className={`h-1.5 w-1.5 rounded-full ${k <= i ? "bg-primary" : "bg-muted-foreground/30"}`} />)}
          </span>
          <div className="flex shrink-0 gap-1.5">
            {step.secondary ? <Button size="sm" variant="ghost" onClick={onClose}>{step.secondary}</Button>
              : !last && <Button size="sm" variant="ghost" onClick={onClose}>Pular</Button>}
            {i > 0 && !step.primary && <Button size="sm" variant="outline" onClick={() => setI(i - 1)}>Voltar</Button>}
            <Button size="sm" autoFocus onClick={next}>{step.primary ?? (last ? "Concluir" : "Próximo")}</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
