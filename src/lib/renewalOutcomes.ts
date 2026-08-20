import { supabase } from "@/integrations/supabase/client";

interface SaveRenewalOutcomeInput {
  accountId: string;
  contractId: string;
  clientId: string;
  resolvedBy: string;
  renewalValue: number;
  outcome: "renewed" | "lost" | "pending" | "negotiating";
  lossReason?: string | null;
  lossNotes?: string | null;
}

export async function saveRenewalOutcome(input: SaveRenewalOutcomeInput) {
  const payload = {
    account_id: input.accountId,
    contract_id: input.contractId,
    client_id: input.clientId,
    outcome: input.outcome,
    renewal_value: input.renewalValue,
    resolved_at: new Date().toISOString(),
    resolved_by: input.resolvedBy,
    loss_reason: input.lossReason ?? null,
    loss_notes: input.lossNotes ?? null,
  };

  const { data, error } = await supabase
    .from("renewal_outcomes")
    .upsert(payload, { onConflict: "contract_id" })
    .select("id, outcome")
    .single();

  if (error) throw error;
  if (!data?.id || data.outcome !== input.outcome) {
    throw new Error("O status não foi confirmado após a gravação.");
  }

  const { data: persisted, error: verificationError } = await supabase
    .from("renewal_outcomes")
    .select("id, outcome")
    .eq("id", data.id)
    .eq("contract_id", input.contractId)
    .single();

  if (verificationError) throw verificationError;
  if (!persisted || persisted.outcome !== input.outcome) {
    throw new Error("O status não persistiu no banco. Tente novamente.");
  }

  return persisted;
}