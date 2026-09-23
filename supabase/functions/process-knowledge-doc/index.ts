import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BYTES = 25 * 1024 * 1024; // arquivos maiores não são processados (só ficam anexados)
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
const MAX_CHUNKS = 400;

function decodeSub(authHeader: string | null): string | null {
  try {
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

function cleanText(raw: string): string {
  return raw
    .replace(/\u0000/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(i + CHUNK_SIZE, text.length);
    if (end < text.length) {
      const slice = text.slice(i, end);
      const brk = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("\n"),
        slice.lastIndexOf(". "),
      );
      if (brk > CHUNK_SIZE * 0.5) end = i + brk + 1;
    }
    const piece = text.slice(i, end).trim();
    if (piece) chunks.push(piece);
    if (end >= text.length) break;
    i = Math.max(end - CHUNK_OVERLAP, i + 1);
  }
  return chunks;
}

async function extractText(
  bytes: Uint8Array,
  fileName: string,
  fileType: string | null,
): Promise<{ text: string; note?: string }> {
  const name = (fileName || "").toLowerCase();
  const type = (fileType || "").toLowerCase();

  const isPdf = name.endsWith(".pdf") || type.includes("pdf");
  const isDocx = name.endsWith(".docx") ||
    type.includes("officedocument.wordprocessingml");
  const isPlain = /\.(txt|md|markdown|csv|json|vtt|srt|html?|log)$/.test(name) ||
    type.startsWith("text/") || type.includes("json");

  if (isPdf) {
    const { extractText: pdfExtract, getDocumentProxy } = await import(
      "npm:unpdf@0.12.1"
    );
    const doc = await getDocumentProxy(bytes);
    const { text } = await pdfExtract(doc, { mergePages: true });
    return { text: Array.isArray(text) ? text.join("\n\n") : String(text ?? "") };
  }

  if (isDocx) {
    const mammoth = await import("npm:mammoth@1.8.0");
    const result = await mammoth.extractRawText({
      // deno-lint-ignore no-explicit-any
      buffer: bytes as any,
    });
    return { text: result?.value ?? "" };
  }

  if (isPlain) {
    return { text: new TextDecoder("utf-8", { fatal: false }).decode(bytes) };
  }

  return {
    text: "",
    note: "Formato não suportado para leitura automática — o arquivo fica anexado, mas só o título é usado pela IA.",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  let documentId: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Configuração ausente" }, 500);

    const authUserId = decodeSub(req.headers.get("Authorization"));
    if (!authUserId) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    documentId = typeof body?.documentId === "string" ? body.documentId : null;
    if (!documentId || !/^[0-9a-f-]{36}$/i.test(documentId)) {
      return json({ error: "documentId inválido" }, 400);
    }

    admin = createClient(url, key, { auth: { persistSession: false } });

    const { data: userRow } = await admin
      .from("users")
      .select("account_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    const accountId = userRow?.account_id;
    if (!accountId) return json({ error: "Conta não encontrada" }, 403);

    const { data: doc, error: docErr } = await admin
      .from("ai_knowledge_documents")
      .select("id, account_id, file_path, file_name, file_type, file_size")
      .eq("id", documentId)
      .maybeSingle();
    if (docErr || !doc) return json({ error: "Documento não encontrado" }, 404);
    if (doc.account_id !== accountId) return json({ error: "Sem acesso" }, 403);
    if (!doc.file_path) return json({ error: "Documento sem arquivo" }, 400);

    await admin
      .from("ai_knowledge_documents")
      .update({ status: "processing", error_message: null })
      .eq("id", documentId);

    if (Number(doc.file_size ?? 0) > MAX_BYTES) {
      await admin
        .from("ai_knowledge_documents")
        .update({
          status: "completed",
          chunks_count: 0,
          error_message:
            "Arquivo muito grande para leitura automática (limite 25 MB). Ele fica anexado, mas a IA usa apenas o título.",
        })
        .eq("id", documentId);
      return json({ ok: true, chunks: 0, skipped: "too_large" });
    }

    const { data: file, error: dlErr } = await admin.storage
      .from("ai-knowledge-docs")
      .download(doc.file_path);
    if (dlErr || !file) throw new Error("Não foi possível ler o arquivo enviado");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { text: rawText, note } = await extractText(
      bytes,
      doc.file_name ?? "",
      doc.file_type ?? null,
    );
    const text = cleanText(rawText ?? "");

    await admin.from("ai_knowledge_chunks").delete().eq("document_id", documentId);

    if (!text) {
      await admin
        .from("ai_knowledge_documents")
        .update({
          status: "completed",
          chunks_count: 0,
          extracted_text: null,
          error_message: note ??
            "Não foi possível extrair texto (arquivo digitalizado ou vazio).",
        })
        .eq("id", documentId);
      return json({ ok: true, chunks: 0 });
    }

    const chunks = chunkText(text);
    for (let i = 0; i < chunks.length; i += 100) {
      const batch = chunks.slice(i, i + 100).map((content, idx) => ({
        account_id: accountId,
        document_id: documentId,
        chunk_index: i + idx,
        content,
      }));
      const { error: insErr } = await admin.from("ai_knowledge_chunks").insert(batch);
      if (insErr) throw insErr;
    }

    await admin
      .from("ai_knowledge_documents")
      .update({
        status: "completed",
        chunks_count: chunks.length,
        extracted_text: text.slice(0, 20000),
        error_message: null,
      })
      .eq("id", documentId);

    return json({ ok: true, chunks: chunks.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao processar o arquivo";
    console.error("process-knowledge-doc error:", message);
    if (admin && documentId) {
      await admin
        .from("ai_knowledge_documents")
        .update({ status: "error", error_message: message.slice(0, 500) })
        .eq("id", documentId);
    }
    return json({ error: message }, 500);
  }
});
