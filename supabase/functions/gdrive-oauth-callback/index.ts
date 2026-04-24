import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type OAuthState = {
  u: string;
  a: string;
  r: string;
  o?: string | null;
  n: string;
  t: number;
};

function getRedirectContext(stateParam: string | null, fallbackBase: string) {
  if (!stateParam) {
    return {
      appBase: fallbackBase,
      returnTo: "/settings?tab=integrations",
      parsedState: null as OAuthState | null,
    };
  }

  try {
    const parsedState = JSON.parse(atob(stateParam)) as Partial<OAuthState>;
    const appBase =
      typeof parsedState.o === "string" && /^https?:\/\//.test(parsedState.o)
        ? parsedState.o
        : fallbackBase;
    const returnTo =
      typeof parsedState.r === "string" && parsedState.r.startsWith("/")
        ? parsedState.r
        : "/settings?tab=integrations";

    return {
      appBase,
      returnTo,
      parsedState: parsedState as OAuthState,
    };
  } catch {
    return {
      appBase: fallbackBase,
      returnTo: "/settings?tab=integrations",
      parsedState: null as OAuthState | null,
    };
  }
}

function buildRedirectUrl(base: string, returnTo: string, status: "connected" | "error", reason?: string) {
  const sep = returnTo.includes("?") ? "&" : "?";
  const reasonParam = reason ? `&reason=${encodeURIComponent(reason)}` : "";
  return `${base}${returnTo}${sep}gdrive=${status}${reasonParam}`;
}

function escapeForJs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/</g, "\\u003c");
}

function htmlRedirect(targetUrl: string, message: string) {
  const safeUrl = escapeForJs(targetUrl);
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Google Drive</title>
<meta http-equiv="refresh" content="0;url=${targetUrl}"/>
<script>window.location.replace('${safeUrl}');</script>
</head>
<body style="font-family:system-ui;padding:32px;text-align:center">
<p>${message}</p><p><a href="${targetUrl}">Voltar ao app</a></p>
<script>setTimeout(function(){window.location.href='${safeUrl}';},50);</script>
</body></html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const appBase =
    Deno.env.get("APP_BASE_URL") || "https://iamroy.app";
  const redirectContext = getRedirectContext(state, appBase);

  try {
    if (errorParam) {
      return htmlRedirect(
        buildRedirectUrl(redirectContext.appBase, redirectContext.returnTo, "error", errorParam),
        `Falha na autorização: ${errorParam}`
      );
    }
    if (!code || !state) {
      return htmlRedirect(
        buildRedirectUrl(redirectContext.appBase, redirectContext.returnTo, "error", "missing_code"),
        "Parâmetros ausentes."
      );
    }

    const parsedState = redirectContext.parsedState;
    if (!parsedState) {
      return htmlRedirect(
        buildRedirectUrl(redirectContext.appBase, redirectContext.returnTo, "error", "invalid_state"),
        "State inválido."
      );
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const redirectUri = `${supabaseUrl}/functions/v1/gdrive-oauth-callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("token exchange failed", tokenJson);
      return htmlRedirect(
        buildRedirectUrl(redirectContext.appBase, redirectContext.returnTo, "error", "token_exchange"),
        `Falha ao trocar código: ${tokenJson?.error || tokenRes.status}`
      );
    }

    const accessToken = tokenJson.access_token as string;
    const refreshToken = tokenJson.refresh_token as string | undefined;
    const expiresIn = (tokenJson.expires_in as number) || 3600;
    const scope = (tokenJson.scope as string) || "";

    if (!refreshToken) {
      return htmlRedirect(
        buildRedirectUrl(redirectContext.appBase, redirectContext.returnTo, "error", "no_refresh_token"),
        "Google não retornou refresh_token. Revogue o acesso e tente novamente."
      );
    }

    const userInfoRes = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const userInfo = await userInfoRes.json();
    const googleEmail = userInfo?.email as string;
    const googleUserId = userInfo?.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);
    const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();

    const { error: upsertErr } = await admin
      .from("google_drive_connections")
        .upsert(
        {
          account_id: parsedState.a,
          user_id: parsedState.u,
          google_email: googleEmail,
          google_user_id: googleUserId,
          refresh_token: refreshToken,
          access_token: accessToken,
          token_expires_at: expiresAt,
          scope,
          connected_by: parsedState.u,
          connected_at: new Date().toISOString(),
          is_active: true,
          last_sync_status: null,
          last_sync_error: null,
        },
        { onConflict: "account_id,user_id" }
      );

    if (upsertErr) {
      console.error("upsert connection error", upsertErr);
      return htmlRedirect(
        buildRedirectUrl(redirectContext.appBase, redirectContext.returnTo, "error", "db"),
        `Erro ao salvar conexão: ${upsertErr.message}`
      );
    }

    return htmlRedirect(
      buildRedirectUrl(redirectContext.appBase, redirectContext.returnTo, "connected"),
      "Conexão concluída! Redirecionando..."
    );
  } catch (e) {
    console.error("gdrive-oauth-callback error", e);
    return htmlRedirect(
      buildRedirectUrl(redirectContext.appBase, redirectContext.returnTo, "error", "exception"),
      `Erro: ${e instanceof Error ? e.message : "unknown"}`
    );
  }
});