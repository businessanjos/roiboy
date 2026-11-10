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
  const phase = PHASES.find((p) => p.id === active)!;
  const counts = useMemo(() => Object.fromEntries(PHASES.map((p) => {
    const keys = p.groups.flatMap((g, gi) => g.items.map((_, ii) => `${p.id}-${gi}-${ii}`));
    return [p.id, { total: keys.length, done: keys.filter((k) => done.has(k)).length }];
  })), [done]);
  const toggle = (k: string) => setDone((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const first = clientName?.trim().split(/\s+/)[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b px-6 py-4">
          <div>
            <DialogTitle className="text-xl">Fases de Crescimento no Eternum</DialogTitle>
            <DialogDescription>Checklist de implementação · Nível Black{first ? ` · ${first}` : ""}</DialogDescription>
          </div>
          <div className="inline-flex rounded-lg border bg-muted/40 p-1">
            {([["phases", "Fases", ListChecks], ["4fa", "Método 4FA", LayoutGrid]] as const).map(([k, l, I]) => (
              <button key={k} onClick={() => setTab(k)} className={cn("flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", tab === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <I className="h-4 w-4" />{l}
              </button>
            ))}
          </div>
        </div>

        {tab === "phases" ? (
          <div className="grid min-h-0 flex-1 md:grid-cols-[260px_1fr]">
            <nav className="flex gap-2 overflow-x-auto border-b p-3 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
              {PHASES.map((p) => {
                const c = counts[p.id]; const I = p.icon; const on = p.id === active;
                return (
                  <button key={p.id} onClick={() => setActive(p.id)} className={cn("flex min-w-[200px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors md:min-w-0", on ? "border-primary/40 bg-primary/10" : "border-transparent hover:bg-muted")}>
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}><I className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{p.tag}</span>
                      <span className="block truncate text-sm font-medium">{p.title}</span>
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">{c.done}/{c.total}</span>
                  </button>
                );
              })}
            </nav>
            <div key={phase.id} className="min-h-0 animate-fade-in overflow-y-auto p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{phase.tag}</p>
              <h3 className="mb-4 text-2xl font-semibold">{phase.title}</h3>
              {phase.tip && (
                <div className="mb-5 flex gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm leading-relaxed">
                  <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p><span className="font-semibold">Orientação para a consultora: </span>{phase.tip}</p>
                </div>
              )}
              <div className="space-y-5">
                {phase.groups.map((g, gi) => (
                  <section key={gi} className="rounded-xl border bg-card">
                    {(g.label || g.alert) && (
                      <header className="border-b px-4 py-3">
                        {g.alert
                          ? <p className="flex items-center gap-2 text-sm font-semibold text-warning"><AlertTriangle className="h-4 w-4" />Sintoma: {g.alert}</p>
                          : <p className="text-sm font-semibold">{g.label}</p>}
                      </header>
                    )}
                    <ol className="divide-y">
                      {g.items.map((it, ii) => {
                        const k = `${phase.id}-${gi}-${ii}`; const on = done.has(k);
                        return (
                          <li key={k}>
                            <button onClick={() => toggle(k)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50">
                              <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-semibold tabular-nums", on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>{on ? <Check className="h-3 w-3" /> : ii + 1}</span>
                              <span className={cn("text-sm", on && "text-muted-foreground line-through")}>{it}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 animate-fade-in overflow-y-auto p-6">
            <div className="mb-5 text-center">
              <h3 className="text-2xl font-semibold">Método 4FA — 4 Funis dos Anjos</h3>
              <p className="text-sm text-muted-foreground">Pergunte quais estratégias ela já usa e monte o quadro junto com ela.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {FUNNELS.map((f) => (
                <div key={f.title} className={cn("overflow-hidden rounded-xl border", f.tone)}>
                  <div className={cn("px-4 py-3 text-center text-lg font-semibold uppercase tracking-wide", f.head)}>{f.title}</div>
                  <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
                    {f.items.map((it) => (
                      <div key={it} className={cn("flex min-h-14 items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-medium shadow-sm", f.chip)}>{it}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
