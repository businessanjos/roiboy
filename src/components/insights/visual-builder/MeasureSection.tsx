import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Aggregation, DataSource, DATA_SOURCE_FIELDS, AGGREGATION_OPTIONS } from "./types";
import { CatalogField } from "@/lib/insights/fieldRegistry";

interface MeasureSectionProps {
  dataSource: DataSource | null;
  field: string | null;
  aggregation: Aggregation;
  onFieldChange: (field: string) => void;
  onAggregationChange: (aggregation: Aggregation) => void;
  /** Full field catalog (native + custom) — enables numeric custom fields as measure */
  catalog?: CatalogField[];
}

export function MeasureSection({
  dataSource,
  field,
  aggregation,
  onFieldChange,
  onAggregationChange,
  catalog,
}: MeasureSectionProps) {
  const nativeNumeric = dataSource ? DATA_SOURCE_FIELDS[dataSource].numeric : [];
  const customNumeric = (catalog || [])
    .filter((f) => f.source !== 'native' && f.type === 'number')
    .map((f) => ({
      value: `${f.source}::${f.key}`,
      label: f.label,
      badge: f.source === 'deal_custom' ? 'negócio' : 'lead',
    }));
  const numericFields = [
    ...nativeNumeric.map((f) => ({ value: f.value, label: f.label, badge: undefined as string | undefined })),
    ...customNumeric,
  ];
  const hasNumericFields = numericFields.length > 0;

  // If no numeric fields, only count is available
  const availableAggregations = hasNumericFields
    ? AGGREGATION_OPTIONS
    : AGGREGATION_OPTIONS.filter((opt) => opt.value === 'count');


  return (
    <div className="space-y-4">
      <Label className="text-base font-medium">Medida (Eixo Y)</Label>
      
      {hasNumericFields && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Campo</Label>
          <Select
            value={field || undefined}
            onValueChange={onFieldChange}
            disabled={!dataSource}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o campo" />
            </SelectTrigger>
            <SelectContent>
              {numericFields.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                  {option.badge && (
                    <span className="ml-1 text-xs text-muted-foreground">({option.badge})</span>
                  )}
                </SelectItem>
              ))}

            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Agregação</Label>
        <Select
          value={aggregation}
          onValueChange={(v) => onAggregationChange(v as Aggregation)}
          disabled={!dataSource}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableAggregations.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hasNumericFields && dataSource && (
        <p className="text-xs text-muted-foreground">
          Esta tabela não possui campos numéricos. Apenas contagem está disponível.
        </p>
      )}
    </div>
  );
}
