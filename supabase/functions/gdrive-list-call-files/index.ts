import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.24.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  search: z.string().trim().max(120).optional(),
  folderId: z.string().trim().max(120).optional(),
  // Scope of listing:
  // - "my-drive" (default): user's My Drive
  // - "shared-with-me": files shared with the user
  // - "shared-drive": list inside a Shared Drive (driveId required)
  // - "drives-root": virtual root showing "Meu Drive", "Compartilhados comigo" and Shared Drives
  scope: z.enum(["my-drive", "shared-with-me", "shared-drive", "drives-root"]).optional(),
  driveId: z.string().trim().max(120).optional(),
  pageToken: z.string().trim().max(2048).optional(),
  pageSize: z.number().int().min(10).max(500).optional(),
});

const FILE_MIME_QUERY = [
  "mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'",
  "mimeType='text/plain'",
  "mimeType='application/vnd.google-apps.document'",
].join(" or ");

const FOLDER_MIME = "application/vnd.google-apps.folder";

// Virtual folder IDs for the root picker
const VIRTUAL_MY_DRIVE = "__my_drive__";
const VIRTUAL_SHARED_WITH_ME = "__shared_with_me__";
const VIRTUAL_SHARED_DRIVE_PREFIX = "__shared_drive__:";

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
  url.searchParams.set("fields", "id,name,parents,driveId");
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

async function listSharedDrives(accessToken: string) {
  const url = new URL("https://www.googleapis.com/drive/v3/drives");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("fields", "drives(id,name)");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok) {
    console.warn("listSharedDrives failed", json);
    return [] as Array<{ id: string; name: string }>;
  }
  return (json.drives || []) as Array<{ id: string; name: string }>;
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
    const rawFolderId = body.data.folderId?.trim() || "";
    let scope = body.data.scope || "my-drive";
    let driveId = body.data.driveId?.trim() || "";
    let folderId = rawFolderId;

    // Translate virtual folder IDs into the right scope/driveId/folderId.
    if (folderId === VIRTUAL_MY_DRIVE) {
      scope = "my-drive";
      folderId = "";
    } else if (folderId === VIRTUAL_SHARED_WITH_ME) {
      scope = "shared-with-me";
      folderId = "";
    } else if (folderId.startsWith(VIRTUAL_SHARED_DRIVE_PREFIX)) {
      scope = "shared-drive";
      driveId = folderId.slice(VIRTUAL_SHARED_DRIVE_PREFIX.length);
      folderId = driveId; // Shared drive root folder id == driveId
    }

    // Virtual root: present "Meu Drive", "Compartilhados comigo" and each Shared Drive as folders.
    if (scope === "drives-root") {
      const drives = await listSharedDrives(accessToken);
      const items = [
        {
          id: VIRTUAL_MY_DRIVE,
          name: "Meu Drive",
          mimeType: FOLDER_MIME,
          modifiedTime: "",
          webViewLink: null,
          isFolder: true,
        },
        {
          id: VIRTUAL_SHARED_WITH_ME,
          name: "Compartilhados comigo",
          mimeType: FOLDER_MIME,
          modifiedTime: "",
          webViewLink: null,
          isFolder: true,
        },
        ...drives.map((d) => ({
          id: `${VIRTUAL_SHARED_DRIVE_PREFIX}${d.id}`,
          name: d.name,
          mimeType: FOLDER_MIME,
          modifiedTime: "",
          webViewLink: null,
          isFolder: true,
        })),
      ];

      return new Response(
        JSON.stringify({
          connection_email: googleEmail,
          currentFolder: { id: "drives-root", name: "Drives", parentId: null },
          scope: "drives-root",
          items,
          files: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build query depending on scope
    const conditions: string[] = ["trashed=false"];

    if (scope === "shared-with-me") {
      conditions.push("sharedWithMe=true");
      conditions.push(`(mimeType='${FOLDER_MIME}' or ${FILE_MIME_QUERY})`);
      if (search) conditions.push(`name contains '${search}'`);
      if (folderId) {
        conditions.push(`'${folderId.replace(/'/g, "\\'")}' in parents`);
      }
    } else if (scope === "shared-drive") {
      const target = folderId || driveId;
      if (!target) throw new Error("driveId obrigatório para listar Shared Drive");
      conditions.push(`'${target.replace(/'/g, "\\'")}' in parents`);
      conditions.push(`(mimeType='${FOLDER_MIME}' or ${FILE_MIME_QUERY})`);
      if (search) conditions.push(`name contains '${search}'`);
    } else {
      // my-drive
      if (folderId) {
        conditions.push(`'${folderId.replace(/'/g, "\\'")}' in parents`);
      } else {
        conditions.push(`'root' in parents`);
      }
      conditions.push(`(mimeType='${FOLDER_MIME}' or ${FILE_MIME_QUERY})`);
      if (search) conditions.push(`name contains '${search}'`);
    }

    const q = conditions.join(" and ");

    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", q);
    url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,webViewLink,parents,driveId)");
    url.searchParams.set("orderBy", "folder,name");
    url.searchParams.set("pageSize", "200");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");

    if (scope === "shared-drive") {
      url.searchParams.set("corpora", "drive");
      url.searchParams.set("driveId", driveId);
    } else {
      url.searchParams.set("corpora", "allDrives");
    }

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
    if (scope === "shared-drive") {
      if (folderId && folderId !== driveId) {
        try {
          currentFolder = await fetchFolderInfo(accessToken, folderId);
        } catch (e) {
          console.warn("fetchFolderInfo failed", e);
        }
      } else {
        // At the root of a shared drive
        try {
          const url2 = new URL(`https://www.googleapis.com/drive/v3/drives/${driveId}`);
          url2.searchParams.set("fields", "id,name");
          const res2 = await fetch(url2.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
          const json2 = await res2.json();
          if (res2.ok) {
            currentFolder = { id: driveId, name: json2.name, parentId: null };
          }
        } catch (e) {
          console.warn("fetch shared drive name failed", e);
        }
      }
    } else if (scope === "shared-with-me") {
      if (folderId) {
        try {
          currentFolder = await fetchFolderInfo(accessToken, folderId);
        } catch (e) {
          console.warn("fetchFolderInfo failed", e);
        }
      } else {
        currentFolder = { id: VIRTUAL_SHARED_WITH_ME, name: "Compartilhados comigo", parentId: null };
      }
    } else {
      // my-drive
      if (folderId) {
        try {
          currentFolder = await fetchFolderInfo(accessToken, folderId);
        } catch (e) {
          console.warn("fetchFolderInfo failed", e);
        }
      } else {
        currentFolder = { id: "root", name: "Meu Drive", parentId: null };
      }
    }

    return new Response(
      JSON.stringify({
        connection_email: googleEmail,
        currentFolder,
        scope,
        driveId: scope === "shared-drive" ? driveId : null,
        items,
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
