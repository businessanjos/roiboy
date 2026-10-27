export type CatalogListKey = "contract_type" | "contract_status" | "renewal_status" | "loss_reason";

export type CatalogColor = "success" | "info" | "warning" | "danger" | "muted";

export interface CatalogItem {
  value: string;
  label: string;
  description?: string | null;
  color?: CatalogColor | null;
  metric_bucket?: string | null;
  is_active: boolean;
  is_builtin: boolean;
  display_order: number;
}

export interface CatalogRow extends Omit<CatalogItem, "color"> {
  id: string;
  list_key: string;
  color?: string | null;
}

export const CATALOG_LISTS: { key: CatalogListKey; title: string; hint: string; buckets?: { value: string; label: string }[] }[] = [
  { key: "contract_type", title: "Tipos de contrato", hint: "Aparecem ao criar ou editar um contrato." },
  {
    key: "contract_status",
    title: "Status do contrato",
    hint: "Situação do contrato na ficha do cliente.",
    buckets: [
      { value: "active", label: "Conta como ativo" },
      { value: "pending", label: "Conta como pendente" },
      { value: "paused", label: "Conta como pausado/suspenso" },
      { value: "exit", label: "Conta como saída (churn)" },
      { value: "neutral", label: "Não conta em métricas" },
    ],
  },
  {
    key: "renewal_status",
    title: "Status de renovação",
    hint: "Desfechos mostrados na aba Renovações.",
    buckets: [
      { value: "renewed", label: "Conta como renovado" },
      { value: "lost", label: "Conta como não renovado/perda" },
      { value: "neutral", label: "Não conta em métricas" },
    ],
  },
  { key: "loss_reason", title: "Motivos de perda/cancelamento", hint: "Usados no contrato, no modal e no gráfico de Renovações." },
];

const b = (value: string, label: string, extra: Partial<CatalogItem> = {}, i = 0): CatalogItem => ({
  value, label, is_active: true, is_builtin: true, display_order: i, ...extra,
});

export const BUILT_IN_CATALOG: Record<CatalogListKey, CatalogItem[]> = {
  contract_type: [
    ["compra", "Compra"], ["renovacao", "Renovação"], ["migracao", "Migração"],
    ["confissao_divida", "Confissão de Dívida"], ["termo_congelamento", "Termo de Congelamento"], ["distrato", "Distrato"],
  ].map(([v, l], i) => b(v, l, {}, i)),
  contract_status: ([
    ["active", "Ativo", "success", "active"],
    ["pending", "Pendente (em assinatura)", "info", "pending"],
    ["paused", "Pausado", "info", "paused"],
    ["suspended", "Suspenso", "warning", "paused"],
    ["suspended_bonus", "Suspenso Bônus", "warning", "paused"],
    ["cancelled", "Distrato de Cancelamento", "danger", "exit"],
    ["dismissal_termination", "Distrato por Demissão", "danger", "exit"],
    ["ended", "Encerrado", "muted", "exit"],
    ["dismissed", "Demitida", "danger", "exit"],
    ["dropout_7d", "Desistência 7D", "warning", "exit"],
  ] as const).map(([v, l, c, m], i) => b(v, l, { color: c, metric_bucket: m }, i)),
  renewal_status: ([
    ["renewed", "Renovado", "success", "renewed"],
    ["not_renewed", "Não renovado", "muted", "lost"],
    ["cancelled", "Cancelado", "danger", "lost"],
    ["dropout_7d", "Desistência 07 dias (Garantia)", "warning", "lost"],
  ] as const).map(([v, l, c, m], i) => b(v, l, { color: c, metric_bucket: m }, i)),
  loss_reason: ([
    ["financeiro", "Financeiro", "Dificuldade em manter o investimento no momento."],
    ["operacional_financeiro", "Operacional/Financeiro", "Alega não estar tendo retorno no negócio e, por isso, não consegue seguir com o investimento."],
    ["insatisfacao_resultados", "Insatisfação com resultados", null],
    ["falta_tempo", "Falta de tempo / priorização", null],
    ["mudanca_momento", "Mudança de momento do negócio", null],
    ["mudanca_prioridade", "Mudança de prioridade", null],
    ["nao_adaptou", "Não se adaptou ao formato", null],
    ["cliente_nao_retorna_inadimplente", "Cliente não retorna – Inadimplente", null],
    ["problemas_pessoais", "Problemas pessoais", "Questões pessoais que impactam na continuidade no programa."],
  ] as const).map(([v, l, d], i) => b(v, l, { description: d }, i)),
};

/** Junta itens padrão (com ajustes salvos) e personalizados, na ordem de exibição. */
export function mergeCatalog(list: CatalogListKey, rows: Pick<CatalogRow, "value" | "label" | "description" | "color" | "metric_bucket" | "is_active" | "is_builtin" | "display_order" | "list_key">[]): CatalogItem[] {
  const mine = rows.filter((r) => r.list_key === list);
  const byValue = new Map(mine.map((r) => [r.value, r]));
  const builtIns = BUILT_IN_CATALOG[list].map((item) => {
    const o = byValue.get(item.value);
    return o
      ? { ...item, label: o.label, description: o.description ?? item.description, color: (o.color as CatalogColor) ?? item.color, metric_bucket: o.metric_bucket ?? item.metric_bucket, is_active: o.is_active, display_order: o.display_order }
      : item;
  });
  const builtSet = new Set(BUILT_IN_CATALOG[list].map((i) => i.value));
  const custom = mine
    .filter((r) => !builtSet.has(r.value))
    .map((r) => ({ value: r.value, label: r.label, description: r.description, color: (r.color as CatalogColor) ?? null, metric_bucket: r.metric_bucket, is_active: r.is_active, is_builtin: false, display_order: r.display_order + 1000 }));
  return [...builtIns, ...custom].sort((a, z) => a.display_order - z.display_order);
}

export const CATALOG_COLOR_CLASSES: Record<CatalogColor, string> = {
  success: "bg-success/15 text-success-strong border-success/30",
  info: "bg-info/10 text-info border-info/30",
  warning: "bg-warning/15 text-warning-strong border-warning/30",
  danger: "bg-danger/15 text-danger-strong border-danger/30",
  muted: "bg-muted text-foreground border-border",
};

export function slugifyCatalogValue(label: string): string {
  return label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
