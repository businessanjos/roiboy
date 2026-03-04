import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { FieldFilter } from "@/components/insights/visual-builder/types";

// Known lead field UUIDs
const LEAD_FIELDS = [
  { id: 'e4270e93-e9b9-4d9b-9589-d614ce335bcd', name: 'MQL' },
  { id: '3bcdcf47-076e-47f2-a1ab-a4dd1ec8398a', name: 'Canal' },
  { id: 'e352a1ca-cfbc-435a-95f7-2f53b5cac041', name: 'Faturamento Atual' },
];

interface LeadFieldFilterSectionProps {
  filters: FieldFilter[];
  onFiltersChange: (filters: FieldFilter[]) => void;
}

function SingleLeadFilter({
  filter,
  index,
  usedFieldIds,
  onUpdate,
  onRemove,
}: {
  filter: FieldFilter;
  index: number;
  usedFieldIds: Set<string>;
  onUpdate: (index: number, filter: FieldFilter) => void;
  onRemove: (index: number) => void;
}) {
  const { currentUser } = useCurrentUser();
  const [fieldOptions, setFieldOptions] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!filter.fieldId || !currentUser?.account_id) {
      setFieldOptions([]);
      return;
    }

    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const { data: fieldDef } = await supabase
          .from('custom_fields')
          .select('options')
          .eq('id', filter.fieldId)
          .maybeSingle();

        if (fieldDef?.options && Array.isArray(fieldDef.options) && fieldDef.options.length > 0) {
          const labels = fieldDef.options.map((opt: any) => opt.label).filter(Boolean);
          setFieldOptions(labels);
        } else {
          const { data: values } = await supabase
            .from('lead_field_values')
            .select('value_text')
            .eq('field_id', filter.fieldId)
            .eq('account_id', currentUser.account_id)
            .not('value_text', 'is', null);

          if (values) {
            const unique = [...new Set(values.map(v => v.value_text).filter(Boolean) as string[])].sort();
            setFieldOptions(unique);
          }
        }
      } catch (error) {
        console.error('Error fetching lead field options:', error);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, [filter.fieldId, currentUser?.account_id]);

  const handleFieldSelect = (value: string) => {
    if (value === 'none') {
      onRemove(index);
      return;
    }
    const field = LEAD_FIELDS.find(f => f.id === value);
    if (field) {
      onUpdate(index, { fieldId: field.id, fieldName: field.name, selectedValues: [] });
    }
  };

  const handleToggleValue = (value: string, checked: boolean) => {
    const newValues = checked
      ? [...filter.selectedValues, value]
      : filter.selectedValues.filter(v => v !== value);
    onUpdate(index, { ...filter, selectedValues: newValues });
  };

  const availableFields = LEAD_FIELDS.filter(
    f => f.id === filter.fieldId || !usedFieldIds.has(f.id)
  );

  return (
    <div className="space-y-2 p-3 border rounded-lg relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 h-6 w-6"
        onClick={() => onRemove(index)}
      >
        <X className="h-3 w-3" />
      </Button>

      <Select value={filter.fieldId || 'none'} onValueChange={handleFieldSelect}>
        <SelectTrigger className="pr-8">
          <SelectValue placeholder="Selecione um campo" />
        </SelectTrigger>
        <SelectContent>
          {availableFields.map(field => (
            <SelectItem key={field.id} value={field.id}>
              {field.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {filter.fieldId && fieldOptions.length > 0 && (
        <div className="space-y-1 max-h-[150px] overflow-y-auto">
          {loadingOptions ? (
            <p className="text-xs text-muted-foreground">Carregando opções...</p>
          ) : (
            fieldOptions.map(option => (
              <div key={option} className="flex items-center gap-2">
                <Checkbox
                  id={`lead-filter-${index}-${option}`}
                  checked={filter.selectedValues.includes(option)}
                  onCheckedChange={(checked) => handleToggleValue(option, !!checked)}
                />
                <label htmlFor={`lead-filter-${index}-${option}`} className="text-sm cursor-pointer">
                  {option}
                </label>
              </div>
            ))
          )}
        </div>
      )}

      {filter.fieldId && !loadingOptions && fieldOptions.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma opção encontrada.</p>
      )}
    </div>
  );
}

export function LeadFieldFilterSection({ filters, onFiltersChange }: LeadFieldFilterSectionProps) {
  const usedFieldIds = new Set(filters.map(f => f.fieldId).filter(Boolean));

  const handleUpdate = (index: number, filter: FieldFilter) => {
    const newFilters = [...filters];
    newFilters[index] = filter;
    onFiltersChange(newFilters);
  };

  const handleRemove = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    onFiltersChange([...filters, { fieldId: '', fieldName: '', selectedValues: [] }]);
  };

  const canAddMore = usedFieldIds.size < LEAD_FIELDS.length;

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Filtro por Lead</Label>
      <p className="text-xs text-muted-foreground">
        Filtre os dados por campos do Lead. Múltiplos filtros usam lógica AND.
      </p>

      {filters.map((filter, index) => (
        <SingleLeadFilter
          key={index}
          filter={filter}
          index={index}
          usedFieldIds={usedFieldIds}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
        />
      ))}

      {canAddMore && (
        <Button variant="outline" size="sm" className="w-full" onClick={handleAdd}>
          <Plus className="h-3 w-3 mr-1" />
          Adicionar filtro de Lead
        </Button>
      )}

      <Separator />
    </div>
  );
}
