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
  recruiter_provider_id: z.string().nullable(),
  target_fill_date: z.date().nullable(),
  opening_reason: z.string(),
});

export default function RHJobForm() {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();
  const [jobId, setJobId] = useState<string | undefined>(routeId);
  const isEditing = !!jobId;
  const [currentStep, setCurrentStep] = useState(1);
  const { data: existingJob, isLoading } = useHRJobById(jobId);
  const createJob = useCreateHRJob();
  const updateJob = useUpdateHRJob();
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutosavingRef = useRef(false);
  const jobIdRef = useRef<string | undefined>(routeId);
  const hydratedRef = useRef(false);
  const resetForJobIdRef = useRef<string | null>(null);
  useEffect(() => { jobIdRef.current = jobId; }, [jobId]);

  const form = useForm<JobFormData>({ resolver: zodResolver(formSchema), defaultValues: DEFAULT_JOB_FORM_DATA });

  useEffect(() => {
    if (!existingJob || !jobId) return;
    // Reset somente UMA vez por jobId carregado — refetches subsequentes (causados pelo
    // próprio autosave) não devem sobrescrever o que o usuário está digitando.
    if (resetForJobIdRef.current === jobId) return;
    resetForJobIdRef.current = jobId;

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
      recruiter_provider_id: (existingJob as any).recruiter_provider_id || null,
      target_fill_date: (existingJob as any).target_fill_date ? new Date((existingJob as any).target_fill_date) : null,
      opening_reason: (existingJob as any).opening_reason || "",
    });
    hydratedRef.current = true;
  }, [existingJob, jobId, form]);

  const totalSteps = JOB_WIZARD_STEPS.length;

  const handleNext = async () => {
    let fields: (keyof JobFormData)[] = [];
    if (currentStep === 1) fields = ["title"];
    const isValid = await form.trigger(fields);
    if (isValid && currentStep < totalSteps) setCurrentStep(s => s + 1);
  };

  const buildPayload = useCallback((values: JobFormData, status?: "draft" | "active") => ({
    title: values.title || "Sem título",
    description: values.description || null,
    requirements: values.requirements || null,
    position: values.position || null,
    department: values.department || null,
    unit: values.unit || null,
    ...(status ? { status } : {}),
    work_model: values.work_model,
    contract_type: values.contract_type,
    seniority: values.seniority || null,
    openings_count: values.openings_count,
    description_tone: values.description_tone || null,
    description_context: values.description_context || null,
    required_skills: values.required_skills,
    desired_skills: values.desired_skills,
    experience_years: values.experience_years,
    education_level: values.education_level || null,
    languages: values.languages,
    salary_type: values.salary_type,
    salary_min: values.salary_min,
    salary_max: values.salary_max,
    benefits: values.benefits,
    application_deadline: values.application_deadline?.toISOString().split("T")[0] || null,
    expected_start_date: values.expected_start_date?.toISOString().split("T")[0] || null,
    urgency: values.urgency,
    require_cover_letter: values.require_cover_letter,
    tags: values.tags,
    hiring_manager_id: values.hiring_manager_id,
    recruiter_id: values.recruiter_id,
    recruiter_provider_id: values.recruiter_provider_id,
    target_fill_date: values.target_fill_date?.toISOString().split("T")[0] || null,
    opening_reason: values.opening_reason || null,
  }), []);

  // ─── Autosave silencioso ───
  const performAutosave = useCallback(async () => {
    if (!currentUser?.account_id) return;
    const values = form.getValues();
    if (!values.title?.trim()) return; // título obrigatório p/ persistir
    if (isAutosavingRef.current) return;
    isAutosavingRef.current = true;
    setSaveStatus("saving");
    try {
      const payload = buildPayload(values);
      const currentId = jobIdRef.current;
      if (!currentId) {
        const { data, error } = await supabase
          .from("hr_jobs")
          .insert({ ...payload, status: "draft", account_id: currentUser.account_id, created_by: currentUser.id } as any)
          .select("id")
          .single();
        if (error) throw error;
        const newId = (data as any).id as string;
        setJobId(newId);
        jobIdRef.current = newId;
        // Atualiza URL para /edit sem recarregar o componente
        window.history.replaceState(null, "", `/rh/vacancies/${newId}/edit`);
      } else {
        const { error } = await supabase.from("hr_jobs").update(payload as any).eq("id", currentId);
        if (error) throw error;
      }
      setLastSavedAt(new Date());
      setSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["hr-jobs"] });
      // NÃO invalidar ["hr-job", id] aqui — isso dispara refetch e form.reset, apagando o que o usuário está digitando.
    } catch (e) {
      console.error("[autosave]", e);
      setSaveStatus("error");
    } finally {
      isAutosavingRef.current = false;
    }
  }, [buildPayload, currentUser, form, queryClient]);

  // Debounce em mudanças do form
  useEffect(() => {
    const subscription = form.watch(() => {
      if (!hydratedRef.current) return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      setSaveStatus("saving");
      autosaveTimer.current = setTimeout(() => { performAutosave(); }, 1500);
    });
    return () => {
      subscription.unsubscribe();
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [form, performAutosave]);

  // Em modo CRIAÇÃO (sem routeId) o form já está pronto desde o início.
  useEffect(() => {
    if (!routeId) hydratedRef.current = true;
  }, [routeId]);

  // Flush ao desmontar
  useEffect(() => () => {
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); performAutosave(); }
  }, [performAutosave]);

  const submitJob = async (values: JobFormData, status: "draft" | "active") => {
    const jobData = buildPayload(values, status);
    try {
      if (jobIdRef.current) await updateJob.mutateAsync({ id: jobIdRef.current, ...jobData });
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
      case 5: return <JobStepProcess form={form} jobId={jobId} />;
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
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <AutosaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
          <span>Passo {currentStep} de {totalSteps}</span>
        </div>

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

function AutosaveIndicator({ status, lastSavedAt }: { status: "idle" | "saving" | "saved" | "error"; lastSavedAt: Date | null }) {
  if (status === "saving") return <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando…</span>;
  if (status === "error") return <span className="inline-flex items-center gap-1.5 text-red-600"><AlertCircle className="h-3.5 w-3.5" />Erro ao salvar</span>;
  if (status === "saved" && lastSavedAt) return <span className="inline-flex items-center gap-1.5 text-emerald-600"><Check className="h-3.5 w-3.5" />Salvo {formatDistanceToNow(lastSavedAt, { locale: ptBR, addSuffix: true })}</span>;
  return null;
}

