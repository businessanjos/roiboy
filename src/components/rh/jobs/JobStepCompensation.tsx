import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { SALARY_TYPE_LABELS, JOB_BENEFITS } from "@/constants/jobOptions";
import type { JobFormData, SalaryType } from "@/types/job";

interface Props { form: UseFormReturn<JobFormData>; }

export function JobStepCompensation({ form }: Props) {
  const salaryType = form.watch("salary_type");
  const selectedBenefits = form.watch("benefits");

  const toggleBenefit = (b: string) => {
    const current = form.getValues("benefits");
    form.setValue("benefits", current.includes(b) ? current.filter(x => x !== b) : [...current, b]);
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
            {JOB_BENEFITS.map(b => (
              <Badge
                key={b}
                variant={selectedBenefits.includes(b) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleBenefit(b)}
              >
                {b}
                {selectedBenefits.includes(b) && <X className="h-3 w-3 ml-1" />}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
