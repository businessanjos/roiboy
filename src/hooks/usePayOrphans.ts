import { useQuery } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { PayRelationship } from "@/lib/rykaPay";

export type PayOrphan = {
  source: "rykapay" | "stripe_legacy";
  id: string;
  payerName: string;
  amountCents: number | null;
  date: string | null;
  label: string | null;
};
export type PayOrphanList = { orphans: PayOrphan[]; partial: boolean };

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("rykapay-orphans", { body });
  if (error) {
    let message = "Não foi possível consultar o RykaPay. Tente novamente.";
    if (error instanceof FunctionsHttpError) {
      const details = await error.context.json().catch(() => null);
      if (typeof details?.error === "string") message = details.error;
    }
    throw new Error(message);
  }
  return data as T;
}

/** Paid Clínica Ryka sales not yet tied to any deal; read only while a dialog or the manager page is open. */
export function usePayOrphans(active: boolean) {
  const { currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ["pay-orphans", currentUser?.account_id],
    enabled: Boolean(active && currentUser),
    queryFn: async () => {
      const data = await invoke<PayOrphanList>({ action: "list" });
      if (!data || !Array.isArray(data.orphans)) throw new Error("Lista de vendas indisponível.");
      return data;
    },
    staleTime: 15000,
    gcTime: 0,
    retry: false,
  });
}

export function approvePayLink(input: {
  requestId: string;
  orphan: Pick<PayOrphan, "source" | "id">;
  relationship: PayRelationship;
  relationshipOther?: string;
  payerDocument?: string;
  payerEmail?: string;
}) {
  return invoke<{ ok: true }>({
    action: "decide",
    requestId: input.requestId,
    source: input.orphan.source,
    externalId: input.orphan.id,
    relationship: input.relationship,
    relationshipOther: input.relationshipOther?.trim() || undefined,
    payerDocument: input.payerDocument?.trim() || undefined,
    payerEmail: input.payerEmail?.trim() || undefined,
  });
}

/** WhatsApp notice to the managers (new request) or to the seller (decision); a failed notice never blocks the flow. */
export async function notifyPayLink(action: "notify" | "decided", requestId: string) {
  const { error } = await supabase.functions.invoke("pay-link-whatsapp", { body: { action, request_id: requestId } });
  if (error) console.error("[pay-link-whatsapp]", error);
}

export const orphanKey = (o: Pick<PayOrphan, "source" | "id">) => `${o.source}:${o.id}`;
export const orphanMoney = (cents: number | null) =>
  cents === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
export const orphanDay = (value: string | null) => (value ? value.slice(0, 10).split("-").reverse().join("/") : "—");
