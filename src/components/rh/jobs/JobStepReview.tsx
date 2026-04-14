import { UseFormReturn } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WORK_MODEL_LABELS, CONTRACT_TYPE_LABELS, JOB_SENIORITY_LABELS, SALARY_TYPE_LABELS, JOB_URGENCY_LABELS, EDUCATION_LEVEL_LABELS, LANGUAGE_LEVEL_OPTIONS } from "@/constants/jobOptions";
import type { JobFormData } from "@/types/job";

interface Props { form: UseFormReturn<JobFormData>; }

export function JobStepReview({ form }: Props) {
  const v = form.getValues();

  const formatCurrency = (n: number | null) => n != null ? `R$ ${n.toLocaleString("pt-BR")}` : "—";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Revisão</h2>
        <p className="text-muted-foreground">Confira os dados antes de publicar</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">{v.title || "Sem título"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><p className="text-muted-foreground">Departamento</p><p className="font-medium">{v.department || "—"}</p></div>
            <div><p className="text-muted-foreground">Cargo</p><p className="font-medium">{v.position || "—"}</p></div>
            <div><p className="text-muted-foreground">Localização</p><p className="font-medium">{v.unit || "—"}</p></div>
            <div><p className="text-muted-foreground">Modelo</p><p className="font-medium">{WORK_MODEL_LABELS[v.work_model]}</p></div>
            <div><p className="text-muted-foreground">Contrato</p><p className="font-medium">{CONTRACT_TYPE_LABELS[v.contract_type]}</p></div>
            <div><p className="text-muted-foreground">Senioridade</p><p className="font-medium">{v.seniority ? JOB_SENIORITY_LABELS[v.seniority as keyof typeof JOB_SENIORITY_LABELS] : "—"}</p></div>
            <div><p className="text-muted-foreground">Vagas</p><p className="font-medium">{v.openings_count}</p></div>
            <div><p className="text-muted-foreground">Urgência</p><p className="font-medium">{JOB_URGENCY_LABELS[v.urgency]}</p></div>
            <div><p className="text-muted-foreground">Salário</p><p className="font-medium">
              {v.salary_type === "fixed" ? formatCurrency(v.salary_min) :
               v.salary_type === "range" ? `${formatCurrency(v.salary_min)} - ${formatCurrency(v.salary_max)}` :
               SALARY_TYPE_LABELS[v.salary_type]}
            </p></div>
          </div>

          {v.required_skills.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Skills obrigatórias</p>
                <div className="flex flex-wrap gap-1">{v.required_skills.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
              </div>
            </>
          )}

          {v.benefits.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Benefícios</p>
                <div className="flex flex-wrap gap-1">{v.benefits.map(b => <Badge key={b} variant="outline">{b}</Badge>)}</div>
              </div>
            </>
          )}

          {v.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Tags</p>
                <div className="flex flex-wrap gap-1">{v.tags.map(t => <Badge key={t}>{t}</Badge>)}</div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
