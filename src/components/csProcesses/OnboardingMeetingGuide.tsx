import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpenCheck, MonitorUp, TrendingUp, HeartHandshake, ClipboardList, AlertTriangle, Search, Sparkles, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Roteiro nativo da reunião de onboarding (antes ficava num Canva externo). */
export const ONBOARDING_GUIDE_URL = /canva\.com\/design\/DAHQ3-2Ft-Y/i;

type Item = { id: string; text: string };
type Block = {
  title: string; subtitle?: string; icon: typeof MonitorUp;
  highlight?: string;
  warning?: string;
  groups: { label?: string; items: Item[] }[];
};

const BLOCKS: Block[] = [
  {
    title: "Análise", subtitle: "15 minutos antes do onboarding", icon: Search,
    highlight: "Análise prévia: revise tudo da cliente 15 minutos antes de entrar na reunião.",
    groups: [{ items: [
      { id: "an-roy", text: "Roy com informações do comercial" },
      { id: "an-insta", text: "Perfil do Instagram" },
      { id: "an-cadastro", text: "Cadastro empresarial" },
      { id: "an-briefing", text: "Briefing comercial" },
    ] }],
  },
  {
    title: "Cliente entrou na reunião", subtitle: "Antes de começar", icon: Sparkles,
    groups: [{ items: [
      { id: "cr-audio", text: "Teste de áudio" },
      { id: "cr-video", text: "Teste de vídeo" },
      { id: "cr-gravar", text: "Colocar para gravar no computador" },
    ] }],
  },
  {
    title: "Alinhamento e conexão", subtitle: "Abertura da reunião", icon: HeartHandshake,
    groups: [{ items: [
      { id: "al-historico", text: "Histórico breve" },
      { id: "al-acolhimento", text: "Acolhimento de boas-vindas" },
      { id: "al-apresentar", text: "Se apresentar" },
      { id: "al-qg", text: "Apresentar o QG" },
      { id: "al-horarios", text: "Alinhar horários" },
      { id: "al-compromisso", text: "Compromisso 50%" },
    ] }],
  },
  {
    title: "Alinhamento “Tá pago”", subtitle: "Entender a dor principal", icon: Sparkles,
    highlight: "O que eu precisaria te ensinar e passar aqui que se eu esclarecesse você falaria que \"tá pago\"?",
    groups: [{ items: [
      { id: "tp-dor", text: "Foca em resolver essa dor e faz ela soltar um \"tá pago\"" },
    ] }],
  },
  {
    title: "Dúvidas e esclarecimentos", subtitle: "Cadastro e briefing", icon: BookOpenCheck,
    highlight: "Dúvidas e esclarecimentos sobre as respostas do cadastro empresarial e briefing comercial.",
    groups: [{ items: [
      { id: "de-cadastro", text: "Esclarecer respostas do cadastro empresarial" },
      { id: "de-briefing", text: "Esclarecer respostas do briefing comercial" },
    ] }],
  },
  {
    title: "Prioridades", subtitle: "Tela normal", icon: ClipboardList,
    warning: "Isso será incluído no plano de ação.",
    groups: [{ items: [
      { id: "pr-pilares", text: "Fale sobre os 4 pilares" },
      { id: "pr-mkt", text: "Listem juntos até 3 prioridades para área de marketing e vendas" },
      { id: "pr-ops", text: "Listem juntos até 2 prioridades para área de operação e finanças" },
    ] }],
  },
  {
    title: "Método & marca", icon: Sparkles,
    groups: [{ items: [
      { id: "mm-importancia", text: "Explicar a importância" },
      { id: "mm-montar", text: "Ensinar a montar o método" },
      { id: "mm-exemplos", text: "Dar exemplos práticos e reais dentro do nicho dela" },
    ] }],
  },
  {
    title: "Instagram", subtitle: "Compartilhar a tela", icon: MonitorUp,
    highlight: "Objetivo: tirar um \"tá pago\".",
    groups: [{ items: [
      { id: "ig-sugestoes", text: "Pontue direcionamentos e sugestões" },
      { id: "ig-link", text: "Enviar link posicionamento do nicho dela" },
    ] }],
  },
  {
    title: "Clínica Ryka", subtitle: "Sistema de vendas", icon: MonitorUp,
    highlight: "Explicar a função e os benefícios ao implementar o sistema de vendas que já gerou mais de 1,3 bilhão em vendas de procedimentos.",
    groups: [{ items: [
      { id: "ryka-tela", text: "Compartilhar tela do sistema Clínica Ryka" },
      { id: "ryka-func", text: "Explicar o sistema e as funcionalidades" },
    ] }],
  },
  {
    title: "Vendas", subtitle: "ROI rápido", icon: TrendingUp,
    groups: [
      { label: "Se já tem lista de clientes", items: [{ id: "v-mortos", text: "Reativação dos mortos-vivos" }] },
      { label: "Se não tem clientes", items: [{ id: "v-novos", text: "Parceria, urna, influencer ou tráfego pago" }] },
    ],
  },
  {
    title: "Dúvidas sobre a conversa", subtitle: "Abrir espaço para perguntas", icon: BookOpenCheck,
    highlight: "Dúvidas sobre a conversa.",
    groups: [{ items: [
      { id: "dc-duvidas", text: "Tirar as dúvidas sobre a conversa" },
    ] }],
  },
  {
    title: "Plano de ação", subtitle: "Próximos passos", icon: ClipboardList,
    groups: [{ items: [{ id: "p-48h", text: "Enviar plano de ação em até 48 horas" }] }],
    warning: "De acordo com as prioridades listadas anteriormente.",
  },
  {
    title: "Agradecimento", subtitle: "Encerramento com segurança", icon: HeartHandshake,
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
  const [i, setI] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>(`[data-step="${i}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [i]);
  const toggle = (id: string) => setDone((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const go = useCallback((d: number) => setI((v) => Math.min(BLOCKS.length - 1, Math.max(0, v + d))), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  const b = BLOCKS[i];
  const Icon = b.icon;
  const blockDone = (x: Block) => x.groups.every((g) => g.items.every((it) => done.has(it.id)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <header className="border-b px-10 pb-6 pt-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" />Roteiro da reunião de onboarding
          </span>
          <DialogTitle className="sr-only">Roteiro da reunião</DialogTitle>
          <DialogDescription className="mt-2 text-base">
            {clientName ? <>Em reunião com <strong className="text-foreground">{clientName}</strong> · {done.size} de {TOTAL} pontos abordados</> : `${done.size} de ${TOTAL} pontos abordados`}
          </DialogDescription>
          <nav ref={navRef} className="-mx-1 mt-5 flex gap-2 overflow-x-auto scroll-smooth px-1 pb-2">
            {BLOCKS.map((x, k) => (
              <button key={x.title} type="button" data-step={k} onClick={() => setI(k)}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-4 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 py-2.5 text-left text-sm font-medium transition-all ${k === i ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:border-primary/40"}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${blockDone(x) ? "bg-primary text-primary-foreground" : k === i ? "bg-primary/20 text-primary" : "bg-muted"}`}>
                  {blockDone(x) ? <Check className="h-3.5 w-3.5" /> : k + 1}
                </span>
                <span className="truncate">{x.title}</span>
              </button>
            ))}
          </nav>
        </header>

        <section key={i} className="flex-1 overflow-y-auto px-10 py-10 animate-fade-in">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-5">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Icon className="h-8 w-8" /></span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Etapa {i + 1} de {BLOCKS.length}{b.subtitle ? ` · ${b.subtitle}` : ""}</p>
                <h2 className="mt-1 text-5xl font-semibold tracking-tight">{b.title}</h2>
              </div>
            </div>

            {b.highlight && (
              <p className="mt-8 rounded-2xl border-l-4 border-primary bg-primary/10 px-6 py-5 text-xl leading-relaxed">{b.highlight}</p>
            )}

            <div className="mt-8 space-y-7">
              {b.groups.map((g, gi) => (
                <div key={gi}>
                  {g.label && <p className="mb-3 text-lg font-semibold text-primary">{g.label}</p>}
                  <ul className="space-y-3">
                    {g.items.map((it) => {
                      const on = done.has(it.id);
                      return (
                        <li key={it.id}>
                          <button type="button" onClick={() => toggle(it.id)}
                            className={`flex w-full items-center gap-4 rounded-2xl border px-6 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 py-5 text-left text-xl transition-all hover:border-primary/50 ${on ? "border-primary/40 bg-primary/5 text-muted-foreground" : "bg-card shadow-sm"}`}>
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                              {on && <Check className="h-4 w-4" />}
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
            {b.warning && (
              <p className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-6 py-4 text-lg font-medium text-destructive">
                <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />{b.warning}
              </p>
            )}
          </div>
        </section>

        <footer className="flex items-center justify-between gap-3 border-t px-10 py-4">
          <Button variant="ghost" size="lg" className="gap-2" disabled={i === 0} onClick={() => go(-1)}><ChevronLeft className="h-5 w-5" />Anterior</Button>
          <span className="hidden text-xs text-muted-foreground sm:block">Use as setas ← → do teclado para trocar de etapa</span>
          {i < BLOCKS.length - 1
            ? <Button size="lg" className="gap-2" onClick={() => go(1)}>Próxima<ChevronRight className="h-5 w-5" /></Button>
            : <Button size="lg" className="gap-2" onClick={() => onOpenChange(false)}><Check className="h-5 w-5" />Concluir roteiro</Button>}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
