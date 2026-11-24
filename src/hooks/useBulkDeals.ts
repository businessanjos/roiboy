import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRequiredFieldsValidation } from "@/hooks/useRequiredFieldsValidation";
import type { Deal, DealMutationOptions } from "@/hooks/useDeals";
import { bulkFieldColumns, mqlFromRevenue, runBulkDeals, type BulkDealAction, type BulkDealResult } from "@/lib/sales/bulkDeals";
import { DEAL_FIELD_IDS } from "@/utils/dealToClientContractMapping";

interface Options {
  moveDeal: (id: string, stageId: string, pipelineId?: string, options?: DealMutationOptions) => Promise<boolean>;
  updateDeal: (id: string, data: { value?: number; product_id?: string }, options?: DealMutationOptions) => Promise<boolean>;
  refresh: () => Promise<void>;
}

function friendlyBulkError(error: unknown): string {
  const raw = (error as { message?: string })?.message || "";
  if ((error as { code?: string })?.code === "PGRST116" || /permission|row-level|policy|PGRST116|0 rows|JWT|not allowed/i.test(raw)) return "Sem acesso para alterar este negócio. Nada foi aplicado por esta ação.";
  if (/fetch|network|timeout|connection/i.test(raw)) return "A conexão falhou. Confira o negócio antes de tentar novamente.";
  if (/constraint|invalid|violates/i.test(raw)) return "O valor não atende às regras deste negócio.";
  return raw && error instanceof Error ? raw : "Não foi possível alterar este negócio. Confira seu acesso e tente novamente.";
}

export function useBulkDeals({ moveDeal, updateDeal, refresh }: Options) {
  const { currentUser } = useCurrentUser();
  const { validateDealMove } = useRequiredFieldsValidation();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BulkDealResult[]>([]);
  const [total, setTotal] = useState(0);
  const locked = useRef(false);
  const cancelled = useRef(false);

  const run = async (deals: Deal[], action: BulkDealAction): Promise<BulkDealResult[]> => {
    if (locked.current || !currentUser?.account_id || !deals.length) return [];
    locked.current = true;
    cancelled.current = false;
    setRunning(true);
    setResults([]);
    setTotal(deals.length);
    const accountId = currentUser.account_id;
    const mutationOptions = { quiet: true, deferRefresh: true, throwOnError: true };
    try {
      const outcome = await runBulkDeals(deals, async id => {
        try {
          // Read through this user's session before any write: stale/deleted/hidden records fail closed.
          const { data: current, error: readError } = await supabase.from("deals")
            .select("id, status, pipeline_id, stage_id").eq("id", id).eq("account_id", accountId).is("deleted_at", null).single();
          if (readError || !current) throw readError || new Error("Negócio não disponível.");
          if (action.type === "move") {
            if (current.status !== "open") throw new Error("Negócio encerrado. Reabra individualmente antes de mudar o funil ou a etapa.");
            const { data: destination, error: destinationError } = await supabase.from("deal_stages")
              .select("id").eq("id", action.stageId).eq("pipeline_id", action.pipelineId).eq("account_id", accountId).eq("is_active", true).single();
            if (destinationError || !destination) throw new Error("A etapa de destino não está mais disponível neste funil.");
            if (current.stage_id === action.stageId && current.pipeline_id === action.pipelineId) return;
            const validation = await validateDealMove(id, action.stageId, accountId, true);
            if (!validation.canMoveToStage) throw new Error(`Preencha antes: ${validation.missingFields.map(field => field.name).join(", ")}.`);
            const ok = await moveDeal(id, action.stageId, action.pipelineId, mutationOptions);
            if (!ok) throw new Error("Não foi possível mover este negócio.");
          } else if (action.type === "value") {
            if (!Number.isFinite(action.value) || action.value < 0) throw new Error("Informe um valor válido, maior ou igual a zero.");
            const ok = await updateDeal(id, { value: action.value }, mutationOptions);
            if (!ok) throw new Error("Não foi possível alterar o valor.");
          } else {
            const fieldId = action.type === "product" ? DEAL_FIELD_IDS.ITEM_VENDA : action.field.id;
            const { data: field, error: fieldError } = await supabase.from("custom_fields")
              .select("id, field_type, options").eq("id", fieldId).eq("account_id", accountId)
              .eq("is_active", true).eq("show_in_deals", true).single();
            if (fieldError || !field) throw new Error("Este campo não está mais disponível nos negócios.");
            if (action.type === "field" && field.field_type !== action.field.field_type) throw new Error("O tipo deste campo foi alterado. Reabra a seleção antes de continuar.");
            if (action.type === "product") {
              const { data: product, error: productError } = await supabase.from("products")
                .select("id").eq("id", action.productId).eq("account_id", accountId).eq("is_active", true).single();
              if (productError || !product) throw new Error("Este produto não está mais disponível.");
            }
            const columns = action.type === "product"
              ? { value_text: action.productId, value_number: null, value_boolean: null, value_date: null, value_json: null }
              : bulkFieldColumns(action.field, action.value);
            const rows = [{ account_id: accountId, deal_id: id, field_id: fieldId, ...columns }];
            if (action.type === "field" && fieldId === "ed5c7c0e-0740-4945-b982-70a593ffae0c") {
              const mql = mqlFromRevenue(action.value, action.field.options);
              if (mql) rows.push({ account_id: accountId, deal_id: id, field_id: "448404cd-0344-4892-a574-2387b1c17578", value_text: mql, value_number: null, value_boolean: null, value_date: null, value_json: null });
            }
            const { data: saved, error: saveError } = await supabase.from("deal_field_values")
              .upsert(rows as never, { onConflict: "deal_id,field_id" }).select("field_id");
            if (saveError) throw saveError;
            if (saved?.length !== rows.length) throw new Error("Não foi possível confirmar a alteração deste negócio.");
          }
        } catch (error) { throw new Error(friendlyBulkError(error)); }
      }, result => setResults(previous => [...previous, result]), () => cancelled.current);
      await refresh();
      return outcome;
    } finally {
      locked.current = false;
      setRunning(false);
    }
  };

  return { run, running, results, total, cancel: () => { cancelled.current = true; }, reset: () => { if (!locked.current) { setResults([]); setTotal(0); } } };
}