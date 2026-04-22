// Edge Function: bulk-process-call-transcripts
// Recebe um lote de arquivos .docx (base64), extrai o texto, parseia o nome
// (formato esperado: "Vendedor - Lead - Data.docx"), tenta dar match em deals
// ganhos no intervalo de ±7 dias, roda análise da IA com pontuação e grava em
// sales_call_analyses. Deduplica por hash do conteúdo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface IncomingFile {
  name: string;
  contentBase64: string; // raw .docx bytes (base64)
}

interface ProcessResult {
  filename: string;
  status: "processed" | "duplicate" | "error";
  error?: string;
  ai_score?: number | null;
  matched_deal_id?: string | null;
  matched_seller_id?: string | null;
  matched_client_id?: string | null;
  is_champion?: boolean;
  call_outcome?: string | null;
  extracted?: {
    seller_name?: string | null;
    lead_name?: string | null;
    call_date?: string | null;
  };
}

// ---------- Helpers ----------

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Arquivo .docx inválido (sem word/document.xml)");
  const xml = await docFile.async("string");
  // Quebras: <w:p ...> = parágrafo; <w:br/> = quebra de linha
  let text = xml
    .replace(/<w:p[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<w:tab[^>]*\/>/g, "\t");
  // Remove tags
  text = text.replace(/<[^>]+>/g, "");
  // Decodifica entidades comuns
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
  // Limpa espaços excessivos
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Distância de Jaccard simples para nomes
function nameSimilarity(a: string, b: string): number {
  const sa = new Set(normalize(a).split(" ").filter(Boolean));
  const sb = new Set(normalize(b).split(" ").filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return inter / union;
}

// Tenta extrair vendedor, lead e data do nome do arquivo
// Padrões aceitos:
//   "Vendedor - Lead - 2026-04-15.docx"
//   "Vendedor - Lead - 15-04-2026.docx"
//   "Vendedor - Lead - 15_04_2026.docx"
//   "Vendedor - Lead.docx" (sem data)
function parseFilename(filename: string): {
  seller?: string;
  lead?: string;
  date?: string; // ISO yyyy-mm-dd
} {
  const base = filename.replace(/\.docx$/i, "").trim();
  // separador " - " é o esperado, mas aceitamos " – ", "_" como fallback
  const parts = base
    .split(/\s+[-–]\s+|\s+_\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return {};

  const tryParseDate = (s: string): string | undefined => {
    const c = s.replace(/[._/]/g, "-").trim();
    let m = c.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = c.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    m = c.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
    if (m) return `20${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return undefined;
  };

  // Última parte costuma ser a data
  const last = parts[parts.length - 1];
  const date = tryParseDate(last);
  const meaningful = date ? parts.slice(0, -1) : parts;
  const seller = meaningful[0];
  const lead = meaningful.slice(1).join(" - ") || undefined;
  return { seller, lead, date };
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------- AI analysis ----------

const SYSTEM_PROMPT = `Você é um especialista em vendas e coaching comercial.
Analise a transcrição de uma call de vendas e retorne um JSON ESTRITO com a estrutura:

{
  "score": number (0-10, sua avaliação geral da call),
  "outcome_guess": "success" | "partial" | "failure" | "no_answer",
  "summary": string (resumo de 2-3 linhas),
  "objections": [{"objection": string, "moment": string, "reaction": string, "ideal_response": string}],
  "errors": [string],
  "strengths": [string],
  "diagnosis": string,
  "improved_script": string,
  "top_actions": [string]
}

Use português brasileiro. Seja DIRETO e ESPECÍFICO. Use exemplos reais da transcrição.
RETORNE APENAS O JSON, sem markdown, sem texto adicional.`;

async function analyzeWithAI(
  transcript: string,
  apiKey: string,
): Promise<{ analysisMarkdown: string; score: number | null; outcome: string | null }> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analise esta transcrição de call de vendas:\n\n${transcript.slice(0, 80000)}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const t = await response.text();
    throw new Error(`AI gateway ${response.status}: ${t}`);
  }
  const data = await response.json();
  const raw: string = data.choices?.[0]?.message?.content || "{}";

  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // tenta extrair bloco json caso venha com texto
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        parsed = {};
      }
    }
  }

  const score = typeof parsed.score === "number" ? parsed.score : null;
  const outcome =
    typeof parsed.outcome_guess === "string" ? parsed.outcome_guess : null;

  // Renderiza markdown amigável a partir do JSON
  const md: string[] = [];
  md.push(`## 📊 Resumo Geral`);
  if (score !== null) md.push(`- **Nota:** ${score}/10`);
  if (parsed.summary) md.push(parsed.summary);
  if (Array.isArray(parsed.objections) && parsed.objections.length > 0) {
    md.push(`\n## 🚫 Objeções Identificadas`);
    for (const o of parsed.objections) {
      md.push(`- **Objeção:** ${o.objection || "-"}\n  - **Momento:** ${o.moment || "-"}\n  - **Como reagiu:** ${o.reaction || "-"}\n  - **Como deveria ter respondido:** ${o.ideal_response || "-"}`);
    }
  }
  if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
    md.push(`\n## ❌ Erros do Vendedor`);
    parsed.errors.forEach((e: string) => md.push(`- ${e}`));
  }
  if (Array.isArray(parsed.strengths) && parsed.strengths.length > 0) {
    md.push(`\n## ✅ Pontos Fortes`);
    parsed.strengths.forEach((s: string) => md.push(`- ${s}`));
  }
  if (parsed.diagnosis) {
    md.push(`\n## 🎯 Diagnóstico`);
    md.push(parsed.diagnosis);
  }
  if (parsed.improved_script) {
    md.push(`\n## 📝 Script Melhorado`);
    md.push(parsed.improved_script);
  }
  if (Array.isArray(parsed.top_actions) && parsed.top_actions.length > 0) {
    md.push(`\n## 🔑 Top Ações Imediatas`);
    parsed.top_actions.forEach((a: string) => md.push(`- ${a}`));
  }

  return {
    analysisMarkdown: md.join("\n"),
    score,
    outcome,
  };
}

// ---------- Main ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

    // Auth: identifica usuário/account a partir do JWT do header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authUserId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profile, error: profileErr } = await admin
      .from("users")
      .select("id, account_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const accountId = profile.account_id as string;
    const userId = profile.id as string;

    const body = await req.json();
    const files: IncomingFile[] = Array.isArray(body?.files) ? body.files : [];
    if (files.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo enviado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (files.length > 30) {
      return new Response(
        JSON.stringify({ error: "Envie no máximo 30 arquivos por lote" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Carrega base de vendedores e deals da conta uma vez
    const { data: sellers } = await admin
      .from("users")
      .select("id, name")
      .eq("account_id", accountId);

    const { data: wonDeals } = await admin
      .from("deals")
      .select("id, title, won_at, stage_changed_at, client_id, lead_id")
      .eq("account_id", accountId)
      .eq("status", "won");

    // Resolve nomes de leads para os deals (em batch)
    const leadIds = Array.from(
      new Set((wonDeals || []).map((d: any) => d.lead_id).filter(Boolean)),
    );
    const leadsById: Record<string, string> = {};
    if (leadIds.length > 0) {
      const { data: leads } = await admin
        .from("leads")
        .select("id, full_name")
        .in("id", leadIds);
      (leads || []).forEach((l: any) => (leadsById[l.id] = l.full_name || ""));
    }
    const clientIds = Array.from(
      new Set((wonDeals || []).map((d: any) => d.client_id).filter(Boolean)),
    );
    const clientsById: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: clients } = await admin
        .from("clients")
        .select("id, full_name")
        .in("id", clientIds);
      (clients || []).forEach((c: any) => (clientsById[c.id] = c.full_name || ""));
    }

    const results: ProcessResult[] = [];

    for (const file of files) {
      const result: ProcessResult = { filename: file.name, status: "processed" };
      try {
        const bytes = base64ToUint8Array(file.contentBase64);
        const transcript = await extractDocxText(bytes);
        if (!transcript || transcript.length < 50) {
          throw new Error("Texto extraído muito curto");
        }

        const hash = await sha256(`${accountId}::${transcript}`);

        // Verifica duplicado
        const { data: existing } = await admin
          .from("sales_call_analyses")
          .select("id")
          .eq("account_id", accountId)
          .eq("source_hash", hash)
          .maybeSingle();
        if (existing) {
          result.status = "duplicate";
          results.push(result);
          continue;
        }

        const meta = parseFilename(file.name);
        result.extracted = {
          seller_name: meta.seller || null,
          lead_name: meta.lead || null,
          call_date: meta.date || null,
        };

        // Match vendedor pelo nome
        let sellerId: string | null = null;
        if (meta.seller && sellers) {
          let best = { id: "", score: 0 };
          for (const s of sellers as any[]) {
            const sc = nameSimilarity(meta.seller, s.name || "");
            if (sc > best.score) best = { id: s.id, score: sc };
          }
          if (best.score >= 0.5) sellerId = best.id;
        }

        // Match deal ganho dentro de ±7 dias com nome similar
        let dealId: string | null = null;
        let clientId: string | null = null;
        if (meta.lead && meta.date && wonDeals) {
          const minDate = addDays(meta.date, -7);
          const maxDate = addDays(meta.date, 7);
          let best = { dealId: "", clientId: "" as string | null, score: 0 };
          for (const d of wonDeals as any[]) {
            const closed = (d.won_at || d.stage_changed_at || "").slice(0, 10);
            if (!closed || closed < minDate || closed > maxDate) continue;
            const candidates = [
              d.title || "",
              clientsById[d.client_id] || "",
              leadsById[d.lead_id] || "",
            ];
            let sc = 0;
            for (const c of candidates) {
              const x = nameSimilarity(meta.lead, c);
              if (x > sc) sc = x;
            }
            if (sc > best.score) {
              best = { dealId: d.id, clientId: d.client_id || null, score: sc };
            }
          }
          if (best.score >= 0.4) {
            dealId = best.dealId;
            clientId = best.clientId;
          }
        }

        // Análise IA
        const ai = await analyzeWithAI(transcript, LOVABLE_API_KEY);
        const isChampion = (ai.score ?? 0) >= 8;
        const callOutcome = isChampion ? "success" : ai.outcome || null;

        const insertPayload: any = {
          account_id: accountId,
          user_id: userId,
          analysis: ai.analysisMarkdown,
          transcript_preview: transcript.slice(0, 200),
          source_filename: file.name,
          source_hash: hash,
          ai_score: ai.score,
          extracted_seller_name: meta.seller || null,
          extracted_lead_name: meta.lead || null,
          call_date: meta.date || null,
          seller_user_id: sellerId,
          deal_id: dealId,
          client_id: clientId,
          call_outcome: callOutcome,
        };

        const { error: insErr } = await admin
          .from("sales_call_analyses")
          .insert(insertPayload);
        if (insErr) {
          // Tratamento de violação de unique (duplicado em corrida)
          if ((insErr as any).code === "23505") {
            result.status = "duplicate";
            results.push(result);
            continue;
          }
          throw insErr;
        }

        result.ai_score = ai.score;
        result.matched_deal_id = dealId;
        result.matched_seller_id = sellerId;
        result.matched_client_id = clientId;
        result.is_champion = isChampion;
        result.call_outcome = callOutcome;
        results.push(result);
      } catch (e: any) {
        console.error(`[bulk-process] erro em ${file.name}:`, e);
        result.status = "error";
        result.error = e?.message || String(e);
        results.push(result);
      }
    }

    const summary = {
      total: results.length,
      processed: results.filter((r) => r.status === "processed").length,
      duplicates: results.filter((r) => r.status === "duplicate").length,
      errors: results.filter((r) => r.status === "error").length,
      champions: results.filter((r) => r.is_champion).length,
    };

    return new Response(JSON.stringify({ summary, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("bulk-process-call-transcripts error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
