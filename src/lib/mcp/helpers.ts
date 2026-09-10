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

/** Confirma o mesmo acesso setorial usado pela navegação do ROY. */
export async function requireSector(ctx: ToolContext, sectorId: string) {
  const supabase = requireUser(ctx);
  const userId = ctx.getUserId?.();
  if (!userId) throw new ToolError("Não autenticado. Reconecte o conector para renovar o acesso.");
  const { data, error } = await supabase.rpc("user_has_sector_access", {
    _auth_user_id: userId,
    _sector_id: sectorId,
  });
  failIf(error);
  if (data !== true) throw new ToolError(`Sem permissão para consultar a área ${sectorId}.`);
  return supabase;
}

const RH_ALLOWED_EMAILS = new Set([
  "m.quintana@me.com",
  "coachevertonsantos@gmail.com",
  "rh@anjosbusiness.com.br",
  "diessica@consultoria-luma.com",
  "jaqueline@consultoria-luma.com",
  "brualmeida.est@hotmail.com",
  "arthur.mudri@hotmail.com",
]);

/** Replica a proteção adicional por usuário aplicada às telas de RH. */
export async function requireRhAccess(ctx: ToolContext) {
  const email = (ctx.getUserEmail?.() ?? "").toLowerCase();
  if (!RH_ALLOWED_EMAILS.has(email)) throw new ToolError("Sem permissão para consultar a área de RH.");
  return requireSector(ctx, "rh");
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
