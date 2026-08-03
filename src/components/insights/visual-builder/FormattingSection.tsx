import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { FormatType, FORMAT_TYPE_OPTIONS, Aggregation } from "./types";

interface FormattingSectionProps {
  value: FormatType;
  onChange: (value: FormatType) => void;
  /** Agregação atual — usada para avisar que formatação não muda a métrica */
  aggregation?: Aggregation;
  /** Atalho para trocar a medida para contagem */
  onUseCount?: () => void;
  /** Como o percentual é calculado quando o formato é Porcentagem */
  percentMode?: 'share' | 'raw';
  onPercentModeChange?: (mode: 'share' | 'raw') => void;
}

export function FormattingSection({ value, onChange, aggregation, onUseCount, percentMode = 'share', onPercentModeChange }: FormattingSectionProps) {
  const showCountHint = !!aggregation && aggregation !== 'count';


  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Formatação de Dados</Label>
      <p className="text-xs text-muted-foreground">
        Muda apenas como o número aparece. Para trocar o que é calculado, ajuste a Agregação na Medida.
      </p>

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

      {showCountHint && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Este visual está somando valores. Quer ver a <strong>quantidade</strong> por canal?
            </p>
            {onUseCount && (
              <Button type="button" size="sm" variant="outline" onClick={onUseCount}>
                Usar contagem de registros
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
