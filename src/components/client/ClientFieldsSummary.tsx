import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FieldValueEditor } from "@/components/custom-fields/FieldValueEditor";
import { CustomField } from "@/components/custom-fields/CustomFieldsManager";
import { 
  Layers, 
  Loader2, 
  ToggleLeft, 
  Hash, 
  DollarSign, 
  Calendar, 
  List, 
  ListChecks, 
  Users, 
  Type,
  CheckCircle2,
  Circle
} from "lucide-react";

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

const FIELD_TYPE_CONFIG: Record<string, { 
  icon: typeof Type; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  boolean: { 
    icon: ToggleLeft, 
    label: "Sim/Não", 
    color: "text-purple-500",
    bgColor: "bg-purple-500/10"
  },
  number: { 
    icon: Hash, 
    label: "Número", 
    color: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  currency: { 
    icon: DollarSign, 
    label: "Moeda", 
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10"
  },
  date: { 
    icon: Calendar, 
    label: "Data", 
    color: "text-orange-500",
    bgColor: "bg-orange-500/10"
  },
  select: { 
    icon: List, 
    label: "Seleção", 
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10"
  },
  multi_select: { 
    icon: ListChecks, 
    label: "Multi-seleção", 
    color: "text-pink-500",
    bgColor: "bg-pink-500/10"
  },
  user: { 
    icon: Users, 
    label: "Responsável", 
    color: "text-amber-500",
    bgColor: "bg-amber-500/10"
  },
  text: { 
    icon: Type, 
    label: "Texto", 
    color: "text-muted-foreground",
    bgColor: "bg-muted"
  },
};

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

      // Fetch active custom fields that should appear in clients
      const { data: fieldsData, error: fieldsError } = await supabase
        .from("custom_fields")
        .select("*")
        .eq("is_active", true)
        .eq("show_in_clients", true)
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

  const getFieldTypeConfig = (type: string) => {
    return FIELD_TYPE_CONFIG[type] || FIELD_TYPE_CONFIG.text;
  };

  const hasFieldValue = (field: CustomField) => {
    const value = fieldValues[field.id];
    if (value === null || value === undefined) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (value === "") return false;
    return true;
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
      <div className="text-center py-12 text-muted-foreground">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
          <Layers className="h-8 w-8 opacity-50" />
        </div>
        <p className="font-medium">Nenhum campo personalizado</p>
        <p className="text-sm mt-1">Acesse Configurações para criar campos.</p>
      </div>
    );
  }

  // Count fields with values
  const filledCount = fields.filter(hasFieldValue).length;
  const progressPercent = Math.round((filledCount / fields.length) * 100);

  // Expanded view - visual card format for dedicated tab
  if (expanded) {
    return (
      <div className="space-y-6">
        {/* Progress Header */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/10">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Preenchimento</span>
              <span className="text-sm text-muted-foreground">
                {filledCount} de {fields.length} campos
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
          </div>
        </div>

        {/* Fields Grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => {
            const config = getFieldTypeConfig(field.field_type);
            const Icon = config.icon;
            const value = fieldValues[field.id];
            const hasValue = hasFieldValue(field);

            return (
              <div
                key={field.id}
                className={`group relative p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${
                  hasValue
                    ? "bg-card border-border hover:border-primary/30"
                    : "bg-muted/30 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40"
                }`}
              >
                {/* Status indicator */}
                <div className="absolute top-3 right-3">
                  {hasValue ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/30" />
                  )}
                </div>

                {/* Field Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${config.bgColor}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <h4 className={`font-medium text-sm truncate ${!hasValue && 'text-muted-foreground'}`}>
                      {field.name}
                    </h4>
                    <p className={`text-xs ${config.color}`}>
                      {config.label}
                    </p>
                  </div>
                </div>

                {/* Field Value */}
                <div className="pl-11">
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
            const hasValue = hasFieldValue(field);

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
