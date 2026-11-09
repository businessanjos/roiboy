import { useState } from "react";
import { BookOpenCheck, MonitorUp, TrendingUp, HeartHandshake, Sparkles, Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Roteiro nativo da reunião de onboarding (antes ficava num Canva externo). */
export const ONBOARDING_GUIDE_URL = /canva\.com\/design\/DAHQ3-2Ft-Y/i;

type Item = { id: string; text: string };
type Block = {
  n: string; title: string; subtitle?: string; icon: typeof MonitorUp;
  highlight?: string;
  groups: { label?: string; items: Item[] }[];
};

const BLOCKS: Block[] = [
  {
    n: "01", title: "Clínica Ryka", subtitle: "Sistema de vendas", icon: MonitorUp,
    highlight: "Explique a função e os benefícios de implementar o sistema de vendas que já gerou mais de R$ 1,3 bilhão em vendas de procedimentos.",
    groups: [{ items: [
      { id: "ryka-tela", text: "Compartilhar a tela do sistema Clínica Ryka" },
      { id: "ryka-func", text: "Explicar o sistema e as funcionalidades" },
    ] }],
  },
  {
    n: "02", title: "Vendas", subtitle: "ROI rápido", icon: TrendingUp,
    groups: [
      { label: "Se já tem lista de clientes", items: [{ id: "v-mortos", text: "Reativação dos mortos-vivos" }] },
      { label: "Se não tem clientes", items: [{ id: "v-novos", text: "Parceria, urna, influencer ou tráfego pago" }] },
    ],
  },
  {
    n: "03", title: "Agradecimento", subtitle: "Encerramento com segurança", icon: HeartHandshake,
    groups: [{ items: [
      { id: "a-plantao", text: "Como funciona o plantão de dúvidas do WhatsApp" },
      { id: "a-ansiedade", text: "Tirar a ansiedade de parecer muita coisa" },
      { id: "a-metodo", text: "Reafirmar que ela está segura e tem um método para seguir" },
    ] }],
  },
];

const TOTAL = BLOCKS.reduce((s, b) => s + b.groups.reduce((g, x) => g + x.items.length, 0), 0);

export function OnboardingGuideButton({ clientName }: { clientName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" className="gap-2" onClick={() => setOpen(true)}>
        <BookOpenCheck className="h-4 w-4" />Abrir roteiro da reunião
      </Button>
      <OnboardingMeetingGuide open={open} onOpenChange={setOpen} clientName={clientName} />
    </>
  );
}

export function OnboardingMeetingGuide({ open, onOpenChange, clientName }: { open: boolean; onOpenChange: (v: boolean) => void; clientName?: string }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setDone((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pct = Math.round((done.size / TOTAL) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-8 pb-5 pt-7 text-left">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />Reunião de onboarding
          </span>
          <DialogTitle className="mt-2 text-3xl font-semibold tracking-tight">Roteiro da reunião</DialogTitle>
          <DialogDescription className="text-base">
            {clientName ? <>Conduza com calma a conversa com <strong className="text-foreground">{clientName}</strong>, ponto a ponto.</> : "Conduza com calma, ponto a ponto."}
          </DialogDescription>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{done.size} de {TOTAL}</span>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-10 overflow-y-auto px-8 py-8">
          {BLOCKS.map((b, bi) => {
            const Icon = b.icon;
            return (
              <section key={b.n} className="animate-fade-in opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: `${bi * 120}ms` }}>
                <div className="flex items-start gap-4">
                  <span className="text-4xl font-light leading-none text-primary/40 tabular-nums">{b.n}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <h3 className="text-2xl font-semibold tracking-tight">{b.title}</h3>
                    </div>
                    {b.subtitle && <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">{b.subtitle}</p>}
                  </div>
                </div>

                <div className="mt-5 space-y-4 pl-0 sm:pl-14">
                  {b.highlight && (
                    <p className="rounded-xl border-l-4 border-primary bg-primary/10 px-4 py-3 text-[15px] leading-relaxed">{b.highlight}</p>
                  )}
                  {b.groups.map((g, gi) => (
                    <div key={gi}>
                      {g.label && <p className="mb-2 text-sm font-semibold text-foreground/80">{g.label}</p>}
                      <ul className="space-y-2">
                        {g.items.map((it) => {
                          const on = done.has(it.id);
                          return (
                            <li key={it.id}>
                              <button type="button" onClick={() => toggle(it.id)}
                                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] transition-all hover:border-primary/50 ${on ? "border-primary/40 bg-primary/5 text-muted-foreground" : "bg-card"}`}>
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                                  {on && <Check className="h-3.5 w-3.5" />}
                                </span>
                                <span className={on ? "line-through" : "font-medium"}>{it.text}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
