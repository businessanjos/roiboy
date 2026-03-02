import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { FileSpreadsheet } from "lucide-react";

interface FieldMapping {
  source: string;
  customFieldId?: string;
}

interface OmieFieldMapperProps {
  fieldMappings: Record<string, FieldMapping>;
  onChange: (mappings: Record<string, FieldMapping>) => void;
}

const OS_FIELDS = [
  { key: "cliente", label: "Cliente", description: "Identificação do cliente no Omie (CPF/CNPJ)" },
  { key: "vendedor", label: "Vendedor", description: "Nome do vendedor na OS" },
  { key: "descricao", label: "Descrição / Observações", description: "Texto descritivo da OS" },
  { key: "valor", label: "Valor Unitário", description: "Valor do serviço" },
];

const FIXED_SOURCES = [
  { value: "deal.title", label: "Título do Negócio", group: "Negócio" },
  { value: "deal.value", label: "Valor do Negócio", group: "Negócio" },
  { value: "deal.description", label: "Descrição do Negócio", group: "Negócio" },
  { value: "deal.responsible", label: "Responsável do Negócio", group: "Negócio" },
  { value: "client.name", label: "Nome do Cliente", group: "Cliente" },
  { value: "client.cpf_cnpj", label: "CPF/CNPJ do Cliente", group: "Cliente" },
  { value: "client.phone", label: "Telefone do Cliente", group: "Cliente" },
  { value: "client.email", label: "E-mail do Cliente", group: "Cliente" },
];

export function OmieFieldMapper({ fieldMappings, onChange }: OmieFieldMapperProps) {
  const { currentUser } = useCurrentUser();
  const [customFields, setCustomFields] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!currentUser?.account_id) return;
    supabase
      .from("custom_fields")
      .select("id, name")
      .eq("account_id", currentUser.account_id)
      .eq("show_in_deals", true)
      .eq("is_active", true)
      .then(({ data }) => {
        setCustomFields(data || []);
      });
  }, [currentUser?.account_id]);

  const handleSourceChange = (fieldKey: string, value: string) => {
    if (value.startsWith("custom:")) {
      const customFieldId = value.replace("custom:", "");
      onChange({
        ...fieldMappings,
        [fieldKey]: { source: "custom_field", customFieldId },
      });
    } else {
      onChange({
        ...fieldMappings,
        [fieldKey]: { source: value },
      });
    }
  };

  const getCurrentValue = (fieldKey: string) => {
    const mapping = fieldMappings[fieldKey];
    if (!mapping) return "";
    if (mapping.source === "custom_field" && mapping.customFieldId) {
      return `custom:${mapping.customFieldId}`;
    }
    return mapping.source;
  };

  const getSourceLabel = (fieldKey: string) => {
    const mapping = fieldMappings[fieldKey];
    if (!mapping?.source) return null;
    if (mapping.source === "custom_field") {
      const cf = customFields.find((f) => f.id === mapping.customFieldId);
      return cf?.name || "Campo personalizado";
    }
    return FIXED_SOURCES.find((s) => s.value === mapping.source)?.label;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Mapeamento de Campos da OS
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure de onde cada campo da Ordem de Serviço irá buscar os dados.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {OS_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="font-medium">{field.label}</Label>
              {getSourceLabel(field.key) && (
                <Badge variant="outline" className="text-xs">
                  {getSourceLabel(field.key)}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{field.description}</p>
            <Select
              value={getCurrentValue(field.key)}
              onValueChange={(val) => handleSourceChange(field.key, val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a origem dos dados..." />
              </SelectTrigger>
              <SelectContent>
                {/* Fixed sources grouped */}
                {["Negócio", "Cliente"].map((group) => (
                  <div key={group}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {group}
                    </div>
                    {FIXED_SOURCES.filter((s) => s.group === group).map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
                {/* Custom fields */}
                {customFields.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Campos Personalizados
                    </div>
                    {customFields.map((cf) => (
                      <SelectItem key={cf.id} value={`custom:${cf.id}`}>
                        {cf.name}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
