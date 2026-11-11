import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const digits = (v: unknown) => String(v ?? "").split("@")[0].split(":")[0].replace(/\D/g, "");

/** Formata um número do WhatsApp para exibição: +55 11 98336-4308 */
export function formatMentionPhone(d: string): string {
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    return `+55 ${ddd} ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
  }
  return `+${d}`;
}

/**
 * Menções em grupos chegam como @<LID> (identificador interno do WhatsApp).
 * Busca os participantes do grupo (somente leitura) e devolve LID -> nome conhecido
 * ou o número de telefone real formatado.
 */
export function useZappGroupLidMap(opts: {
  enabled: boolean;
  groupJid?: string | null;
  sectorId?: string;
  integrationId?: string | null;
  knownNames: Record<string, string>;
}) {
  const { enabled, groupJid, sectorId, integrationId } = opts;
  const query = useQuery({
    queryKey: ["zapp-group-lid-map", groupJid, sectorId, integrationId],
    enabled: enabled && !!groupJid,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "group_participants", group_id: groupJid, sector_id: sectorId, integration_id: integrationId },
      });
      if (error) return { map: {}, names: {}, teamBySuffix: {} } as { map: Record<string, string>; names: Record<string, string>; teamBySuffix: Record<string, string> };
      const list: any[] = data?.data?.participants || data?.participants || [];
      const map: Record<string, string> = {}; // lid -> phone digits
      const names: Record<string, string> = {}; // phone/lid -> nome do contato
      const isNum = (x: string) => !x || /^\+?[\d\s()-]+$/.test(x);
      for (const p of list) {
        const lid = digits(p.LID || p.lid || (String(p.JID || p.jid || p.id || "").includes("@lid") ? p.JID || p.jid || p.id : ""));
        let phone = digits(p.PhoneNumber || p.phoneNumber || p.phone);
        if (!phone) {
          const j = String(p.JID || p.jid || p.id || "");
          if (j.includes("@s.whatsapp.net")) phone = digits(j);
        }
        if (lid && phone && lid !== phone) map[lid] = phone;
        const nm = String(p.DisplayName || p.displayName || p.name || p.notify || p.pushName || "").trim();
        if (!isNum(nm)) { if (phone) names[phone] = nm; if (lid) names[lid] = nm; }
      }
      // Contatos da equipe (ex.: Lucas) e colaboradores: nome pelo número
      const sb: any = supabase;
      const [{ data: ic }, { data: hr }] = await Promise.all([
        sb.from("zapp_internal_contacts").select("phone_e164, label"),
        sb.from("hr_collaborators").select("phone, full_name"),
      ]);
      const teamBySuffix: Record<string, string> = {};
            (hr || []).forEach((r: any) => { const d = digits(r.phone); if (d && r.full_name) teamBySuffix[d.slice(-8)] = r.full_name; });
      // Rótulos genéricos ("Interno", "Equipe"...) não são nome de pessoa
      const generic = /^(interno|interna|equipe|time|staff|colaborador|teste)$/i;
      (ic || []).forEach((r: any) => { const d = digits(r.phone_e164); if (d && r.label && !isNum(r.label) && !generic.test(r.label.trim()) && !teamBySuffix[d.slice(-8)]) teamBySuffix[d.slice(-8)] = r.label; });
      return { map, names, teamBySuffix };
    },
  });

  const { knownNames } = opts;
  return useMemo(() => {
  const { map: lidToPhone = {}, names = {}, teamBySuffix = {} } = query.data || {};
  const result: Record<string, string> = {};
  // Menções exibem só o primeiro nome (@Lucas), nunca o nome completo
  const firstName = (n: string) => n.trim().split(/\s+/)[0] || "";
  const nameFor = (phone: string, lid?: string) => {
    const full =
      knownNames[phone] || knownNames[phone.slice(-11)] || knownNames[phone.slice(-10)]
        || knownNames[phone.slice(-9)] || knownNames[phone.slice(-8)]
        || names[phone] || (lid ? names[lid] : "") || teamBySuffix[phone.slice(-8)] || "";
    return full ? firstName(full) : "";
  };
  // Também cobre menções por número real (@5511...), não só por LID.
  for (const [k, nm] of Object.entries(names)) if (!lidToPhone[k]) result[k] = nameFor(k) || firstName(nm);
  for (const [suf, nm] of Object.entries(teamBySuffix)) if (!result[suf]) result[suf] = firstName(nm);
  for (const [lid, phone] of Object.entries(lidToPhone)) {
    result[lid] = nameFor(phone, lid) || formatMentionPhone(phone);
  }
  return result;
  }, [query.data, knownNames]);
}
