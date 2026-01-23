import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DataSource, DATA_SOURCE_OPTIONS } from "./types";

interface DataSourceSelectProps {
  value: DataSource | null;
  onChange: (value: DataSource) => void;
}

export function DataSourceSelect({ value, onChange }: DataSourceSelectProps) {
  return (
    <div className="space-y-2">
      <Label>Fonte de Dados</Label>
      <Select value={value || undefined} onValueChange={(v) => onChange(v as DataSource)}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione a tabela" />
        </SelectTrigger>
        <SelectContent>
          {DATA_SOURCE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
