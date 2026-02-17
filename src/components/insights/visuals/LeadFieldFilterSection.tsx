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
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Known lead field UUIDs
const LEAD_FIELDS = [
  { id: 'e4270e93-e9b9-4d9b-9589-d614ce335bcd', name: 'MQL' },
  { id: '3bcdcf47-076e-47f2-a1ab-a4dd1ec8398a', name: 'Canal' },
  { id: 'e352a1ca-cfbc-435a-95f7-2f53b5cac041', name: 'Faturamento Atual' },
];

interface LeadFieldFilterSectionProps {
  selectedFieldId: string;
  selectedFieldName: string;
  selectedValues: string[];
  onFieldChange: (fieldId: string, fieldName: string) => void;
  onSelectedValuesChange: (values: string[]) => void;
}

export function LeadFieldFilterSection({
  selectedFieldId,
  selectedFieldName,
  selectedValues,
  onFieldChange,
  onSelectedValuesChange,
}: LeadFieldFilterSectionProps) {
  const { currentUser } = useCurrentUser();
  const [fieldOptions, setFieldOptions] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Fetch options when field changes
  useEffect(() => {
    if (!selectedFieldId || !currentUser?.account_id) {
      setFieldOptions([]);
      return;
    }

    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        // First try to get options from custom_fields definition
        const { data: fieldDef } = await supabase
          .from('custom_fields')
          .select('options')
          .eq('id', selectedFieldId)
          .maybeSingle();

        if (fieldDef?.options && Array.isArray(fieldDef.options) && fieldDef.options.length > 0) {
          // Use labels from field options
          const labels = fieldDef.options.map((opt: any) => opt.label).filter(Boolean);
          setFieldOptions(labels);
        } else {
          // Fetch unique values from lead_field_values
          const { data: values } = await supabase
            .from('lead_field_values')
            .select('value_text')
            .eq('field_id', selectedFieldId)
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
  }, [selectedFieldId, currentUser?.account_id]);

  const handleFieldSelect = (value: string) => {
    if (value === 'none') {
      onFieldChange('', '');
      onSelectedValuesChange([]);
      return;
    }
    const field = LEAD_FIELDS.find(f => f.id === value);
    if (field) {
      onFieldChange(field.id, field.name);
      onSelectedValuesChange([]);
    }
  };

  const handleToggleValue = (value: string, checked: boolean) => {
    if (checked) {
      onSelectedValuesChange([...selectedValues, value]);
    } else {
      onSelectedValuesChange(selectedValues.filter(v => v !== value));
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Filtro por Lead</Label>
      <p className="text-xs text-muted-foreground">
        Filtre os dados do visual por um campo específico do Lead.
      </p>

      <Select value={selectedFieldId || 'none'} onValueChange={handleFieldSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione um campo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhum filtro</SelectItem>
          {LEAD_FIELDS.map(field => (
            <SelectItem key={field.id} value={field.id}>
              {field.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedFieldId && fieldOptions.length > 0 && (
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {loadingOptions ? (
            <p className="text-xs text-muted-foreground">Carregando opções...</p>
          ) : (
            fieldOptions.map(option => {
              const isChecked = selectedValues.includes(option);
              return (
                <div key={option} className="flex items-center gap-2">
                  <Checkbox
                    id={`lead-filter-${option}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => handleToggleValue(option, !!checked)}
                  />
                  <label htmlFor={`lead-filter-${option}`} className="text-sm cursor-pointer">
                    {option}
                  </label>
                </div>
              );
            })
          )}
        </div>
      )}

      {selectedFieldId && !loadingOptions && fieldOptions.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma opção encontrada para este campo.</p>
      )}

      <Separator />
    </div>
  );
}
