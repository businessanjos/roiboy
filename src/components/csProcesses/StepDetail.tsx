import { useState } from "react";
import { MessageCircle, Hourglass, AlertTriangle, ExternalLink, Copy, User, CalendarClock, ListChecks, CheckCircle2, Plus, Layers, Mic, AudioLines } from "lucide-react";
import { genderConsultant, genderClient } from "@/lib/consultantGender";
import { Button } from "@/components/ui/button";
import { AudioTeleprompter } from "@/components/csProcesses/AudioTeleprompter";
import { Checkbox } from "@/components/ui/checkbox";
import { OnboardingGuideButton, ONBOARDING_GUIDE_URL } from "@/components/csProcesses/OnboardingMeetingGuide";
import { GrowthPhasesButton, GROWTH_PHASES_URL } from "@/components/csProcesses/GrowthPhasesGuide";
import { toast } from "sonner";
import { fillVars, plainText, stepTitle, type Action, type StepInfo } from "@/lib/csProcessActions";
import { resolveProcessLink, replaceClientLinks, FIELD_LABEL, type ProcessClient, type ClientField } from "@/lib/csClientLinks";
import type { Step } from "@/lib/csProcesses";

type Vars = Record<string, string | undefined>;
export interface WaitState { started_at: string }

export interface StepContext {
  client: ProcessClient | null;
  onEditClient: (field: ClientField) => void;
  waits: Map<number, WaitState>;
  alertDays: (idx: number) => number;
  canConfigWait: boolean;
  onSetAlertDays: (idx: number, n: number) => void;
  onStartWait: (idx: number) => void;
  onResolveWait: (idx: number) => void;
  onDoneAction: (idx: number) => void;
}

const URL_SPLIT = /(\*\*[^*]+\*\*|\*[^*\n]+\*|\{[^}]+\}|https?:\/\/[^\s)]+)/g;

export function waitingFor(startedAt: string) {
  const h = (Date.now() - new Date(startedAt).getTime()) / 3600000;
  if (h < 24) return h < 1 ? "menos de 1 hora" : `${Math.floor(h)} h`;
  const d = Math.floor(h / 24); return `${d} ${d === 1 ? "dia" : "dias"}`;
}

export function VariableChip({ name, value }: { name: string; value?: string }) {
  return (
    <span
      title={value ? `Preenchido: ${value}` : /^(nome|cliente|primeiro[_ ]nome)$/i.test(name.trim()) ? "Ao enviar no RoyZapp, entra o nome do contato automaticamente" : "Selecione uma cliente para preencher"}
      className={`mx-0.5 inline-flex cursor-default items-center rounded-md px-1.5 py-0 text-[0.9em] font-medium ${value ? "bg-primary/15 text-foreground" : "border border-dashed border-primary/50 text-primary"}`}>
      {value ?? name}
    </span>
  );
}

export function ProcessLinkButton({ url, ctx, fallbackLabel }: { url: string; ctx?: StepContext; fallbackLabel?: string }) {
  const r = resolveProcessLink(url, ctx?.client ?? null);
  if (r.kind === "missing") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 align-middle">
        <Button size="sm" variant="outline" disabled className="gap-1.5"><ExternalLink className="h-4 w-4" />{r.label}</Button>
        <button type="button" onClick={() => ctx?.onEditClient(r.field)} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <Plus className="h-3.5 w-3.5" />Falta {FIELD_LABEL[r.field]} — adicionar
        </button>
      </span>
    );
  }
  if (r.kind === "needsClient") return (
    <Button size="sm" variant="outline" aria-disabled="true"
      className="gap-1.5 cursor-not-allowed opacity-60 hover:bg-background"
      onClick={() => toast.info("Selecione uma cliente primeiro", { description: "Escolha a cliente no topo da tela para abrir o link dela." })}>
      <ExternalLink className="h-4 w-4" />{r.label}
    </Button>
  );
  const label = r.kind === "client" ? r.label : fallbackLabel;
  if (!label) return <a href={r.url} target="_blank" rel="noreferrer" className="break-all text-primary underline">{r.url}</a>;
  return (
    <a href={r.url} target="_blank" rel="noreferrer"
      className="group mx-0.5 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 align-middle text-sm font-medium text-primary shadow-sm transition-all hover:-translate-y-px hover:border-primary/50 hover:bg-primary/15 hover:shadow">
      <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />{label}
    </a>
  );
}

export function InlineMarkdown({ text, vars = {}, ctx }: { text: string; vars?: Vars; ctx?: StepContext }) {
  return (
    <>
      {text.split(URL_SPLIT).map((p, i) => {
        if (!p) return null;
        if (/^\*\*.+\*\*$/.test(p)) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
        if (/^\*.+\*$/.test(p)) return <em key={i} className="text-muted-foreground">{p.slice(1, -1)}</em>;
        if (/^\{.+\}$/.test(p)) { const n = p.slice(1, -1); return <VariableChip key={i} name={n} value={vars[n.trim().toLowerCase()]} />; }
        if (/^https?:/.test(p)) return <ProcessLinkButton key={i} url={p} ctx={ctx} />;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function MessageCard({ a, vars, tour, ctx, onCopied }: { a: Extract<Action, { kind: "message" }>; vars: Vars; tour?: string; ctx: StepContext; onCopied: () => void }) {
  const long = a.text.split("\n").length > 3 || a.text.length > 260;
  const [open, setOpen] = useState(!long);
  const [rec, setRec] = useState(false);
  const shown = genderClient(genderConsultant(replaceClientLinks(a.text, ctx.client), vars["nome da consultora"]), ctx.client?.full_name);
  const isAudio = /áudio|audio/i.test(a.channel ?? "");
  const copy = () => { navigator.clipboard.writeText(plainText(fillVars(shown, vars))); toast.success(isAudio ? "Roteiro copiado ✓" : "Mensagem copiada ✓"); onCopied(); };
  return (
    <div data-tour={tour} className="rounded-xl border border-primary/40 bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        {isAudio ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <AudioLines className="h-3.5 w-3.5 text-primary" />{a.label ? `${a.label} · ` : ""}Roteiro de áudio
          </span>
        ) : (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{a.label ? `${a.label} · ` : ""}{a.channel}</span>
        )}
        {isAudio
          ? <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={copy} title="Copiar roteiro" aria-label="Copiar roteiro"><Copy className="h-3.5 w-3.5" /></Button>
              <Button size="sm" className="gap-1.5" onClick={() => setRec(true)}><Mic className="h-4 w-4" />Gravar</Button>
            </div>
          : <Button size="sm" className="gap-1.5" onClick={copy}><Copy className="h-4 w-4" />Copiar</Button>}
      </div>
      <p className={`whitespace-pre-wrap text-base leading-relaxed ${open ? "" : "line-clamp-3"}`}>
        {shown.split(URL_SPLIT).map((p, i) => /^https?:/.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-primary underline">{p}</a> : <InlineMarkdown key={i} text={p} vars={vars} />)}
      </p>
      {long && <button type="button" onClick={() => setOpen(!open)} className="mt-2 text-sm font-medium text-primary hover:underline">{open ? "Recolher mensagem" : "Ver mensagem completa"}</button>}
      {isAudio && (
        <AudioTeleprompter open={rec} onOpenChange={setRec} client={ctx.client} onSent={onCopied}
          script={<InlineMarkdown text={plainText(fillVars(shown, vars)).replace(/https?:\/\/\S+/g, "")} vars={vars} />} />
      )}
    </div>
  );
}

function WaitItem({ a, idx, ctx }: { a: Extract<Action, { kind: "wait" }>; idx: number; ctx: StepContext }) {
  const w = ctx.waits.get(idx);
  const days = ctx.alertDays(idx);
  return (
    <div className="rounded-lg border border-dashed px-3 py-2">
      <p className="italic text-muted-foreground"><InlineMarkdown text={a.text.replace(/\*\*/g, "")} /></p>
      {ctx.client && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {w ? (
            <>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-sm font-medium">⏳ Aguardando há {waitingFor(w.started_at)}</span>
              <span className="text-xs text-muted-foreground">desde {new Date(w.started_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => ctx.onResolveWait(idx)}><CheckCircle2 className="h-4 w-4" />Cliente respondeu</Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => ctx.onStartWait(idx)}><Hourglass className="h-4 w-4" />Começar a aguardar</Button>
          )}
        </div>
      )}
      {ctx.canConfigWait && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Aviso após {days} {days === 1 ? "dia" : "dias"} sem resposta
        </p>
      )}
    </div>
  );
}

const ICONS = { message: MessageCircle, task: ListChecks, wait: Hourglass, alert: AlertTriangle, link: ExternalLink, note: MessageCircle } as const;

function StepActionItem({ a, idx, vars, taskDone, onTask, canTick, tour, ctx }: { a: Action; idx: number; vars: Vars; taskDone?: boolean; onTask?: (v: boolean) => void; canTick: boolean; tour?: string; ctx: StepContext }) {
  const Icon = ICONS[a.kind];
  const dot = a.kind === "alert" ? "bg-destructive/15 text-destructive" : a.kind === "message" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground";
  return (
    <li data-step-action className="group relative flex scroll-mt-24 gap-4 rounded-xl pb-6 transition-shadow last:pb-0 data-[active=true]:ring-2 data-[active=true]:ring-primary/40 data-[active=true]:ring-offset-4 data-[active=true]:ring-offset-muted">
      <span className="absolute left-4 top-9 bottom-0 w-px bg-border group-last:hidden" aria-hidden />
      <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${dot}`} title={`Passo ${idx + 1}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 pt-1 text-base">
        {a.kind === "message" && <MessageCard a={a} vars={vars} tour={tour} ctx={ctx} onCopied={() => ctx.onDoneAction(idx)} />}
        {a.kind === "task" && ONBOARDING_GUIDE_URL.test(a.text) && (
          <div className="flex flex-col items-start gap-3">
            <label data-tour={tour} className="flex cursor-pointer items-start gap-3">
              <Checkbox disabled={!canTick} checked={!!taskDone} onCheckedChange={(v) => onTask?.(!!v)} className="mt-1" />
              <span className={taskDone ? "text-muted-foreground line-through" : ""}>Abrir o roteiro da reunião para direcionar perguntas e orientações, seguindo as etapas.</span>
            </label>
            <div className="pl-7"><OnboardingGuideButton clientName={ctx.client?.full_name} /></div>
          </div>
        )}
        {a.kind === "task" && GROWTH_PHASES_URL.test(a.text) && (
          <div className="flex flex-col items-start gap-3">
            <label data-tour={tour} className="flex cursor-pointer items-start gap-3">
              <Checkbox disabled={!canTick} checked={!!taskDone} onCheckedChange={(v) => onTask?.(!!v)} className="mt-1" />
              <span className={taskDone ? "text-muted-foreground line-through" : ""}>Abrir o Processo das Fases de Crescimento no Eternum — Método 4FA.</span>
            </label>
            <div className="pl-7"><GrowthPhasesButton clientName={ctx.client?.full_name} /></div>
          </div>
        )}
        {a.kind === "task" && !ONBOARDING_GUIDE_URL.test(a.text) && !GROWTH_PHASES_URL.test(a.text) && (
          <label data-tour={tour} className="flex cursor-pointer items-start gap-3">
            <Checkbox disabled={!canTick} checked={!!taskDone} onCheckedChange={(v) => onTask?.(!!v)} className="mt-1" />
            <span className={taskDone ? "text-muted-foreground line-through" : ""}><InlineMarkdown text={a.text} vars={vars} ctx={ctx} /></span>
          </label>
        )}
        {a.kind === "wait" && <WaitItem a={a} idx={idx} ctx={ctx} />}
        {a.kind === "alert" && (
          <div data-tour={tour} className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 font-medium"><InlineMarkdown text={a.text} vars={vars} ctx={ctx} /></div>
        )}
        {a.kind === "link" && <ProcessLinkButton url={a.url} ctx={ctx} fallbackLabel={a.label} />}
        {a.kind === "note" && <p className="text-muted-foreground"><InlineMarkdown text={a.text} vars={vars} ctx={ctx} /></p>}
      </div>
    </li>
  );
}

/** Links das tarefas "Abrir ..." de uma etapa (preparação da reunião). */
export function meetingLinks(info: StepInfo) {
  return info.actions.filter((a) => a.kind === "task" && /^abrir/i.test(a.text)).map((a: any) => (a.text.match(/https?:\/\/[^\s)]+/) || [])[0]).filter((u) => u && !ONBOARDING_GUIDE_URL.test(u) && !GROWTH_PHASES_URL.test(u)) as string[];
}

export function StepDetail({ step, number, phaseLabel, info, vars, canTick, doneKeys, stepKey, onTask, ctx }: {
  step: Step; number: string; phaseLabel: string; info: StepInfo; vars: Vars; canTick: boolean;
  doneKeys: Set<string>; stepKey: string; onTask: (k: string, v: boolean) => void; ctx: StepContext;
}) {
  const tours = new Set<string>();
  const tourFor = (k: string) => { const t = k === "message" ? "copy" : k === "task" ? "checklist" : k === "alert" ? "alert" : ""; if (!t || tours.has(t)) return undefined; tours.add(t); return t; };
  const links = meetingLinks(info);
  const openAll = () => {
    const urls = links.map((u) => resolveProcessLink(u, ctx.client)).filter((r) => r.kind === "static" || r.kind === "client").map((r: any) => r.url);
    urls.forEach((u) => window.open(u, "_blank", "noopener"));
    const skipped = links.length - urls.length;
    toast.success(`${urls.length} abas abertas${skipped ? ` · ${skipped} sem dado da cliente` : ""}`, { description: "Se abriu só uma, permita pop-ups do Roy no navegador." });
  };
  return (
    <article className="mx-auto w-full max-w-[760px]">
      <span className="inline-block rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">{phaseLabel}</span>
      <h2 className="mt-2 text-2xl font-semibold leading-tight">{number} {stepTitle(step.title) || phaseLabel.split(" · ")[1] || "Etapa"}</h2>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1"><User className="h-4 w-4" />{info.who}</span>
        {info.when && <span className="inline-flex items-center gap-1"><CalendarClock className="h-4 w-4" />{info.when}</span>}
        <span className="inline-flex items-center gap-1"><ListChecks className="h-4 w-4" />{info.actions.length} {info.actions.length === 1 ? "ação" : "ações"}</span>
      </div>
      {links.length >= 3 && (
        <Button className="mt-4 gap-2" onClick={openAll}><Layers className="h-4 w-4" />Abrir tudo para a reunião</Button>
      )}
      <ol className="mt-6">
        {info.actions.map((a, j) => {
          const tk = `${stepKey}-a${j}`;
          return <StepActionItem key={j} a={a} idx={j} vars={vars} canTick={canTick} ctx={ctx} taskDone={doneKeys.has(tk)}
            onTask={(v) => { onTask(tk, v); if (v) ctx.onDoneAction(j); }} tour={tourFor(a.kind)} />;
        })}
      </ol>
    </article>
  );
}
