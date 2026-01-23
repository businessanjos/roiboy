import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FormatType, FORMAT_TYPE_OPTIONS } from "./types";

interface FormattingSectionProps {
  value: FormatType;
  onChange: (value: FormatType) => void;
}

export function FormattingSection({ value, onChange }: FormattingSectionProps) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Formatação de Dados</Label>
      
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as FormatType)}
        className="space-y-2"
      >
        {FORMAT_TYPE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <RadioGroupItem value={option.value} />
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground w-8">
                {option.symbol}
              </span>
              <span className="text-sm">{option.label}</span>
            </div>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
