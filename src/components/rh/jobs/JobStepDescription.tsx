import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import type { JobFormData } from "@/types/job";

interface Props { form: UseFormReturn<JobFormData>; }

export function JobStepDescription({ form }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Descrição da Vaga</h2>
        <p className="text-muted-foreground">Escreva a descrição completa da vaga (suporta Markdown)</p>
      </div>
      <FormField control={form.control} name="description" render={({ field }) => (
        <FormItem>
          <FormLabel>Descrição *</FormLabel>
          <FormControl>
            <Textarea placeholder="Descreva a vaga em detalhes..." rows={16} className="font-mono text-sm" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  );
}
