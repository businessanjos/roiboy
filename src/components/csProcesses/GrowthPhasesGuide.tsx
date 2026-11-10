import { useMemo, useState } from "react";
import { Sprout, Wallet, Megaphone, Gem, Magnet, MessageSquareHeart, Handshake, Lightbulb, AlertTriangle, LayoutGrid, ListChecks, Check, Map } from "lucide-react";
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
  const [tab, setTab] = useState<"phases" | "4fa">("phases");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] max-w-7xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-gradient-to-r from-primary/10 via-background to-background px-6 py-5 pr-14">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md"><Map className="h-6 w-6" /></div>
            <div>
              <DialogTitle className="text-2xl font-semibold tracking-tight">Fases de Crescimento no Eternum</DialogTitle>
              <DialogDescription className="text-sm">Checklist de implementação · Nível Black{first ? ` · ${first}` : ""}</DialogDescription>
            </div>
          </div>
          <div className="inline-flex rounded-xl border bg-muted/50 p-1">
            {([["phases", "Fases", ListChecks], ["4fa", "Método 4FA", LayoutGrid]] as const).map(([k, l, I]) => (
              <button key={k} onClick={() => setTab(k)} className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all", tab === k ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                <I className="h-4 w-4" />{l}
              </button>
            ))}
          </div>
        </div>

        {tab === "phases" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Jornada */}
            <div className="overflow-x-auto border-b bg-muted/20 px-6 py-4">
              <ol className="flex min-w-max items-center">
                {PHASES.map((p, i) => {
                  const pc = counts[p.id]; const on = p.id === active; const complete = pc.total > 0 && pc.done === pc.total; const I = p.icon;
                  return (
                    <li key={p.id} className="flex items-center">
                      <button onClick={() => setActive(p.id)} className={cn("group flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all", on ? "border-primary bg-primary/10 shadow-sm" : "border-transparent hover:bg-muted")}>
                        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors", complete ? "border-success bg-success text-success-foreground" : on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}>
                          {complete ? <Check className="h-5 w-5" /> : <I className="h-5 w-5" />}
                        </span>
                        <span className="leading-tight">
                          <span className={cn("block text-[11px] font-semibold uppercase tracking-wider", on ? "text-primary" : "text-muted-foreground")}>{p.tag}</span>
                          <span className="block max-w-[150px] text-sm font-medium">{p.title}</span>
                          <span className="block text-xs tabular-nums text-muted-foreground">{pc.done}/{pc.total}</span>
                        </span>
                      </button>
                      {i < PHASES.length - 1 && <span className="mx-1 h-0.5 w-6 rounded bg-border" />}
                    </li>
                  );
                })}
              </ol>
            </div>

            <div key={phase.id} className="min-h-0 flex-1 animate-fade-in overflow-y-auto">
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
                          <button key={k} onClick={() => toggle(k)} className={cn("flex items-center gap-4 rounded-xl border bg-card px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm", on && "border-success/40 bg-success/5")}>
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
                  <Button disabled={idx === PHASES.length - 1} onClick={() => setActive(PHASES[idx + 1].id)}>{idx < PHASES.length - 1 ? PHASES[idx + 1].tag : "Próxima"} →</Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 animate-fade-in overflow-y-auto">
            <div className="mx-auto max-w-6xl px-6 py-8">
              <div className="mb-8 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Método 4FA</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight">Os 4 Funis dos Anjos</h2>
                <p className="mx-auto mt-2 max-w-2xl text-base text-muted-foreground">Quatro caminhos para trazer clientes. Pergunte quais ela já usa e marque juntas o que vale ativar.</p>
              </div>
              <div className="relative grid gap-5 md:grid-cols-2">
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-background bg-primary text-xl font-bold text-primary-foreground shadow-lg md:flex">4FA</div>
                {FUNNELS.map((f, fi) => {
                  const m = FUNNEL_META[f.title]; const I = m.icon;
                  return (
                    <div key={f.title} className={cn("overflow-hidden rounded-2xl border-2 bg-card shadow-sm", f.tone)}>
                      <div className={cn("h-1.5", m.bar)} />
                      <div className="p-6">
                        <div className="mb-4 flex items-start gap-4">
                          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", f.head)}><I className="h-6 w-6" /></div>
                          <div>
                            <p className={cn("text-xs font-bold uppercase tracking-wider", m.text)}>Funil {fi + 1}</p>
                            <h3 className="text-xl font-semibold">{f.title}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
                          </div>
                        </div>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {f.items.map((it) => (
                            <li key={it} className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[15px]", f.chip)}>
                              <span className={cn("h-2 w-2 shrink-0 rounded-full", m.bar)} />{it}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
