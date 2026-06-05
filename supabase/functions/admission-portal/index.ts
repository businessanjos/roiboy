// Public portal for admission candidates: read checklist and upload documents.
// No auth required — protected by per-admission public_token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "admission-docs";
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "get";

  try {
    if (action === "get") {
      const token = url.searchParams.get("token");
      if (!token) return json({ error: "token obrigatório" }, 400);
      const { data, error } = await supabase.rpc("get_admission_portal", { _token: token });
      if (error) throw error;
      if (!data) return json({ error: "not_found" }, 404);
      return json(data);
    }

    if (action === "upload" && req.method === "POST") {
      const form = await req.formData();
      const token = form.get("token") as string;
      const docId = form.get("doc_id") as string;
      const file = form.get("file") as File;
      if (!token || !docId || !file) return json({ error: "campos obrigatórios faltando" }, 400);
      if (file.size > MAX_BYTES) return json({ error: "Arquivo acima de 15MB" }, 400);

      // Resolve admission via token
      const { data: portal, error: pErr } = await supabase.rpc("get_admission_portal", { _token: token });
      if (pErr) throw pErr;
      if (!portal || portal.expired) return json({ error: "Link inválido ou expirado" }, 403);

      const admissionId = portal.id as string;
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `portal/${admissionId}/${docId}.${ext}`;
      const buf = new Uint8Array(await file.arrayBuffer());

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
        upsert: true,
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) throw upErr;

      const { data: signed, error: sErr } = await supabase
        .storage.from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr) throw sErr;

      const { data: ok, error: rpcErr } = await supabase.rpc("submit_admission_doc", {
        _token: token,
        _doc_id: docId,
        _file_url: signed.signedUrl,
        _file_name: file.name,
      });
      if (rpcErr) throw rpcErr;
      if (!ok) return json({ error: "Documento não encontrado" }, 404);

      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    console.error("admission-portal error", e);
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});
