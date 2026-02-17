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

interface DealField {
  id: string;
  name: string;
  field_type: string;
  options: any;
}

interface DealFieldFilterSectionProps {
  selectedFieldId: string;
  selectedFieldName: string;
  selectedValues: string[];
  onFieldChange: (fieldId: string, fieldName: string) => void;
  onSelectedValuesChange: (values: string[]) => void;
}

export function DealFieldFilterSection({
  selectedFieldId,
  selectedFieldName,
  selectedValues,
  onFieldChange,
  onSelectedValuesChange,
}: DealFieldFilterSectionProps) {
  const { currentUser } = useCurrentUser();
  const [dealFields, setDealFields] = useState<DealField[]>([]);
  const [fieldOptions, setFieldOptions] = useState<string[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Fetch available deal custom fields
  useEffect(() => {
    if (!currentUser?.account_id) return;

    const fetchFields = async () => {
      setLoadingFields(true);
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
      } finally {
        setLoadingFields(false);
      }
    };

    fetchFields();
  }, [currentUser?.account_id]);

  // Fetch options when field changes
  useEffect(() => {
    if (!selectedFieldId || !currentUser?.account_id) {
      setFieldOptions([]);
      return;
    }

    const selectedField = dealFields.find(f => f.id === selectedFieldId);
    if (!selectedField) return;

    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        // For select/multi_select fields, use options from field definition
        if (
          (selectedField.field_type === 'select' || selectedField.field_type === 'multi_select') &&
          selectedField.options &&
          Array.isArray(selectedField.options) &&
          selectedField.options.length > 0
        ) {
          const labels = selectedField.options.map((opt: any) => opt.label).filter(Boolean);
          setFieldOptions(labels);
        } else {
          // For other field types, fetch unique values from deal_field_values
          const { data: values } = await supabase
            .from('deal_field_values')
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
        console.error('Error fetching deal field options:', error);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, [selectedFieldId, currentUser?.account_id, dealFields]);

  const handleFieldSelect = (value: string) => {
    if (value === 'none') {
      onFieldChange('', '');
      onSelectedValuesChange([]);
      return;
    }
    const field = dealFields.find(f => f.id === value);
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
      <Label className="text-base font-medium">Filtro por Negócio</Label>
      <p className="text-xs text-muted-foreground">
        Filtre os dados do visual por um campo personalizado do Negócio.
      </p>

      <Select value={selectedFieldId || 'none'} onValueChange={handleFieldSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione um campo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhum filtro</SelectItem>
          {dealFields.map(field => (
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
                    id={`deal-filter-${option}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => handleToggleValue(option, !!checked)}
                  />
                  <label htmlFor={`deal-filter-${option}`} className="text-sm cursor-pointer">
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
