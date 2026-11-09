import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { StepDetail } from "@/components/csProcesses/StepDetail";
import { StepEditDialog } from "@/components/csProcesses/StepEditDialog";
import { StepNavigator, ProcessOverview, type NavStatus } from "@/components/csProcesses/StepNavigator";
import { toStepInfo, waitKey } from "@/lib/csProcessActions";
import { waitingFor, type StepContext } from "@/components/csProcesses/StepDetail";
import { processVars, type ProcessClient, type ClientField } from "@/lib/csClientLinks";
import { ClientProcessDataDialog } from "@/components/csProcesses/ClientProcessDataDialog";
import { InProgressBoard } from "@/components/csProcesses/InProgressBoard";
import { ProcessTrack } from "@/components/csProcesses/ProcessTrack";
import type { BoardCard } from "@/lib/csInProgress";
import { spDate } from "@/lib/csToday";
import { onboardingGroups } from "@/components/csProcesses/OnboardingFlow";
import { ProcessFlow, StepCard, CycleView, EventTimeline, isCycle, type StepStatus } from "@/components/csProcesses/ProcessFlow";
import { Copy, AlertTriangle, CheckSquare, Search, ExternalLink, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { parseProcesses, defaultProcessesText, serializeProcesses, type Block, type Step } from "@/lib/csProcesses";
import { isManagementUser } from "@/lib/access/managementRoles";
import { isMasculineName } from "@/lib/consultantGender";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

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
  const [params, setParams] = useSearchParams();
  const clientId = params.get("client");
  const eventId = params.get("event");
  const target = clientId ? { type: "client" as const, id: clientId } : eventId ? { type: "event" as const, id: eventId } : null;
  const { currentUser } = useCurrentUser();
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const procParam = params.get("proc"), stepParam = params.get("step");
  const [active, setActive] = useState(procParam ? Number(procParam) : eventId ? 1 : 0);
  const [tab, setTab] = useState<"today" | "process">("process");
  useEffect(() => { if (procParam) setActive(Number(procParam)); if (stepParam) { setSel(stepParam); setTab("process"); } }, [procParam, stepParam, clientId]);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"list" | "flow">(() => (localStorage.getItem("csProcessesView") === "flow" ? "flow" : "list"));
  const [flowReset, setFlowReset] = useState(0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(stepParam);
  useEffect(() => { localStorage.setItem("csProcessesView", view); }, [view]);

  const { data: customText } = useQuery({
    queryKey: ["cs-process-content", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data } = await supabase.from("cs_process_content").select("content").eq("account_id", currentUser!.account_id).maybeSingle();
      return (data?.content as string | undefined) ?? null;
    },
  });
  const processText = customText || defaultProcessesText;
  const csProcesses = useMemo(() => { const p = parseProcesses(processText); return p.length ? p : parseProcesses(defaultProcessesText); }, [processText]);
  const canEdit = isManagementUser(currentUser as any);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const defaultParsed = useMemo(() => parseProcesses(defaultProcessesText), []);
  const editIdx = editKey ? editKey.split("-").map(Number) : null;
  const editProc = csProcesses[Math.min(active, csProcesses.length - 1)];
  const editStep = editIdx ? editProc?.phases[editIdx[0]]?.steps[editIdx[1]] ?? null : null;
  const editOriginal = editIdx ? defaultParsed.find((p) => p.id === editProc?.id)?.phases[editIdx[0]]?.steps[editIdx[1]] ?? null : null;
  const saveStep = async (st: Step) => {
    if (!currentUser || !editIdx) return;
    const next = structuredClone(csProcesses);
    const target = next[Math.min(active, next.length - 1)];
    target.phases[editIdx[0]].steps[editIdx[1]] = st;
    setSaving(true);
    const { error } = await supabase.from("cs_process_content").upsert({ account_id: currentUser.account_id, content: serializeProcesses(next), updated_by: currentUser.id, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar. Só gestores podem editar."); return; }
    toast.success("Etapa atualizada para toda a equipe");
    setEditKey(null);
    qc.invalidateQueries({ queryKey: ["cs-process-content"] });
  };

  const proc = csProcesses[Math.min(active, csProcesses.length - 1)];
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  const { data: targetName } = useQuery({
    queryKey: ["cs-process-target", target?.type, target?.id],
    enabled: !!target,
    queryFn: async () => {
      if (target!.type === "client") { const { data } = await supabase.from("clients").select("full_name").eq("id", target!.id).maybeSingle(); return data?.full_name as string | undefined; }
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

  const lastActive = useRef(active);
  useEffect(() => { if (lastActive.current !== active) { lastActive.current = active; if (!stepParam) setSel(null); } }, [active, stepParam]);
  const infoOf = useCallback((k: string) => { const [pi, si] = k.split("-").map(Number); const st = proc?.phases[pi]?.steps[si]; return st ? toStepInfo(st) : null; }, [proc]);
  const visibleKeys = useMemo(() => allKeys.filter((k) => { if (!q.trim()) return true; const [pi, si] = k.split("-").map(Number); const st = proc.phases[pi].steps[si]; return norm(st.title + JSON.stringify(st.blocks)).includes(norm(q)); }), [allKeys, q, proc]);
  const selKey = sel && visibleKeys.includes(sel) ? sel : (currentKey && visibleKeys.includes(currentKey) ? currentKey : visibleKeys[0] ?? "0-0");
  const selIdx = allKeys.indexOf(selKey);
  const [spi, ssi] = selKey.split("-").map(Number);
  const selStep = proc?.phases[spi]?.steps[ssi];
  const selInfo = selStep ? toStepInfo(selStep) : null;
  const selNumber = `${spi + 1}.${ssi + 1}`;
  const selPhaseLabel = `Fase ${spi + 1} · ${(proc?.phases[spi]?.title ?? "").replace(/^Fase\s+\d+\s*[—-]\s*/i, "")}`;
  const navStatus = useCallback((k: string): NavStatus => doneKeys.has(k) ? "done" : (target ? k === currentKey : k === selKey) ? "current" : "pending", [doneKeys, target, currentKey, selKey]);
  const pickPhase = (pi: number) => { const ks = allKeys.filter((k) => k.startsWith(`${pi}-`)); setSel(ks.find((k) => !doneKeys.has(k)) ?? ks[0]); };
  const completeAndNext = async () => {
    if (target && !doneKeys.has(selKey)) await toggle(selKey, true);
    if (selIdx < allKeys.length - 1) setSel(allKeys[selIdx + 1]);
  };
  const { data: client = null } = useQuery({
    queryKey: ["cs-process-client", clientId], enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name, instagram, ryka_url, platform_login, phone_e164, responsible_user_id").eq("id", clientId!).maybeSingle();
      if (!data) return null;
      const { data: prov } = await supabase.from("client_ryka_provisions").select("email").eq("client_id", clientId!).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return { ...(data as ProcessClient), loginFallback: (prov?.email as string | undefined) ?? null };
    },
  });
  const vars = useMemo(() => processVars(client, (client as any)?.loginFallback, (currentUser as any)?.name), [client, currentUser]);
  const [editField, setEditField] = useState<ClientField | undefined>();
  const [editClientOpen, setEditClientOpen] = useState(false);

  const { data: openWaits = [] } = useQuery({
    queryKey: ["cs-process-waits", clientId], enabled: !!clientId,
    queryFn: async () => (await supabase.from("cs_process_waits").select("id, process_id, step_key, action_index, started_at").eq("client_id", clientId!).is("resolved_at", null)).data ?? [],
  });
  const { data: waitSettings = [] } = useQuery({
    queryKey: ["cs-process-wait-settings", currentUser?.account_id], enabled: !!currentUser?.account_id,
    queryFn: async () => (await supabase.from("cs_process_wait_settings").select("wait_key, alert_days")).data ?? [],
  });
  const waitDays = useMemo(() => new Map(waitSettings.map((w: any) => [w.wait_key, w.alert_days as number])), [waitSettings]);
  const waitsOfStep = useCallback((k: string) => new Map(openWaits.filter((w: any) => w.process_id === proc?.id && w.step_key === k).map((w: any) => [w.action_index as number, { started_at: w.started_at as string, id: w.id as string }])), [openWaits, proc]);
  const badgeOf = useCallback((k: string) => { const ws = [...waitsOfStep(k).values()]; return ws.length ? waitingFor(ws.sort((a, b) => a.started_at.localeCompare(b.started_at))[0].started_at) : undefined; }, [waitsOfStep]);
  const refreshWaits = () => { qc.invalidateQueries({ queryKey: ["cs-process-waits"] }); qc.invalidateQueries({ queryKey: ["cs-in-progress"] }); };
  const startWait = async (k: string, idx: number) => {
    if (!client || !currentUser) return;
    const info = infoOf(k); const a = info?.actions[idx] as any;
    const { error } = await supabase.from("cs_process_waits").insert({ account_id: currentUser.account_id, client_id: client.id, process_id: proc.id, step_key: k, action_index: idx, label: a?.what ?? "responder", started_by: currentUser.id });
    if (!error) { toast.success(`Aguardando ${client.full_name.split(" ")[0]} desde agora`); refreshWaits(); }
  };
  const stepCtx = (k: string): StepContext => {
    const ws = waitsOfStep(k);
    return {
      client, onEditClient: (f) => { setEditField(f); setEditClientOpen(true); },
      waits: ws, alertDays: (i) => waitDays.get(waitKey(proc.id, k, i)) ?? 2, canConfigWait: canEdit,
      onSetAlertDays: async (i, n) => {
        const { error } = await supabase.from("cs_process_wait_settings").upsert({ account_id: currentUser!.account_id, wait_key: waitKey(proc.id, k, i), alert_days: n, updated_by: currentUser!.id, updated_at: new Date().toISOString() });
        if (error) toast.error("Só gestores podem mudar os dias de espera."); else { toast.success(`Aviso após ${n} ${n === 1 ? "dia" : "dias"}`); qc.invalidateQueries({ queryKey: ["cs-process-wait-settings"] }); }
      },
      onStartWait: (i) => startWait(k, i),
      onResolveWait: async (i) => {
        const w = ws.get(i) as any; if (!w) return;
        await supabase.from("cs_process_waits").update({ resolved_at: new Date().toISOString(), resolved_by: currentUser?.id }).eq("id", w.id);
        toast.success("Ótimo! Pode seguir para o próximo passo."); refreshWaits();
      },
      onDoneAction: (i) => { const next = infoOf(k)?.actions[i + 1]; if (client && next?.kind === "wait" && !ws.has(i + 1)) startWait(k, i + 1); },
    };
  };
  const firstWith = (kind: string) => allKeys.find((k) => infoOf(k)?.actions.some((a) => a.kind === kind));
  const [track, setTrack] = useState<{ pi: number; card: BoardCard } | null>(null);
  const goToStep = (pi: number, card: BoardCard, stepKey: string) => {
    const next = new URLSearchParams();
    next.set("proc", String(pi)); next.set("step", stepKey);
    next.set(card.kind === "client" ? "client" : "event", card.id);
    setTrack(null); setParams(next); setActive(pi); setSel(stepKey); setTab("process");
  };
  const MAIN_TOUR: TourStep[] = [
    { text: "Bem-vinda aos Processos Eternum! 👋\nAqui está tudo que você precisa para conduzir cada cliente e cada encontro do jeito Eternum. Vamos fazer um tour rapidinho?", primary: "Bora!", secondary: "Agora não" },
    { target: "board", text: "Aqui você vê cada cliente e cada encontro na fase em que está. Clique num cartão para ver a trilha completa e ir direto para a etapa atual.", onEnter: () => setTab("today") },
    { target: "menu", onEnter: () => setTab("process"), text: "Aqui ficam os 3 processos: Onboarding, Encontro Online e Encontro Presencial. Clique em um para abrir." },
    { target: "nav", text: "Aqui estão as fases e as etapas na ordem. Clique em uma etapa para abrir só ela ao lado.", onEnter: () => { setActive(0); setSel("0-0"); } },
    { target: "status", text: "O sinal mostra a situação: ✓ feito, ● atual e ○ pendente." },
    { target: "copy", text: "Mensagens ficam em cartões brancos. Clique em Copiar e mande no WhatsApp. Com uma cliente aberta, o nome dela já entra no lugar de {Nome}.", onEnter: () => { const k = firstWith("message"); if (k) setSel(k); } },
    { target: "checklist", text: "Tarefas internas têm caixinha. Marque conforme for fazendo; o progresso fica salvo por cliente.", onEnter: () => { const k = firstWith("task"); if (k) setSel(k); } },
    { target: "alert", text: "Avisos em vermelho são o que não pode ser esquecido.", onEnter: () => { const k = firstWith("alert"); if (k) setSel(k); } },
    { target: "next", text: "Terminou a etapa? Clique aqui para concluir e ir para a próxima." },
    { text: "Pronto! Agora é com você 🚀\nSe precisar rever o tour, é só clicar no ? aqui no canto.", primary: "Começar" },
  ];
  const mainTour = useTourSeen("cs_processes_main", true);
  const miniTour = useTourSeen("cs_processes_client", !!clientId && !mainTour.open);
  const startMain = () => { setTab("today"); setView("list"); setQ(""); mainTour.setOpen(true); };
  const MINI: TourStep[] = [
    { target: "nav", text: `Este é o onboarding da ${targetName ?? "cliente"}. Siga as etapas na ordem.` },
    { target: "status", text: "A etapa atual fica marcada com ●. É por ela que você continua." },
    { target: "next", text: "Ao terminar, conclua aqui e a próxima etapa abre sozinha." },
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
      <StepEditDialog open={!!editKey} onOpenChange={(o) => !o && setEditKey(null)} step={editStep} original={editOriginal} saving={saving} onSave={saveStep} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Processos Eternum</h1>
          <p className="text-sm text-muted-foreground">{target ? `Acompanhando: ${targetName ?? "…"}` : "Passo a passo, mensagens prontas e links de cada processo."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border p-0.5">
          <Button size="sm" variant={tab === "process" ? "secondary" : "ghost"} onClick={() => setTab("process")}>Processos</Button>
          <Button size="sm" variant={tab === "today" ? "secondary" : "ghost"} onClick={() => setTab("today")}>Em andamento</Button>
        </div>
        {tab === "process" && client && <Button size="sm" variant="outline" onClick={() => { setEditField(undefined); setEditClientOpen(true); }}>Dados da {client.full_name.split(" ")[0]}</Button>}
        {tab === "process" && <div data-tour="toggle" className="inline-flex rounded-lg border p-0.5">
          <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} className="gap-1" onClick={() => setView("list")}><List className="h-4 w-4" />Lista</Button>
          <Button size="sm" variant={view === "flow" ? "secondary" : "ghost"} className="gap-1" onClick={() => setView("flow")}><Workflow className="h-4 w-4" />Fluxograma</Button>
        </div>}
        </div>
      </div>

      {tab === "today" ? (
        <InProgressBoard processes={csProcesses} onOpenCard={(i, c) => setTrack({ pi: i, card: c })} />
      ) : (<>
      <div data-tour="menu" className="grid gap-3 sm:grid-cols-3">
        {csProcesses.map((p, i) => (
          <button key={p.id} onClick={() => { setActive(i); setFlowReset((v) => v + 1); }} className={`rounded-xl border border-l-4 p-3 text-left shadow-sm transition ${accents[i % 3]} ${i === active ? "bg-accent" : "hover:bg-accent/50"}`}>
            <div className="font-medium">{p.title}</div>
            <div className="text-xs text-muted-foreground">{p.phases.length} fases · {p.phases.reduce((a, f) => a + f.steps.length, 0)} etapas</div>
          </button>
        ))}
      </div>

      {target && <div className="space-y-1"><div className="flex justify-between text-xs text-muted-foreground"><span>Progresso</span><span>{pct}%</span></div><Progress value={pct} /></div>}
      {active > 0 && <EventTimeline accent={dots[active % 3]} />}

      {view === "flow" && !isMobile ? (
        <ProcessFlow groups={active === 0 ? onboardingGroups(proc) : undefined} process={proc} accent={dots[active % 3]} statusOf={statusOf} open={setOpenKey} badgeOf={badgeOf} resetKey={flowReset} />
      ) : (
        <>
          <ProcessOverview process={proc} statusOf={navStatus} onPick={pickPhase} />
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar etapa ou mensagem…" className="pl-9" />
          </div>
          {visibleKeys.length === 0 ? <p className="text-sm text-muted-foreground">Nada encontrado.</p> : (
            <div className="flex flex-col gap-6 lg:flex-row">
              <StepNavigator process={proc} selected={selKey} onSelect={setSel} statusOf={navStatus} badgeOf={badgeOf} onEdit={canEdit ? setEditKey : undefined} visible={(k) => visibleKeys.includes(k)} mobile={isMobile} />
              <div className="min-w-0 flex-1 rounded-xl bg-muted/40 p-4 md:p-6">
                {selStep && (
                  <>
                    {isCycle(selStep) && <div className="mx-auto mb-4 max-w-[760px]"><CycleView step={selStep} /></div>}
                    <StepDetail step={selStep} number={selNumber} phaseLabel={selPhaseLabel} info={selInfo!} vars={vars} ctx={stepCtx(selKey)}
                      canTick={!!target} doneKeys={doneKeys} stepKey={selKey} onTask={toggle} />
                  </>
                )}
                <div className="sticky bottom-0 mx-auto mt-8 flex max-w-[760px] items-center justify-between gap-2 border-t bg-muted/80 py-3 backdrop-blur">
                  <Button variant="ghost" disabled={selIdx <= 0} onClick={() => setSel(allKeys[selIdx - 1])}>← Etapa anterior</Button>
                  <Button data-tour="next" disabled={!target && selIdx >= allKeys.length - 1} onClick={completeAndNext}>
                    {target ? (doneKeys.has(selKey) && selIdx >= allKeys.length - 1 ? "Etapa concluída" : "Concluir e ir para a próxima →") : "Próxima etapa →"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      </>)}

      <Sheet open={!!opened} onOpenChange={(o) => !o && setOpenKey(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {opened && openKey && (
            <div className="space-y-3">
              <SheetHeader><SheetTitle>{opened.title || "Etapa"}</SheetTitle></SheetHeader>
              {isCycle(opened) && <CycleView step={opened} />}
              {(() => { const [pi, si] = openKey.split("-").map(Number); return (
                <StepDetail step={opened} number={`${pi + 1}.${si + 1}`} phaseLabel={`Fase ${pi + 1} · ${proc.phases[pi].title.replace(/^Fase\s+\d+\s*[—-]\s*/i, "")}`} info={toStepInfo(opened)} vars={vars}
                  canTick={!!target} doneKeys={doneKeys} stepKey={openKey} onTask={toggle} ctx={stepCtx(openKey)} />); })()}
              {stepFooter(openKey)}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Button size="icon" variant="outline" aria-label="Rever tour" className="fixed bottom-20 right-4 z-40 rounded-full shadow-md lg:bottom-6" onClick={startMain}>
        <HelpCircle className="h-5 w-5" />
      </Button>
      <ClientProcessDataDialog client={client} focus={editField} open={editClientOpen} onOpenChange={setEditClientOpen} />
      {track && <ProcessTrack card={track.card} process={csProcesses[track.pi]} processIndex={track.pi} today={spDate()} onClose={() => setTrack(null)} onGo={(k) => goToStep(track.pi, track.card, k)} />}
      <GuidedTour steps={MAIN_TOUR} open={mainTour.open} onClose={mainTour.close} />
      <GuidedTour steps={MINI} open={miniTour.open && !mainTour.open} onClose={miniTour.close} />
    </div>
  );
}
