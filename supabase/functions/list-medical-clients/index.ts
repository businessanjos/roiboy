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
      .select("id, full_name, logo_url, status, education, education_specialty, client_products(product_id, products(name, color))")
      .eq("account_id", accountId)
      .in("status", ["active", "churn_risk"]);

    const clientList = (clients ?? []).map((c: any) => {
      const productNames: string[] = (c.client_products ?? [])
        .map((cp: any) => cp.products?.name)
        .filter(Boolean);
      const productColors: Record<string, string> = {};
      for (const cp of c.client_products ?? []) {
        if (cp.products?.name) productColors[cp.products.name] = cp.products.color || "#6b7280";
      }
      return {
        id: c.id,
        full_name: c.full_name,
        logo_url: c.logo_url,
        education: c.education,
        education_specialty: c.education_specialty,
        products: productNames,
        productColors,
        isMentorship: productNames.some((n) =>
          MENTORSHIP_PRODUCT_PATTERNS.some((p) => n.toLowerCase().includes(p)),
        ),
      };
    });

    const mentorshipClientIds = clientList.filter((c) => c.isMentorship).map((c) => c.id);

    // 2) Field values evidence
    const { data: fieldValues } = mentorshipClientIds.length
      ? await supabase
          .from("client_field_values")
          .select("client_id, field_id, value_text, custom_fields(name)")
          .in("client_id", mentorshipClientIds)
          .in("field_id", RELEVANT_FIELD_IDS)
      : { data: [] };

    type Ev = { source: string; field?: string; text: string; kind: "doctor" | "dentist" };
    const evidenceByClient = new Map<string, Ev[]>();
    const excludedByClient = new Set<string>();

    for (const fv of fieldValues ?? []) {
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

    // 3) Compile final list: apenas médicos e dentistas com evidência positiva.
    const result = clientList
      .filter((c) => c.isMentorship)
      .map((c) => {
        const evidence: Ev[] = evidenceByClient.get(c.id) ?? [];
        const eduKind = classify(c.education);
        if (eduKind) {
          evidence.push({ source: "cadastro", field: "Formação", text: c.education!, kind: eduKind });
        }
        const specKind = classify(c.education_specialty);
        if (specKind) {
          evidence.push({ source: "cadastro", field: "Especialidade", text: c.education_specialty!, kind: specKind });
        }
        // Também descarta se cadastro traz profissão excluída.
        const eduLower = (c.education ?? "").toLowerCase();
        const specLower = (c.education_specialty ?? "").toLowerCase();
        if (EXCLUDE_TERMS.some((t) => eduLower.includes(t) || specLower.includes(t))) {
          excludedByClient.add(c.id);
        }
        const kind: "doctor" | "dentist" | null =
          evidence.some((e) => e.kind === "doctor") ? "doctor"
          : evidence.some((e) => e.kind === "dentist") ? "dentist"
          : null;
        return { ...c, evidence, kind };
      })
      .filter((c) => c.kind !== null && !excludedByClient.has(c.id))
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
