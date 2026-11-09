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
      if (error) return {} as Record<string, string>;
      const list: any[] = data?.data?.participants || data?.participants || [];
      const map: Record<string, string> = {}; // lid -> phone digits
      for (const p of list) {
        const lid = digits(p.LID || p.lid || (String(p.JID || p.jid || p.id || "").includes("@lid") ? p.JID || p.jid || p.id : ""));
        let phone = digits(p.PhoneNumber || p.phoneNumber || p.phone);
        if (!phone) {
          const j = String(p.JID || p.jid || p.id || "");
          if (j.includes("@s.whatsapp.net")) phone = digits(j);
        }
        if (lid && phone && lid !== phone) map[lid] = phone;
      }
      return map;
    },
  });

  const { knownNames } = opts;
  return useMemo(() => {
  const lidToPhone = query.data || {};
  const result: Record<string, string> = {};
  for (const [lid, phone] of Object.entries(lidToPhone)) {
    const name = knownNames[phone] || knownNames[phone.slice(-11)] || knownNames[phone.slice(-10)]
      || knownNames[phone.slice(-9)] || knownNames[phone.slice(-8)];
    result[lid] = name || formatMentionPhone(phone);
  }
  return result;
  }, [query.data, knownNames]);
}
