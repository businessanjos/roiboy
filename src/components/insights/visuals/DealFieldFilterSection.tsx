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
import { Input } from "@/components/ui/input";
import { FieldFilter, DEAL_CREATED_AT_FIELD_ID } from "@/components/insights/visual-builder/types";

interface DealField {
  id: string;
  name: string;
  field_type: string;
  options: any;
}

const DEAL_STATUS_OPTIONS = [
  { value: 'won', label: 'Ganho' },
  { value: 'open', label: 'Em Aberto' },
  { value: 'lost', label: 'Perdido' },
];

interface DealFieldFilterSectionProps {
  filters: FieldFilter[];
  onFiltersChange: (filters: FieldFilter[]) => void;
  dealStatusFilter?: string[];
  onDealStatusFilterChange?: (statuses: string[]) => void;
}

function SingleDealFilter({
  filter,
  index,
  dealFields,
  usedFieldIds,
  onUpdate,
  onRemove,
}: {
  filter: FieldFilter;
  index: number;
  dealFields: DealField[];
  usedFieldIds: Set<string>;
  onUpdate: (index: number, filter: FieldFilter) => void;
  onRemove: (index: number) => void;
}) {
  const { currentUser } = useCurrentUser();
  const [fieldOptions, setFieldOptions] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const isDateRangeField = filter.fieldId === DEAL_CREATED_AT_FIELD_ID;

  useEffect(() => {
    if (!filter.fieldId || !currentUser?.account_id || isDateRangeField) {
      setFieldOptions([]);
      return;
    }

    const selectedField = dealFields.find(f => f.id === filter.fieldId);
    if (!selectedField) return;

    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        if (
          (selectedField.field_type === 'select' || selectedField.field_type === 'multi_select') &&
          selectedField.options &&
          Array.isArray(selectedField.options) &&
          selectedField.options.length > 0
        ) {
          const labels = selectedField.options.map((opt: any) => opt.label).filter(Boolean);
          setFieldOptions(labels);
        } else {
          const { data: values } = await supabase
            .from('deal_field_values')
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
        console.error('Error fetching deal field options:', error);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, [filter.fieldId, currentUser?.account_id, dealFields, isDateRangeField]);

  const handleFieldSelect = (value: string) => {
    if (value === 'none') {
      onRemove(index);
      return;
    }
    if (value === DEAL_CREATED_AT_FIELD_ID) {
      onUpdate(index, {
        fieldId: DEAL_CREATED_AT_FIELD_ID,
        fieldName: 'Data de criação do Negócio',
        selectedValues: [],
        dateFrom: '',
        dateTo: '',
      });
      return;
    }
    const field = dealFields.find(f => f.id === value);
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

  const availableFields = dealFields.filter(
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
                  id={`deal-filter-${index}-${option}`}
                  checked={filter.selectedValues.includes(option)}
                  onCheckedChange={(checked) => handleToggleValue(option, !!checked)}
                />
                <label htmlFor={`deal-filter-${index}-${option}`} className="text-sm cursor-pointer">
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

export function DealFieldFilterSection({ filters, onFiltersChange, dealStatusFilter = [], onDealStatusFilterChange }: DealFieldFilterSectionProps) {
  const { currentUser } = useCurrentUser();
  const [dealFields, setDealFields] = useState<DealField[]>([]);

  useEffect(() => {
    if (!currentUser?.account_id) return;

    const fetchFields = async () => {
      try {
        const { data } = await supabase
          .from('custom_fields')
          .select('id, name, field_type, options')
          .eq('account_id', currentUser.account_id)
          .eq('show_in_deals', true)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (data) {
          setDealFields(data as DealField[]);
        }
      } catch (error) {
        console.error('Error fetching deal custom fields:', error);
      }
    };

    fetchFields();
  }, [currentUser?.account_id]);

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

  const canAddMore = dealFields.length > 0 && usedFieldIds.size < dealFields.length;

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Filtro por Negócio</Label>
      <p className="text-xs text-muted-foreground">
        Filtre os dados por campos do Negócio. Múltiplos filtros usam lógica AND.
      </p>

      {/* Fixed Status filter */}
      {onDealStatusFilterChange && (
        <div className="space-y-2 p-3 border rounded-lg">
          <Label className="text-sm font-medium">Status do Negócio</Label>
          <div className="space-y-1">
            {DEAL_STATUS_OPTIONS.map(opt => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox
                  id={`deal-status-${opt.value}`}
                  checked={dealStatusFilter.includes(opt.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onDealStatusFilterChange([...dealStatusFilter, opt.value]);
                    } else {
                      onDealStatusFilterChange(dealStatusFilter.filter(v => v !== opt.value));
                    }
                  }}
                />
                <label htmlFor={`deal-status-${opt.value}`} className="text-sm cursor-pointer">
                  {opt.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {filters.map((filter, index) => (
        <SingleDealFilter
          key={index}
          filter={filter}
          index={index}
          dealFields={dealFields}
          usedFieldIds={usedFieldIds}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
        />
      ))}

      {canAddMore && (
        <Button variant="outline" size="sm" className="w-full" onClick={handleAdd}>
          <Plus className="h-3 w-3 mr-1" />
          Adicionar filtro de Negócio
        </Button>
      )}

      <Separator />
    </div>
  );
}
