import raw from "@/content/csProcesses.md?raw";

export type Block =
  | { kind: "message"; text: string }
  | { kind: "task"; text: string }
  | { kind: "alert"; text: string }
  | { kind: "meta"; label: string; text: string }
  | { kind: "note"; text: string };
export interface Step { title: string; blocks: Block[] }
export interface Phase { title: string; steps: Step[] }
export interface Process { id: string; title: string; phases: Phase[] }

const strip = (s: string) => s.replace(/\*\*/g, "").trim();

export function parseProcesses(md: string): Process[] {
  const out: Process[] = [];
  let proc: Process | null = null, phase: Phase | null = null, step: Step | null = null;
  let quote: string[] | null = null;
  const ensureStep = () => {
    if (!phase) return null;
    if (!step) { step = { title: "", blocks: [] }; phase.steps.push(step); }
    return step;
  };
  const flush = () => { if (quote && ensureStep()) step!.blocks.push({ kind: "message", text: quote.join("\n").trim() }); quote = null; };
  for (const line of md.split("\n")) {
    const t = line.trim();
    if (/^>/.test(t)) { (quote ??= []).push(t.replace(/^>\s?/, "")); continue; }
    flush();
    let m;
    if ((m = t.match(/^# PROCESSO \d+ — (.+)/))) { proc = { id: String(out.length + 1), title: m[1], phases: [] }; out.push(proc); phase = null; step = null; continue; }
    if (!proc) continue;
    if ((m = t.match(/^## (.+)/))) { phase = { title: m[1], steps: [] }; proc.phases.push(phase); step = null; continue; }
    if ((m = t.match(/^### (.+)/))) { if (!phase) continue; step = { title: m[1], blocks: [] }; phase.steps.push(step); continue; }
    if (!t || t === "---") continue;
    const s = ensureStep(); if (!s) continue;
    const body = t.replace(/^-\s*/, "");
    if ((m = body.match(/^\[[ x]\]\s*(.+)/))) s.blocks.push({ kind: "task", text: strip(m[1]) });
    else if (body.includes("⚠️")) s.blocks.push({ kind: "alert", text: strip(body.replace("⚠️", "")) });
    else if ((m = body.match(/^\*\*([^*]+):\*\*\s*(.*)/))) s.blocks.push({ kind: "meta", label: m[1], text: strip(m[2]) });
    else s.blocks.push({ kind: "note", text: strip(body) });
  }
  return out;
}

export const defaultProcessesText = raw;
export const csProcesses = parseProcesses(raw);
