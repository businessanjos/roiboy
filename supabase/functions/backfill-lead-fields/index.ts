import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, unauthorizedResponse } from "../_shared/api-key-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// === Field ID mapping ===
const DEAL_FIELDS = {
  mql: "448404cd-0344-4892-a574-2387b1c17578",
  canal: "16ebda9f-cd3b-412c-bb06-0950001963c5",
  faturamento: "ed5c7c0e-0740-4945-b982-70a593ffae0c",
};

const LEAD_FIELDS = {
  mql: "e4270e93-e9b9-4d9b-9589-d614ce335bcd",
  canal: "3bcdcf47-076e-47f2-a1ab-a4dd1ec8398a",
  faturamento: "e352a1ca-cfbc-435a-95f7-2f53b5cac041",
};

// === Value translation maps ===
const MQL_MAP: Record<string, string> = {
  sim_acima_30k: "opt_1",
  nao_abaixo_30k: "opt_2",
};

const CANAL_MAP: Record<string, string> = {
  organico: "opt_1",
  trafego_pago: "opt_2",
  indicacao: "opt_1770990177251",
  prospeccao_ativa: "opt_1770990180958",
  eventos: "opt_1770990186415",
  carteira_esteira: "opt_1770990194848",
  social_seller: "opt_1770990199860",
  recorrencia: "opt_1770990203418",
};

const FATURAMENTO_LABEL_MAP: Record<string, string> = {
  abaixo_20k: "Abaixo de 20 mil reais",
  "25_50k": "Entre 30 e 50 mil reais",
  "50_70k": "Entre 50 e 70 mil reais",
  "70_100k": "Entre 70 e 100 mil reais",
  acima_100k: "Acima de 100 mil reais",
  acima_200k: "Acima de 200 mil reais",
  acima_300k: "Acima de 300 mil reais",
  acima_500k: "Acima de 500 mil reais",
  opt_1767729831203: "Entre 20 e 30 mil reais",
};

const DEAL_FIELD_IDS = [DEAL_FIELDS.mql, DEAL_FIELDS.canal, DEAL_FIELDS.faturamento];

const PAGE_SIZE = 500;
const BATCH_SIZE = 50; // For IN queries to avoid URL length limits

async function queryInBatches<T>(
  supabase: any,
  table: string,
  select: string,
  filterCol: string,
  filterValues: string[],
  extraFilters?: (q: any) => any,
  orderBy?: { column: string; ascending: boolean }
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < filterValues.length; i += BATCH_SIZE) {
    const batch = filterValues.slice(i, i + BATCH_SIZE);
    let query = supabase.from(table).select(select).in(filterCol, batch);
    if (extraFilters) query = extraFilters(query);
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending });
    const { data, error } = await query;
    if (error) throw new Error(`Error querying ${table}: ${error.message}`);
    if (data) results.push(...data);
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Authenticate
  const auth = await authenticateRequest(req, supabase);
  if (!auth.authenticated || !auth.accountId) {
    return unauthorizedResponse(corsHeaders, auth.error);
  }

  const accountId = auth.accountId;

  let totalLeads = 0;
  let leadsWithDeal = 0;
  let fieldsUpdated = 0;
  let offset = 0;

  try {
    // Paginate through all leads
    while (true) {
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("id")
        .eq("account_id", accountId)
        .range(offset, offset + PAGE_SIZE - 1);

      if (leadsError) throw new Error(`Error fetching leads: ${leadsError.message}`);
      if (!leads || leads.length === 0) break;

      totalLeads += leads.length;
      const leadIds = leads.map((l) => l.id);

      // Batch query deals for these leads
      const deals = await queryInBatches<{ id: string; lead_id: string; created_at: string }>(
        supabase, "deals", "id, lead_id, created_at", "lead_id", leadIds,
        (q: any) => q.eq("account_id", accountId),
        { column: "created_at", ascending: false }
      );

      if (deals.length === 0) {
        offset += PAGE_SIZE;
        continue;
      }

      // Get latest deal per lead
      const latestDealByLead = new Map<string, string>();
      for (const deal of deals) {
        if (!latestDealByLead.has(deal.lead_id)) {
          latestDealByLead.set(deal.lead_id, deal.id);
        }
      }

      const dealIds = Array.from(latestDealByLead.values());
      leadsWithDeal += latestDealByLead.size;

      // Batch query field values
      const dealFieldValues = await queryInBatches<{ deal_id: string; field_id: string; value_text: string }>(
        supabase, "deal_field_values", "deal_id, field_id, value_text", "deal_id", dealIds,
        (q: any) => q.in("field_id", DEAL_FIELD_IDS)
      );

      if (dealFieldValues.length === 0) {
        offset += PAGE_SIZE;
        continue;
      }

      // Build upsert rows for lead_field_values
      const upsertRows: Array<{
        account_id: string;
        lead_id: string;
        field_id: string;
        value_text: string;
        updated_at: string;
      }> = [];

      for (const [leadId, dealId] of latestDealByLead.entries()) {
        const dealVals = dealFieldValues.filter((v) => v.deal_id === dealId);

        for (const dv of dealVals) {
          let leadFieldId: string | null = null;
          let leadValue: string | null = null;

          if (dv.field_id === DEAL_FIELDS.mql && dv.value_text) {
            leadFieldId = LEAD_FIELDS.mql;
            leadValue = MQL_MAP[dv.value_text] || null;
          } else if (dv.field_id === DEAL_FIELDS.canal && dv.value_text) {
            leadFieldId = LEAD_FIELDS.canal;
            leadValue = CANAL_MAP[dv.value_text] || null;
          } else if (dv.field_id === DEAL_FIELDS.faturamento && dv.value_text) {
            leadFieldId = LEAD_FIELDS.faturamento;
            leadValue = FATURAMENTO_LABEL_MAP[dv.value_text] || dv.value_text;
          }

          if (leadFieldId && leadValue) {
            upsertRows.push({
              account_id: accountId,
              lead_id: leadId,
              field_id: leadFieldId,
              value_text: leadValue,
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

      // Batch upsert
      if (upsertRows.length > 0) {
        const { error: upsertError } = await supabase
          .from("lead_field_values")
          .upsert(upsertRows, { onConflict: "lead_id,field_id" });

        if (upsertError) throw new Error(`Upsert error: ${upsertError.message}`);
        fieldsUpdated += upsertRows.length;
      }

      // If fewer than page size, we're done
      if (leads.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    const summary = {
      success: true,
      total_leads: totalLeads,
      leads_with_deal: leadsWithDeal,
      fields_updated: fieldsUpdated,
    };

    console.log("Backfill complete:", summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Backfill error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
