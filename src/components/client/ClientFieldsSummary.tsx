import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FieldValueBadge } from "@/components/custom-fields/FieldValueBadge";
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

interface TeamUser {
  id: string;
  name: string;
  email: string;
}

interface ClientFieldsSummaryProps {
  clientId: string;
}

export function ClientFieldsSummary({ clientId }: ClientFieldsSummaryProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const fetchData = async () => {
    try {
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

      // Fetch team users for user-type fields
      const hasUserFields = parsedFields.some((f) => f.field_type === "user");
      if (hasUserFields) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, name, email")
          .order("name");
        setTeamUsers((usersData || []) as TeamUser[]);
      }
    } catch (error) {
      console.error("Error fetching custom fields:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-card mb-4">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando campos...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (fields.length === 0) {
    return null;
  }

  // Filter fields that have values
  const fieldsWithValues = fields.filter((field) => {
    const value = fieldValues[field.id];
    if (value === null || value === undefined) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (value === "") return false;
    return true;
  });

  const fieldsWithoutValues = fields.filter((field) => {
    const value = fieldValues[field.id];
    if (value === null || value === undefined) return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (value === "") return true;
    return false;
  });

  return (
    <Card className="shadow-card mb-4 bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <Layers className="h-4 w-4" />
          Campos Personalizados
          <Badge variant="secondary" className="text-xs">
            {fieldsWithValues.length}/{fields.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {fields.map((field) => {
            const value = fieldValues[field.id];
            const hasValue = value !== null && value !== undefined && 
              !(Array.isArray(value) && value.length === 0) && value !== "";

            return (
              <div
                key={field.id}
                className={`p-2 rounded-lg border ${
                  hasValue 
                    ? "bg-card border-border" 
                    : "bg-muted/50 border-border/50"
                }`}
              >
                <p className="text-xs text-muted-foreground mb-1 truncate" title={field.name}>
                  {field.name}
                </p>
                <FieldValueBadge
                  field={field}
                  value={value}
                  size="sm"
                  teamUsers={teamUsers}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
