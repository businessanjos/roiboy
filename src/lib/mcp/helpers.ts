import { ToolError } from "@lovable.dev/mcp-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

/** Garante identidade e devolve o client Supabase autenticado como o usuário. */
export function requireUser(ctx: ToolContext) {
  if (!ctx.isAuthenticated?.() || !ctx.getUserId?.()) {
    throw new ToolError("Não autenticado. Reconecte o conector para renovar o acesso.");
  }
  return supabaseForUser(ctx);
}

/** Resposta padrão: JSON legível + structuredContent. */
export function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

export function failIf(error: { message: string } | null) {
  if (error) throw new ToolError(error.message);
}

/** Converte "YYYY-MM-DD" (ou ISO) em ISO completo; lança erro se inválido. */
export function toIso(value: string | null | undefined, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
    : value;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new ToolError(`Data inválida: ${value}`);
  return d.toISOString();
}

export function secondsToHuman(total: number): string {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
