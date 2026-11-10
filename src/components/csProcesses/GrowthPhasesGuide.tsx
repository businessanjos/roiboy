import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Sprout, Wallet, Megaphone, Gem, Magnet, MessageSquareHeart, Handshake, Lightbulb, AlertTriangle, LayoutGrid, ListChecks, Check, Map, Maximize2, Minimize2, Network, ArrowRight, ChevronRight, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Processo das Fases de Crescimento + Método 4FA (antes num Whimsical externo com senha). */
export const GROWTH_PHASES_URL = /whimsical\.com\/processo-de-acompanhamento/i;

type Group = { label?: string; alert?: string; items: string[] };
type Phase = { id: string; tag: string; title: string; icon: typeof Sprout; tip?: string; groups: Group[] };

const PHASES: Phase[] = [
  { id: "onb", tag: "Onboarding", title: "Análise da situação atual", icon: Sprout,
    tip: "Nessa etapa inicial, receba a protegida com todo cuidado do mundo. Mostre que agora ela não está mais sozinha. No primeiro momento, quase sempre chega desesperada e com medo: acolha esses sentimentos enquanto começamos a organizar a casa. Sempre que pegar alguma informação, registre nos comentários para o squad acompanhar.",
    groups: [{ items: ["Planilha de cadastro informativo", "Preenchimento das informações do Asana", "Preenchimento das informações no Anjo Guia", "Reunião inicial de onboarding — agendamento", "Reunião inicial de onboarding — reunião", "Implementação Anjo Guia com a cliente passo a passo", "Relatório de vendas (últimos 3 meses)", "Bônus — consultoria financeira", "Bônus — consultoria marketing", "Bônus — consultoria conteúdo"] }] },
  { id: "fin", tag: "Fase base", title: "Finanças e Operação", icon: Wallet,
    groups: [{ items: ["Cortar custos desnecessários", "Analisar folha de pagamento", "Analisar formato de contratações", "Separar PF x PJ", "Entender fluxo de caixa", "Definir pró-labore", "Fechar caixa diariamente", "Lançar as vendas do dia todo dia", "Emitir notas fiscais", "Controlar cobranças", "Alimentar a planilha/sistema", "Calcular capacidade operacional", "Calcular capacidade profissional"] }] },
  { id: "f1", tag: "Fase 1", title: "Marketing e Vendas", icon: Megaphone,
    groups: [{ items: ["Criação de método", "Criação de marca", "Definir esteira de produtos", "Precificação de todos os produtos", "Definir público-alvo (fazer o doc)", "Ajustar rede social", "Identificar o gargalo no funil de vendas"] }] },
  { id: "f2", tag: "Fase 2", title: "Marca e Percepção de Valor", icon: Gem,
    tip: "Atrair para uma marca ruim é pedir para quebrar mais rápido. Antes do processo agressivo de atração, organize a percepção de valor da imagem do negócio e dela. Nunca comece uma estratégia antes de saber QUEM é o público-alvo — todas as estratégias precisam estar ligadas a ele.",
    groups: [{ alert: "Não tem lead para conversar", items: ["Analisar o posicionamento da marca", "Marca pessoal (Shape / Cara de Ryka)", "Nome da marca / método", "Big idea e grande promessa", "Problema que resolve", "Instagram (posicionamento e linha editorial)", "Percepção de valor (Especialista / Bandeijão)", "Alinhamento do discurso com o público-alvo"] }] },
  { id: "f3", tag: "Fase 3", title: "Estratégias de atração", icon: Magnet,
    tip: "Ajuste de acordo com o 4FA: pergunte quais estratégias ela já usa e monte o quadro visual para ela ir acompanhando (aba “Método 4FA”).",
    groups: [
      { items: ["Canais de atração", "Quais estão sendo usados?", "Qual a qualidade de cada um?", "Está sendo feito um funil?", "Qual a frequência que está sendo feita?", "Está utilizando alguma forma de controle de leads? (CRM)"] },
      { label: "Método dos Anjos", items: ["Narrativa de lançamento / como lançar seu método [EAB]", "Indicação em 3 etapas & indicação simples [EAB]", "Tráfego pago [EAB]", "Ímã de clientes (urna) [EAB]", "Reativação dos mortos vivos [EAB]", "Digital Influencer [EAB]", "Parcerias [EAB] / [BLACK]", "Programa de indicação [EAB] / [BLACK]", "Desafios — temáticos com a época do ano ou evento [EAB]", "Curso Topo de Funil [BLACK]", "Calendário de Campanhas [BLACK]", "Indicações Infinitas [BLACK]", "Parcerias de Alto Nível", "Paralellum [BLACK] / [BLACK 2.0]", "B2B — como vender para empresas [BLACK]", "Produto de Época [BLACK]", "Eventos e Palestras [BLACK]", "Stories de Domingo [BLACK]"] },
      { label: "Datas comerciais", items: ["Dia das Mães", "Dia dos Namorados", "Black Friday"] },
      { label: "Injeção de caixa rápido", items: ["Injeção de Caixa Rápido"] },
    ] },
  { id: "f4", tag: "Fase 4", title: "Engajamento", icon: MessageSquareHeart,
    groups: [
      { alert: "Os leads estão chegando, mas não estão agendando consulta", items: ["Analisar o funil — a percepção pode enganar: ver a média das métricas de conversão sugeridas", "Analisar abordagem inicial", "Ler todas as conversas novamente", "Implementar novos scripts para testar"] },
      { alert: "Os leads estão agendando consulta, mas não estão indo", items: ["Confirmação em 2 etapas", "Confirmação em 3 etapas", "Cobrar antecipado com 50% de desconto", "Dar alguma sessão de bônus para quem for na consulta", "Criar um produto de entrada para qualificar e fazer upsell usando o valor pago como desconto"] },
    ] },
  { id: "f5", tag: "Fase 5", title: "Conversão", icon: Handshake,
    groups: [{ alert: "Os leads vão na consulta, mas não fecham", items: ["Assistir consulta matadora e gravar a consulta", "Incluir uma sessão com resultado na hora antes da consulta", "Medir o quanto está bem para fazer a consulta (emocional importa muito)", "Melhorar o nível de persuasão", "Dar duas opções de fechamento para a cliente, apenas", "Utilizar técnica do cala boca", "Oferta especial 24h/48h", "Recontato até a pessoa fechar"] }] },
];

const FUNNELS = [
  { title: "Tráfego Pago", tone: "bg-primary/10 border-primary/30", head: "bg-primary text-primary-foreground", chip: "bg-card border-primary/30", items: ["Oferta direta", "Google Ads", "Funil direto", "Isca", "Evento"] },
  { title: "Tráfego Alheio", tone: "bg-success/10 border-success/30", head: "bg-success text-success-foreground", chip: "bg-card border-success/30", items: ["Influencer", "B2B", "Parcerias", "Urna — Ímã de clientes", "Desafios", "Eventos & Palestras"] },
  { title: "Indicação", tone: "bg-info/10 border-info/30", head: "bg-info text-info-foreground", chip: "bg-card border-info/30", items: ["Indicação em 3 etapas", "Indicação simples", "Programa de indicação"] },
  { title: "Lista Quente", tone: "bg-warning/10 border-warning/30", head: "bg-warning text-warning-foreground", chip: "bg-card border-warning/30", items: ["Reativação dos mortos vivos", "Upsell", "Recontato", "Produto de época", "Confirmação em 3 etapas", "Agenda lotada — Stories de domingo", "Injeção de caixa rápido", "Recompra", "Tráfego orgânico"] },
];

const FUNNEL_META: Record<string, { icon: typeof Sprout; desc: string; bar: string; text: string }> = {
  "Tráfego Pago": { icon: Megaphone, desc: "Anúncios que levam a pessoa direto para a oferta ou para uma isca.", bar: "bg-primary", text: "text-primary" },
  "Tráfego Alheio": { icon: Magnet, desc: "Usar a audiência de outras pessoas e empresas para atrair clientes.", bar: "bg-success", text: "text-success" },
  "Indicação": { icon: Handshake, desc: "Clientes satisfeitas trazendo novas clientes, de forma organizada.", bar: "bg-info", text: "text-info" },
  "Lista Quente": { icon: MessageSquareHeart, desc: "Quem já conhece a clínica: reativar, recomprar e lotar a agenda.", bar: "bg-warning", text: "text-warning" },
};

export function GrowthPhasesButton({ clientName }: { clientName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" className="gap-2" onClick={() => setOpen(true)}><Map className="h-4 w-4" />Abrir Fases de Crescimento — Método 4FA</Button>
      <GrowthPhasesGuide open={open} onOpenChange={setOpen} clientName={clientName} />
    </>
  );
}

export function GrowthPhasesGuide({ open, onOpenChange, clientName }: { open: boolean; onOpenChange: (v: boolean) => void; clientName?: string }) {
  const [tab, setTab] = useState<"map" | "phases" | "4fa">("phases");
  const [full, setFull] = useState(false);
  const [active, setActive] = useState(PHASES[0].id);
  const [done, setDone] = useState<Set<string>>(new Set());
  const idx = PHASES.findIndex((p) => p.id === active);
  const phase = PHASES[idx];
  const counts = useMemo(() => Object.fromEntries(PHASES.map((p) => {
    const keys = p.groups.flatMap((g, gi) => g.items.map((_, ii) => `${p.id}-${gi}-${ii}`));
    return [p.id, { total: keys.length, done: keys.filter((k) => done.has(k)).length }];
  })), [done]);
  const toggle = (k: string) => setDone((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const first = clientName?.trim().split(/\s+/)[0];
  const c = counts[phase.id];
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  const PI = phase.icon;
  let n = 0;
  const go = (id: string) => { setActive(id); setTab("phases"); };

  const stripRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [edge, setEdge] = useState({ left: false, right: true });
  const updateEdge = () => { const el = stripRef.current; if (!el) return; setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 }); };
  const stopScroll = () => { if (timer.current) { cancelAnimationFrame(timer.current); timer.current = null; } };
  const startScroll = (d: 1 | -1) => { stopScroll(); const tick = () => { stripRef.current?.scrollBy({ left: d * 6 }); timer.current = requestAnimationFrame(tick); }; timer.current = requestAnimationFrame(tick); };
  useEffect(() => stopScroll, []);
  const bodyRef = useRef<HTMLDivElement>(null);
  const downTimer = useRef<number | null>(null);
  const [more, setMore] = useState(false);
  const updateMore = () => { const el = bodyRef.current; if (!el) return; setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 8); };
  const stopDown = () => { if (downTimer.current) { cancelAnimationFrame(downTimer.current); downTimer.current = null; } };
  const startDown = () => { stopDown(); const tick = () => { const el = bodyRef.current; if (!el) return; el.scrollBy({ top: 5 }); if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) { stopDown(); updateMore(); return; } downTimer.current = requestAnimationFrame(tick); }; downTimer.current = requestAnimationFrame(tick); };
  useEffect(() => { stopDown(); const id = requestAnimationFrame(updateMore); return () => { cancelAnimationFrame(id); stopDown(); }; }, [active, tab, open, full]);
  useEffect(() => {
    if (!open || tab !== "phases") return;
    const id = requestAnimationFrame(() => {
      stripRef.current?.querySelector<HTMLElement>(`[data-phase="${active}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      updateEdge();
    });
    return () => cancelAnimationFrame(id);
  }, [active, open, tab]);

  useEffect(() => {
    if (!open || tab !== "phases") return;
    const step = (dir: 1 | -1) => {
      setActive((a) => { const i = PHASES.findIndex((p) => p.id === a); return PHASES[Math.min(Math.max(i + dir, 0), PHASES.length - 1)].id; });
      // Soltar o foco evita o contorno preto do navegador embaixo das fases.
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== document.body) el.blur();
    };
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, tab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("flex flex-col gap-0 overflow-hidden p-0 transition-all", full ? "h-screen w-screen max-w-none rounded-none sm:rounded-none" : "h-[94vh] max-w-7xl")}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b bg-gradient-to-r from-primary/10 via-background to-background px-6 py-5 pr-14">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md"><Map className="h-6 w-6" /></div>
            <div>
              <DialogTitle className="text-2xl font-semibold tracking-tight">Fases de Crescimento <span className="text-primary">Eternum</span></DialogTitle>
              <DialogDescription className="text-sm">Checklist de implementação · Nível Black{first ? ` · ${first}` : ""}</DialogDescription>
            </div>
          </div>
          <div className="flex min-w-0 max-w-full items-center gap-2">
          <div className="inline-flex min-w-0 max-w-full overflow-x-auto rounded-xl border bg-muted/50 p-1">
            {([["map", "Mapa geral", Network], ["phases", "Fases", ListChecks], ["4fa", "Método 4FA", LayoutGrid]] as const).map(([k, l, I]) => (
              <button key={k} onClick={() => setTab(k)} className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", tab === k ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                <I className="h-4 w-4" />{l}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={() => setFull((f) => !f)} aria-label={full ? "Sair da tela cheia" : "Tela cheia"} title={full ? "Sair da tela cheia" : "Tela cheia"}>
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          </div>
        </div>

        {tab === "phases" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Jornada */}
            <div className="group/strip relative border-b bg-muted/20">
            {([-1, 1] as const).map((d) => (
              <button key={d} type="button" tabIndex={-1} aria-label={d === 1 ? "Rolar fases para a direita" : "Rolar fases para a esquerda"}
                onMouseEnter={() => startScroll(d)} onMouseLeave={stopScroll}
                className={cn("absolute inset-y-0 z-10 flex w-10 items-center justify-center text-muted-foreground/70 opacity-0 transition-opacity hover:text-primary group-hover/strip:opacity-100", d === 1 ? "right-0 bg-gradient-to-l from-background via-background/80 to-transparent" : "left-0 bg-gradient-to-r from-background via-background/80 to-transparent", (d === 1 ? !edge.right : !edge.left) && "pointer-events-none !opacity-0")}>
                {d === 1 ? <ChevronRight className="h-5 w-5" /> : <ChevronRight className="h-5 w-5 rotate-180" />}
              </button>
            ))}
            <div ref={stripRef} onScroll={updateEdge} className="overflow-x-auto px-6 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ol className="flex min-w-max items-center">
                {PHASES.map((p, i) => {
                  const pc = counts[p.id]; const on = p.id === active; const complete = pc.total > 0 && pc.done === pc.total; const I = p.icon;
                  return (
                    <li key={p.id} data-phase={p.id} className="flex items-center">
                      <button onMouseDown={(e) => e.preventDefault()} onClick={() => setActive(p.id)} className={cn("group flex items-center gap-3 rounded-xl border px-3 py-2 text-left outline-none transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&:focus:not(:focus-visible)]:ring-0", on ? "border-primary bg-primary/10 shadow-sm" : "border-transparent hover:bg-muted")}>
                        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors", complete ? "border-success bg-success text-success-foreground" : on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}>
                          {complete ? <Check className="h-5 w-5" /> : <I className="h-5 w-5" />}
                        </span>
                        <span className="leading-tight">
                          <span className={cn("block text-[11px] font-semibold uppercase tracking-wider", on ? "text-primary" : "text-muted-foreground")}>{p.tag}</span>
                          <span className="block max-w-[150px] text-sm font-medium">{p.title}</span>
                          <span className="block text-xs tabular-nums text-muted-foreground">{pc.done}/{pc.total}</span>
                        </span>
                      </button>
                      {i < PHASES.length - 1 && <button onClick={() => setActive(PHASES[i + 1].id)} aria-label={`Ir para ${PHASES[i + 1].tag}`} title={`Ir para ${PHASES[i + 1].tag}`} className="mx-1 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/60 transition-all duration-200 hover:translate-x-1 hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><ChevronRight className="h-4 w-4" /></button>}
                    </li>
                  );
                })}
              </ol>
            </div>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col">
            <div key={phase.id} ref={bodyRef} onScroll={updateMore} className="min-h-0 flex-1 animate-fade-in overflow-y-auto">
              <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
                <header className="flex flex-wrap items-center gap-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary"><PI className="h-8 w-8" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{phase.tag}</p>
                    <h2 className="text-3xl font-semibold tracking-tight">{phase.title}</h2>
                  </div>
                  <div className="w-full sm:w-56">
                    <div className="mb-1.5 flex justify-between text-sm"><span className="text-muted-foreground">Progresso</span><span className="font-semibold tabular-nums">{pct}%</span></div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                  </div>
                </header>

                {phase.tip && (
                  <div className="flex gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
                    <Lightbulb className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                    <div>
                      <p className="mb-1 text-sm font-semibold text-primary">Orientação para a consultora</p>
                      <p className="text-base leading-relaxed">{phase.tip}</p>
                    </div>
                  </div>
                )}

                {phase.groups.map((g, gi) => (
                  <section key={gi} className="space-y-3">
                    {g.alert && (
                      <div className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-5 py-4">
                        <AlertTriangle className="h-6 w-6 shrink-0 text-warning" />
                        <div><p className="text-xs font-bold uppercase tracking-wider text-warning">Sintoma</p><p className="text-lg font-semibold">{g.alert}</p></div>
                      </div>
                    )}
                    {g.label && <h3 className="flex items-center gap-3 pt-2 text-lg font-semibold"><span className="h-5 w-1 rounded-full bg-primary" />{g.label}</h3>}
                    <div className="grid gap-3 md:grid-cols-2">
                      {g.items.map((it, ii) => {
                        const k = `${phase.id}-${gi}-${ii}`; const on = done.has(k); n++;
                        return (
                          <button key={k} onClick={() => toggle(k)} className={cn("flex items-center gap-4 rounded-xl border bg-card px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", on && "border-success/40 bg-success/5")}>
                            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums", on ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground")}>{on ? <Check className="h-4 w-4" /> : n}</span>
                            <span className={cn("text-[15px] leading-snug", on && "text-muted-foreground line-through")}>{it}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}

                <div className="flex justify-between border-t pt-5">
                  <Button variant="outline" disabled={idx === 0} onClick={() => setActive(PHASES[idx - 1].id)}>← {idx > 0 ? PHASES[idx - 1].tag : "Anterior"}</Button>
                  <span className="hidden self-center text-xs text-muted-foreground sm:block">Use as setas ← → do teclado</span>
                  <Button disabled={idx === PHASES.length - 1} onClick={() => setActive(PHASES[idx + 1].id)}>{idx < PHASES.length - 1 ? PHASES[idx + 1].tag : "Próxima"} →</Button>
                </div>
              </div>
            </div>
            <div aria-hidden onMouseEnter={startDown} onMouseLeave={stopDown}
              className={cn("absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-background via-background/70 to-transparent transition-opacity duration-300", more ? "opacity-100" : "pointer-events-none opacity-0")} />
            </div>
          </div>
        ) : tab === "4fa" ? <FourFA /> : <MacroMap counts={counts} onPick={go} on4fa={() => setTab("4fa")} />}
      </DialogContent>
    </Dialog>
  );
}

const FUNNEL_VAR: Record<string, string> = { "Tráfego Pago": "--funnel-1", "Tráfego Alheio": "--funnel-2", "Indicação": "--funnel-3", "Lista Quente": "--funnel-4" };
const fc = (title: string, a = 1) => `hsl(var(${FUNNEL_VAR[title]}) / ${a})`;

function FunnelCard({ f, fi }: { f: (typeof FUNNELS)[number]; fi: number }) {
  const m = FUNNEL_META[f.title]; const I = m.icon;
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 pt-7 shadow-sm">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: fc(f.title) }} />
      <div className="mb-5 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: fc(f.title, 0.14) }}>
          <I className="h-6 w-6" strokeWidth={2} style={{ color: fc(f.title) }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: fc(f.title) }}>Funil {fi + 1}</p>
          <h3 className="text-[22px] font-semibold leading-tight tracking-tight text-foreground">{f.title}</h3>
          <p className="mt-1 text-sm font-medium leading-relaxed text-muted-foreground">{m.desc}</p>
        </div>
      </div>
      <ul className="grid grid-cols-1 content-start gap-2 sm:grid-cols-2">
        {f.items.map((it) => (
          <li key={it} className={cn("flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-[15px] text-foreground/80", it.length > 22 && "sm:col-span-2")} style={{ background: fc(f.title, 0.09) }}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: fc(f.title) }} />
            <span className="truncate">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FourFA() {
  const G = 44; // metade do espaço entre os cartões (88px)
  return (
    <div className="min-h-0 flex-1 animate-fade-in overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.25em] text-primary">Método 4FA</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Os 4 Funis <span className="text-primary">dos Anjos</span></h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">Quatro caminhos para trazer clientes. Pergunte quais ela já usa e decidam juntas o que vale ativar.</p>
        </div>
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 md:hidden">
          <span className="text-base font-black tracking-tight text-primary-foreground">4FA</span>
          <span className="text-xs font-medium text-primary-foreground/90">· 4 Funis dos Anjos</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {FUNNELS.map((f, fi) => <FunnelCard key={f.title} f={f} fi={fi} />)}
        </div>
        {/* Grade 3x3: o selo fica na célula central, exatamente no meio do vão entre os 4 cartões. */}
        <div className="hidden md:grid" style={{ gridTemplateColumns: `1fr ${G * 2}px 1fr`, gridTemplateRows: `auto ${G * 2}px auto` }}>
          {FUNNELS.map((f, fi) => (
            <div key={f.title} style={{ gridColumn: fi % 2 ? 3 : 1, gridRow: fi < 2 ? 1 : 3 }}><FunnelCard f={f} fi={fi} /></div>
          ))}
          <div className="relative flex items-center justify-center" style={{ gridColumn: 2, gridRow: 2 }}>
            <svg width={G * 2} height={G * 2} className="pointer-events-none absolute inset-0" viewBox={`0 0 ${G * 2} ${G * 2}`} aria-hidden>
              {FUNNELS.map((f, i) => (
                <line key={f.title} x1={G} y1={G} x2={i % 2 ? G * 2 : 0} y2={i < 2 ? 0 : G * 2} stroke={fc(f.title)} strokeWidth={1.5} />
              ))}
            </svg>
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg ring-4 ring-background">
              <span className="text-base font-black tracking-tight text-primary-foreground">4FA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MacroMap({ counts, onPick, on4fa }: { counts: Record<string, { total: number; done: number }>; onPick: (id: string) => void; on4fa: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const fit = () => {
    const b = box.current, c = inner.current; if (!b || !c) return;
    const z = Math.max(0.5, Math.min(1, (b.clientWidth - 32) / c.scrollWidth));
    setZoom(z);
    requestAnimationFrame(() => { b.scrollLeft = (b.scrollWidth - b.clientWidth) / 2; b.scrollTop = 0; });
  };
  useLayoutEffect(() => { fit(); }, []);
  useEffect(() => { const b = box.current, c = inner.current; if (!b || !c) return; requestAnimationFrame(() => { b.scrollLeft = (b.scrollWidth - b.clientWidth) / 2; }); }, [zoom]);
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button") || !box.current) return;
    drag.current = { x: e.clientX, y: e.clientY, l: box.current.scrollLeft, t: box.current.scrollTop };
    setGrabbing(true); box.current.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current, b = box.current; if (!d || !b) return;
    b.scrollLeft = d.l - (e.clientX - d.x); b.scrollTop = d.t - (e.clientY - d.y);
  };
  const onUp = () => { drag.current = null; setGrabbing(false); };
  const zb = "flex h-9 w-9 items-center justify-center text-muted-foreground transition hover:bg-muted hover:text-foreground";
  return (
    <div className="relative min-h-0 flex-1 animate-fade-in">
    <div className="absolute bottom-4 right-4 z-10 flex overflow-hidden rounded-xl border bg-card shadow-md">
      <button type="button" className={zb} aria-label="Diminuir" title="Diminuir" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}><ZoomOut className="h-4 w-4" /></button>
      <button type="button" className={cn(zb, "w-14 border-x text-xs font-medium tabular-nums")} title="Ajustar à tela" onClick={fit}>{Math.round(zoom * 100)}%</button>
      <button type="button" className={zb} aria-label="Aumentar" title="Aumentar" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}><ZoomIn className="h-4 w-4" /></button>
      <button type="button" className={cn(zb, "border-l")} aria-label="Ajustar à tela" title="Ajustar à tela" onClick={fit}><Maximize className="h-4 w-4" /></button>
    </div>
    <div ref={box} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      className={cn("h-full select-none overflow-auto bg-muted/20 [background-image:radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:20px_20px] [scrollbar-width:thin]", grabbing ? "cursor-grabbing" : "cursor-grab")}>
      <div ref={inner} className="mx-auto w-max px-6 py-8" style={{ zoom }}>
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.25em] text-primary">Visão macro</span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Mapa da <span className="text-primary">jornada completa</span></h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">Do onboarding à conversão, com os sintomas de cada fase e os 4 funis. Clique numa fase para abrir os detalhes.</p>
        </div>
        <div className="mx-auto w-max">
          {/* Raiz */}
          <div className="flex justify-center">
            <div className="flex items-center gap-3 rounded-2xl bg-primary px-6 py-3 text-primary-foreground shadow-lg">
              <Map className="h-5 w-5" /><span className="text-lg font-semibold">Jornada Eternum · Nível Black</span>
            </div>
          </div>
          <div className="mx-auto h-8 w-0.5 bg-primary/60" />
          {/* Ramos das fases */}
          <div className="flex items-start">
            {PHASES.map((p, i) => {
              const I = p.icon; const c = counts[p.id]; const complete = c.total > 0 && c.done === c.total;
              const branches = p.groups.flatMap((g) => [g.alert ? { k: "alert", t: g.alert } : null, g.label ? { k: "label", t: g.label } : null]).filter(Boolean) as { k: string; t: string }[];
              const first = i === 0; const last = i === PHASES.length - 1;
              return (
                <div key={p.id} className={cn("relative flex flex-col items-center px-3", p.id === "f3" ? "w-[420px]" : "w-[210px]")}>
                  <span className={cn("absolute top-0 h-0.5 bg-primary/60", first ? "left-1/2 right-0" : last ? "left-0 right-1/2" : "inset-x-0")} />
                  <span className="h-6 w-0.5 bg-primary/60" />
                  <button onClick={() => onPick(p.id)} className="group w-full rounded-2xl border-2 border-primary/50 bg-card p-4 text-left shadow-md transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                    <div className="flex items-center gap-3">
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary-foreground", complete ? "bg-success" : "bg-primary")}>{complete ? <Check className="h-5 w-5" /> : <I className="h-5 w-5" />}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{p.tag}</p>
                        <p className="text-sm font-semibold leading-snug">{p.title}</p>
                      </div>
                    </div>
                    <p className="mt-2 flex items-center justify-end gap-1 text-xs text-muted-foreground"><span className="tabular-nums">{c.done}/{c.total} itens</span><ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></p>
                  </button>
                  {branches.length > 0 && (
                    <div className="relative mt-0 w-full pl-6">
                      <span className="absolute bottom-5 left-3 top-0 w-0.5 bg-border" />
                      {branches.map((b) => (
                        <div key={b.t} className="relative mt-3">
                          <span className="absolute -left-3 top-1/2 h-0.5 w-3 bg-border" />
                          {b.k === "alert" ? (
                            <div className="flex items-start gap-1.5 rounded-xl bg-warning/10 px-3 py-2 text-xs font-medium leading-snug"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />{b.t}</div>
                          ) : (
                            <div className="flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-xs font-medium"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{b.t}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {p.id === "f3" && (
                    <button type="button" onClick={on4fa} title="Abrir o Método 4FA" className="group/4fa mt-3 flex w-full flex-col items-center rounded-2xl transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                      <span className="h-5 w-0.5 bg-primary/60" />
                      <div className="rounded-full bg-primary px-4 py-1 text-xs font-black tracking-wide text-primary-foreground shadow">4FA</div>
                      <span className="h-4 w-0.5 bg-primary/60" />
                      <div className="grid w-full grid-cols-2 gap-2">
                        {FUNNELS.map((f) => {
                          const FI = FUNNEL_META[f.title].icon;
                          return (
                            <div key={f.title} className="relative overflow-hidden rounded-xl border bg-card p-3 pt-3.5 shadow-sm">
                              <span className="absolute inset-x-0 top-0 h-1" style={{ background: fc(f.title) }} />
                              <p className="flex items-center gap-2 text-sm font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: fc(f.title, 0.14) }}><FI className="h-4 w-4" style={{ color: fc(f.title) }} /></span>{f.title}</p>
                              <ul className="mt-2 space-y-1">
                                {f.items.map((it) => <li key={it} className="flex items-center gap-1.5 text-xs text-foreground/80"><span className="h-1 w-1 shrink-0 rounded-full" style={{ background: fc(f.title) }} /><span className="truncate">{it}</span></li>)}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-70 transition group-hover/4fa:opacity-100">Abrir Método 4FA<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/4fa:translate-x-1" /></span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
