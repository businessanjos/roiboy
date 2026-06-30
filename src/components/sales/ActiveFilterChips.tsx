import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActiveFilter, FilterCondition } from "@/hooks/usePipelineFilters";
import { DealStage } from "@/hooks/useDeals";
import { CustomFieldOption } from "./PipelineFilterDialog";

interface SalesUser {
  id: string;
  name: string;
  avatar_url: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  value: "Valor",
  responsible_user_id: "Vendedor",
  stage_id: "Etapa",
  tags: "Tags",
  source: "Fonte",
  created_at: "Criado em",
  updated_at: "Atualizado em",
  expected_close_date: "Fechamento previsto",
};

const OPERATOR_LABELS: Record<string, string> = {
  contains: "contém",
  not_contains: "não contém",
  equals: "=",
  not_equals: "≠",
  greater_than: ">",
  less_than: "<",
  greater_or_equal: "≥",
  less_or_equal: "≤",
  is_empty: "vazio",
  is_not_empty: "preenchido",
  today: "hoje",
  this_week: "esta semana",
  this_month: "este mês",
  older_than_days: "há mais de",
  next_days: "nos próximos",
  before: "antes de",
  after: "depois de",
};

interface ActiveFilterChipsProps {
  activeFilter: ActiveFilter | null;
  searchTerm?: string;
  onSearchClear?: () => void;
  onFilterChange: (filter: ActiveFilter | null) => void;
  salesUsers: SalesUser[];
  stages: DealStage[];
  customFields?: CustomFieldOption[];
}

function fieldLabel(field: string, customFields: CustomFieldOption[]): string {
  if (field.startsWith("custom:")) {
    const id = field.slice("custom:".length);
    return customFields.find((f) => f.id === id)?.name ?? "Campo";
  }
  return FIELD_LABELS[field] ?? field;
}

function valueLabel(
  cond: FilterCondition,
  ctx: { salesUsers: SalesUser[]; stages: DealStage[]; customFields: CustomFieldOption[] },
): string {
  const { field, operator, value } = cond;
  if (["is_empty", "is_not_empty", "today", "this_week", "this_month"].includes(operator)) {
    return "";
  }
  const vals = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  if (vals.length === 0) return "";

  const mapOne = (v: any): string => {
    if (field === "responsible_user_id") {
      return ctx.salesUsers.find((u) => u.id === v)?.name ?? String(v);
    }
    if (field === "stage_id") {
      return ctx.stages.find((s) => s.id === v)?.name ?? String(v);
    }
    if (field.startsWith("custom:")) {
      const cf = ctx.customFields.find((f) => f.id === field.slice("custom:".length));
      if (cf?.options) {
        return cf.options.find((o) => o.value === v)?.label ?? String(v);
      }
    }
    if (operator === "older_than_days") return `${v} dias`;
    if (operator === "next_days") return `${v} dias`;
    return String(v);
  };

  const labels = vals.map(mapOne);
  if (labels.length === 1) return labels[0];
  if (labels.length <= 2) return labels.join(", ");
  return `${labels[0]} +${labels.length - 1}`;
}

export function ActiveFilterChips({
  activeFilter,
  searchTerm,
  onSearchClear,
  onFilterChange,
  salesUsers,
  stages,
  customFields = [],
}: ActiveFilterChipsProps) {
  const hasSearch = !!searchTerm?.trim();
  if (!activeFilter && !hasSearch) return null;

  const chips: Array<{ key: string; label: React.ReactNode; onRemove: () => void }> = [];

  if (hasSearch && onSearchClear) {
    chips.push({
      key: "__search",
      label: (
        <>
          <span className="text-muted-foreground">Busca:</span> {searchTerm}
        </>
      ),
      onRemove: onSearchClear,
    });
  }

  if (activeFilter) {
    if (activeFilter.type === "salesperson") {
      chips.push({
        key: "f-sp",
        label: (
          <>
            <span className="text-muted-foreground">Vendedor:</span> {activeFilter.name}
          </>
        ),
        onRemove: () => onFilterChange(null),
      });
    } else if (activeFilter.type === "product") {
      chips.push({
        key: "f-prod",
        label: (
          <>
            <span className="text-muted-foreground">Produto:</span> {activeFilter.name}
          </>
        ),
        onRemove: () => onFilterChange(null),
      });
    } else if (activeFilter.type === "recommended") {
      chips.push({
        key: "f-rec",
        label: activeFilter.name,
        onRemove: () => onFilterChange(null),
      });
    } else if (activeFilter.type === "custom") {
      const conds = activeFilter.conditions || [];
      if (conds.length === 0) {
        chips.push({
          key: "f-custom",
          label: activeFilter.name,
          onRemove: () => onFilterChange(null),
        });
      } else {
        conds.forEach((c, idx) => {
          const fl = fieldLabel(c.field, customFields);
          const op = OPERATOR_LABELS[c.operator] ?? c.operator;
          const vl = valueLabel(c, { salesUsers, stages, customFields });
          chips.push({
            key: `c-${idx}`,
            label: (
              <span className="flex items-center gap-1">
                <span className="font-medium">{fl}</span>
                <span className="text-muted-foreground">{op}</span>
                {vl && <span>{vl}</span>}
              </span>
            ),
            onRemove: () => {
              const next = conds.filter((_, i) => i !== idx);
              if (next.length === 0) {
                onFilterChange(null);
              } else {
                onFilterChange({
                  ...activeFilter,
                  // mark as ephemeral so we don't accidentally overwrite saved
                  id: activeFilter.id,
                  name: activeFilter.name,
                  conditions: next,
                });
              }
            },
          });
        });
      }
    }
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 py-1">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 pl-2 pr-1 py-1 text-xs font-normal"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            className="ml-0.5 rounded p-0.5 hover:bg-background/60 transition-colors"
            aria-label="Remover filtro"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={() => {
            onFilterChange(null);
            onSearchClear?.();
          }}
          className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-1"
        >
          Limpar todos
        </button>
      )}
    </div>
  );
}
