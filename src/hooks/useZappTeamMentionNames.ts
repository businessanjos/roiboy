import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { zappMentionName } from "@/lib/zappMentionName";

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** Nomes da equipe por final do número (8 dígitos), carregados uma vez para a lista. */
export function useZappTeamMentionNames() {
  return useQuery({
    queryKey: ["zapp-team-mention-names"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const sb: any = supabase;
      const [{ data: ic }, { data: hr }] = await Promise.all([
        sb.from("zapp_internal_contacts").select("phone_e164, label"),
        sb.from("hr_collaborators").select("phone, full_name"),
      ]);
      const out: Record<string, string> = {};
      (hr || []).forEach((r: any) => { const d = digits(r.phone); const n = zappMentionName(r.full_name || "", d); if (d.length >= 8 && n) out[d.slice(-8)] = n; });
      (ic || []).forEach((r: any) => { const d = digits(r.phone_e164); const n = zappMentionName(r.label || "", d); if (d.length >= 8 && n && !out[d.slice(-8)]) out[d.slice(-8)] = n; });
      return out;
    },
  }).data || {};
}

/** Troca @<número/LID> por @Nome; sem nome conhecido, mostra "@contato". */
export function resolvePreviewMentions(text: string, names: Record<string, string>): string {
  if (!text) return text;
  return text.replace(/@(\d{8,})/g, (_m, num: string) => {
    const n = names[num.slice(-8)];
    return n ? `@${n}` : "@contato";
  });
}
