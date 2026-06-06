// OCR pra documentos usados dentro do app autenticado (Guia de Encaminhamento etc.).
// Recebe imagem base64 + kind ("id" | "cpf" | "address") e retorna campos extraídos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

type Kind = "id" | "cpf" | "address";

const SCHEMAS: Record<Kind, { name: string; description: string; fields: { key: string; description?: string }[] }> = {
  id: {
    name: "extract_id_document",
    description: "Extrai dados de RG ou CNH brasileira (frente e/ou verso). Aceita ambos.",
    fields: [
      { key: "tipo", description: "RG ou CNH" },
      { key: "nome", description: "Nome completo" },
      { key: "cpf", description: "Formato 000.000.000-00" },
      { key: "rg", description: "Número do RG" },
      { key: "rg_orgao_emissor", description: "Órgão emissor (ex SSP/SP)" },
      { key: "data_nascimento", description: "DD/MM/AAAA" },
      { key: "cnh_numero", description: "Número de registro da CNH" },
      { key: "cnh_categoria", description: "Categoria CNH" },
      { key: "cnh_validade", description: "DD/MM/AAAA" },
    ],
  },
  cpf: {
    name: "extract_cpf",
    description: "Extrai CPF e nome do titular.",
    fields: [
      { key: "cpf", description: "Formato 000.000.000-00" },
      { key: "nome", description: "Nome do titular" },
    ],
  },
  address: {
    name: "extract_address",
    description: "Extrai endereço completo de comprovante de residência.",
    fields: [
      { key: "titular" },
      { key: "logradouro" },
      { key: "numero" },
      { key: "complemento" },
      { key: "bairro" },
      { key: "cidade" },
      { key: "uf", description: "UF (2 letras)" },
      { key: "cep", description: "Formato 00000-000" },
    ],
  },
};

function buildTool(kind: Kind) {
  const s = SCHEMAS[kind];
  const properties: Record<string, unknown> = {};
  for (const f of s.fields) properties[f.key] = { type: "string", description: f.description || f.key };
  return {
    name: s.name,
    description: s.description,
    parameters: { type: "object", properties, additionalProperties: false },
  };
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

  try {
    // Auth check — apenas usuários logados
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "não autenticado" }, 401);
    const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: uErr } = await sb.auth.getUser();
    if (uErr || !userData?.user) return json({ error: "não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind || "id") as Kind;
    const images = Array.isArray(body.images) ? body.images : [];
    if (!SCHEMAS[kind]) return json({ error: "kind inválido" }, 400);
    if (images.length === 0) return json({ error: "envie pelo menos uma imagem (base64)" }, 400);
    if (images.length > 4) return json({ error: "máximo 4 imagens" }, 400);

    const imageParts = images.map((dataUrl: string) => ({
      type: "image_url" as const,
      image_url: { url: dataUrl },
    }));

    const tool = buildTool(kind);
    const sysPrompt =
      `Você é um assistente de OCR para documentos brasileiros. Leia as imagens enviadas e extraia os campos solicitados. ` +
      `Quando não tiver certeza de um campo, deixe-o como string vazia. NÃO invente dados. Responda chamando a função fornecida.`;
    const userText =
      kind === "id"
        ? "Estas são imagens de um documento de identidade brasileiro (RG ou CNH, frente e/ou verso). Extraia os campos."
        : kind === "cpf"
        ? "Esta é uma imagem do CPF brasileiro. Extraia os campos."
        : "Esta é uma imagem de um comprovante de residência. Extraia os campos do endereço.";

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: [{ type: "text", text: userText }, ...imageParts] },
        ],
        tools: [{ type: "function", function: tool }],
        tool_choice: { type: "function", function: { name: tool.name } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errText);
      let msg = "Falha ao ler o documento";
      if (aiRes.status === 429) msg = "Muitas leituras agora. Tente em alguns segundos.";
      if (aiRes.status === 402) msg = "Sem créditos pra leitura automática.";
      return json({ error: msg }, aiRes.status);
    }

    const aiJson = await aiRes.json();
    const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return json({ error: "Não consegui extrair os dados. Tente outra foto, com mais luz e foco." }, 502);
    }

    let extracted: Record<string, unknown> = {};
    try { extracted = JSON.parse(call.function.arguments); } catch (_) {}

    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(extracted)) {
      const s = (typeof v === "string" ? v : String(v ?? "")).trim();
      if (s) cleaned[k] = s;
    }

    return json({ ok: true, data: cleaned });
  } catch (e) {
    console.error("ocr-document error", e);
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});
