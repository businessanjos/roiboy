import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Aggregation, DataSource, DATA_SOURCE_FIELDS, AGGREGATION_OPTIONS } from "./types";

interface MeasureSectionProps {
  dataSource: DataSource | null;
  field: string | null;
  aggregation: Aggregation;
  onFieldChange: (field: string) => void;
  onAggregationChange: (aggregation: Aggregation) => void;
}

export function MeasureSection({
  dataSource,
  field,
  aggregation,
  onFieldChange,
  onAggregationChange,
}: MeasureSectionProps) {
  const numericFields = dataSource ? DATA_SOURCE_FIELDS[dataSource].numeric : [];
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
