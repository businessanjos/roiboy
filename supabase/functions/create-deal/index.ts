import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequestWithLegacy,
  unauthorizedResponse,
  logApiKeyUsage,
} from "../_shared/api-key-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface CreateDealPayload {
  title: string;
  lead_id?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  source?: string;
  tags?: string[];
  notes?: string;
  product_id?: string;
  value?: number;
  canal_de_venda?: string;
  mql?: string;
  faturamento?: string;
  origem_da_venda?: string;
  instagram?: string;
  observacoes?: string;
  data_primeiro_contato?: string;
  responsible_user_id?: string;
  pipeline_name?: string; // optional: "Closer" or "SDR"
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ITEM_VENDA_FIELD_ID = "033b91fb-3add-4c96-aec9-567fefbd0fb2";

interface ItemVendaOption {
  label: string;
  value: string;
}

interface ProductMatch {
  id: string;
  name: string;
  price: number;
  is_renewal: boolean | null;
  updated_at?: string | null;
}

interface ResolvedProductSelection {
  fieldValue: string;
  matchedBy: "product_uuid" | "legacy_option" | "product_name" | "raw_input";
  usedLegacyIdentifier: boolean;
  product: ProductMatch | null;
}

function normalizeComparableText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function inferRenewalFromText(value?: string | null): boolean {
  if (!value) return false;
  const normalized = normalizeComparableText(value);
  return normalized.startsWith("ren ") || normalized.includes(" renovacao") || normalized.includes(" renovação");
}

function selectBestProductMatch(
  matches: ProductMatch[],
  desiredRenewal: boolean,
  hintedValue?: number
): ProductMatch | null {
  if (matches.length === 0) return null;

  const renewalScopedMatches = matches.filter(
    (product) => Boolean(product.is_renewal) === desiredRenewal
  );
  const candidatePool = renewalScopedMatches.length > 0 ? renewalScopedMatches : matches;

  if (typeof hintedValue === "number" && Number.isFinite(hintedValue) && hintedValue > 0) {
    const exactPriceMatch = candidatePool.find((product) => Number(product.price) === hintedValue);
    if (exactPriceMatch) return exactPriceMatch;
  }

  return [...candidatePool].sort((left, right) => {
    if (Number(right.price) !== Number(left.price)) {
      return Number(right.price) - Number(left.price);
    }

    return String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? ""));
  })[0] ?? null;
}

async function resolveProductSelection(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  rawProductInput: string,
  hintedValue?: number
): Promise<ResolvedProductSelection> {
  const sanitizedInput = rawProductInput.replace(/\\n/g, "").replace(/\n/g, "").trim();
  const isUuidInput = UUID_REGEX.test(sanitizedInput);

  if (isUuidInput) {
    const { data: productById } = await supabase
      .from("products")
      .select("id, name, price, is_renewal, updated_at")
      .eq("account_id", accountId)
      .eq("id", sanitizedInput)
      .eq("is_active", true)
      .maybeSingle();

    if (productById) {
      return {
        fieldValue: productById.id,
        matchedBy: "product_uuid",
        usedLegacyIdentifier: false,
        product: productById,
      };
    }
  }

  const { data: fieldDef } = await supabase
    .from("custom_fields")
    .select("options")
    .eq("id", ITEM_VENDA_FIELD_ID)
    .maybeSingle();

  const options = Array.isArray(fieldDef?.options) ? (fieldDef.options as ItemVendaOption[]) : [];
  const normalizedInput = normalizeComparableText(sanitizedInput);

  const matchedOption =
    options.find((option) => normalizeComparableText(option.value) === normalizedInput) ||
    options.find((option) => normalizeComparableText(option.label) === normalizedInput) ||
    options.find((option) => {
      const normalizedLabel = normalizeComparableText(option.label);
      return normalizedLabel.includes(normalizedInput) || normalizedInput.includes(normalizedLabel);
    }) ||
    options.find((option) => {
      const normalizedValue = normalizeComparableText(option.value);
      return normalizedValue.includes(normalizedInput) || normalizedInput.includes(normalizedValue);
    });

  const desiredRenewal = matchedOption
    ? inferRenewalFromText(matchedOption.label) || inferRenewalFromText(matchedOption.value)
    : inferRenewalFromText(sanitizedInput);

  const searchTerms = Array.from(
    new Set(
      [matchedOption?.label, sanitizedInput, sanitizedInput.replace(/[_-]+/g, " ")].filter(
        (value): value is string => Boolean(value?.trim())
      )
    )
  );

  let productMatch: ProductMatch | null = null;

  for (const term of searchTerms) {
    const { data: exactMatches } = await supabase
      .from("products")
      .select("id, name, price, is_renewal, updated_at")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .ilike("name", term);

    productMatch = selectBestProductMatch(exactMatches || [], desiredRenewal, hintedValue);
    if (productMatch) break;
  }

  if (!productMatch) {
    for (const term of searchTerms) {
      const { data: partialMatches } = await supabase
        .from("products")
        .select("id, name, price, is_renewal, updated_at")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .ilike("name", `%${term}%`);

      productMatch = selectBestProductMatch(partialMatches || [], desiredRenewal, hintedValue);
      if (productMatch) break;
    }
  }

  return {
    fieldValue: productMatch?.id || matchedOption?.value || sanitizedInput,
    matchedBy: productMatch
      ? matchedOption
        ? "legacy_option"
        : "product_name"
      : matchedOption
        ? "legacy_option"
        : "raw_input",
    usedLegacyIdentifier: !isUuidInput,
    product: productMatch,
  };
}

/**
 * Resolves the pipeline and first stage for a deal.
 * Priority: 1) payload.pipeline_name  2) "Closer" pipeline  3) first active pipeline
 * ALWAYS returns both pipeline_id and stage_id, or throws.
 */
async function resolvePipelineAndStage(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  preferredPipelineName?: string
): Promise<{ pipelineId: string; stageId: string }> {
  let pipeline: { id: string; name: string } | null = null;

  // 1. Try preferred pipeline name from payload
  if (preferredPipelineName?.trim()) {
    const { data } = await supabase
      .from("pipelines")
      .select("id, name")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .ilike("name", `%${preferredPipelineName.trim()}%`)
      .limit(1)
      .maybeSingle();
    pipeline = data;
    if (pipeline) console.log(`[PIPELINE] Matched by payload name: "${pipeline.name}" (${pipeline.id})`);
  }

  // 2. Default to Closer pipeline
  if (!pipeline) {
    const { data } = await supabase
      .from("pipelines")
      .select("id, name")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .ilike("name", "%closer%")
      .limit(1)
      .maybeSingle();
    pipeline = data;
    if (pipeline) console.log(`[PIPELINE] Using Closer pipeline: "${pipeline.name}" (${pipeline.id})`);
  }

  // 3. Fallback: first active pipeline by display order
  if (!pipeline) {
    const { data } = await supabase
      .from("pipelines")
      .select("id, name")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    pipeline = data;
    if (pipeline) console.log(`[PIPELINE] Fallback to first pipeline: "${pipeline.name}" (${pipeline.id})`);
  }

  if (!pipeline) {
    throw new Error(`No active pipeline found for account ${accountId}. Create a pipeline first.`);
  }

  // Resolve first stage in the chosen pipeline
  const { data: firstStage } = await supabase
    .from("deal_stages")
    .select("id, name")
    .eq("account_id", accountId)
    .eq("pipeline_id", pipeline.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstStage) {
    throw new Error(`No active stage found in pipeline "${pipeline.name}" (${pipeline.id}). Create at least one stage.`);
  }

  console.log(`[PIPELINE] Resolved: pipeline="${pipeline.name}", stage="${firstStage.name}"`);

  return { pipelineId: pipeline.id, stageId: firstStage.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const auth = await authenticateRequestWithLegacy(req, supabase);
    if (!auth.authenticated) {
      return unauthorizedResponse(corsHeaders, auth.error);
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: CreateDealPayload = await req.json();

    // Validate required field
    if (!payload.title || !payload.title.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing required field: title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate lead_id UUID format if provided
    if (payload.lead_id && !UUID_REGEX.test(payload.lead_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid lead_id format. Must be a valid UUID." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountId = auth.accountId!;

    // ── Pipeline & Stage Resolution (guaranteed non-null) ──
    const { pipelineId, stageId } = await resolvePipelineAndStage(
      supabase,
      accountId,
      payload.pipeline_name
    );

    // Build tags array filtering empty strings
    const tags = (payload.tags || []).filter((t) => t && t.trim());

    const resolvedProduct = payload.product_id?.trim()
      ? await resolveProductSelection(supabase, accountId, payload.product_id, payload.value)
      : null;

    const hasExplicitValue =
      typeof payload.value === "number" && Number.isFinite(payload.value) && payload.value > 0;

    const resolvedDealValue =
      resolvedProduct?.product && (resolvedProduct.usedLegacyIdentifier || !hasExplicitValue)
        ? resolvedProduct.product.price
        : payload.value || 0;

    if (resolvedProduct?.product) {
      console.log(
        `[PRODUCT] Resolved input="${payload.product_id}" -> "${resolvedProduct.product.name}" ` +
          `(renewal=${resolvedProduct.product.is_renewal}, price=${resolvedProduct.product.price}, ` +
          `matchedBy=${resolvedProduct.matchedBy}, legacy=${resolvedProduct.usedLegacyIdentifier})`
      );
    }

    // Insert deal — pipeline_id and stage_id are ALWAYS set
    const { data: newDeal, error: insertError } = await supabase
      .from("deals")
      .insert({
        account_id: accountId,
        pipeline_id: pipelineId,
        stage_id: stageId,
        title: payload.title.trim(),
        lead_id: payload.lead_id || null,
        contact_name: payload.contact_name?.trim() || null,
        contact_phone: payload.contact_phone?.trim() || null,
        contact_email: payload.contact_email?.trim() || null,
        source: payload.source?.trim() || null,
        notes: payload.notes?.trim() || null,
        tags: tags.length > 0 ? tags : [],
        value: resolvedDealValue,
        status: "open",
        responsible_user_id: payload.responsible_user_id || null,
      })
      .select("id, title, lead_id, status, stage_id, pipeline_id")
      .single();

    if (insertError) {
      console.error("Error creating deal:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create deal", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[DEAL] Created: "${newDeal.title}" → pipeline=${newDeal.pipeline_id}, stage=${newDeal.stage_id}`);

    // ── Save resolved product / Item da Venda ──
    if (resolvedProduct) {
      try {
        const { error: productFieldError } = await supabase.from("deal_field_values").upsert(
          {
            account_id: accountId,
            deal_id: newDeal.id,
            field_id: ITEM_VENDA_FIELD_ID,
            value_text: resolvedProduct.fieldValue,
          },
          { onConflict: "deal_id,field_id" }
        );

        if (productFieldError) {
          console.error("Error saving resolved product:", productFieldError);
        }
      } catch (err) {
        console.error("Error resolving product:", err);
      }
    }

    // ── Save custom field values in batch ──
    try {
      const fieldMappings: Array<{ param: string; fieldId: string; column: "value_text" | "value_json" | "value_date" }> = [
        { param: "canal_de_venda", fieldId: "16ebda9f-cd3b-412c-bb06-0950001963c5", column: "value_text" },
        { param: "mql", fieldId: "448404cd-0344-4892-a574-2387b1c17578", column: "value_text" },
        { param: "faturamento", fieldId: "ed5c7c0e-0740-4945-b982-70a593ffae0c", column: "value_text" },
        { param: "origem_da_venda", fieldId: "43d7d9a1-9370-45f3-803a-93717d2a6d1d", column: "value_json" },
        { param: "instagram", fieldId: "47df969b-735e-414f-a25e-2a56e589551d", column: "value_json" },
        { param: "observacoes", fieldId: "f906c26d-7dc7-43bb-902e-f3878e7535d2", column: "value_text" },
        { param: "data_primeiro_contato", fieldId: "166fe351-b29b-4f08-b330-88f82c65f625", column: "value_date" },
      ];

      const selectFieldIds = fieldMappings.map((f) => f.fieldId);
      const { data: customFields } = await supabase
        .from("custom_fields")
        .select("id, field_type, options")
        .in("id", selectFieldIds);

      const fieldOptionsMap: Record<string, { field_type: string; options: Array<{ label: string; value: string }> }> = {};
      if (customFields) {
        for (const cf of customFields) {
          if ((cf.field_type === "select" || cf.field_type === "multi_select") && cf.options) {
            fieldOptionsMap[cf.id] = {
              field_type: cf.field_type,
              options: cf.options as Array<{ label: string; value: string }>,
            };
          }
        }
      }

      function matchOptionValue(options: Array<{ label: string; value: string }>, input: string): string {
        const trimmed = input.trim();
        const lower = trimmed.toLowerCase();
        const exactLabel = options.find((o) => o.label.toLowerCase() === lower);
        if (exactLabel) return exactLabel.value;
        const exactValue = options.find((o) => o.value.toLowerCase() === lower);
        if (exactValue) return exactValue.value;
        const partial = options.find(
          (o) => o.label.toLowerCase().includes(lower) || lower.includes(o.label.toLowerCase())
        );
        if (partial) return partial.value;
        return trimmed;
      }

      const fieldInserts = fieldMappings
        .filter(({ param }) => {
          const val = payload[param as keyof CreateDealPayload];
          return val !== undefined && val !== null && String(val).trim() !== "";
        })
        .map(({ param, fieldId, column }) => {
          const raw = payload[param as keyof CreateDealPayload] as string;
          const row: Record<string, unknown> = {
            account_id: accountId,
            deal_id: newDeal.id,
            field_id: fieldId,
          };

          const fieldDef = fieldOptionsMap[fieldId];

          if (column === "value_json") {
            const items = Array.isArray(raw) ? raw : [raw.trim()];
            if (fieldDef && fieldDef.field_type === "multi_select") {
              row.value_json = items.map((item) => matchOptionValue(fieldDef.options, String(item)));
            } else {
              row.value_json = items;
            }
          } else if (column === "value_date") {
            row.value_date = raw.trim();
          } else {
            if (fieldDef && fieldDef.field_type === "select") {
              row.value_text = matchOptionValue(fieldDef.options, raw.trim());
            } else {
              row.value_text = raw.trim();
            }
          }
          return row;
        });

      if (fieldInserts.length > 0) {
        const { error: fieldErr } = await supabase.from("deal_field_values").insert(fieldInserts);
        if (fieldErr) console.error("Error inserting custom fields:", fieldErr);
      }
    } catch (err) {
      console.error("Error saving custom fields:", err);
    }

    // ── Register activity ──
    try {
      await supabase.from("deal_activities").insert({
        account_id: accountId,
        deal_id: newDeal.id,
        type: "note",
        title: "Negócio criado via API",
        content: `Negócio "${newDeal.title}" criado automaticamente via integração.`,
      });
    } catch (err) {
      console.error("Error creating activity:", err);
    }

    if (auth.method === "api_key" && auth.apiKeyId) {
      await logApiKeyUsage(supabase, auth.apiKeyId, req, 201);
    }

    return new Response(JSON.stringify({ success: true, deal: newDeal }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in create-deal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
