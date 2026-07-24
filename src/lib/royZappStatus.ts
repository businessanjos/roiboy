/**
 * Single source of truth for RoyZapp instance status.
 *
 * All UI surfaces (settings connections, sector selector, instance switcher,
 * channel pills, admin integration card, sector instance card) MUST derive
 * their status from `getInstanceStatus`. This guarantees the badge, tooltip,
 * label, and color always agree — no more "conectado" in one screen and
 * "desconectado" in another.
 */

export type InstanceProvider = "uazapi" | "meta_official" | "unknown";

export type InstanceStatusKind =
  | "operational" // connected + webhook ok (or Meta)
  | "no_webhook" // connected on server but webhook broken → not receiving
  | "disconnected" // server says disconnected / unknown
  | "unknown"; // no data yet

export interface InstanceStatusInput {
  /** integrations.status column ('connected' | 'disconnected' | ...) */
  status?: string | null;
  /** integrations.config.connection_state ('open' | 'close' | ...) */
  connection_state?: string | null;
  /** true/false. undefined = unknown → treated as ok to avoid false negatives */
  webhook_configured?: boolean | null;
  provider?: string | null;
}

export interface InstanceStatusResult {
  kind: InstanceStatusKind;
  connected: boolean; // server-side connection (independent of webhook)
  operational: boolean; // connected AND receiving
  webhookBroken: boolean; // connected but webhook not configured
  isMeta: boolean;
  label: string; // human label ("Operacional" | "Sem recebimento" | "Desconectado")
  tone: "success" | "warning" | "danger" | "muted";
}

export function isMetaProvider(provider?: string | null): boolean {
  return !!provider && /^meta(_official)?$/i.test(provider);
}

/**
 * Accepts either a flat row (from list_sector_instances edge function) OR
 * a raw integrations row where webhook lives inside `config`. Callers that
 * only have the raw row should pass:
 *   { status, connection_state: cfg?.connection_state, webhook_configured: cfg?.webhook_configured, provider }
 */
export function getInstanceStatus(input: InstanceStatusInput): InstanceStatusResult {
  const isMeta = isMetaProvider(input.provider);
  const state = (input.connection_state || "").toLowerCase();
  const status = (input.status || "").toLowerCase();

  // `integrations.status` is the server-synced source of truth. Some older
  // records still carry a stale `config.connection_state=connected`; never let
  // that override an explicit DB/server status of disconnected/logged out.
  const explicitlyDisconnected = ["disconnected", "logged_out", "close", "closed"].includes(status);
  const connected = !explicitlyDisconnected && (status === "connected" || state === "open" || state === "connected");
  // Meta bypasses webhook check (webhook is server-managed, not per-instance).
  // For UAZAPI, only `false` breaks it — `undefined` = unknown → assume ok.
  const webhookBroken = connected && !isMeta && input.webhook_configured === false;
  const operational = connected && !webhookBroken;

  let kind: InstanceStatusKind;
  if (!input.status && !input.connection_state) kind = "unknown";
  else if (operational) kind = "operational";
  else if (webhookBroken) kind = "no_webhook";
  else kind = "disconnected";

  const label =
    kind === "operational"
      ? "Operacional"
      : kind === "no_webhook"
        ? "Sem recebimento"
        : kind === "unknown"
          ? "Verificando…"
          : "Desconectado";

  const tone: InstanceStatusResult["tone"] =
    kind === "operational"
      ? "success"
      : kind === "no_webhook"
        ? "warning"
        : kind === "unknown"
          ? "muted"
          : "danger";

  return { kind, connected, operational, webhookBroken, isMeta, label, tone };
}

/** Convenience for raw `integrations` rows where webhook lives under config. */
export function getInstanceStatusFromIntegration(row: {
  status?: string | null;
  provider?: string | null;
  config?: Record<string, unknown> | null;
}): InstanceStatusResult {
  const cfg = row.config as Record<string, unknown> | null | undefined;
  return getInstanceStatus({
    status: row.status,
    connection_state: (cfg?.connection_state as string) ?? null,
    webhook_configured:
      cfg?.webhook_configured === undefined
        ? null
        : (cfg.webhook_configured as boolean),
    provider: row.provider ?? (cfg?.provider as string) ?? null,
  });
}
