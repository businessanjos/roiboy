import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WORK_MODEL_LABELS, CONTRACT_TYPE_LABELS, JOB_SENIORITY_LABELS } from "@/constants/jobOptions";
import type { JobFormData, WorkModel, JobContractType, JobSeniority } from "@/types/job";
import { OPENING_REASON_LABELS } from "@/types/job";
import { useHRCollaborators } from "@/hooks/useHRCollaborators";
import { useAccountUsersForJobs } from "@/hooks/useHRJobStages";
import { PersonSelector } from "@/components/rh/jobs/PersonSelector";
import { useMemo } from "react";

interface Props { form: UseFormReturn<JobFormData>; }

export function JobStepBasicInfo({ form }: Props) {
  const { collaborators } = useHRCollaborators();
  const { data: users } = useAccountUsersForJobs();

  const departments = useMemo(() => {
    const set = new Set<string>();
    collaborators.forEach(c => { if (c.department) set.add(c.department); });
    return Array.from(set).sort();
  }, [collaborators]);

  const positions = useMemo(() => {
    const set = new Set<string>();
    collaborators.forEach(c => { if (c.position) set.add(c.position); });
    return Array.from(set).sort();
  }, [collaborators]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Informações Básicas</h2>
        <p className="text-muted-foreground">Preencha os dados principais da vaga</p>
      </div>
      <div className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem>
              <FormLabel>Título da Vaga *</FormLabel>
              <FormControl><Input placeholder="Ex: Desenvolvedor Frontend Pleno" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="openings_count" render={({ field }) => (
            <FormItem>
              <FormLabel>Número de Vagas *</FormLabel>
              <FormControl><Input type="number" min={1} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="position" render={({ field }) => (
            <FormItem>
              <FormLabel>Cargo</FormLabel>
              <Select value={field.value || "_none"} onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione ou digite" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="_none">Nenhum</SelectItem>
                  {positions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem>
              <FormLabel>Departamento</FormLabel>
              <Select value={field.value || "_none"} onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione o departamento" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="_none">Nenhum</SelectItem>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="work_model" render={({ field }) => (
            <FormItem>
              <FormLabel>Modelo de Trabalho *</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {(Object.entries(WORK_MODEL_LABELS) as [WorkModel, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="unit" render={({ field }) => (
            <FormItem>
              <FormLabel>Localização</FormLabel>
              <FormControl><Input placeholder="Ex: São Paulo - SP" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="contract_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Contrato *</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {(Object.entries(CONTRACT_TYPE_LABELS) as [JobContractType, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="seniority" render={({ field }) => (
            <FormItem>
              <FormLabel>Senioridade</FormLabel>
              <Select value={field.value || "_none"} onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="_none">Não especificado</SelectItem>
                  {(Object.entries(JOB_SENIORITY_LABELS) as [JobSeniority, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Gestão da vaga */}
        <div className="border-t pt-6 space-y-4">
          <h3 className="font-semibold">Gestão da vaga</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="hiring_manager_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Gestor responsável</FormLabel>
                <Select value={field.value || "_none"} onValueChange={(v) => field.onChange(v === "_none" ? null : v)}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Quem aprova candidatos" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {(users || []).map(u => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="recruiter_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Recrutador (RH)</FormLabel>
                <Select value={field.value || "_none"} onValueChange={(v) => field.onChange(v === "_none" ? null : v)}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Quem toca o processo" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {(users || []).map(u => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="target_fill_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Prazo ideal para fechar a vaga</FormLabel>
                <FormControl>
                  <Input type="date" value={field.value ? field.value.toISOString().split("T")[0] : ""}
                    onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : null)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="opening_reason" render={({ field }) => (
              <FormItem>
                <FormLabel>Motivo da abertura</FormLabel>
                <Select value={field.value || "_none"} onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {Object.entries(OPENING_REASON_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>
      </div>
    </div>
  );
}
