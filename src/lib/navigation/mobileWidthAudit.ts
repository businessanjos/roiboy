/**
 * Inventário e critérios da auditoria de largura mobile (docs/mobile-width-audit.md).
 *
 * O script `scripts/qa/mobile-width-audit.mjs` percorre estas rotas no navegador
 * autenticado nas larguras abaixo e aplica `findWidthViolations` às medições.
 * Toda rota interna nova em App.tsx precisa entrar aqui (ou em
 * MOBILE_WIDTH_AUDIT_EXCLUDED com o motivo) — o teste de inventário falha se faltar.
 */
export const MOBILE_AUDIT_WIDTHS = [320, 393, 440] as const;

/** Rotas internas autenticadas. `:id` é substituído por um registro existente no momento da auditoria. */
export const MOBILE_WIDTH_AUDIT_ROUTES: readonly string[] = [
  "/setores", "/dashboard", "/dashboard/cadeira-dupla",
  "/clients", "/clients/medicos", "/clients/checkpoints", "/vips", "/clients/new", "/clients/:id",
  "/renewals", "/operations/mentoria-ec", "/operations/practice-areas", "/operations/briefing-audit",
  "/operations/onboarding", "/operations/presenca-eventos", "/operations/clinica-ryka",
  "/operations/consultant-bonus", "/operations/cs-incentive-presentation", "/operations/scripts",
  "/operations/instagram-ranking", "/contracts", "/settings/contract-defaults", "/settings/team/pendencias",
  "/sales/contracts", "/sales/contracts/templates", "/sales/contracts/defaults", "/pipeline",
  "/sales-dashboard", "/sales/logs", "/sales-calendar", "/sales-team", "/sales-team/spiffs",
  "/sales-team/incentive-presentation", "/leads",
  "/financial", "/financial/dashboard", "/financial/cash-flow", "/financial/bank-accounts",
  "/financial/bank-accounts/:id/extrato", "/financial/categories", "/financial/cost-centers",
  "/financial/budget", "/financial/commissions", "/financial/payment-methods", "/financial/integracoes/pluggy",
  "/financial/prestadores", "/financial/ajuda", "/financial/entries", "/financial/recebiveis",
  "/financial/conciliacao", "/financial/cobranca", "/financial/notas-fiscais", "/financial/pessoas",
  "/financial/relatorios", "/financial/recurring", "/financial/invoices", "/financial/parcelas",
  "/financial/boletos", "/financial/reconciliation", "/financial/sales-reconciliation", "/financial/importar",
  "/financial/alerts", "/financial/regua-cobranca", "/financial/configuracoes/fiscal",
  "/financial/clientes-ativos", "/financial/pagadores", "/financial/suppliers", "/financial/dre",
  "/financial/aging", "/financial/profitability", "/financial/drf", "/financial/balance-sheet",
  "/products", "/events", "/events/calendar", "/events/inventory", "/events/playbooks", "/events/kpis",
  "/events/suppliers", "/events/:id", "/tasks", "/forms", "/integrations", "/team", "/profile",
  "/notifications", "/settings", "/account-settings", "/reminders", "/roy-zapp", "/roy-zapp/atendimentos",
  "/ever-ia", "/gestao-tech", "/reuniao-lideres", "/billing",
  "/marketing", "/marketing/dashboard", "/content-calendar", "/social-media", "/criacao", "/marketing-tasks",
  "/marketing-insights", "/marketing/trafego-pago", "/marketing/content-hq", "/marketing/rebranding",
  "/marketing/projetos", "/marketing/projetos/:id", "/marketing/agencias", "/marketing/agencias/comparativo",
  "/marketing/portal-agencia", "/marketing/market-intelligence",
  "/insights", "/insights/goals", "/admin", "/admin/whatsapp-diagnostics", "/sales-scripts",
  "/rh", "/rh/collaborators", "/rh/collaborators/:id", "/rh/org-chart", "/rh/departments",
  "/rh/job-descriptions", "/rh/behavior-profiles", "/rh/meetings", "/rh/benefits", "/rh/vacancies",
  "/rh/vacancies/new", "/rh/service-providers", "/rh/partners", "/rh/offers", "/rh/offers/new",
  "/rh/admissions", "/rh/offboarding", "/rh/resumes",
];

/** Rotas internas fora da varredura automática, sempre com motivo. */
export const MOBILE_WIDTH_AUDIT_EXCLUDED: Readonly<Record<string, string>> = {
  "/sales-team/incentive-presentation/slideshow": "apresentação em tela cheia para TV, fora do shell mobile",
  "/marketing/agencias/:id": "sem agência cadastrada para abrir sem criar registro",
  "/insights/:dashboardId": "painéis customizados; coberto pelo índice /insights",
  "/rh/vacancies/:id": "sem vaga existente para abrir sem criar registro",
  "/rh/vacancies/:id/edit": "edição de vaga; exige registro existente",
  "/rh/service-providers/:id": "perfil coberto pelo mesmo cabeçalho de /rh/collaborators/:id",
  "/rh/partners/:id": "perfil coberto pelo mesmo cabeçalho de /rh/collaborators/:id",
  "/rh/offers/:id/edit": "edição de oferta; exige registro existente",
};

export interface WidthMetrics {
  /** Largura útil da viewport (documentElement.clientWidth). */
  viewportWidth: number;
  documentScrollWidth: number;
  /** Área de rolagem principal (#app-main-scroll). */
  mainClientWidth: number | null;
  mainScrollWidth: number | null;
  /** Deslocamento horizontal após gesto lateral, no documento e nos ancestrais do main. */
  windowScrollX: number;
  shiftedAncestors: string[];
  /** Elementos visíveis fora da viewport e não contidos em região rolável própria. */
  offscreenElements: string[];
}

/** Tolerância de arredondamento subpixel. */
const EPSILON = 1;

export function findWidthViolations(m: WidthMetrics): string[] {
  const violations: string[] = [];
  if (m.documentScrollWidth > m.viewportWidth + EPSILON) {
    violations.push(`documento ${m.documentScrollWidth}px > viewport ${m.viewportWidth}px`);
  }
  if (m.mainScrollWidth !== null && m.mainClientWidth !== null && m.mainScrollWidth > m.mainClientWidth + EPSILON) {
    violations.push(`conteúdo do main ${m.mainScrollWidth}px > ${m.mainClientWidth}px`);
  }
  if (Math.abs(m.windowScrollX) > 0) violations.push(`página deslocada ${m.windowScrollX}px na horizontal`);
  for (const a of m.shiftedAncestors) violations.push(`contêiner do app deslocado: ${a}`);
  for (const e of m.offscreenElements) violations.push(`fora da tela: ${e}`);
  return violations;
}
