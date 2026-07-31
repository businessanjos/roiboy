import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DataSource, DateGrouping, DATA_SOURCE_FIELDS, DATE_GROUPING_OPTIONS } from "./types";
import { CatalogField } from "@/lib/insights/fieldRegistry";

interface DimensionSectionProps {
  dataSource: DataSource | null;
  field: string | null;
  dateGrouping: DateGrouping;
  onFieldChange: (field: string) => void;
  onDateGroupingChange: (grouping: DateGrouping) => void;
  /** Full field catalog (native + custom) — enables custom fields as dimension */
  catalog?: CatalogField[];
}

export function DimensionSection({
  dataSource,
  field,
  dateGrouping,
  onFieldChange,
  onDateGroupingChange,
  catalog,
}: DimensionSectionProps) {
  const nativeFields = dataSource ? DATA_SOURCE_FIELDS[dataSource].dimension : [];
  const customFields = (catalog || [])
    .filter((f) => f.source !== 'native' && f.groupable)
    .map((f) => ({
      value: `${f.source}::${f.key}`,
      label: f.label,
      type: f.type === 'date' ? 'date' : 'text',
      badge: f.source === 'deal_custom' ? 'negócio' : 'lead',
    }));
  const dimensionFields = [
    ...nativeFields.map((f) => ({ ...f, badge: undefined as string | undefined })),
    ...customFields,
  ];
  const selectedField = dimensionFields.find((f) => f.value === field);
  const isDateField = selectedField?.type === 'date';


  return (
    <div className="space-y-4">
      <Label className="text-base font-medium">Dimensão (Eixo X)</Label>
      
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Campo</Label>
        <Select
          value={field || undefined}
          onValueChange={onFieldChange}
          disabled={!dataSource}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o agrupamento" />
          </SelectTrigger>
          <SelectContent>
            {dimensionFields.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isDateField && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Agrupar por</Label>
          <Select
            value={dateGrouping}
            onValueChange={(v) => onDateGroupingChange(v as DateGrouping)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_GROUPING_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
