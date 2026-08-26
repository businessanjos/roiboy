import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Somente Médicos e Dentistas. Excluir explicitamente outras profissões da saúde.
const DOCTOR_TERMS = [
  "médico", "medico", "médica", "medica", "medicina",
  "cirurgi", "dermato", "cardio", "pediatr", "ginecolog", "ortoped",
  "neurocir", "neurolog", "psiquiatr", "urolog", "oftalmo", "otorrino", "anestesi",
  "radiolog", "endocrino", "nutrolog", "hemato", "nefro", "reumato",
  "gastroenter", "infecto", "oncolog", "pneumolog", "geriatr", "patolog",
  "mastolog", "angiolog", "homeopat", "hebiatr", "clínica médica", "clinica medica",
  "hepatolog",
];

const DENTIST_TERMS = [
  "dentista", "odontolog", "odontólog", "odonto", "odontopediatr",
  "endodont", "periodont", "implantodont", "ortodont", "protesist",
  "harmonizaç", "harmoniz", "cirurgião-dentista", "cirurgiao-dentista", "cirurgiã-dentista", "cirurgia dentista",
];

// Se o texto contiver qualquer um destes, NÃO é médico nem dentista.
const EXCLUDE_TERMS = [
  "biomédic", "biomedic",
  "fisioterap",
  "enfermeir", "enfermag",
  "farmacêut", "farmaceut",
  "nutricion",
  "psicólog", "psicolog", "psicanal",
  "veterinár", "veterinar",
  "esteticist", "estética facial", "estetica facial", "estética avançada", "estetica avancada",
  "fonoaudi",
  "terapeuta ocupacional",
  "educador físic", "educador fisic", "educadora físic", "educadora fisic",
  "personal trainer",
  "quiroprax",
  "podólog", "podolog",
  "técnic", "tecnic",
  "administrad", "empresár", "empresari", "advogad", "engenh", "arquitet",
];

const RELEVANT_FIELD_IDS = [
  "2659c721-11dc-4c61-918d-c6eebc18d6b0", // Qual a sua profissão atual?
  "034ed260-5a76-4b40-8379-675285c9d1d8", // Qual sua formação de graduação?
  "73c0976c-d15c-42b2-968e-009aa808199b", // Qual(is) a(s) sua(s) área(s) de atuação?
  "0c01f67a-b0b1-423e-af36-7fd4fb91b016", // Descrição do negócio
  "327c2004-57ba-4c1e-9f42-ea17c4a98966", // Qual é a sua atuação profissional?
  "a82dfd9a-4e3a-4e26-98c0-62a864c3ecb5", // Área de atuação
];

const MENTORSHIP_PRODUCT_PATTERNS = ["ryka", "eternum", "mvp", "private"];

type Classification = "doctor" | "dentist" | null;

function classify(text: string | null | undefined): Classification {
  if (!text) return null;
  const lower = text.toLowerCase();
  // Exclusão tem prioridade — se aparece profissão bloqueada, ignora.
  if (EXCLUDE_TERMS.some((t) => lower.includes(t))) return null;
  if (DENTIST_TERMS.some((t) => lower.includes(t))) return "dentist";
  if (DOCTOR_TERMS.some((t) => lower.includes(t))) return "doctor";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("account_id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle();
    const accountId = profile?.account_id;
    if (!accountId) {
      return new Response(JSON.stringify({ error: "No account" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) All non-inactive clients in this account with their (mentorship) products
    const { data: clients } = await supabase
      .from("clients")
      .select("*, client_products(product_id, is_active, products(name, color)), responsible:users!clients_responsible_user_id_fkey(name)")
      .eq("account_id", accountId)
      .in("status", ["active", "churn_risk"]);

    // Campos da ficha que não fazem sentido expor na sincronização
    const HIDDEN_COLUMNS = new Set([
      "id", "account_id", "client_products", "responsible",
      "full_name_normalized", "company_name_normalized",
      "responsible_user_id", "sales_user_id", "stage_id",
      "logo_url", "avatar_url",
    ]);

    const COLUMN_LABELS: Record<string, string> = {
      full_name: "Nome", phone_e164: "Telefone", emails: "E-mails",
      additional_phones: "Telefones adicionais", status: "Status", tags: "Tags",
      cpf: "CPF", cnpj: "CNPJ", rg: "RG", birth_date: "Nascimento", gender: "Gênero",
      company_name: "Empresa", companies: "Empresas", notes: "Observações",
      street: "Rua", street_number: "Número", complement: "Complemento",
      neighborhood: "Bairro", city: "Cidade", state: "UF", zip_code: "CEP", country: "País",
      business_street: "Rua (negócio)", business_street_number: "Número (negócio)",
      business_complement: "Complemento (negócio)", business_neighborhood: "Bairro (negócio)",
      business_city: "Cidade (negócio)", business_state: "UF (negócio)", business_zip_code: "CEP (negócio)",
      contract_start_date: "Início do contrato", contract_end_date: "Fim do contrato",
      is_mls: "MLS", mls_level: "Nível MLS", instagram: "Instagram", instagrams: "Instagrams",
      bio: "Bio", business_segment: "Segmento", business_niche: "Nicho",
      education: "Formação", education_specialty: "Especialidade",
      initial_revenue: "Faturamento inicial", current_revenue: "Faturamento atual",
      current_revenue_month: "Mês do faturamento", differential: "Diferencial",
      method_name: "Nome do método", timezone: "Fuso horário",
      pix_key_type: "Tipo chave PIX", pix_key: "Chave PIX", bank_name: "Banco",
      bank_code: "Código do banco", bank_agency: "Agência", bank_account: "Conta",
      bank_account_type: "Tipo de conta", additional_pix_keys: "Chaves PIX adicionais",
      additional_bank_accounts: "Contas bancárias adicionais",
      created_at: "Criado em", onboarding_started_at: "Onboarding iniciado em",
      stage_changed_at: "Etapa alterada em", recent_activity_at: "Última atividade",
      ai_next_step: "Próximo passo (IA)", ai_next_step_at: "Próximo passo em",
      overdue_exception_until: "Exceção de inadimplência até",
    };

    const formatValue = (v: any): string => {
      if (v === null || v === undefined || v === "") return "";
      if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).filter(Boolean).join(", ");
      if (typeof v === "object") return JSON.stringify(v);
      if (typeof v === "boolean") return v ? "Sim" : "Não";
      return String(v);
    };

    const clientList = (clients ?? []).map((c: any) => {
      // Considera apenas vínculos de produto ativos (toggle na ficha do cliente)
      const activeProducts = (c.client_products ?? []).filter((cp: any) => cp.is_active !== false);
      const productNames: string[] = activeProducts
        .map((cp: any) => cp.products?.name)
        .filter(Boolean);
      const productColors: Record<string, string> = {};
      for (const cp of activeProducts) {
        if (cp.products?.name) productColors[cp.products.name] = cp.products.color || "#6b7280";
      }


      // Todos os campos da ficha (fonte única), já formatados
      const recordFields = Object.keys(c)
        .filter((k) => !HIDDEN_COLUMNS.has(k))
        .map((k) => ({ key: k, label: COLUMN_LABELS[k] ?? k, value: formatValue(c[k]) }))
        .filter((f) => f.value !== "")
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

      if (c.responsible?.name) {
        recordFields.push({ key: "responsible", label: "Responsável", value: c.responsible.name });
      }

      return {
        id: c.id,
        full_name: c.full_name,
        logo_url: c.logo_url,
        education: c.education,
        education_specialty: c.education_specialty,
        status: c.status,
        phone_e164: c.phone_e164,
        city: c.city,
        state: c.state,
        recordFields,
        products: productNames,
        productColors,
        isMentorship: productNames.some((n) =>
          MENTORSHIP_PRODUCT_PATTERNS.some((p) => n.toLowerCase().includes(p)),
        ),
      };
    });

    const mentorshipClientIds = clientList.filter((c) => c.isMentorship).map((c) => c.id);

    // 2) Todos os campos personalizados preenchidos (sincronização completa)
    const fieldValues: any[] = [];
    if (mentorshipClientIds.length) {
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data: page, error: pageErr } = await supabase
          .from("client_field_values")
          .select("client_id, field_id, value_text, value_number, value_boolean, value_date, value_json, custom_fields(name)")
          .in("client_id", mentorshipClientIds)
          .order("client_id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (pageErr) throw pageErr;
        fieldValues.push(...(page ?? []));
        if (!page || page.length < PAGE) break;
      }
    }

    const customByClient = new Map<string, { key: string; label: string; value: string }[]>();
    for (const fv of (fieldValues ?? []) as any[]) {
      const raw = fv.value_text ?? fv.value_number ?? fv.value_boolean ?? fv.value_date ?? fv.value_json;
      const value = formatValue(raw);
      if (!value) continue;
      const list = customByClient.get(fv.client_id) ?? [];
      list.push({ key: fv.field_id, label: fv.custom_fields?.name ?? "Campo personalizado", value });
      customByClient.set(fv.client_id, list);
    }
    for (const list of customByClient.values()) {
      list.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    }


    type Ev = { source: string; field?: string; text: string; kind: "doctor" | "dentist" };
    const evidenceByClient = new Map<string, Ev[]>();
    const excludedByClient = new Set<string>();

    for (const fv of fieldValues ?? []) {
      // Classificação continua restrita aos campos relevantes de profissão.
      if (!RELEVANT_FIELD_IDS.includes((fv as any).field_id)) continue;
      const text = (fv as any).value_text as string | null;
      if (!text) continue;

      const lower = text.toLowerCase();
      // Se qualquer campo indica profissão excluída, cliente é descartado.
      if (EXCLUDE_TERMS.some((t) => lower.includes(t))) {
        excludedByClient.add((fv as any).client_id);
      }
      const kind = classify(text);
      if (!kind) continue;
      const fieldName = (fv as any).custom_fields?.name ?? "Campo";
      const list = evidenceByClient.get((fv as any).client_id) ?? [];
      list.push({ source: "onboarding", field: fieldName, text, kind });
      evidenceByClient.set((fv as any).client_id, list);
    }

    // 3) Compile final list: a ficha do cliente (cadastro) é a fonte autoritativa.
    const result = clientList
      .filter((c) => c.isMentorship)
      .map((c) => {
        const evidence: Ev[] = [...(evidenceByClient.get(c.id) ?? [])];
        const eduKind = classify(c.education);
        if (eduKind) {
          evidence.push({ source: "cadastro", field: "Formação", text: c.education!, kind: eduKind });
        }
        const specKind = classify(c.education_specialty);
        if (specKind) {
          evidence.push({ source: "cadastro", field: "Especialidade", text: c.education_specialty!, kind: specKind });
        }

        const eduLower = (c.education ?? "").toLowerCase();
        const specLower = (c.education_specialty ?? "").toLowerCase();
        const cadastroExcluded = EXCLUDE_TERMS.some(
          (t) => eduLower.includes(t) || specLower.includes(t),
        );
        // A ficha manda: se ela classifica como médico/dentista, entra mesmo que
        // o onboarding antigo diga outra coisa; se ela diz outra profissão, sai.
        const cadastroKind = cadastroExcluded ? null : (eduKind ?? specKind);
        const onboardingKind: "doctor" | "dentist" | null =
          evidence.some((e) => e.source === "onboarding" && e.kind === "doctor") ? "doctor"
          : evidence.some((e) => e.source === "onboarding" && e.kind === "dentist") ? "dentist"
          : null;

        const hasCadastroInfo = Boolean(c.education || c.education_specialty);
        const kind: "doctor" | "dentist" | null = hasCadastroInfo
          ? cadastroKind
          : (excludedByClient.has(c.id) ? null : onboardingKind);

        return { ...c, evidence, kind, customFields: customByClient.get(c.id) ?? [] };
      })
      .filter((c) => c.kind !== null)
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));


    return new Response(
      JSON.stringify({ clients: result, total: result.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("list-medical-clients error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
