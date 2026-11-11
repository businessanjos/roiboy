// Importa automaticamente as transcrições do Google Meet ("Meet Recordings")
// do Drive de cada vendedor conectado para Videochamadas (status pendente).
// Modos: usuário logado -> só a conta dele; cron (x-cron-secret) -> todas.
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_FILES_PER_CONNECTION = 15;
const LOOKBACK_DAYS = 30;
const DOC_MIME = "application/vnd.google-apps.document";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function docxText(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return "";
  return xml.replace(/<\/w:p>/g, "\n").replace(/<w:br[^>]*\/>/g, "\n").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}

/** "Reunião com Ana Silva (2026-11-10 14:00 GMT-3) - Transcrição" -> "Ana Silva" */
export function participantFromTitle(name: string): string {
  let t = name.replace(/\.(docx|txt|vtt)$/i, "");
  t = t.replace(/\s*[-–]\s*(transcri[çc][ãa]o|transcript|anota[çc][õo]es.*|notes by gemini)\s*$/i, "");
  t = t.replace(/\s*\(\d{4}-\d{2}-\d{2}[^)]*\)\s*/g, " ");
  t = t.replace(/^(reuni[ãa]o|call|chamada|meeting)\s*(comercial)?\s*(com|with|-)?\s*/i, "");
  return t.replace(/\s+/g, " ").trim().slice(0, 200) || name.slice(0, 200);
}

async function refresh(admin: any, conn: any) {
  if (conn.access_token && conn.token_expires_at && new Date(conn.token_expires_at).getTime() > Date.now() + 60_000)
    return conn.access_token as string;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!, client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: conn.refresh_token, grant_type: "refresh_token",
    }).toString(),
  });
  const j = await r.json();
  if (!r.ok || !j?.access_token) throw new Error(`Google recusou a renovação do acesso (${j?.error || r.status}). Reconecte o Google.`);
  await admin.from("google_drive_connections").update({
    access_token: j.access_token,
    token_expires_at: new Date(Date.now() + ((j.expires_in || 3600) - 60) * 1000).toISOString(),
  }).eq("id", conn.id);
  return j.access_token as string;
}

async function gget(token: string, url: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive [${r.status}]: ${(await r.text()).slice(0, 300)}`);
  return r;
}

async function syncConnection(admin: any, conn: any) {
  const token = await refresh(admin, conn);
  const { data: seller } = await admin.from("users").select("id").eq("auth_user_id", conn.user_id).eq("account_id", conn.account_id).maybeSingle();
  if (!seller) throw new Error("Usuário do ROY não encontrado para esta conexão");

  // Pastas padrão do Meet
  const fq = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and trashed=false and (name='Meet Recordings' or name='Gravações do Meet' or name='Gravações Meet')`);
  const folders = (await (await gget(token, `https://www.googleapis.com/drive/v3/files?q=${fq}&fields=files(id,name)&pageSize=10`)).json()).files ?? [];
  if (folders.length === 0) return { imported: 0, note: "Pasta do Meet ainda não existe no Drive" };

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();
  const parents = folders.map((f: any) => `'${f.id}' in parents`).join(" or ");
  const q = encodeURIComponent(`(${parents}) and trashed=false and modifiedTime > '${since}' and (mimeType='${DOC_MIME}' or mimeType='${DOCX_MIME}' or mimeType='text/plain')`);
  const files = (await (await gget(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,createdTime)&orderBy=createdTime desc&pageSize=100`)).json()).files ?? [];

  const ids = files.map((f: any) => f.id);
  const { data: existing } = ids.length
    ? await admin.from("video_call_sessions").select("drive_file_id").eq("account_id", conn.account_id).in("drive_file_id", ids)
    : { data: [] };
  const seen = new Set((existing ?? []).map((e: any) => e.drive_file_id));
  const pending = files.filter((f: any) => !seen.has(f.id)).slice(0, MAX_FILES_PER_CONNECTION);

  let imported = 0;
  for (const f of pending) {
    let text = "";
    if (f.mimeType === DOC_MIME) {
      text = await (await gget(token, `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=text/plain`)).text();
    } else if (f.mimeType === DOCX_MIME) {
      text = await docxText(new Uint8Array(await (await gget(token, `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).arrayBuffer()));
    } else {
      text = await (await gget(token, `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).text();
    }
    text = text.trim();
    // Arquivos curtos demais (ex.: "Anotações" vazias) são ignorados mas marcados para não reler
    const { error } = await admin.from("video_call_sessions").insert({
      account_id: conn.account_id,
      user_id: seller.id,
      source: "meet_drive",
      drive_file_id: f.id,
      transcript_file_name: f.name,
      participant_name: participantFromTitle(f.name),
      transcription: text.length >= 200 ? text : null,
      analysis_status: text.length >= 200 ? "pending" : "no_transcription",
      status: "completed",
      created_at: f.createdTime,
    });
    if (error && !String(error.message).includes("duplicate")) throw new Error(error.message);
    if (!error) imported++;
  }
  return { imported };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const cron = req.headers.get("x-cron-secret");
    const cronSecret = Deno.env.get("THREECPLUS_CRON_SECRET");
    let query = admin.from("google_drive_connections").select("id, user_id, account_id, access_token, refresh_token, token_expires_at").eq("is_active", true);
    if (!(cron && cronSecret && cron === cronSecret)) {
      const auth = req.headers.get("Authorization");
      if (!auth?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
      const { data, error } = await admin.auth.getUser(auth.slice(7));
      if (error || !data.user) return json({ error: "Não autorizado" }, 401);
      query = query.eq("user_id", data.user.id);
    }
    const { data: conns, error } = await query;
    if (error) throw error;
    const results = [];
    for (const c of conns ?? []) {
      await admin.from("google_drive_connections").update({ last_sync_status: "syncing" }).eq("id", c.id);
      try {
        const r = await syncConnection(admin, c);
        await admin.from("google_drive_connections").update({ last_sync_at: new Date().toISOString(), last_sync_status: `ok · ${r.imported} nova(s)`, last_sync_error: null }).eq("id", c.id);
        results.push({ id: c.id, ...r });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[gdrive-sync-meet]", c.id, msg);
        await admin.from("google_drive_connections").update({ last_sync_at: new Date().toISOString(), last_sync_status: "erro", last_sync_error: msg.slice(0, 500) }).eq("id", c.id);
        results.push({ id: c.id, error: msg });
      }
    }
    return json({ connections: results.length, results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
