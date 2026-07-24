import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, AlertTriangle } from "lucide-react";
import { SALARY_TYPE_LABELS, JOB_BENEFITS } from "@/constants/jobOptions";
import type { JobFormData, SalaryType } from "@/types/job";
import { isMarketCompatibleClaim, MARKET_COMPATIBLE_LABEL } from "@/lib/marketSalaryClaim";
import { useToast } from "@/hooks/use-toast";

interface Props { form: UseFormReturn<JobFormData>; }

export function JobStepCompensation({ form }: Props) {
  const { toast } = useToast();
  const salaryType = form.watch("salary_type");
  const salaryMin = form.watch("salary_min");
  const salaryMax = form.watch("salary_max");
  const selectedBenefits = form.watch("benefits") ?? [];

  // "Salário compatível com o mercado" só faz sentido se existir faixa salarial publicada.
  const salaryPublished =
    (salaryType === "fixed" || salaryType === "range") && (salaryMin != null || salaryMax != null);

  const marketClaimSelected = selectedBenefits.some(isMarketCompatibleClaim);

  const toggleBenefit = (b: string) => {
    const current = form.getValues("benefits") ?? [];
    const enabling = !current.includes(b);

    if (enabling && isMarketCompatibleClaim(b) && !salaryPublished) {
      toast({
        variant: "destructive",
        title: "Não é possível marcar este diferencial",
        description:
          'Para declarar "Salário compatível com o mercado" você precisa publicar uma faixa salarial (fixa ou intervalo). Caso contrário, o benchmark de mercado não consegue validar.',
      });
      return;
    }

    form.setValue("benefits", current.includes(b) ? current.filter((x) => x !== b) : [...current, b]);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Remuneração</h2>
        <p className="text-muted-foreground">Salário e benefícios oferecidos</p>
      </div>
      <div className="grid gap-6">
        <FormField control={form.control} name="salary_type" render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo de Remuneração</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {(Object.entries(SALARY_TYPE_LABELS) as [SalaryType, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        {(salaryType === "fixed" || salaryType === "range") && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="salary_min" render={({ field }) => (
              <FormItem>
                <FormLabel>{salaryType === "fixed" ? "Valor" : "Mínimo"} (R$)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {salaryType === "range" && (
              <FormField control={form.control} name="salary_max" render={({ field }) => (
                <FormItem>
                  <FormLabel>Máximo (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
          </div>
        )}

        <div className="space-y-2">
          <FormLabel>Benefícios</FormLabel>
          <div className="flex flex-wrap gap-2">
            {JOB_BENEFITS.map(b => {
              const isMarketClaim = isMarketCompatibleClaim(b);
              const disabled = isMarketClaim && !salaryPublished && !selectedBenefits.includes(b);
              return (
                <Badge
                  key={b}
                  variant={selectedBenefits.includes(b) ? "default" : "outline"}
                  className={`cursor-pointer ${disabled ? "opacity-50" : ""}`}
                  onClick={() => toggleBenefit(b)}
                  title={disabled ? "Publique uma faixa salarial para marcar este diferencial." : undefined}
                >
                  {b}
                  {selectedBenefits.includes(b) && <X className="h-3 w-3 ml-1" />}
                </Badge>
              );
            })}
          </div>
          {marketClaimSelected && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-900 leading-snug">
                Você marcou <strong>"{MARKET_COMPATIBLE_LABEL}"</strong>. Assim que a vaga for criada, o benchmark
                automático verifica se o salário informado bate com o mercado. Se ficar <strong>abaixo do P50</strong>,
                este diferencial é ocultado na página pública até você ajustar o salário ou remover o item.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
