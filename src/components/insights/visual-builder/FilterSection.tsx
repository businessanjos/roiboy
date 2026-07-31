import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataSource,
  VisualFilter,
  FilterOperator,
  operatorsForType,
  operatorNeedsValues,
  newFilterId,
} from "./types";
import {
  CatalogField,
  catalogFieldId,
  parseCatalogFieldId,
  fetchNativeFieldValues,
  fetchCustomFieldValues,
} from "@/lib/insights/fieldRegistry";

interface FilterSectionProps {
  dataSource: DataSource;
  accountId: string | null;
  catalog: CatalogField[];
  filters: VisualFilter[];
  onChange: (filters: VisualFilter[]) => void;
}

function FilterRow({
  filter,
  index,
  catalog,
  dataSource,
  accountId,
  onUpdate,
  onRemove,
}: {
  filter: VisualFilter;
  index: number;
  catalog: CatalogField[];
  dataSource: DataSource;
  accountId: string | null;
  onUpdate: (index: number, filter: VisualFilter) => void;
  onRemove: (index: number) => void;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const field = catalog.find((f) => f.source === filter.source && f.key === filter.field);
  const needsValues = operatorNeedsValues(filter.operator);
  const isText = filter.type === 'text';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isText || !needsValues || !accountId) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        if (field?.options?.length) {
          if (!cancelled) setOptions(field.options);
        } else if (filter.source === 'native') {
          const values = await fetchNativeFieldValues(dataSource, filter.field, accountId);
          if (!cancelled) setOptions(values);
        } else {
          const values = await fetchCustomFieldValues(filter.field);
          if (!cancelled) setOptions(values);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [filter.field, filter.source, filter.operator, dataSource, accountId, isText, needsValues, field?.options]);

  const changeField = (id: string) => {
    const parsed = parseCatalogFieldId(id);
    if (!parsed) return;
    const next = catalog.find((f) => f.source === parsed.source && f.key === parsed.key);
    if (!next) return;
    const ops = operatorsForType(next.type);
    onUpdate(index, {
      ...filter,
      source: next.source,
      field: next.key,
      label: next.label,
      type: next.type,
      operator: ops[0].value,
      values: [],
      from: undefined,
      to: undefined,
    });
  };

  const toggleValue = (value: string, checked: boolean) => {
    const single = filter.operator === 'is';
    let values: string[];
    if (single) {
      values = checked ? [value] : [];
    } else {
      values = checked ? [...filter.values, value] : filter.values.filter((v) => v !== value);
    }
    onUpdate(index, { ...filter, values });
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Select value={catalogFieldId({ ...(field as CatalogField), source: filter.source, key: filter.field } as CatalogField)} onValueChange={changeField}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Campo" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {catalog.map((f) => (
              <SelectItem key={catalogFieldId(f)} value={catalogFieldId(f)}>
                {f.label}
                {f.source !== 'native' && (
                  <span className="text-muted-foreground text-xs ml-1">
                    ({f.source === 'deal_custom' ? 'negócio' : 'lead'})
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.operator}
          onValueChange={(op) =>
            onUpdate(index, { ...filter, operator: op as FilterOperator, values: op === 'is' ? filter.values.slice(0, 1) : filter.values })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operatorsForType(filter.type).map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon" onClick={() => onRemove(index)} aria-label="Remover filtro">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {needsValues && isText && (
        <div className="max-h-44 overflow-y-auto space-y-1.5 pl-1">
          {loading && <p className="text-xs text-muted-foreground">Carregando valores...</p>}
          {!loading && options.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum valor disponível para este campo.</p>
          )}
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={filter.values.includes(opt)}
                onCheckedChange={(c) => toggleValue(opt, c === true)}
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}

      {needsValues && filter.type === 'date' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={filter.from || ''}
            onChange={(e) => onUpdate(index, { ...filter, from: e.target.value })}
          />
          <span className="text-muted-foreground text-sm">até</span>
          <Input
            type="date"
            value={filter.to || ''}
            onChange={(e) => onUpdate(index, { ...filter, to: e.target.value })}
          />
        </div>
      )}

      {needsValues && filter.type === 'number' && (
        <div className="flex items-center gap-2">
          {filter.operator === 'is' ? (
            <Input
              type="number"
              placeholder="Valor"
              value={filter.values[0] || ''}
              onChange={(e) => onUpdate(index, { ...filter, values: e.target.value ? [e.target.value] : [] })}
            />
          ) : (
            <>
              {filter.operator !== 'lt' && (
                <Input
                  type="number"
                  placeholder="Mínimo"
                  value={filter.from || ''}
                  onChange={(e) => onUpdate(index, { ...filter, from: e.target.value })}
                />
              )}
              {filter.operator !== 'gt' && (
                <Input
                  type="number"
                  placeholder="Máximo"
                  value={filter.to || ''}
                  onChange={(e) => onUpdate(index, { ...filter, to: e.target.value })}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function FilterSection({ dataSource, accountId, catalog, filters, onChange }: FilterSectionProps) {
  const addFilter = () => {
    const first = catalog[0];
    if (!first) return;
    onChange([
      ...filters,
      {
        id: newFilterId(),
        source: first.source,
        field: first.key,
        label: first.label,
        type: first.type,
        operator: operatorsForType(first.type)[0].value,
        values: [],
      },
    ]);
  };

  const updateFilter = (index: number, filter: VisualFilter) => {
    const next = [...filters];
    next[index] = filter;
    onChange(next);
  };

  const removeFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Filtros</Label>
        <span className="text-xs text-muted-foreground">
          {filters.length === 0 ? 'Nenhum filtro' : `${filters.length} filtro(s) aplicado(s)`}
        </span>
      </div>

      {filters.map((filter, index) => (
        <FilterRow
          key={filter.id}
          filter={filter}
          index={index}
          catalog={catalog}
          dataSource={dataSource}
          accountId={accountId}
          onUpdate={updateFilter}
          onRemove={removeFilter}
        />
      ))}

      <Button variant="outline" size="sm" onClick={addFilter} disabled={catalog.length === 0}>
        <Plus className="h-4 w-4 mr-1" />
        Adicionar filtro
      </Button>
    </div>
  );
}
