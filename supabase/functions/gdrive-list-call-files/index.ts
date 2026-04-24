import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.24.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  search: z.string().trim().max(120).optional(),
  folderId: z.string().trim().max(120).optional(),
});

const FILE_MIME_QUERY = [
  "mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'",
  "mimeType='text/plain'",
  "mimeType='application/vnd.google-apps.document'",
].join(" or ");

const FOLDER_MIME = "application/vnd.google-apps.folder";

async function getAuthenticatedContext(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!supabaseUrl) throw new Error("SUPABASE_URL not configured");
  if (!anonKey) throw new Error("SUPABASE_ANON_KEY not configured");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID not configured");
  if (!clientSecret) throw new Error("GOOGLE_CLIENT_SECRET not configured");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    throw new Error("Unauthorized");
  }

  const userId = claimsData.claims.sub as string;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: profile } = await admin
    .from("users")
    .select("account_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (!profile?.account_id) {
    throw new Error("Conta não encontrada");
  }

  const { data: connection, error: connectionError } = await admin
    .from("google_drive_connections")
    .select("id, access_token, refresh_token, token_expires_at, google_email, is_active")
    .eq("account_id", profile.account_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (connectionError) throw connectionError;
  if (!connection?.is_active) {
    throw new Error("Google Drive não conectado");
  }

  let accessToken = connection.access_token;
  const shouldRefresh =
    !accessToken ||
    !connection.token_expires_at ||
    new Date(connection.token_expires_at).getTime() <= Date.now() + 60_000;

  if (shouldRefresh) {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refresh_token,
        grant_type: "refresh_token",
      }).toString(),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson?.access_token) {
      throw new Error(`Falha ao atualizar token do Google Drive: ${tokenJson?.error || tokenRes.status}`);
    }

    accessToken = tokenJson.access_token as string;
    const expiresAt = new Date(Date.now() + (((tokenJson.expires_in as number) || 3600) - 60) * 1000).toISOString();

    await admin
      .from("google_drive_connections")
      .update({ access_token: accessToken, token_expires_at: expiresAt, last_sync_error: null, last_sync_status: "ready" })
      .eq("id", connection.id);
  }

  return { accessToken, connectionId: connection.id, googleEmail: connection.google_email };
}

async function fetchFolderInfo(accessToken: string, folderId: string) {
  if (folderId === "root") {
    return { id: "root", name: "Meu Drive", parentId: null as string | null };
  }
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${folderId}`);
  url.searchParams.set("fields", "id,name,parents");
  url.searchParams.set("supportsAllDrives", "true");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Falha ao obter pasta [${res.status}]: ${JSON.stringify(json)}`);
  }
  return {
    id: json.id as string,
    name: json.name as string,
    parentId: (json.parents?.[0] as string | undefined) ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return new Response(JSON.stringify({ error: body.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { accessToken, googleEmail } = await getAuthenticatedContext(req);
    const search = body.data.search?.replace(/'/g, "\\'") || "";
    const folderId = body.data.folderId?.trim() || "";

    // Build query: when searching globally (no folder), search by name across drive.
    // When inside a folder, list folder contents (folders first, then matching files).
    const conditions: string[] = ["trashed=false"];

    if (folderId) {
      conditions.push(`'${folderId.replace(/'/g, "\\'")}' in parents`);
      conditions.push(`(mimeType='${FOLDER_MIME}' or ${FILE_MIME_QUERY})`);
      if (search) conditions.push(`name contains '${search}'`);
    } else {
      // Top-level / global search: include folders too, so user can pick a folder
      conditions.push(`(mimeType='${FOLDER_MIME}' or ${FILE_MIME_QUERY})`);
      if (search) {
        conditions.push(`name contains '${search}'`);
      } else {
        // Default root view: only show items directly under root
        conditions.push(`'root' in parents`);
      }
    }

    const q = conditions.join(" and ");

    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", q);
    url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,webViewLink,parents)");
    url.searchParams.set("orderBy", "folder,name");
    url.searchParams.set("pageSize", "200");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");

    const driveRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const driveJson = await driveRes.json();

    if (!driveRes.ok) {
      throw new Error(`Falha ao listar arquivos do Google Drive [${driveRes.status}]: ${JSON.stringify(driveJson)}`);
    }

    const items = (driveJson.files || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
      isFolder: file.mimeType === FOLDER_MIME,
    }));

    // Resolve current folder info for breadcrumb / parent navigation
    let currentFolder: { id: string; name: string; parentId: string | null } | null = null;
    if (folderId) {
      try {
        currentFolder = await fetchFolderInfo(accessToken, folderId);
      } catch (e) {
        console.warn("fetchFolderInfo failed", e);
      }
    } else {
      currentFolder = { id: "root", name: search ? "Resultados da busca" : "Meu Drive", parentId: null };
    }

    return new Response(
      JSON.stringify({
        connection_email: googleEmail,
        currentFolder,
        items,
        // legacy field for backward compat
        files: items.filter((i: any) => !i.isFolder),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("gdrive-list-call-files error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
