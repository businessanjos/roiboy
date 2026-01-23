import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Info, AlertCircle, CheckCircle2 } from "lucide-react";
import { validateFormula } from "@/lib/formula-evaluator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

interface FormulaSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export function FormulaSection({ value, onChange }: FormulaSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; error?: string }>({ valid: true });

  useEffect(() => {
    if (value) {
      const result = validateFormula(value);
      setValidation(result);
    } else {
      setValidation({ valid: true });
    }
  }, [value]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
            <div className="flex items-center gap-2">
              <Label className="text-base font-medium cursor-pointer">Fórmula Customizada</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[280px]">
                    <div className="space-y-2 text-xs">
                      <p><strong>Opcional:</strong> Transforme os valores agregados.</p>
                      <p><strong>Use:</strong> {"{{value}}"} para referenciar o valor.</p>
                      <p><strong>Exemplos:</strong></p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>{"{{value}} * 0.1"} → 10% do valor</li>
                        <li>{"{{value}} / 1000"} → Converter para milhares</li>
                        <li>{"sqrt({{value}})"} → Raiz quadrada</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-2">
          <div className="relative">
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Ex: {{value}} * 0.1"
              className={`pr-8 ${!validation.valid ? 'border-destructive' : ''}`}
            />
            {value && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {validation.valid ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
              </div>
            )}
          </div>
          {!validation.valid && validation.error && (
            <p className="text-xs text-destructive">{validation.error}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Operadores: +, -, *, /, ^, () | Funções: sqrt(), abs(), round()
          </p>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
