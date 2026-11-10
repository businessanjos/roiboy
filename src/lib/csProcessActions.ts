import type { Step } from "@/lib/csProcesses";

export type Action =
  | { kind: "message"; text: string; label?: string; channel: string }
  | { kind: "task"; text: string }
  | { kind: "wait"; text: string; what?: string }
  | { kind: "alert"; text: string }
  | { kind: "link"; label: string; url: string }
  | { kind: "note"; text: string };

export interface StepInfo { actions: Action[]; who: string; when?: string }

const URL_RE = /https?:\/\/[^\s)]+/;
const cleanTitle = (t: string) => t.replace(/^Etapa\s+[\d.]+\s*[—-]\s*/i, "").trim();
export const stepTitle = (t: string) => cleanTitle(t).replace(/\s*\(Consultor(a)? Eternum\)/gi, "").trim();

function linkLabel(prefix: string, url: string) {
  const tag = prefix.replace(/[:\-\s]+$/, "").trim();
  const base = /canva\.com/.test(url) ? "Abrir arte no Canva" : /drive\.google/.test(url) ? "Abrir no Drive" : tag && tag.length > 4 ? `Abrir ${tag}` : "Abrir link";
  return tag && tag.length <= 4 ? `${base} (${tag})` : base;
}

/** Converte os blocos já lidos de uma etapa em passos tipados (mensagem, tarefa, aguardar, alerta, link). */
export function toStepInfo(step: Step): StepInfo {
  const actions: Action[] = [];
  let channel = "WhatsApp";
  let pendingLabel: string | undefined;
  let when: string | undefined;
  let who = "Consultora";
  for (const b of step.blocks) {
    if (b.kind === "meta") {
      const l = b.label.toLowerCase();
      if (l === "formato") { channel = b.text.charAt(0).toUpperCase() + b.text.slice(1); continue; }
      if (l === "quando") { when = b.text; continue; }
      if (l === "quem") { who = b.text; continue; }
      if (l.startsWith("tarefa")) { actions.push({ kind: "task", text: b.text.charAt(0).toUpperCase() + b.text.slice(1) }); continue; }
      if (l === "link" && URL_RE.test(b.text)) { actions.push({ kind: "link", url: b.text.match(URL_RE)![0], label: "Abrir link" }); continue; }
      if (!b.text) { pendingLabel = l.startsWith("mensagem") && l === "mensagem" ? undefined : b.label; continue; }
      actions.push({ kind: "note", text: `**${b.label}:** ${b.text}` });
      continue;
    }
    if (b.kind === "message") { actions.push({ kind: "message", text: b.text, label: pendingLabel, channel }); pendingLabel = undefined; continue; }
    if (b.kind === "alert") { actions.push(/aguardar|espera/i.test(b.text) ? { kind: "wait", text: b.text } : { kind: "alert", text: b.text }); continue; }
    if (b.kind === "task") {
      const w = b.text.match(/(às \d{1,2}h[^,.]*)/i); if (w && !when) when = w[1];
      actions.push({ kind: "task", text: b.text }); continue;
    }
    const url = b.text.match(URL_RE);
    if (url && b.text.replace(URL_RE, "").replace(/[:\-\s]/g, "").length < 20) { actions.push({ kind: "link", url: url[0], label: linkLabel(b.text.replace(URL_RE, ""), url[0]) }); continue; }
    if (/🚨|^importante\b/i.test(b.text)) { actions.push({ kind: "alert", text: b.text.replace("🚨", "").trim() }); continue; }
    actions.push({ kind: "note", text: b.text });
  }
  if (!when && /\b(antes|no dia|dia seguinte|anterior|depois)\b/i.test(step.title) && step.title.length < 40) when = stepTitle(step.title).split(" — ")[0];
  if (/\bCX\b/.test(step.title)) who = "CX";
  return { actions: withWaits(actions), who, when };
}

/** Preenche variáveis conhecidas; as desconhecidas ficam como estão. */
export function fillVars(text: string, vars: Record<string, string | undefined>) {
  return text.replace(/\{([^}]+)\}/g, (m, k) => vars[k.trim().toLowerCase()] ?? m);
}

export const plainText = (t: string) => t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2");

const ASKS_REPLY = /(me avise|me responda|me retorne|assim que finalizar|preench|opções de agenda)/i;
function whatOf(t: string) {
  if (/manual/i.test(t)) return "ler o manual de boas-vindas";
  if (/agenda/i.test(t)) return "escolher o horário da agenda";
  if (/cadastro|preench|formul/i.test(t)) return "preencher o cadastro";
  if (/acesso|login|senha/i.test(t)) return "fazer o primeiro acesso à plataforma";
  return "ver a minha última mensagem";
}
/** Depois de pedir resposta à cliente, garante um passo de espera e diz o que ela precisa fazer. */
function withWaits(list: Action[]): Action[] {
  const out: Action[] = [];
  list.forEach((a, i) => {
    out.push(a);
    const next = list[i + 1];
    if ((a.kind === "message" && ASKS_REPLY.test(a.text)) || (a.kind === "task" && /opções de agenda/i.test(a.text))) {
      if (next?.kind === "wait") { (next as any).what ??= whatOf(a.text); }
      else out.push({ kind: "wait", text: "Aguardar a cliente responder", what: whatOf(a.text) });
    }
  });
  for (let i = 0; i < out.length; i++) {
    const w = out[i];
    if (w.kind === "wait" && !w.what) { const prev = out.slice(0, i).reverse().find((x) => x.kind === "message" || x.kind === "task") as any; w.what = whatOf(prev?.text ?? ""); }
  }
  return out;
}

/** Chave de configuração de dias de espera de um passo. */
export const waitKey = (processId: string, stepKey: string, idx: number) => `${processId}:${stepKey}:${idx}`;
