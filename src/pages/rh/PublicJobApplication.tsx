import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Briefcase, MapPin, Clock, Building, Users, GraduationCap,
  Upload, CheckCircle2, Loader2, FileText, AlertCircle
} from "lucide-react";
import { WORK_MODEL_LABELS, CONTRACT_TYPE_LABELS, JOB_SENIORITY_LABELS } from "@/constants/jobOptions";
import type { HRJob, WorkModel, JobContractType, JobSeniority } from "@/types/job";
import { motion, AnimatePresence } from "framer-motion";

interface ApplicationFormData {
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  candidate_city: string;
  candidate_state: string;
  desired_position: string;
  desired_seniority: string;
  cover_letter: string;
  candidate_pcd: boolean;
  candidate_pcd_type: string;
}

const INITIAL_FORM: ApplicationFormData = {
  candidate_name: "",
  candidate_email: "",
  candidate_phone: "",
  candidate_city: "",
  candidate_state: "",
  desired_position: "",
  desired_seniority: "",
  cover_letter: "",
  candidate_pcd: false,
  candidate_pcd_type: "",
};

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

export default function PublicJobApplication() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [job, setJob] = useState<HRJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<ApplicationFormData>(INITIAL_FORM);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadJob();
  }, [id]);

  async function loadJob() {
    setLoading(true);
    const { data, error } = await supabase
      .from("hr_jobs")
      .select("*")
      .eq("id", id!)
      .eq("status", "active")
      .single();

    if (error || !data) {
      setError("Vaga não encontrada ou não está mais disponível.");
    } else {
      setJob(data as unknown as HRJob);
    }
    setLoading(false);
  }

  function updateField<K extends keyof ApplicationFormData>(key: K, value: ApplicationFormData[K]) {
    setFormData(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job) return;

    if (!formData.candidate_name || !formData.candidate_email) {
      toast({ title: "Preencha os campos obrigatórios", description: "Nome e e-mail são obrigatórios.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      let resume_url: string | null = null;

      if (resumeFile) {
        const ext = resumeFile.name.split(".").pop();
        const safeName = formData.candidate_name.replace(/[^a-zA-Z0-9_-]+/g, "_");
        const path = `${job.id}/${Date.now()}_${safeName}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("hr-resumes")
          .upload(path, resumeFile);

        if (uploadError) throw uploadError;

        // Bucket is private — store the storage path; viewer generates signed URL on demand.
        resume_url = path;
      }

      const { error: insertError } = await supabase
        .from("hr_job_applications")
        .insert({
          job_id: job.id,
          account_id: job.account_id,
          candidate_name: formData.candidate_name,
          candidate_email: formData.candidate_email,
          candidate_phone: formData.candidate_phone || null,
          candidate_city: formData.candidate_city || null,
          candidate_state: formData.candidate_state || null,
          desired_position: formData.desired_position || null,
          desired_seniority: formData.desired_seniority || null,
          cover_letter: formData.cover_letter || null,
          candidate_pcd: formData.candidate_pcd,
          candidate_pcd_type: formData.candidate_pcd ? formData.candidate_pcd_type : null,
          resume_url,
          stage: "applied",
          status: "active",
        });

      if (insertError) throw insertError;

      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Erro ao enviar candidatura", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">{error || "Vaga não encontrada"}</h2>
            <p className="text-muted-foreground">Esta vaga pode ter sido encerrada ou o link está incorreto.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4 }}>
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
              <h2 className="text-2xl font-bold">Candidatura Enviada!</h2>
              <p className="text-muted-foreground">
                Obrigado pelo seu interesse na vaga <strong>{job.title}</strong>. 
                Analisaremos seu perfil e entraremos em contato em breve.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Job Header */}
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <Card>
            <CardHeader>
              <div className="space-y-3">
                <CardTitle className="text-2xl md:text-3xl">{job.title}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {job.work_model && (
                    <Badge variant="secondary" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      {WORK_MODEL_LABELS[job.work_model as WorkModel] || job.work_model}
                    </Badge>
                  )}
                  {job.contract_type && (
                    <Badge variant="secondary" className="gap-1">
                      <FileText className="h-3 w-3" />
                      {CONTRACT_TYPE_LABELS[job.contract_type as JobContractType] || job.contract_type}
                    </Badge>
                  )}
                  {job.seniority && (
                    <Badge variant="secondary" className="gap-1">
                      <GraduationCap className="h-3 w-3" />
                      {JOB_SENIORITY_LABELS[job.seniority as JobSeniority] || job.seniority}
                    </Badge>
                  )}
                  {job.unit && (
                    <Badge variant="outline" className="gap-1">
                      <Building className="h-3 w-3" />
                      {job.unit}
                    </Badge>
                  )}
                  {job.department && (
                    <Badge variant="outline" className="gap-1">
                      <Briefcase className="h-3 w-3" />
                      {job.department}
                    </Badge>
                  )}
                  {job.openings_count && job.openings_count > 1 && (
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      {job.openings_count} vagas
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Job Description */}
        {job.description && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader><CardTitle className="text-lg">Sobre a Vaga</CardTitle></CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">{job.description}</div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Requirements & Skills */}
        {(job.required_skills?.length > 0 || job.desired_skills?.length > 0 || job.requirements) && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
            <Card>
              <CardHeader><CardTitle className="text-lg">Requisitos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {job.requirements && <div className="prose prose-sm max-w-none whitespace-pre-wrap">{job.requirements}</div>}
                {job.required_skills?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Habilidades obrigatórias:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {job.required_skills.map(s => <Badge key={s} variant="default">{s}</Badge>)}
                    </div>
                  </div>
                )}
                {job.desired_skills?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Habilidades desejáveis:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {job.desired_skills.map(s => <Badge key={s} variant="outline">{s}</Badge>)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Benefits */}
        {job.benefits?.length > 0 && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader><CardTitle className="text-lg">Benefícios</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {job.benefits.map(b => <Badge key={b} variant="secondary">{b}</Badge>)}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <Separator />

        {/* Application Form */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Candidatar-se</CardTitle>
              <p className="text-sm text-muted-foreground">Preencha seus dados para se candidatar a esta vaga</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Info */}
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Dados Pessoais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome Completo *</Label>
                      <Input id="name" value={formData.candidate_name} onChange={e => updateField("candidate_name", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail *</Label>
                      <Input id="email" type="email" value={formData.candidate_email} onChange={e => updateField("candidate_email", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input id="phone" value={formData.candidate_phone} onChange={e => updateField("candidate_phone", e.target.value)} placeholder="(00) 00000-0000" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="city">Cidade</Label>
                        <Input id="city" value={formData.candidate_city} onChange={e => updateField("candidate_city", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">UF</Label>
                        <Select value={formData.candidate_state} onValueChange={v => updateField("candidate_state", v)}>
                          <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                          <SelectContent>
                            {BRAZILIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Professional Info */}
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Informações Profissionais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="position">Cargo Desejado</Label>
                      <Input id="position" value={formData.desired_position} onChange={e => updateField("desired_position", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="seniority">Senioridade</Label>
                      <Select value={formData.desired_seniority} onValueChange={v => updateField("desired_seniority", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(JOB_SENIORITY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Resume Upload */}
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Currículo</h3>
                  <div className="space-y-2">
                    <Label htmlFor="resume">Anexar Currículo (PDF, DOC, DOCX - máx. 10MB)</Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                      <input
                        id="resume"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={e => setResumeFile(e.target.files?.[0] || null)}
                      />
                      <label htmlFor="resume" className="cursor-pointer space-y-2 block">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                        {resumeFile ? (
                          <p className="text-sm font-medium text-primary">{resumeFile.name}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Clique para selecionar ou arraste seu currículo</p>
                        )}
                      </label>
                    </div>
                  </div>
                </div>

                {/* Cover Letter */}
                {job.require_cover_letter && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Carta de Apresentação</h3>
                    <Textarea
                      value={formData.cover_letter}
                      onChange={e => updateField("cover_letter", e.target.value)}
                      placeholder="Conte-nos por que você é o candidato ideal para esta vaga..."
                      rows={5}
                    />
                  </div>
                )}

                {/* PCD */}
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Diversidade</h3>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="pcd"
                      checked={formData.candidate_pcd}
                      onCheckedChange={v => updateField("candidate_pcd", !!v)}
                    />
                    <Label htmlFor="pcd" className="cursor-pointer">Pessoa com deficiência (PCD)</Label>
                  </div>
                  <AnimatePresence>
                    {formData.candidate_pcd && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        <Input
                          placeholder="Tipo de deficiência"
                          value={formData.candidate_pcd_type}
                          onChange={e => updateField("candidate_pcd_type", e.target.value)}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : "Enviar Candidatura"}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Ao enviar sua candidatura, você concorda com o tratamento dos seus dados conforme a LGPD.
                </p>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
