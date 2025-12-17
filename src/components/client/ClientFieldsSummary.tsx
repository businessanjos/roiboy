import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FieldValueEditor } from "@/components/custom-fields/FieldValueEditor";
import { CustomField } from "@/components/custom-fields/CustomFieldsManager";
import { Layers, Loader2 } from "lucide-react";

interface ClientFieldValue {
  field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_json: any;
}

interface ClientFieldsSummaryProps {
  clientId: string;
  expanded?: boolean;
}

export function ClientFieldsSummary({ clientId, expanded = false }: ClientFieldsSummaryProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const fetchData = async () => {
    try {
      // Get account ID
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (userData) {
        setAccountId(userData.account_id);
      }

      // Fetch active custom fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from("custom_fields")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (fieldsError) throw fieldsError;

      const parsedFields: CustomField[] = (fieldsData || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        field_type: f.field_type,
        options: Array.isArray(f.options) ? f.options : [],
        is_required: f.is_required,
        display_order: f.display_order,
        is_active: f.is_active,
      }));
      setFields(parsedFields);

      // Fetch field values for this client
      const { data: valuesData, error: valuesError } = await supabase
        .from("client_field_values")
        .select("*")
        .eq("client_id", clientId);

      if (valuesError) throw valuesError;

      // Map values by field_id
      const valuesMap: Record<string, any> = {};
      (valuesData || []).forEach((v: ClientFieldValue) => {
        const field = parsedFields.find((f) => f.id === v.field_id);
        if (field) {
          switch (field.field_type) {
            case "boolean":
              valuesMap[v.field_id] = v.value_boolean;
              break;
            case "number":
            case "currency":
              valuesMap[v.field_id] = v.value_number;
              break;
            case "date":
              valuesMap[v.field_id] = v.value_date;
              break;
            case "multi_select":
            case "user":
              valuesMap[v.field_id] = v.value_json;
              break;
            case "select":
            case "text":
            default:
              valuesMap[v.field_id] = v.value_text;
              break;
          }
        }
      });
      setFieldValues(valuesMap);
    } catch (error) {
      console.error("Error fetching custom fields:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (fieldId: string, newValue: any) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldId]: newValue,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Carregando campos...</span>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Layers className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhum campo personalizado cadastrado.</p>
        <p className="text-sm">Acesse Configurações para criar campos.</p>
      </div>
    );
  }

  // Count fields with values
  const filledCount = fields.filter((field) => {
    const value = fieldValues[field.id];
    if (value === null || value === undefined) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (value === "") return false;
    return true;
  }).length;

  // Expanded view - list format for dedicated tab
  if (expanded) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <Badge variant="secondary">
            {filledCount}/{fields.length} preenchidos
          </Badge>
        </div>
        <div className="divide-y divide-border">
          {fields.map((field) => {
            const value = fieldValues[field.id];
            const hasValue =
              value !== null &&
              value !== undefined &&
              !(Array.isArray(value) && value.length === 0) &&
              value !== "";

            return (
              <div
                key={field.id}
                className="flex items-center justify-between py-3 px-2 hover:bg-muted/30 rounded-lg transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${hasValue ? '' : 'text-muted-foreground'}`}>
                    {field.name}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {field.field_type === 'boolean' ? 'Sim/Não' : 
                     field.field_type === 'number' ? 'Número' :
                     field.field_type === 'currency' ? 'Moeda' :
                     field.field_type === 'date' ? 'Data' :
                     field.field_type === 'select' ? 'Seleção' :
                     field.field_type === 'multi_select' ? 'Multi-seleção' :
                     field.field_type === 'user' ? 'Usuário' : 'Texto'}
                  </p>
                </div>
                <div className="flex-shrink-0 ml-4">
                  {accountId ? (
                    <FieldValueEditor
                      field={field}
                      clientId={clientId}
                      accountId={accountId}
                      currentValue={value}
                      onValueChange={handleValueChange}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Compact view - grid format for summary
  return (
    <Card className="shadow-card mb-4 bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <Layers className="h-4 w-4" />
          Campos Personalizados
          <Badge variant="secondary" className="text-xs">
            {filledCount}/{fields.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {fields.map((field) => {
            const value = fieldValues[field.id];
            const hasValue =
              value !== null &&
              value !== undefined &&
              !(Array.isArray(value) && value.length === 0) &&
              value !== "";

            return (
              <div
                key={field.id}
                className={`p-2 rounded-lg border transition-colors ${
                  hasValue
                    ? "bg-card border-border hover:border-primary/30"
                    : "bg-muted/50 border-border/50 hover:border-border"
                }`}
              >
                <p className="text-xs text-muted-foreground mb-1 truncate" title={field.name}>
                  {field.name}
                </p>
                {accountId ? (
                  <FieldValueEditor
                    field={field}
                    clientId={clientId}
                    accountId={accountId}
                    currentValue={value}
                    onValueChange={handleValueChange}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
