import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { JOB_URGENCY_LABELS, JOB_TAGS } from "@/constants/jobOptions";
import type { JobFormData, JobUrgency } from "@/types/job";

interface Props { form: UseFormReturn<JobFormData>; }

export function JobStepProcess({ form }: Props) {
  const selectedTags = form.watch("tags");
  const toggleTag = (t: string) => {
    const current = form.getValues("tags");
    form.setValue("tags", current.includes(t) ? current.filter(x => x !== t) : [...current, t]);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Processo Seletivo</h2>
        <p className="text-muted-foreground">Configure datas e preferências do processo</p>
      </div>
      <div className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="application_deadline" render={({ field }) => (
            <FormItem>
              <FormLabel>Prazo para Candidatura</FormLabel>
              <FormControl>
                <Input type="date" value={field.value ? field.value.toISOString().split("T")[0] : ""}
                  onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : null)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="expected_start_date" render={({ field }) => (
            <FormItem>
              <FormLabel>Data Prevista de Início</FormLabel>
              <FormControl>
                <Input type="date" value={field.value ? field.value.toISOString().split("T")[0] : ""}
                  onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : null)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="urgency" render={({ field }) => (
          <FormItem>
            <FormLabel>Urgência</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {(Object.entries(JOB_URGENCY_LABELS) as [JobUrgency, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="require_cover_letter" render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <FormLabel>Exigir Carta de Apresentação</FormLabel>
              <p className="text-sm text-muted-foreground">Candidatos precisarão enviar carta de apresentação</p>
            </div>
            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
          </FormItem>
        )} />

        <div className="space-y-2">
          <FormLabel>Tags</FormLabel>
          <div className="flex flex-wrap gap-2">
            {JOB_TAGS.map(t => (
              <Badge key={t} variant={selectedTags.includes(t) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleTag(t)}>
                {t}{selectedTags.includes(t) && <X className="h-3 w-3 ml-1" />}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
