/**
 * Bloqueio de telas pelos Perfis de Permissão.
 *
 * Regra de segurança para não quebrar ninguém: só bloqueia quando o item está
 * EXPLICITAMENTE configurado como "Sem acesso" no perfil (ou no ajuste individual).
 * Quem não tem perfil, ou item não configurado, mantém o comportamento atual.
 * Gestores/admins nunca são bloqueados.
 */
import type { AccessLevel } from "./permissionCatalog";

export interface ProfilePerm { module: string; sub_item: string; access_level: AccessLevel }

export interface RouteRule {
  prefix: string;
  exact?: boolean;
  /** Bloqueia se TODOS os itens estiverem "Sem acesso". */
  items: { module: string; sub: string }[];
  label: string;
}

// Mais específico primeiro.
export const PROFILE_ROUTE_RULES: RouteRule[] = [
  { prefix: "/sales-team/incentive-presentation", items: [{ module: "comercial", sub: "accelerometer" }], label: "Acelerômetro" },
  { prefix: "/sales-team/spiffs", items: [{ module: "comercial", sub: "spiffs" }], label: "SPIFFs" },
  { prefix: "/sales-team", items: [{ module: "comercial", sub: "ranking" }], label: "Ranking" },
  { prefix: "/sales-dashboard", items: [{ module: "comercial", sub: "sales_dashboard" }], label: "Dashboard de vendas" },
  { prefix: "/sales/contracts", items: [{ module: "comercial", sub: "digital_contracts" }], label: "Contratos digitais" },
  { prefix: "/sales/logs", items: [{ module: "gestao", sub: "logs" }], label: "Logs" },
  { prefix: "/roy-zapp/atendimentos", items: [{ module: "royzapp", sub: "analytics" }], label: "Análises do RoyZapp" },
  {
    prefix: "/roy-zapp",
    items: [
      { module: "royzapp", sub: "conversations" },
      { module: "comercial", sub: "calls" },
      { module: "royzapp", sub: "analytics" },
    ],
    label: "RoyZapp",
  },
  { prefix: "/insights/goals", items: [{ module: "gestao", sub: "goals" }], label: "Metas" },
  { prefix: "/financial/commissions", items: [{ module: "gestao", sub: "commissions" }], label: "Comissões" },
  { prefix: "/settings/team/pendencias", items: [{ module: "gestao", sub: "team" }], label: "Equipe" },
  { prefix: "/leads", items: [{ module: "comercial", sub: "leads" }], label: "Leads" },
  {
    prefix: "/pipeline",
    items: [
      { module: "comercial", sub: "deals_open" },
      { module: "comercial", sub: "deals_won" },
      { module: "comercial", sub: "deals_lost" },
    ],
    label: "Pipeline",
  },
];

export function isExplicitlyDenied(perms: ProfilePerm[], module: string, sub: string): boolean {
  const p = perms.find((x) => x.module === module && x.sub_item === sub);
  return p?.access_level === "none";
}

export function findRouteRule(pathname: string): RouteRule | undefined {
  return PROFILE_ROUTE_RULES.find((r) =>
    r.exact ? pathname === r.prefix : pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
}

export function isRouteBlockedByProfile(pathname: string, perms: ProfilePerm[], isAdmin: boolean): boolean {
  if (isAdmin) return false;
  const rule = findRouteRule(pathname);
  if (!rule) return false;
  return rule.items.every((i) => isExplicitlyDenied(perms, i.module, i.sub));
}

/** true quando algum item da rota foi liberado explicitamente (Visualizar/Editar). */
export function isRouteGrantedByProfile(pathname: string, perms: ProfilePerm[]): boolean {
  const rule = findRouteRule(pathname);
  if (!rule) return false;
  return rule.items.some((i) => {
    const p = perms.find((x) => x.module === i.module && x.sub_item === i.sub);
    return p?.access_level === "view" || p?.access_level === "manage";
  });
}
