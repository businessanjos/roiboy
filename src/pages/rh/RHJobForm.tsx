import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Save, Send, ArrowLeft, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { JobWizardSteps } from "@/components/rh/jobs/JobWizardSteps";
import { JobStepBasicInfo } from "@/components/rh/jobs/JobStepBasicInfo";
import { JobStepRequirements } from "@/components/rh/jobs/JobStepRequirements";
import { JobStepCompensation } from "@/components/rh/jobs/JobStepCompensation";
import { JobStepDescription } from "@/components/rh/jobs/JobStepDescription";
import { JobStepProcess } from "@/components/rh/jobs/JobStepProcess";
import { JobStepReview } from "@/components/rh/jobs/JobStepReview";
import { useCreateHRJob, useUpdateHRJob, useHRJobById } from "@/hooks/useHRJobs";
import { JOB_WIZARD_STEPS } from "@/constants/jobOptions";
import { DEFAULT_JOB_FORM_DATA, type JobFormData, type JobSeniority, type EducationLevel } from "@/types/job";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";


const formSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  department: z.string(), unit: z.string(),
  work_model: z.enum(["remote", "hybrid", "onsite"]),
  contract_type: z.enum(["clt", "pj", "internship", "temporary", "freelancer"]),
  seniority: z.string(), openings_count: z.number().min(1), position: z.string(),
  description_tone: z.string(), description_context: z.string(), description: z.string(),
  required_skills: z.array(z.string()), desired_skills: z.array(z.string()),
  experience_years: z.number().nullable(), education_level: z.string(),
  languages: z.array(z.object({ language: z.string(), level: z.string() })),
  requirements: z.string(),
  salary_type: z.enum(["not_disclosed", "negotiable", "fixed", "range"]),
  salary_min: z.number().nullable(), salary_max: z.number().nullable(),
  benefits: z.array(z.string()),
  application_deadline: z.date().nullable(), expected_start_date: z.date().nullable(),
  urgency: z.enum(["low", "medium", "high", "urgent"]),
  require_cover_letter: z.boolean(), tags: z.array(z.string()),
  status: z.enum(["active", "closed", "draft", "on_hold"]),
  hiring_manager_id: z.string().nullable(),
  recruiter_id: z.string().nullable(),
  target_fill_date: z.date().nullable(),
  opening_reason: z.string(),
});

export default function RHJobForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const [currentStep, setCurrentStep] = useState(1);
  const { data: existingJob, isLoading } = useHRJobById(id);
  const createJob = useCreateHRJob();
  const updateJob = useUpdateHRJob();

  const form = useForm<JobFormData>({ resolver: zodResolver(formSchema), defaultValues: DEFAULT_JOB_FORM_DATA });

  useEffect(() => {
    if (existingJob && isEditing) {
      form.reset({
        title: existingJob.title || "", department: existingJob.department || "", unit: existingJob.unit || "",
        work_model: (existingJob.work_model as any) || "onsite", contract_type: (existingJob.contract_type as any) || "clt",
        seniority: (existingJob.seniority as JobSeniority) || "", openings_count: existingJob.openings_count || 1, position: existingJob.position || "",
        description_tone: (existingJob.description_tone as any) || "", description_context: existingJob.description_context || "",
        description: existingJob.description || "", required_skills: existingJob.required_skills || [],
        desired_skills: existingJob.desired_skills || [], experience_years: existingJob.experience_years,
        education_level: (existingJob.education_level as EducationLevel) || "", languages: existingJob.languages || [],
        requirements: existingJob.requirements || "", salary_type: (existingJob.salary_type as any) || "not_disclosed",
        salary_min: existingJob.salary_min, salary_max: existingJob.salary_max, benefits: existingJob.benefits || [],
        application_deadline: existingJob.application_deadline ? new Date(existingJob.application_deadline) : null,
        expected_start_date: existingJob.expected_start_date ? new Date(existingJob.expected_start_date) : null,
        urgency: (existingJob.urgency as any) || "medium", require_cover_letter: existingJob.require_cover_letter || false,
        tags: existingJob.tags || [], status: existingJob.status || "draft",
        hiring_manager_id: (existingJob as any).hiring_manager_id || null,
        recruiter_id: (existingJob as any).recruiter_id || null,
        target_fill_date: (existingJob as any).target_fill_date ? new Date((existingJob as any).target_fill_date) : null,
        opening_reason: (existingJob as any).opening_reason || "",
      });
    }
  }, [existingJob, isEditing, form]);

  const totalSteps = JOB_WIZARD_STEPS.length;

  const handleNext = async () => {
    let fields: (keyof JobFormData)[] = [];
    if (currentStep === 1) fields = ["title"];
    const isValid = await form.trigger(fields);
    if (isValid && currentStep < totalSteps) setCurrentStep(s => s + 1);
  };

  const submitJob = async (values: JobFormData, status: "draft" | "active") => {
    const jobData: any = {
      title: values.title, description: values.description || null, requirements: values.requirements || null,
      position: values.position || null, department: values.department || null, unit: values.unit || null,
      status, work_model: values.work_model, contract_type: values.contract_type, seniority: values.seniority || null,
      openings_count: values.openings_count, description_tone: values.description_tone || null,
      required_skills: values.required_skills, desired_skills: values.desired_skills, experience_years: values.experience_years,
      education_level: values.education_level || null, languages: values.languages, salary_type: values.salary_type,
      salary_min: values.salary_min, salary_max: values.salary_max, benefits: values.benefits,
      application_deadline: values.application_deadline?.toISOString().split("T")[0] || null,
      expected_start_date: values.expected_start_date?.toISOString().split("T")[0] || null,
      urgency: values.urgency, require_cover_letter: values.require_cover_letter, tags: values.tags,
      hiring_manager_id: values.hiring_manager_id,
      recruiter_id: values.recruiter_id,
      target_fill_date: values.target_fill_date?.toISOString().split("T")[0] || null,
      opening_reason: values.opening_reason || null,
    };
    try {
      if (isEditing && id) await updateJob.mutateAsync({ id, ...jobData });
      else await createJob.mutateAsync(jobData);
      navigate("/rh/vacancies");
    } catch (e) { console.error(e); }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <JobStepBasicInfo form={form} />;
      case 2: return <JobStepRequirements form={form} />;
      case 3: return <JobStepCompensation form={form} />;
      case 4: return <JobStepDescription form={form} />;
      case 5: return <JobStepProcess form={form} jobId={id} />;
      case 6: return <JobStepReview form={form} />;
      default: return null;
    }
  };

  const isPending = createJob.isPending || updateJob.isPending;

  if (isEditing && isLoading) return <div className="flex items-center justify-center h-64 p-6"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/rh/vacancies")}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{isEditing ? "Editar Vaga" : "Criar Nova Vaga"}</h1>
            <p className="text-muted-foreground">{JOB_WIZARD_STEPS[currentStep - 1]?.description}</p>
          </div>
        </div>
        <span className="text-sm text-muted-foreground">Passo {currentStep} de {totalSteps}</span>
      </div>

      <JobWizardSteps currentStep={currentStep} onStepClick={s => { if (s <= currentStep) setCurrentStep(s); }}
        completedSteps={Array.from({ length: currentStep - 1 }, (_, i) => i + 1)} />

      <Form {...form}>
        <form onSubmit={e => e.preventDefault()}>
          <Card><CardContent className="pt-6">{renderStep()}</CardContent></Card>
          <div className="flex items-center justify-between mt-6">
            <Button type="button" variant="outline" onClick={() => navigate("/rh/vacancies")}>Cancelar</Button>
            <div className="flex items-center gap-2">
              {currentStep > 1 && <Button type="button" variant="outline" onClick={() => setCurrentStep(s => s - 1)}><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Button>}
              {currentStep === totalSteps ? (
                <>
                  <Button type="button" variant="outline" onClick={() => submitJob(form.getValues(), "draft")} disabled={isPending}><Save className="h-4 w-4 mr-2" />Salvar Rascunho</Button>
                  <Button type="button" onClick={async () => { const ok = await form.trigger(); if (ok) submitJob(form.getValues(), "active"); }} disabled={isPending}><Send className="h-4 w-4 mr-2" />Publicar</Button>
                </>
              ) : (
                <Button type="button" onClick={handleNext}>Próximo<ChevronRight className="h-4 w-4 ml-1" /></Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
