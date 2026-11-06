import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HelpCircle, List, Workflow, ArrowDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsMobile } from "@/hooks/use-mobile";
import { GuidedTour, type TourStep } from "@/components/csProcesses/GuidedTour";
import { ProcessFlow, StepCard, CycleView, EventTimeline, isCycle, type StepStatus } from "@/components/csProcesses/ProcessFlow";
import { Copy, AlertTriangle, CheckSquare, Search, ExternalLink, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { csProcesses, type Block } from "@/lib/csProcesses";

const accents = ["border-l-purple-500", "border-l-teal-500", "border-l-blue-500"];
const dots = ["bg-purple-500", "bg-teal-500", "bg-blue-500"];
const URL_RE = /(https?:\/\/[^\s)]+)/g;

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{[^}]+\}|https?:\/\/[^\s)]+)/g).map((p, i) =>
        /^\{/.test(p) ? <mark key={i} className="rounded bg-primary/15 px-1 text-primary">{p}</mark>
        : /^https?:/.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-primary underline">{p}</a>
        : <span key={i}>{p.replace(/\*\*/g, "")}</span>)}
    </>
  );
}

function BlockView({ b, first }: { b: Block; first?: boolean }) {
  if (b.kind === "message") {
    const clean = b.text.replace(/\*\*/g, "");
    return (
      <div className="rounded-lg border bg-muted/40 p-3" data-tour={first ? "copy" : undefined}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Mensagem pronta</span>
          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => { navigator.clipboard.writeText(clean); toast.success("Mensagem copiada"); }}>
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
        </div>
        <p className="whitespace-pre-wrap text-sm"><Rich text={b.text} /></p>
      </div>
    );
  }
  if (b.kind === "alert") return <div data-tour={first ? "alert" : undefined} className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-sm"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /><Rich text={b.text} /></div>;
  if (b.kind === "task") return <div className="flex gap-2 text-sm"><CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span><Rich text={b.text} /></span></div>;
  if (b.kind === "meta") return <div className="flex gap-2 text-sm"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span><b>{b.label}:</b> <Rich text={b.text} /></span></div>;
  const urls = b.text.match(URL_RE);
  if (urls && b.text.replace(URL_RE, "").replace(/[:\-\s]/g, "").length < 20) {
    return <a href={urls[0]} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" className="gap-1"><ExternalLink className="h-3.5 w-3.5" />{b.text.replace(URL_RE, "").replace(/:\s*$/, "") || "Abrir link"}</Button></a>;
  }
  return <p className="text-sm text-muted-foreground"><Rich text={b.text} /></p>;
}

const MAIN_TOUR: TourStep[] = [
  { text: "Bem-vinda aos Processos Eternum! 👋\nAqui está tudo que você precisa para conduzir cada cliente e cada encontro do jeito Eternum. Vamos fazer um tour rapidinho?", primary: undefined, secondary: "Agora não" },
  { target: "menu", text: "Aqui ficam os 3 processos: Onboarding, Encontro Online e Encontro Presencial. Clique em um para abrir." },
  { target: "toggle", text: "Prefere ver o caminho todo de uma vez? Troque para o Fluxograma e veja cada fase ligada à próxima." },
  { target: "step", text: "Cada cartão é uma etapa. Clique para ver as mensagens, as tarefas e os links." },
  { target: "copy", text: "As mensagens já estão prontas. Troque o que estiver destacado (como {Nome}) e clique em Copiar para mandar no WhatsApp." },
  { target: "checklist", text: "Marque cada tarefa conforme for fazendo. O progresso fica salvo por cliente, então você sempre sabe onde parou." },
  { target: "alert", text: "Fique de olho nos avisos em destaque. São os passos que não podem ser esquecidos, como salvar a gravação do onboarding no Drive." },
  { text: "Pronto! Agora é com você 🚀\nSe precisar rever o tour, é só clicar no ? aqui no canto.", primary: "Começar" },
];
MAIN_TOUR[0].primary = "Bora!";

function useTourSeen(key: string, enabled: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("user_tour_views").select("tour_key").eq("user_id", u.user.id).eq("tour_key", key).maybeSingle();
      if (alive && !data) setOpen(true);
    })();
    return () => { alive = false; };
  }, [key, enabled]);
  const close = useCallback(async () => {
    setOpen(false);
    const { data: u } = await supabase.auth.getUser();
    if (u.user) await supabase.from("user_tour_views").upsert({ user_id: u.user.id, tour_key: key });
  }, [key]);
  return { open, setOpen, close };
}

export default function CSProcesses() {
  const [params] = useSearchParams();
  const clientId = params.get("client");
  const eventId = params.get("event");
  const target = clientId ? { type: "client" as const, id: clientId } : eventId ? { type: "event" as const, id: eventId } : null;
  const { currentUser } = useCurrentUser();
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const [active, setActive] = useState(eventId ? 1 : 0);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"list" | "flow">(() => (localStorage.getItem("csProcessesView") === "flow" ? "flow" : "list"));
  const [openKey, setOpenKey] = useState<string | null>(null);
  useEffect(() => { localStorage.setItem("csProcessesView", view); }, [view]);

  const proc = csProcesses[active];
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  const { data: targetName } = useQuery({
    queryKey: ["cs-process-target", target?.type, target?.id],
    enabled: !!target,
    queryFn: async () => {
      if (target!.type === "client") { const { data } = await supabase.from("clients").select("name").eq("id", target!.id).maybeSingle(); return data?.name as string | undefined; }
      const { data } = await supabase.from("events").select("title").eq("id", target!.id).maybeSingle(); return data?.title as string | undefined;
    },
  });
  const progressKey = ["cs-process-progress", target?.type, target?.id, proc?.id];
  const { data: doneKeys = new Set<string>() } = useQuery({
    queryKey: progressKey,
    enabled: !!target && !!proc,
    queryFn: async () => {
      const { data } = await supabase.from("cs_process_progress").select("step_key").eq("target_type", target!.type).eq("target_id", target!.id).eq("process_id", proc.id);
      return new Set((data ?? []).map((r) => r.step_key));
    },
  });
  const toggle = async (key: string, on: boolean) => {
    if (!target || !currentUser) return;
    if (on) await supabase.from("cs_process_progress").upsert({ account_id: currentUser.account_id, process_id: proc.id, target_type: target.type, target_id: target.id, step_key: key }, { onConflict: "account_id,process_id,target_type,target_id,step_key" });
    else await supabase.from("cs_process_progress").delete().eq("target_type", target.type).eq("target_id", target.id).eq("process_id", proc.id).eq("step_key", key);
    qc.invalidateQueries({ queryKey: progressKey });
  };

  const allKeys = useMemo(() => (proc?.phases ?? []).flatMap((ph, pi) => ph.steps.map((_, si) => `${pi}-${si}`)), [proc]);
  const currentKey = target ? allKeys.find((k) => !doneKeys.has(k)) : undefined;
  const statusOf = useCallback((k: string): StepStatus => !target ? undefined : doneKeys.has(k) ? "done" : k === currentKey ? "current" : "pending", [target, doneKeys, currentKey]);
  const pct = allKeys.length ? Math.round((allKeys.filter((k) => doneKeys.has(k)).length / allKeys.length) * 100) : 0;

  const phases = useMemo(() => (proc?.phases ?? []).map((ph, pi) => ({ ...ph, pi, steps: ph.steps.map((s, si) => ({ s, key: `${pi}-${si}` })).filter(({ s }) => !q.trim() || norm(s.title + JSON.stringify(s.blocks)).includes(norm(q))) })).filter((ph) => ph.steps.length), [proc, q]);

  const mainTour = useTourSeen("cs_processes_main", true);
  const miniTour = useTourSeen("cs_processes_client", !!clientId && !mainTour.open);
  const startMain = () => { setView("list"); setQ(""); mainTour.setOpen(true); };
  const MINI: TourStep[] = [
    { target: "phases", text: `Este é o onboarding da ${targetName ?? "cliente"}. Siga as fases de cima para baixo.` },
    { target: "current", text: "A etapa atual fica destacada. É por ela que você continua." },
    { target: "cycle", text: "Quando terminar o onboarding, o ciclo mensal de acompanhamento começa aqui embaixo." },
  ];

  const opened = openKey ? (() => { const [pi, si] = openKey.split("-").map(Number); return proc.phases[pi]?.steps[si]; })() : null;
  let firstTaskMarked = false, firstStepMarked = false;
  let firstMsg = true, firstAlert = true;

  const renderBlocks = (key: string, blocks: Block[]) => blocks.map((b, j) => {
    if (b.kind === "task") {
      const tk = `${key}-t${j}`; const tour = !firstTaskMarked; firstTaskMarked = true;
      return (
        <label key={j} data-tour={tour ? "checklist" : undefined} className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox disabled={!target} checked={doneKeys.has(tk)} onCheckedChange={(v) => toggle(tk, !!v)} className="mt-0.5" />
          <span className={doneKeys.has(tk) ? "text-muted-foreground line-through" : ""}><Rich text={b.text} /></span>
        </label>
      );
    }
    const isFirst = (b.kind === "message" && firstMsg) || (b.kind === "alert" && firstAlert);
    if (b.kind === "message") firstMsg = false; if (b.kind === "alert") firstAlert = false;
    return <BlockView key={j} b={b} first={isFirst} />;
  });

  const stepFooter = (key: string) => target && (
    <Button size="sm" variant={doneKeys.has(key) ? "secondary" : "default"} onClick={() => toggle(key, !doneKeys.has(key))}>
      {doneKeys.has(key) ? "Desmarcar etapa" : "Marcar etapa como feita"}
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Processos Eternum</h1>
          <p className="text-sm text-muted-foreground">{target ? `Acompanhando: ${targetName ?? "…"}` : "Passo a passo, mensagens prontas e links de cada processo."}</p>
        </div>
        <div data-tour="toggle" className="inline-flex rounded-lg border p-0.5">
          <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} className="gap-1" onClick={() => setView("list")}><List className="h-4 w-4" />Lista</Button>
          <Button size="sm" variant={view === "flow" ? "secondary" : "ghost"} className="gap-1" onClick={() => setView("flow")}><Workflow className="h-4 w-4" />Fluxograma</Button>
        </div>
      </div>

      <div data-tour="menu" className="grid gap-3 sm:grid-cols-3">
        {csProcesses.map((p, i) => (
          <button key={p.id} onClick={() => setActive(i)} className={`rounded-xl border border-l-4 p-3 text-left shadow-sm transition ${accents[i % 3]} ${i === active ? "bg-accent" : "hover:bg-accent/50"}`}>
            <div className="font-medium">{p.title}</div>
            <div className="text-xs text-muted-foreground">{p.phases.length} fases · {p.phases.reduce((a, f) => a + f.steps.length, 0)} etapas</div>
          </button>
        ))}
      </div>

      {target && <div className="space-y-1"><div className="flex justify-between text-xs text-muted-foreground"><span>Progresso</span><span>{pct}%</span></div><Progress value={pct} /></div>}
      {active > 0 && <EventTimeline accent={dots[active % 3]} />}

      {view === "flow" && !isMobile ? (
        <ProcessFlow process={proc} accent={dots[active % 3]} statusOf={statusOf} open={setOpenKey} />
      ) : (
        <>
          {view === "list" && (
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar etapa ou mensagem…" className="pl-9" />
            </div>
          )}
          <div data-tour="phases" className="space-y-6">
            {phases.length === 0 && <p className="text-sm text-muted-foreground">Nada encontrado.</p>}
            {phases.map((ph, idx) => (
              <section key={ph.title} className="relative border-l pl-6">
                <span className={`absolute -left-1.5 top-1 h-3 w-3 rounded-full ${dots[active % 3]}`} />
                <h2 className="mb-3 font-semibold">{ph.title}</h2>
                <div className="space-y-3">
                  {ph.steps.map(({ s, key }) => {
                    const st = statusOf(key);
                    const tour = key === currentKey ? "current" : isCycle(s) ? "cycle" : !firstStepMarked ? "step" : undefined;
                    if (tour === "step") firstStepMarked = true;
                    if (view === "flow") return <div key={key} data-tour={tour}><StepCard step={s} status={st} onClick={() => setOpenKey(key)} /></div>;
                    return (
                      <div key={key} data-tour={tour} className={`animate-in fade-in space-y-2 rounded-xl border bg-card p-4 shadow-sm ${st === "done" ? "border-emerald-500/60" : st === "current" ? "border-primary ring-2 ring-primary/30" : st === "pending" ? "opacity-80" : ""}`}>
                        {s.title && <h3 className="font-medium">{st === "done" && "✓ "}{s.title}</h3>}
                        {isCycle(s) && <CycleView step={s} />}
                        {renderBlocks(key, s.blocks)}
                        {stepFooter(key)}
                      </div>
                    );
                  })}
                </div>
                {view === "flow" && idx < phases.length - 1 && <ArrowDown className="mx-auto mt-3 h-4 w-4 text-muted-foreground" />}
              </section>
            ))}
          </div>
        </>
      )}

      <Sheet open={!!opened} onOpenChange={(o) => !o && setOpenKey(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {opened && openKey && (
            <div className="space-y-3">
              <SheetHeader><SheetTitle>{opened.title || "Etapa"}</SheetTitle></SheetHeader>
              {isCycle(opened) && <CycleView step={opened} />}
              {renderBlocks(openKey, opened.blocks)}
              {stepFooter(openKey)}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Button size="icon" variant="outline" aria-label="Rever tour" className="fixed bottom-20 right-4 z-40 rounded-full shadow-md lg:bottom-6" onClick={startMain}>
        <HelpCircle className="h-5 w-5" />
      </Button>
      <GuidedTour steps={MAIN_TOUR} open={mainTour.open} onClose={mainTour.close} />
      <GuidedTour steps={MINI} open={miniTour.open && !mainTour.open} onClose={miniTour.close} />
    </div>
  );
}
