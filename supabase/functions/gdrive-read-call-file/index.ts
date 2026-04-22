import JSZip from "https://esm.sh/jszip@3.10.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.24.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
});

async function getContext(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!supabaseUrl || !anonKey || !serviceKey || !clientId || !clientSecret) {
    throw new Error("Google Drive runtime configuration is incomplete");
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) throw new Error("Unauthorized");

  const userId = claimsData.claims.sub as string;
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await admin
    .from("users")
    .select("account_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (!profile?.account_id) throw new Error("Conta não encontrada");

  const { data: connection } = await admin
    .from("google_drive_connections")
    .select("id, access_token, refresh_token, token_expires_at, is_active")
    .eq("account_id", profile.account_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!connection?.is_active) throw new Error("Google Drive não conectado");

  let accessToken = connection.access_token;
  const shouldRefresh =
    !accessToken ||
    !connection.token_expires_at ||
    new Date(connection.token_expires_at).getTime() <= Date.now() + 60_000;

  if (shouldRefresh) {
    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refresh_token,
        grant_type: "refresh_token",
      }).toString(),
    });
    const refreshJson = await refreshRes.json();
    if (!refreshRes.ok || !refreshJson?.access_token) {
      throw new Error(`Falha ao atualizar token do Google Drive: ${refreshJson?.error || refreshRes.status}`);
    }

    accessToken = refreshJson.access_token as string;
    const expiresAt = new Date(Date.now() + (((refreshJson.expires_in as number) || 3600) - 60) * 1000).toISOString();
    await admin
      .from("google_drive_connections")
      .update({ access_token: accessToken, token_expires_at: expiresAt, last_sync_error: null, last_sync_status: "ready" })
      .eq("id", connection.id);
  }

  return { accessToken };
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Arquivo .docx inválido");
  const xml = await docFile.async("string");
  return xml
    .replace(/<w:p[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { accessToken } = await getContext(req);
    const { fileId, fileName, mimeType } = parsed.data;

    let transcript = "";

    if (mimeType === "application/vnd.google-apps.document") {
      const docRes = await fetch(`https://docs.googleapis.com/v1/documents/${fileId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const docJson = await docRes.json();
      if (!docRes.ok) {
        throw new Error(`Falha ao ler Google Docs [${docRes.status}]: ${JSON.stringify(docJson)}`);
      }
      transcript = (docJson.body?.content || [])
        .flatMap((block: any) => block.paragraph?.elements || [])
        .map((element: any) => element.textRun?.content || "")
        .join("")
        .trim();
    } else {
      const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!downloadRes.ok) {
        const body = await downloadRes.text();
        throw new Error(`Falha ao baixar arquivo do Google Drive [${downloadRes.status}]: ${body}`);
      }

      if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const bytes = new Uint8Array(await downloadRes.arrayBuffer());
        transcript = await extractDocxText(bytes);
      } else {
        transcript = (await downloadRes.text()).trim();
      }
    }

    if (!transcript) {
      throw new Error(`Não foi possível extrair texto de ${fileName}`);
    }

    return new Response(JSON.stringify({ transcript, fileName, mimeType }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("gdrive-read-call-file error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});