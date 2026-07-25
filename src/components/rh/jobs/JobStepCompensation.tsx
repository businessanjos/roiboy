import { useEffect, useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, AlertTriangle, Star, Gift, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { SALARY_TYPE_LABELS, JOB_BENEFITS } from "@/constants/jobOptions";
import type { JobFormData, SalaryType } from "@/types/job";
import { isMarketCompatibleClaim, MARKET_COMPATIBLE_LABEL } from "@/lib/marketSalaryClaim";
import { useToast } from "@/hooks/use-toast";
import { useHRCompanyBenefits } from "@/hooks/useHRCompanyBenefits";

interface Props { form: UseFormReturn<JobFormData>; isEditing?: boolean; }

export function JobStepCompensation({ form, isEditing }: Props) {
  const { toast } = useToast();
  const salaryType = form.watch("salary_type");
  const salaryMin = form.watch("salary_min");
  const salaryMax = form.watch("salary_max");
  const contractType = form.watch("contract_type");
  const selectedBenefits = form.watch("benefits") ?? [];
  const { activeBenefits } = useHRCompanyBenefits();

  // Benefícios oficiais da empresa, filtrados pela elegibilidade do contrato da vaga.
  const companyBenefits = useMemo(
    () =>
      activeBenefits
        .filter((b) => !b.contract_types?.length || b.contract_types.includes(contractType))
        .sort((a, b) => Number(b.is_highlight) - Number(a.is_highlight)),
    [activeBenefits, contractType],
  );

  const companyNames = useMemo(() => companyBenefits.map((b) => b.name), [companyBenefits]);
  const defaultNames = useMemo(
    () => companyBenefits.filter((b) => b.include_in_jobs_by_default).map((b) => b.name),
    [companyBenefits],
  );

  // Em vagas novas, pré-seleciona os benefícios padrão da empresa uma única vez.
  useEffect(() => {
    if (isEditing || defaultNames.length === 0) return;
    const current = form.getValues("benefits") ?? [];
    const missing = defaultNames.filter((n) => !current.includes(n));
    if (missing.length === 0) return;
    form.setValue("benefits", [...current, ...missing]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultNames.join("|"), isEditing]);

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

  const applyCompanyDefaults = () => {
    const current = form.getValues("benefits") ?? [];
    form.setValue("benefits", [...new Set([...current, ...defaultNames])]);
  };

  // Extras genéricos: só mostra o que não estiver no catálogo da empresa.
  const extraOptions = useMemo(
    () => JOB_BENEFITS.filter((b) => !companyNames.some((n) => n.toLowerCase() === b.toLowerCase())),
    [companyNames],
  );

  const renderBadge = (label: string, opts?: { highlight?: boolean; disabled?: boolean; title?: string }) => (
    <Badge
      key={label}
      variant={selectedBenefits.includes(label) ? "default" : "outline"}
      className={`cursor-pointer ${opts?.disabled ? "opacity-50" : ""}`}
      onClick={() => toggleBenefit(label)}
      title={opts?.title}
    >
      {opts?.highlight && <Star className="h-3 w-3 mr-1" />}
      {label}
      {selectedBenefits.includes(label) && <X className="h-3 w-3 ml-1" />}
    </Badge>
  );

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

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FormLabel className="flex items-center gap-1.5">
                <Gift className="h-4 w-4" /> Benefícios da empresa
              </FormLabel>
              <div className="flex items-center gap-2">
                {defaultNames.length > 0 && (
                  <Button type="button" variant="outline" size="sm" className="h-7" onClick={applyCompanyDefaults}>
                    Aplicar padrão da empresa
                  </Button>
                )}
                <Button asChild type="button" variant="ghost" size="sm" className="h-7">
                  <Link to="/rh/benefits" target="_blank">
                    Gerenciar <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>

            {companyBenefits.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum benefício cadastrado no catálogo para este tipo de contrato.{" "}
                <Link to="/rh/benefits" target="_blank" className="underline">Cadastrar benefícios</Link>.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {companyBenefits.map((b) =>
                  renderBadge(b.name, {
                    highlight: b.is_highlight,
                    title: b.description || b.provider || undefined,
                  }),
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <FormLabel className="text-muted-foreground">Outros diferenciais</FormLabel>
            <div className="flex flex-wrap gap-2">
              {extraOptions.map((b) => {
                const isMarketClaim = isMarketCompatibleClaim(b);
                const disabled = isMarketClaim && !salaryPublished && !selectedBenefits.includes(b);
                return renderBadge(b, {
                  disabled,
                  title: disabled ? "Publique uma faixa salarial para marcar este diferencial." : undefined,
                });
              })}
            </div>
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
