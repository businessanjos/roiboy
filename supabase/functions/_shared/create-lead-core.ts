// Core lead-creation logic shared between the public create-lead endpoint
// (called by external integrations / N8N) and internal callers like the
// typeform-webhook (which needs to create the same shape of lead without
// bouncing through an authenticated HTTP round-trip).
//
// Keep this file dependency-only on _shared and the Supabase client — no
// Deno.serve, no auth, no HTTP.

import { canonicalEmail } from "./email-normalize.ts";
import { canonicalE164, phoneVariants } from "./phone-normalize.ts";

export interface CreateLeadCorePayload {
  full_name: string;
  phone?: string;
  email?: string;
  instagram?: string;
  source?: string;
  revenue_range?: string;
  mql?: string;
  canal?: string;
  tags?: string[];
  notes?: string;
  segment?: string;
  specialty?: string;
  create_deal?: boolean;
  pipeline_id?: string;
  pipeline_name?: string;
  stage_id?: string;
  stage_name?: string;
  responsible_user_id?: string;
  responsible_email?: string;
  deal_title?: string;
  deal_value?: number;
}

export type CreateLeadCoreResult =
  | { status: "created"; lead: any; deal: any | null }
  | { status: "duplicate"; matched_field: "phone"; existing_lead: any }
  | { status: "error"; error: string };

function resolveRevenueKey(label: string, optionValue: string): string {
  const directMap: Record<string, string> = {
    abaixo_20k: "abaixo_20k",
    opt_1767729831203: "20k_30k",
  };
  if (directMap[optionValue]) return directMap[optionValue];

  const abaixo = label.match(/abaixo\s+de\s+(\d+)/);
  if (abaixo) {
    const v = parseInt(abaixo[1]);
    if (v <= 20) return "abaixo_20k";
    if (v <= 30) return "20k_30k";
    return "abaixo_20k";
  }

  const entre = label.match(/entre\s+(\d+)[\s\w]*e\s+(\d+)/);
  if (entre) {
    let low = parseInt(entre[1]);
    let high = parseInt(entre[2]);
    if (high < low) high = high * 1000;
    if (high <= 30) return "20k_30k";
    if (high <= 50) return "30k_50k";
    if (high <= 100) return "50k_100k";
    if (high <= 150) return "100k_150k";
    if (high <= 300) return "150k_300k";
    if (high <= 500) return "300k_500k";
    return "500k_1m";
  }

  const acima = label.match(/acima\s+de\s+(\d+)/);
  if (acima) {
    const v = parseInt(acima[1]);
    if (v >= 1000 || label.includes("milh")) return "acima_1m";
    if (v >= 500) return "500k_1m";
    return "acima_1m";
  }

  return optionValue;
}

export async function createLeadCore(
  supabase: any,
  accountId: string,
  payload: CreateLeadCorePayload,
  opts: { duplicateAudit?: {
    auth_method?: string | null;
    api_key_id?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
  } } = {},
): Promise<CreateLeadCoreResult> {
  if (!payload.full_name || !payload.full_name.trim()) {
    return { status: "error", error: "Missing required field: full_name" };
  }

  const normalizedEmail = canonicalEmail(payload.email);
  const normalizedPhone = canonicalE164(payload.phone);

  // Duplicate check by phone (any variant)
  if (normalizedPhone) {
    const variants = phoneVariants(normalizedPhone);
    const { data: existing } = await supabase
      .from("leads")
      .select("id, full_name")
      .in("phone", variants)
      .eq("account_id", accountId)
      .maybeSingle();

    if (existing) {
      try {
        await supabase.from("lead_duplicate_attempts").insert({
          account_id: accountId,
          existing_lead_id: existing.id,
          existing_lead_name: existing.full_name,
          matched_field: "phone",
          matched_value: normalizedPhone,
          payload: payload as any,
          auth_method: opts.duplicateAudit?.auth_method ?? null,
          api_key_id: opts.duplicateAudit?.api_key_id ?? null,
          ip_address: opts.duplicateAudit?.ip_address ?? null,
          user_agent: opts.duplicateAudit?.user_agent ?? null,
        });
      } catch (logErr) {
        console.error("[create-lead-core] failed to log duplicate", logErr);
      }
      return { status: "duplicate", matched_field: "phone", existing_lead: existing };
    }
  }

  // Duplicate check by email — mirrors what the typeform-webhook match does,
  // so we don't create a second lead for a contact we already have.
  if (normalizedEmail) {
    const { data: existingByEmail } = await supabase
      .from("leads")
      .select("id, full_name")
      .eq("account_id", accountId)
      .ilike("email", normalizedEmail)
      .maybeSingle();
    if (existingByEmail) {
      return { status: "duplicate", matched_field: "phone", existing_lead: existingByEmail };
    }
  }

  const tags = (payload.tags || []).filter((t) => t && t.trim());

  const { data: newLead, error: insertError } = await supabase
    .from("leads")
    .insert({
      account_id: accountId,
      full_name: payload.full_name.trim(),
      phone: normalizedPhone || null,
      email: normalizedEmail || null,
      instagram: payload.instagram?.trim() || null,
      source: payload.source?.trim() || null,
      revenue_range: payload.revenue_range?.trim() || null,
      mql: payload.mql?.trim() || null,
      canal: payload.canal?.trim() || null,
      tags: tags.length > 0 ? tags : [],
      notes: payload.notes?.trim() || null,
      responsible_user_id: payload.responsible_user_id || null,
      status: "new",
    })
    .select("id, full_name, phone, status, email")
    .single();


  if (insertError || !newLead) {
    return { status: "error", error: insertError?.message || "insert failed" };
  }

  // Custom field values: MQL, Canal, Faturamento
  const fieldMappings = [
    { fieldId: "e4270e93-e9b9-4d9b-9589-d614ce335bcd", value: payload.mql },
    { fieldId: "3bcdcf47-076e-47f2-a1ab-a4dd1ec8398a", value: payload.canal },
    { fieldId: "e352a1ca-cfbc-435a-95f7-2f53b5cac041", value: payload.revenue_range },
  ];
  const fieldIds = fieldMappings.map((m) => m.fieldId);
  const { data: customFields } = await supabase
    .from("custom_fields")
    .select("id, field_type, options")
    .in("id", fieldIds);

  const normalize = (str: string) =>
    str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const resolveValue = (fieldId: string, rawText: string): string | null => {
    const fieldDef = customFields?.find((f: any) => f.id === fieldId);
    if (!fieldDef || fieldDef.field_type !== "select") return rawText;
    const normalizedInput = normalize(rawText);
    const match = (fieldDef.options as any[])?.find(
      (opt: any) => normalize(opt.label) === normalizedInput,
    );
    return match ? match.value : null;
  };

  const fieldInserts = fieldMappings
    .filter((m) => m.value && m.value.trim())
    .map((m) => ({
      lead_id: newLead.id,
      field_id: m.fieldId,
      account_id: accountId,
      value_text: resolveValue(m.fieldId, m.value!.trim()),
    }))
    .filter((m) => m.value_text !== null);

  // Product-aware MQL override
  const MQL_FIELD_ID = "e4270e93-e9b9-4d9b-9589-d614ce335bcd";
  const FATURAMENTO_FIELD_ID = "e352a1ca-cfbc-435a-95f7-2f53b5cac041";
  const rawRevenue = payload.revenue_range?.trim() || "";
  if (rawRevenue) {
    const normalizedRaw = normalize(rawRevenue);
    const faturamentoField = customFields?.find((f: any) => f.id === FATURAMENTO_FIELD_ID);
    const matchedOption = (faturamentoField?.options as any[])?.find(
      (opt: any) => normalize(opt.label) === normalizedRaw || opt.value === rawRevenue,
    );
    const resolvedFatValue = matchedOption?.value || rawRevenue;
    const labelToAnalyze = matchedOption ? normalize(matchedOption.label) : normalizedRaw;

    const { data: productsWithCriteria } = await supabase
      .from("products")
      .select("id, name, mql_criteria")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .not("mql_criteria", "is", null);

    let mqlDetermined = false;
    let mqlValue = "opt_1";

    if (productsWithCriteria && productsWithCriteria.length > 0) {
      const leadSegment = payload.segment?.trim() || "";
      const leadSpecialty = payload.specialty?.trim() || "";
      const normalizedLeadSegment = leadSegment ? normalize(leadSegment) : "";
      const normalizedLeadSpecialty = leadSpecialty ? normalize(leadSpecialty) : "";

      const KNOWN_SEGMENTS = [
        "clinica de estetica",
        "esteticista autonoma",
        "biomedica",
        "medico",
        "dentista",
      ];

      const resolvedLeadSegment = normalizedLeadSegment
        ? (KNOWN_SEGMENTS.includes(normalizedLeadSegment) ? normalizedLeadSegment : "outros")
        : "";

      const matchesAnyProduct = productsWithCriteria.some((prod: any) => {
        const criteria = prod.mql_criteria;
        if (!criteria) return false;

        const hasRevenueCriteria = criteria.revenue_ranges && criteria.revenue_ranges.length > 0;
        let revenueMatches = true;
        if (hasRevenueCriteria) {
          const revenueKey = resolveRevenueKey(labelToAnalyze, resolvedFatValue);
          revenueMatches = criteria.revenue_ranges.includes(revenueKey);
        }
        if (!revenueMatches) return false;

        const hasSegmentCriteria = criteria.segments && criteria.segments.length > 0;
        if (hasSegmentCriteria && resolvedLeadSegment) {
          const normalizedCriteriaSegments = criteria.segments.map((s: string) => normalize(s));
          const segmentMatches = normalizedCriteriaSegments.includes(resolvedLeadSegment);
          if (!segmentMatches) return false;
        }

        const hasSpecialtyCriteria = criteria.specialties && criteria.specialties.length > 0;
        if (hasSpecialtyCriteria && normalizedLeadSpecialty && normalizedLeadSegment === "medico") {
          const normalizedCriteriaSpecialties = criteria.specialties.map((s: string) => normalize(s));
          const specialtyMatches = normalizedCriteriaSpecialties.includes(normalizedLeadSpecialty);
          if (!specialtyMatches) return false;
        }

        return true;
      });

      mqlValue = matchesAnyProduct ? "opt_1" : "opt_2";
      mqlDetermined = true;
    }

    if (!mqlDetermined) {
      const isBelow30k = (() => {
        const abaixoMatch = labelToAnalyze.match(/abaixo\s+de\s+(\d+)/);
        if (abaixoMatch && parseInt(abaixoMatch[1]) <= 30) return true;
        const entreMatch = labelToAnalyze.match(/entre\s+(\d+)\s+e\s+(\d+)/);
        if (entreMatch && parseInt(entreMatch[2]) <= 30) return true;
        return false;
      })();
      mqlValue = isBelow30k ? "opt_2" : "opt_1";
    }

    const existingMql = fieldInserts.findIndex((f) => f.field_id === MQL_FIELD_ID);
    if (existingMql >= 0) {
      fieldInserts[existingMql].value_text = mqlValue;
    } else {
      fieldInserts.push({
        lead_id: newLead.id,
        field_id: MQL_FIELD_ID,
        account_id: accountId,
        value_text: mqlValue,
      });
    }
  }

  if (fieldInserts.length > 0) {
    const { error: fieldError } = await supabase
      .from("lead_field_values")
      .insert(fieldInserts);
    if (fieldError) {
      console.error("[create-lead-core] inserting lead field values:", fieldError);
    }
  }

  // Optional deal
  let createdDeal: any = null;
  if (payload.create_deal) {
    try {
      let pipelineId = payload.pipeline_id || null;
      if (!pipelineId && payload.pipeline_name) {
        const { data: pipe } = await supabase
          .from("pipelines")
          .select("id")
          .eq("account_id", accountId)
          .ilike("name", payload.pipeline_name)
          .maybeSingle();
        pipelineId = pipe?.id || null;
      }

      // MQL-based auto-routing: opt_1 (MQL) → Closer, opt_2 (não-MQL) → TP - Eternum Pass
      if (!pipelineId) {
        const MQL_FIELD_ID_LOCAL = "e4270e93-e9b9-4d9b-9589-d614ce335bcd";
        const resolvedMql =
          fieldInserts.find((f: any) => f.field_id === MQL_FIELD_ID_LOCAL)?.value_text ||
          (payload.mql?.trim() || null);
        const isMql = resolvedMql === "opt_1" || /^sim\b/i.test(resolvedMql || "");
        const targetName = isMql ? "Closer" : "TP - Eternum Pass";
        const { data: routedPipe } = await supabase
          .from("pipelines")
          .select("id")
          .eq("account_id", accountId)
          .ilike("name", targetName)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        pipelineId = routedPipe?.id || null;
        if (pipelineId) {
          console.log(`[create-lead-core] Auto-routed by MQL=${resolvedMql} → pipeline ${isMql ? "Closer" : "TP - Eternum Pass"} (${pipelineId})`);
        }
      }




      let responsibleUserId = payload.responsible_user_id || null;
      if (!responsibleUserId && payload.responsible_email) {
        const { data: u } = await supabase
          .from("users")
          .select("id")
          .ilike("email", payload.responsible_email)
          .maybeSingle();
        responsibleUserId = u?.id || null;
      }

      // Distribuição padrão: leads TRAF-*/ORG-* caem no Jonathan Marcato (gestor)
      if (!responsibleUserId) {
        const firstTag = (tags[0] || "").toUpperCase();
        const src = (payload.source || "").toLowerCase();
        const looksLikeFormLead =
          /\[(TRAF|ORG|IND)-/i.test(firstTag) ||
          src.includes("tráfego") || src.includes("trafego") ||
          src.includes("orgânico") || src.includes("organico");
        if (looksLikeFormLead) {
          responsibleUserId = "1232ec15-5f66-4b5f-9e74-f40d436f9d0f";
          console.log("[create-lead-core] Default responsible → Jonathan Marcato");
        }
      }


      if (pipelineId) {
        let resolvedStage: { id: string } | null = null;
        if (payload.stage_id) {
          const { data: s } = await supabase
            .from("deal_stages")
            .select("id")
            .eq("pipeline_id", pipelineId)
            .eq("id", payload.stage_id)
            .maybeSingle();
          if (s) resolvedStage = s;
        }
        if (!resolvedStage && payload.stage_name) {
          const { data: s } = await supabase
            .from("deal_stages")
            .select("id")
            .eq("pipeline_id", pipelineId)
            .ilike("name", payload.stage_name)
            .maybeSingle();
          if (s) resolvedStage = s;
        }
        if (!resolvedStage) {
          const { data: firstStage } = await supabase
            .from("deal_stages")
            .select("id")
            .eq("pipeline_id", pipelineId)
            .order("display_order", { ascending: true })
            .limit(1)
            .maybeSingle();
          resolvedStage = firstStage || null;
        }

        if (resolvedStage) {
          const { data: deal, error: dealErr } = await supabase
            .from("deals")
            .insert({
              account_id: accountId,
              lead_id: newLead.id,
              pipeline_id: pipelineId,
              stage_id: resolvedStage.id,
              responsible_user_id: responsibleUserId,
              title: payload.deal_title?.trim() || newLead.full_name,
              contact_name: newLead.full_name,
              contact_phone: normalizedPhone || null,
              contact_email: normalizedEmail || null,
              value: payload.deal_value ?? null,
              source: payload.source?.trim() || null,
              tags: payload.tags && payload.tags.length ? payload.tags : null,
              status: "open",
              stage_changed_at: new Date().toISOString(),
            })
            .select("id, title, pipeline_id, stage_id, responsible_user_id")
            .single();
          if (dealErr) {
            console.error("[create-lead-core] deal insert failed:", dealErr);
          } else {
            createdDeal = deal;
            // ---------- Deal custom-field enrichment (mirror do typeform-webhook) ----------
            try {
              const DEAL_MQL_FIELD_ID = "448404cd-0344-4892-a574-2387b1c17578";
              const DEAL_FATURAMENTO_FIELD_ID = "ed5c7c0e-0740-4945-b982-70a593ffae0c";
              const DEAL_ORIGEM_FIELD_ID = "43d7d9a1-9370-45f3-803a-93717d2a6d1d";
              const DEAL_PRIMEIRO_CONTATO_FIELD_ID = "166fe351-b29b-4f08-b330-88f82c65f625";
              const DEAL_CANAL_FIELD_ID = "16ebda9f-cd3b-412c-bb06-0950001963c5";

              const { data: dealDefs } = await supabase
                .from("custom_fields")
                .select("id, options")
                .in("id", [DEAL_FATURAMENTO_FIELD_ID, DEAL_ORIGEM_FIELD_ID]);
              const optsOf = (id: string) =>
                (dealDefs || []).find((f: any) => f.id === id)?.options as any[] | undefined;
              const resolveOpt = (opts: any[] | undefined, raw: string | null | undefined) => {
                if (!opts || !raw) return null;
                const n = normalize(raw);
                const m = opts.find((o: any) => normalize(o.label) === n || o.value === raw);
                return m?.value || null;
              };

              const resolvedMqlField = fieldInserts.find((f: any) => f.field_id === MQL_FIELD_ID)?.value_text;
              const isMqlDeal = resolvedMqlField === "opt_1" || /^sim\b/i.test(payload.mql || "");
              const dealInserts: any[] = [
                { deal_id: deal.id, field_id: DEAL_MQL_FIELD_ID, account_id: accountId, value_text: isMqlDeal ? "sim_acima_30k" : "nao_abaixo_30k" },
                { deal_id: deal.id, field_id: DEAL_PRIMEIRO_CONTATO_FIELD_ID, account_id: accountId, value_date: new Date().toISOString().slice(0, 10) },
              ];

              if (payload.revenue_range) {
                const fat = resolveOpt(optsOf(DEAL_FATURAMENTO_FIELD_ID), payload.revenue_range);
                if (fat) dealInserts.push({ deal_id: deal.id, field_id: DEAL_FATURAMENTO_FIELD_ID, account_id: accountId, value_text: fat });
              }

              const firstTag = tags[0] || "";
              if (firstTag) {
                const origem = resolveOpt(optsOf(DEAL_ORIGEM_FIELD_ID), firstTag);
                if (origem) dealInserts.push({ deal_id: deal.id, field_id: DEAL_ORIGEM_FIELD_ID, account_id: accountId, value_json: [origem] });
              }

              const upper = (firstTag || payload.source || "").toUpperCase();
              const canal = /TRAF-/.test(upper) ? "trafego_pago" : (/ORG-/.test(upper) || /ORG[ÂA]NICO/.test(upper) ? "organico" : null);
              if (canal) dealInserts.push({ deal_id: deal.id, field_id: DEAL_CANAL_FIELD_ID, account_id: accountId, value_text: canal });

              await supabase.from("deal_field_values").delete().eq("deal_id", deal.id).in("field_id", dealInserts.map((d) => d.field_id));
              const { error: dfvErr } = await supabase.from("deal_field_values").insert(dealInserts);
              if (dfvErr) console.error("[create-lead-core] deal field enrich failed:", dfvErr);
            } catch (e) {
              console.error("[create-lead-core] deal enrichment error:", e);
            }
          }

