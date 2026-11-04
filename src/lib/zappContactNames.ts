import { supabase } from "@/integrations/supabase/client";

/** WhatsApp sometimes stores the placeholder "Desconhecido" even when the conversation is linked to a lead/client. */
export function isUnknownContactName(name: string | null | undefined, phone?: string | null) {
  const n = (name || "").trim();
  if (!n) return true;
  if (/^(desconhecido|sem nome|contato)$/i.test(n)) return true;
  if (phone && n.replace(/\D/g, "") === phone.replace(/\D/g, "")) return true;
  return false;
}

/** Returns conversationId -> best known name (client > lead > stored contact name). */
export async function resolveZappContactNames(conversationIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = Array.from(new Set(conversationIds.filter(Boolean)));
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("zapp_conversations")
      .select("id, contact_name, client:clients(full_name), lead:leads(full_name)")
      .in("id", ids.slice(i, i + 200));
    for (const r of (data as any[]) || []) {
      const name = r.client?.full_name || r.lead?.full_name || (!isUnknownContactName(r.contact_name) ? r.contact_name : null);
      if (name) out.set(r.id, String(name).trim());
    }
  }
  return out;
}
