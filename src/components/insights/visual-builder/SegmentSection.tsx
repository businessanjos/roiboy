import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentBy } from "./types";
import { CatalogField, catalogFieldId, parseCatalogFieldId } from "@/lib/insights/fieldRegistry";

interface SegmentSectionProps {
  catalog: CatalogField[];
  value: SegmentBy | null;
  onChange: (value: SegmentBy | null) => void;
  /** Field currently used as "Ver por", excluded from the options */
  excludeKey?: string;
}

const NONE = '__none__';

export function SegmentSection({ catalog, value, onChange, excludeKey }: SegmentSectionProps) {
  const options = catalog.filter((f) => f.groupable && f.key !== excludeKey);

  return (
    <div className="space-y-2">
      <Label>Segmentar por (opcional)</Label>
      <Select
        value={value ? catalogFieldId({ ...(value as any), source: value.source, key: value.field } as CatalogField) : NONE}
        onValueChange={(id) => {
          if (id === NONE) {
            onChange(null);
            return;
          }
          const parsed = parseCatalogFieldId(id);
          if (!parsed) return;
          const field = catalog.find((f) => f.source === parsed.source && f.key === parsed.key);
          if (!field) return;
          onChange({ source: field.source, field: field.key, label: field.label });
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Sem segmentação" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={NONE}>Sem segmentação</SelectItem>
          {options.map((f) => (
            <SelectItem key={catalogFieldId(f)} value={catalogFieldId(f)}>
              {f.label}
              {f.source !== 'native' && (
                <span className="text-muted-foreground text-xs ml-1">
                  ({f.source === 'deal_custom' ? 'negócio' : 'lead'})
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Ao segmentar, gráficos de barra passam a empilhar com legenda colorida por valor.
      </p>
    </div>
  );
}
