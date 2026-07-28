import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  useInsightsFilters,
  GlobalFieldFilter,
  GlobalFieldFilterSource,
} from "@/hooks/useInsightsFilters";
import {
  DEAL_CREATED_AT_FIELD_ID,
  FieldFilter,
} from "@/components/insights/visual-builder/types";

interface CustomFieldRow {
  id: string;
  name: string;
  field_type: string;
  options: any;
}

/**
 * Global custom-field filter selector for the insights top bar.
 * Mirrors the deal/lead field filter logic used inside the visual-builder,
 * but stores the result in the shared InsightsFilters context so every
 * dashboard widget picks it up (like the seller/product filters do).
 */
export function InsightsGlobalFieldFilter() {
  const { filters, setGlobalFieldFilter } = useInsightsFilters();
  const { currentUser } = useCurrentUser();
  const accountId = filters.accountIdOverride || currentUser?.account_id;

  const [open, setOpen] = useState(false);
  const active = filters.globalFieldFilter;
  const [source, setSource] = useState<GlobalFieldFilterSource>(active?.source ?? "deal");
  const [fieldId, setFieldId] = useState<string>(active?.filter.fieldId ?? "");
  const [fieldName, setFieldName] = useState<string>(active?.filter.fieldName ?? "");
  const [selectedValues, setSelectedValues] = useState<string[]>(active?.filter.selectedValues ?? []);
  const [dateFrom, setDateFrom] = useState<string>(active?.filter.dateFrom ?? "");
  const [dateTo, setDateTo] = useState<string>(active?.filter.dateTo ?? "");

  // Reset local state when popover opens
  useEffect(() => {
    if (!open) return;
    setSource(active?.source ?? "deal");
    setFieldId(active?.filter.fieldId ?? "");
    setFieldName(active?.filter.fieldName ?? "");
    setSelectedValues(active?.filter.selectedValues ?? []);
    setDateFrom(active?.filter.dateFrom ?? "");
    setDateTo(active?.filter.dateTo ?? "");
  }, [open, active]);

  // Fetch custom fields for the current source
  const { data: fields = [] } = useQuery<CustomFieldRow[]>({
    queryKey: ["insights-global-field", source, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const column = source === "deal" ? "show_in_deals" : "show_in_leads";
      const { data } = await supabase
        .from("custom_fields")
        .select("id, name, field_type, options")
        .eq("account_id", accountId as string)
        .eq(column as any, true)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      const rows = (data as CustomFieldRow[]) || [];
      if (source === "deal") {
        const virtual: CustomFieldRow = {
          id: DEAL_CREATED_AT_FIELD_ID,
          name: "Data de criação do Negócio",
          field_type: "date",
          options: null,
        };
        return [virtual, ...rows];
      }
      return rows;
    },
  });

  const selectedField = useMemo(
    () => fields.find((f) => f.id === fieldId) || null,
    [fields, fieldId]
  );
  const isDateRangeField = fieldId === DEAL_CREATED_AT_FIELD_ID;

  // Fetch value options for the selected field
  const { data: fieldOptions = [] } = useQuery<string[]>({
    queryKey: ["insights-global-field-values", source, fieldId, accountId],
    enabled: !!accountId && !!fieldId && !isDateRangeField,
    queryFn: async () => {
      if (!selectedField) return [];
      if (
        (selectedField.field_type === "select" || selectedField.field_type === "multi_select") &&
        Array.isArray(selectedField.options) &&
        selectedField.options.length > 0
      ) {
        return (selectedField.options as any[]).map((o) => o.label).filter(Boolean);
      }
      const table = source === "deal" ? "deal_field_values" : "lead_field_values";
      const { data } = await supabase
        .from(table as any)
        .select("value_text")
        .eq("field_id", fieldId)
        .eq("account_id", accountId as string)
        .not("value_text", "is", null);
      const unique = [
        ...new Set(((data as any[]) || []).map((r) => r.value_text).filter(Boolean) as string[]),
      ].sort();
      return unique;
    },
  });

  const handleSourceChange = (next: GlobalFieldFilterSource) => {
    setSource(next);
    setFieldId("");
    setFieldName("");
    setSelectedValues([]);
    setDateFrom("");
    setDateTo("");
  };

  const handleFieldChange = (id: string) => {
    const f = fields.find((x) => x.id === id);
    setFieldId(id);
    setFieldName(f?.name ?? "");
    setSelectedValues([]);
    setDateFrom("");
    setDateTo("");
  };

  const toggleValue = (value: string, checked: boolean) => {
    setSelectedValues((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value)
    );
  };

  const canApply = useMemo(() => {
    if (!fieldId) return false;
    if (isDateRangeField) return !!(dateFrom || dateTo);
    return selectedValues.length > 0;
  }, [fieldId, isDateRangeField, dateFrom, dateTo, selectedValues]);

  const apply = () => {
    if (!canApply) return;
    const filter: FieldFilter = {
      fieldId,
      fieldName,
      selectedValues,
      ...(isDateRangeField ? { dateFrom, dateTo } : {}),
    };
    const next: GlobalFieldFilter = { source, filter };
    setGlobalFieldFilter(next);
    setOpen(false);
  };

  const clear = () => {
    setGlobalFieldFilter(null);
    setOpen(false);
  };

  const isActive = !!active;
  const activeLabel = active
    ? (() => {
        const src = active.source === "deal" ? "Negócio" : "Lead";
        const name = active.filter.fieldName || "campo";
        if (active.filter.fieldId === DEAL_CREATED_AT_FIELD_ID) {
          const parts = [active.filter.dateFrom, active.filter.dateTo].filter(Boolean).join(" → ");
          return `${src}: ${name} (${parts})`;
        }
        const vals = active.filter.selectedValues;
        const preview =
          vals.length <= 2 ? vals.join(", ") : `${vals.slice(0, 2).join(", ")} +${vals.length - 2}`;
        return `${src}: ${name} (${preview})`;
      })()
    : "Filtrar por campo";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isActive ? "secondary" : "outline"}
          size="sm"
          className="gap-2 max-w-[260px]"
          title={activeLabel}
        >
          <Filter className="h-4 w-4 shrink-0" />
          <span className="truncate">{activeLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Filtrar por campo</Label>
          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground"
              onClick={clear}
            >
              <X className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Origem</Label>
          <Select value={source} onValueChange={(v) => handleSourceChange(v as GlobalFieldFilterSource)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deal">Campo do Negócio</SelectItem>
              <SelectItem value="lead">Campo do Lead</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Campo</Label>
          <Select value={fieldId || undefined} onValueChange={handleFieldChange}>
            <SelectTrigger>
              <SelectValue placeholder={fields.length ? "Selecione um campo" : "Nenhum campo disponível"} />
            </SelectTrigger>
            <SelectContent>
              {fields.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {fieldId && isDateRangeField && (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        )}

        {fieldId && !isDateRangeField && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Valor</Label>
            <div className="max-h-[180px] overflow-y-auto space-y-1 border rounded-md p-2">
              {fieldOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma opção encontrada.</p>
              ) : (
                fieldOptions.map((opt) => (
                  <div key={opt} className="flex items-center gap-2">
                    <Checkbox
                      id={`global-field-${opt}`}
                      checked={selectedValues.includes(opt)}
                      onCheckedChange={(checked) => toggleValue(opt, !!checked)}
                    />
                    <label htmlFor={`global-field-${opt}`} className="text-sm cursor-pointer">
                      {opt}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <Separator />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={apply} disabled={!canApply}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
