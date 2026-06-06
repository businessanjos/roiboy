// OCR pra documentos da admissão. Baixa arquivo do bucket admission-docs,
// envia pro Lovable AI Gateway (Gemini Vision) e grava o resultado em
// hr_admission_documents.ocr_data via RPC SECURITY DEFINER.
// Público — protegido pelo public_token da admissão.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const BUCKET = "admission-docs";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Kind = "id" | "cpf" | "address";

const SCHEMAS: Record<Kind, { name: string; description: string; fields: { key: string; label: string; type?: string; description?: string }[] }> = {
  id: {
    name: "extract_id_document",
    description: "Extrai dados de RG ou CNH brasileira (frente e/ou verso). Aceita ambos.",
    fields: [
      { key: "tipo", label: "Tipo (RG ou CNH)", description: "RG ou CNH" },
      { key: "nome", label: "Nome completo" },
      { key: "cpf", label: "CPF", description: "Apenas dígitos ou formato 000.000.000-00" },
      { key: "rg", label: "Número do RG / Registro Geral" },
      { key: "rg_orgao_emissor", label: "Órgão emissor do RG (ex SSP/SP)" },
      { key: "data_nascimento", label: "Data de nascimento", description: "DD/MM/AAAA" },
      { key: "nome_mae", label: "Nome da mãe" },
      { key: "nome_pai", label: "Nome do pai" },
      { key: "naturalidade", label: "Naturalidade (cidade/UF)" },
      { key: "cnh_numero", label: "Número de registro da CNH (somente CNH)" },
      { key: "cnh_categoria", label: "Categoria da CNH (somente CNH)" },
      { key: "cnh_validade", label: "Validade da CNH (somente CNH)", description: "DD/MM/AAAA" },
      { key: "cnh_primeira_habilitacao", label: "Data da primeira habilitação (somente CNH)", description: "DD/MM/AAAA" },
    ],
  },
  cpf: {
    name: "extract_cpf",
    description: "Extrai número de CPF e nome do titular.",
    fields: [
      { key: "cpf", label: "CPF", description: "Formato 000.000.000-00" },
      { key: "nome", label: "Nome do titular" },
    ],
  },
  address: {
    name: "extract_address",
    description: "Extrai endereço completo de comprovante de residência (conta de luz, água, internet, fatura).",
    fields: [
      { key: "titular", label: "Nome do titular da conta" },
      { key: "logradouro", label: "Logradouro (rua/av)" },
      { key: "numero", label: "Número" },
      { key: "complemento", label: "Complemento" },
      { key: "bairro", label: "Bairro" },
      { key: "cidade", label: "Cidade" },
      { key: "uf", label: "UF (2 letras)" },
      { key: "cep", label: "CEP", description: "Formato 00000-000" },
      { key: "data_emissao", label: "Data de emissão do comprovante", description: "DD/MM/AAAA" },
    ],
  },
};

function buildSchema(kind: Kind) {
  const s = SCHEMAS[kind];
  const properties: Record<string, unknown> = {};
  for (const f of s.fields) {
    properties[f.key] = { type: "string", description: f.description || f.label };
  }
  return {
    name: s.name,
    description: s.description,
    parameters: {
      type: "object",
      properties,
      additionalProperties: false,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  if (!LOVABLE_API_KEY) {
    return json({ error: "LOVABLE_API_KEY não configurada" }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "");
    const docId = String(body.doc_id || "");
    if (!token || !docId) return json({ error: "campos obrigatórios faltando" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Resolve portal e doc
    const { data: portal, error: pErr } = await admin.rpc("get_admission_portal", { _token: token });
    if (pErr) throw pErr;
    if (!portal || portal.expired) return json({ error: "Link inválido ou expirado" }, 403);

    const doc = (portal.documents || []).find((d: any) => d.id === docId);
    if (!doc) return json({ error: "documento não encontrado" }, 404);
    if (!doc.ocr_kind) return json({ error: "Documento não suporta OCR" }, 400);

    const attachments = (doc.attachments || []) as Array<{ path: string | null; name: string; url: string }>;
    if (attachments.length === 0) return json({ error: "Nenhum arquivo enviado pra ler" }, 400);

    // 2) Marca como processing
    await admin.rpc("set_admission_ocr_result", {
      _token: token,
      _doc_id: docId,
      _status: "processing",
      _data: null,
      _error: null,
    });

    // 3) Baixa todos os anexos com path (ignora os sem path), max 4
    const toRead = attachments.filter((a) => a.path).slice(0, 4);
    if (toRead.length === 0) return json({ error: "Sem arquivos legíveis" }, 400);

    const imageParts: Array<{ type: "image_url"; image_url: { url: string } }> = [];
    for (const a of toRead) {
      const { data: dl, error: dlErr } = await admin.storage.from(BUCKET).download(a.path!);
      if (dlErr || !dl) continue;
      const buf = new Uint8Array(await dl.arrayBuffer());
      // Gemini Vision aceita até ~20MB por imagem, fica seguro com 15MB do upload.
      let mime = dl.type || "image/jpeg";
      // PDFs: o gateway atual não suporta PDF via image_url. Pulamos.
      if (mime === "application/pdf") continue;
      // base64
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        bin += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      const b64 = btoa(bin);
      imageParts.push({ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } });
    }

    if (imageParts.length === 0) {
      await admin.rpc("set_admission_ocr_result", {
        _token: token,
        _doc_id: docId,
        _status: "failed",
        _data: null,
        _error: "Só PDFs foram enviados. Envie uma foto (JPG/PNG) pra leitura automática.",
      });
      return json({ error: "Apenas PDFs enviados; envie uma foto" }, 400);
    }

    // 4) Chama Lovable AI Gateway
    const tool = buildSchema(doc.ocr_kind as Kind);
    const sysPrompt =
      `Você é um assistente de OCR para documentos brasileiros. Leia as imagens enviadas e extraia os campos solicitados. ` +
      `Quando não tiver certeza de um campo, deixe-o como string vazia. NÃO invente dados. Responda chamando a função fornecida.`;
    const userText =
      doc.ocr_kind === "id"
        ? "Estas são imagens de um documento de identidade brasileiro (RG ou CNH). Extraia os campos."
        : doc.ocr_kind === "cpf"
        ? "Esta é uma imagem do CPF brasileiro. Extraia os campos."
        : "Esta é uma imagem de um comprovante de residência brasileiro. Extraia os campos do endereço.";

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
      await admin.rpc("set_admission_ocr_result", {
        _token: token,
        _doc_id: docId,
        _status: "failed",
        _data: null,
        _error: msg,
      });
      return json({ error: msg }, aiRes.status);
    }

    const aiJson = await aiRes.json();
    const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      await admin.rpc("set_admission_ocr_result", {
        _token: token,
        _doc_id: docId,
        _status: "failed",
        _data: null,
        _error: "Não consegui extrair os dados. Tente outra foto, com mais luz e foco.",
      });
      return json({ error: "Resposta sem tool_call" }, 502);
    }

    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(call.function.arguments);
    } catch (_) {
      // ignora
    }

    // limpa strings vazias e normaliza
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(extracted)) {
      const s = (typeof v === "string" ? v : String(v ?? "")).trim();
      if (s) cleaned[k] = s;
    }

    await admin.rpc("set_admission_ocr_result", {
      _token: token,
      _doc_id: docId,
      _status: "ready",
      _data: cleaned,
      _error: null,
    });

    return json({ ok: true, data: cleaned });
  } catch (e) {
    console.error("admission-ocr error", e);
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});
