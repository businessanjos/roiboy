import { supabase } from "@/integrations/supabase/client";

export type CallEngine = "3cplus" | "ryka_call";

export const ENGINE_LABEL: Record<CallEngine, string> = {
  "3cplus": "3C Plus",
  ryka_call: "Call Ryka (WhatsApp)",
};

const LAST_ENGINE_KEY = "roy:last-call-engine";

export function getLastEngine(): CallEngine | null {
  const value = localStorage.getItem(LAST_ENGINE_KEY);
  return value === "3cplus" || value === "ryka_call" ? value : null;
}

export function setLastEngine(engine: CallEngine) {
  localStorage.setItem(LAST_ENGINE_KEY, engine);
}

export interface RykaDialParams {
  phone: string;
  contact_name?: string | null;
  lead_id?: string | null;
  deal_id?: string | null;
  client_id?: string | null;
  company?: string | null;
}

export interface RykaOpenDetail extends RykaDialParams {
  embed_url: string;
  call_log_id: string;
}

declare global {
  interface WindowEventMap {
    "rykacall:open": CustomEvent<RykaOpenDetail>;
  }
}

/** Cria o dial-link no Call Ryka e abre o Discador Call Ryka. */
export async function dialWithRyka(params: RykaDialParams): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("ryka-call-dial", { body: params });
  if (error) return { ok: false, error: "Não foi possível abrir o Call Ryka." };
  if (!data?.success || !data?.embed_url) {
    return { ok: false, error: data?.error || "Não foi possível abrir o Call Ryka." };
  }
  window.dispatchEvent(
    new CustomEvent("rykacall:open", {
      detail: { ...params, embed_url: data.embed_url, call_log_id: data.call_log_id },
    }),
  );
  return { ok: true };
}
