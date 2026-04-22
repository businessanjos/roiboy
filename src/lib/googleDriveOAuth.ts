import { supabase } from "@/integrations/supabase/client";

const GOOGLE_DRIVE_OAUTH_PENDING_KEY = "google-drive-oauth-pending";
const GOOGLE_DRIVE_OAUTH_TIMEOUT_MS = 10000;
const GOOGLE_DRIVE_OAUTH_MAX_RETRIES = 1;
const GOOGLE_DRIVE_OAUTH_RETRY_DELAY_MS = 1200;

type GoogleDriveOAuthPending = {
  returnTo: string;
  startedAt: number;
};

const GOOGLE_DRIVE_REASON_MESSAGES: Record<string, string> = {
  missing_code: "O Google não retornou o código de autorização.",
  invalid_state: "A validação da conexão expirou. Tente novamente.",
  token_exchange: "Não foi possível concluir a autorização com o Google.",
  no_refresh_token: "O Google não liberou acesso contínuo. Revogue a permissão e tente de novo.",
  db: "A conexão foi autorizada, mas não conseguimos salvá-la.",
  exception: "A conexão falhou antes de finalizar.",
};

export function getCleanGoogleDriveReturnTo() {
  const params = new URLSearchParams(window.location.search);
  params.delete("gdrive");
  params.delete("reason");

  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}`;
}

export function setGoogleDriveOAuthPending(returnTo: string) {
  sessionStorage.setItem(
    GOOGLE_DRIVE_OAUTH_PENDING_KEY,
    JSON.stringify({ returnTo, startedAt: Date.now() } satisfies GoogleDriveOAuthPending)
  );
}

export function getGoogleDriveOAuthPending(): GoogleDriveOAuthPending | null {
  const raw = sessionStorage.getItem(GOOGLE_DRIVE_OAUTH_PENDING_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<GoogleDriveOAuthPending>;
    if (typeof parsed.returnTo !== "string" || typeof parsed.startedAt !== "number") {
      sessionStorage.removeItem(GOOGLE_DRIVE_OAUTH_PENDING_KEY);
      return null;
    }
    return { returnTo: parsed.returnTo, startedAt: parsed.startedAt };
  } catch {
    sessionStorage.removeItem(GOOGLE_DRIVE_OAUTH_PENDING_KEY);
    return null;
  }
}

export function clearGoogleDriveOAuthPending() {
  sessionStorage.removeItem(GOOGLE_DRIVE_OAUTH_PENDING_KEY);
}

export function getGoogleDriveCallbackMessage(reason: string | null) {
  if (!reason) return "Falha ao conectar Google Drive.";
  return GOOGLE_DRIVE_REASON_MESSAGES[reason] || `Falha ao conectar Google Drive: ${reason}`;
}

export function getGoogleDriveOAuthErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    const normalizedMessage = error.message.toLowerCase();
    if (normalizedMessage.includes("timeout")) {
      return "A conexão com o Google demorou demais para responder, e a tentativa automática de reconexão não conseguiu concluir.";
    }

    return error.message;
  }

  return "Erro ao conectar Google Drive.";
}

export async function startGoogleDriveOAuth() {
  const returnTo = getCleanGoogleDriveReturnTo();
  setGoogleDriveOAuthPending(returnTo);

  let lastError: unknown;

  try {
    for (let attempt = 0; attempt <= GOOGLE_DRIVE_OAUTH_MAX_RETRIES; attempt++) {
      let timeoutId: number | undefined;

      try {
        const result = await Promise.race([
          supabase.functions.invoke("gdrive-oauth-init", {
            body: { return_to: returnTo, origin: window.location.origin },
          }),
          new Promise<never>((_, reject) => {
            timeoutId = window.setTimeout(() => reject(new Error("oauth_init_timeout")), GOOGLE_DRIVE_OAUTH_TIMEOUT_MS);
          }),
        ]);

        if (result.error) throw result.error;

        const authorizeUrl = typeof result.data?.authorize_url === "string" ? result.data.authorize_url : "";
        if (!authorizeUrl) throw new Error("URL de autorização não recebida.");

        const parsedUrl = new URL(authorizeUrl);
        if (parsedUrl.hostname !== "accounts.google.com") {
          throw new Error("URL de autorização inválida.");
        }

        window.location.assign(authorizeUrl);
        return;
      } catch (error) {
        lastError = error;
        const isTimeout = error instanceof Error && error.message.toLowerCase().includes("timeout");
        const canRetry = isTimeout && attempt < GOOGLE_DRIVE_OAUTH_MAX_RETRIES;

        if (!canRetry) throw error;

        await new Promise((resolve) => window.setTimeout(resolve, GOOGLE_DRIVE_OAUTH_RETRY_DELAY_MS));
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
    }
  } catch (error) {
    clearGoogleDriveOAuthPending();
    throw lastError ?? error;
  }
}