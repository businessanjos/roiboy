/**
 * Fonte única de verdade para rotas e views internas do RoyZapp.
 *
 * Todo link/atalho para /roy-zapp deve passar por `buildRoyZappUrl` ou
 * referenciar `ZAPP_VIEWS` para garantir que apontamos apenas para páginas
 * existentes. O teste em `royZappRoutes.test.ts` varre o código em busca de
 * `view=<algo>` e falha se alguém introduzir uma view desconhecida.
 */

export const ZAPP_VIEWS = [
  "inbox",
  "team",
  "departments",
  "tags",
  "settings",
  "playbook",
  "ruler",
  "marketing",
  "sector",
  "meetings",
  "whatsapp-admin",
  "analytics",
] as const;

export type ZappView = (typeof ZAPP_VIEWS)[number];

export const ZAPP_VIEW_SET: ReadonlySet<ZappView> = new Set(ZAPP_VIEWS);

export function isZappView(value: unknown): value is ZappView {
  return typeof value === "string" && ZAPP_VIEW_SET.has(value as ZappView);
}

export function sanitizeZappView(value: unknown, fallback: ZappView = "inbox"): ZappView {
  return isZappView(value) ? value : fallback;
}

/**
 * Sub-rotas reais (com página React montada) sob /roy-zapp.
 * Alterar somente em conjunto com `App.tsx`.
 */
export const ROY_ZAPP_SUBROUTES = ["", "atendimentos"] as const;
export type RoyZappSubroute = (typeof ROY_ZAPP_SUBROUTES)[number];

export interface BuildRoyZappUrlOptions {
  view?: ZappView;
  sector?: string | null;
  integrationId?: string | null;
  conversation?: string | null;
  extra?: Record<string, string | number | null | undefined>;
  subroute?: RoyZappSubroute;
}

export function buildRoyZappUrl(options: BuildRoyZappUrlOptions = {}): string {
  const { view, sector, integrationId, conversation, extra, subroute = "" } = options;
  const base = subroute ? `/roy-zapp/${subroute}` : "/roy-zapp";
  const params = new URLSearchParams();

  if (view && view !== "inbox") params.set("view", view);
  if (sector) params.set("sector", sector);
  if (integrationId) params.set("integrationId", integrationId);
  if (conversation) params.set("conversation", conversation);

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value === null || value === undefined || value === "") continue;
      params.set(key, String(value));
    }
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
