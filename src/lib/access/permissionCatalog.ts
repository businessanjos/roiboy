/** Catálogo de módulos/itens dos Perfis de Permissão (modelo Clínica Ryka). */
export type AccessLevel = "none" | "view" | "manage";
export type AccessScope = "own" | "all";

export interface CatalogItem {
  sub: string;
  label: string;
  /** Item aceita alcance "só os próprios" x "toda a equipe". */
  scoped?: boolean;
}
export interface CatalogModule {
  module: string;
  label: string;
  items: CatalogItem[];
}

export const PERMISSION_CATALOG: CatalogModule[] = [
  {
    module: "comercial",
    label: "Comercial",
    items: [
      { sub: "deals_open", label: "Negócios abertos", scoped: true },
      { sub: "deals_won", label: "Negócios ganhos", scoped: true },
      { sub: "deals_lost", label: "Negócios perdidos", scoped: true },
      { sub: "leads", label: "Leads", scoped: true },
      { sub: "sales_dashboard", label: "Dashboard de vendas" },
      { sub: "ranking", label: "Ranking" },
      { sub: "spiffs", label: "SPIFFs (aprovar giro, marcar pago)" },
      { sub: "calls", label: "Calls e análises", scoped: true },
      { sub: "digital_contracts", label: "Contratos digitais" },
    ],
  },
  {
    module: "royzapp",
    label: "RoyZapp",
    items: [
      { sub: "conversations", label: "Conversas", scoped: true },
      { sub: "transfer", label: "Transferir conversas" },
      { sub: "sector_queue", label: "Fila do setor" },
      { sub: "analytics", label: "Análises" },
    ],
  },
  {
    module: "gestao",
    label: "Gestão",
    items: [
      { sub: "goals", label: "Metas" },
      { sub: "commissions", label: "Comissões" },
      { sub: "team", label: "Equipe" },
      { sub: "logs", label: "Logs" },
    ],
  },
];

export const LEVEL_LABELS: Record<AccessLevel, string> = {
  none: "Sem acesso",
  view: "Visualizar",
  manage: "Editar",
};
