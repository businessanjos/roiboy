import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Briefcase, MapPin, Building, Users, GraduationCap,
  Upload, CheckCircle2, Loader2, FileText, AlertCircle, Calendar,
} from "lucide-react";
import { WORK_MODEL_LABELS, CONTRACT_TYPE_LABELS, JOB_SENIORITY_LABELS } from "@/constants/jobOptions";
import type { HRJob, WorkModel, JobContractType, JobSeniority } from "@/types/job";
import { motion, AnimatePresence } from "framer-motion";
import letreiro from "@/assets/eternum/letreiro.png.asset.json";
import everBru from "@/assets/eternum/ever-bru.png.asset.json";

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

const DRAFT_STORAGE_PREFIX = "eternum:job-application-draft";
const DRAFT_RETENTION_MS = 1000 * 60 * 60 * 24 * 14;

function getDraftKey(jobId?: string) {
  return jobId ? `${DRAFT_STORAGE_PREFIX}:${jobId}` : null;
}

function hasDraftContent(formData: ApplicationFormData, screeningAnswers: Record<string, string>) {
  const hasFormContent = Object.values(formData).some(value =>
    typeof value === "boolean" ? value : String(value || "").trim().length > 0
  );
  const hasScreeningContent = Object.values(screeningAnswers).some(value => String(value || "").trim().length > 0);
  return hasFormContent || hasScreeningContent;
}

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

type ScreeningQuestion = {
  id: string;
  label: string;
  helper?: string;
  type?: "textarea" | "text";
  required?: boolean;
  minLength?: number;
};

// Perguntas-padrão (usadas quando a vaga não define `screening_questions` próprias).
// Servem pra filtrar (só quem quer mesmo responde) e já traçar perfil.
const DEFAULT_SCREENING_QUESTIONS: ScreeningQuestion[] = [
  {
    id: "why_you",
    label: "Por que VOCÊ, especificamente, deveria ocupar essa cadeira?",
    helper: "Sem clichês. Queremos entender o que te torna diferente, não o que você acha que queremos ouvir.",
    type: "textarea",
    required: true,
    minLength: 200,
  },
  {
    id: "owned_problem",
    label: "Conte uma situação real em que você assumiu um problema que não era seu e resolveu. O que aconteceu?",
    helper: "Contexto, sua ação concreta e o resultado mensurável (números, prazo, impacto).",
    type: "textarea",
    required: true,
    minLength: 200,
  },
  {
    id: "proudest_win",
    label: "Qual o maior orgulho profissional da sua carreira até hoje, e o que isso diz sobre você?",
    type: "textarea",
    required: true,
    minLength: 150,
  },
  {
    id: "why_eternum",
    label: "Por que a Eternum, e por que agora?",
    helper: "O que você já pesquisou sobre a gente? O que te conecta?",
    type: "textarea",
    required: true,
    minLength: 150,
  },
  {
    id: "deal_breaker",
    label: "O que faria você recusar essa vaga, mesmo gostando do desafio?",
    type: "textarea",
    required: true,
    minLength: 80,
  },
  {
    id: "salary",
    label: "Pretensão salarial (CLT, valor bruto mensal em R$)",
    type: "text",
    required: true,
  },
  {
    id: "start_date",
    label: "Em quanto tempo você consegue começar?",
    type: "text",
    required: true,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    helper: "URL completa do seu perfil.",
    type: "text",
    required: true,
  },
  {
    id: "instagram",
    label: "Instagram",
    helper: "Quem você é fora do trabalho importa pra gente.",
    type: "text",
    required: false,
  },
];

// Paleta Eternum (mesma da carta-proposta)
const BG = "#2a1b0f";
const BG_DEEP = "#1d1208";
const CARD = "#ede6cb";
const CARD_SOFT = "#f4eed5";
const TEXT_DARK = "#3b2510";
const GOLD = "#c9a86a";

const SANS = "'Montserrat', system-ui, sans-serif";
const SERIF = "'Merriweather', Georgia, serif";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
      <span className="h-px w-8 sm:w-12" style={{ background: GOLD }} />
      <span
        className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] font-light text-center"
        style={{ color: GOLD, fontFamily: SANS }}
      >
        {children}
      </span>
      <span className="h-px w-8 sm:w-12" style={{ background: GOLD }} />
    </div>
  );
}

function DetailCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="rounded-sm p-4 flex items-start gap-3"
      style={{ background: `${BG_DEEP}66`, border: `1px solid ${GOLD}33` }}
    >
      <div className="mt-0.5" style={{ color: GOLD }}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.25em] mb-1" style={{ color: GOLD, fontFamily: SANS }}>{label}</p>
        <p className="text-sm leading-snug" style={{ color: CARD, fontFamily: SERIF }}>{value}</p>
      </div>
    </div>
  );
}

function FieldLabel({ htmlFor, children, required }: { htmlFor?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <Label
      htmlFor={htmlFor}
      className="text-[11px] uppercase tracking-[0.25em]"
      style={{ color: GOLD, fontFamily: SANS, fontWeight: 600 }}
    >
      {children} {required && <span style={{ color: GOLD }}>*</span>}
    </Label>
  );
}

const inputStyle: React.CSSProperties = {
  background: `${BG_DEEP}aa`,
  border: `1px solid ${GOLD}40`,
  color: CARD,
  fontFamily: SANS,
};

export default function PublicJobApplication() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [job, setJob] = useState<HRJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<ApplicationFormData>(INITIAL_FORM);
  const [screeningAnswers, setScreeningAnswers] = useState<Record<string, string>>({});
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const screeningQuestions: ScreeningQuestion[] = (() => {
    const custom = (job as any)?.screening_questions;
    if (Array.isArray(custom) && custom.length > 0) return custom as ScreeningQuestion[];
    return DEFAULT_SCREENING_QUESTIONS;
  })();

  useEffect(() => {
    if (!id) return;
    loadJob();
  }, [id]);

  useEffect(() => {
    const draftKey = getDraftKey(id);
    if (!draftKey) return;

    try {
      const rawDraft = window.localStorage.getItem(draftKey);
      if (!rawDraft) return;
      const draft = JSON.parse(rawDraft) as {
        formData?: Partial<ApplicationFormData>;
        screeningAnswers?: Record<string, string>;
        savedAt?: number;
      };

      if (!draft.savedAt || Date.now() - draft.savedAt > DRAFT_RETENTION_MS) {
        window.localStorage.removeItem(draftKey);
        return;
      }

      setFormData(prev => ({ ...prev, ...(draft.formData || {}) }));
      setScreeningAnswers(draft.screeningAnswers || {});
      setDraftRestored(true);
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [id]);

  useEffect(() => {
    const draftKey = getDraftKey(id);
    if (!draftKey || submitted) return;

    if (!hasDraftContent(formData, screeningAnswers)) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify({ formData, screeningAnswers, savedAt: Date.now() }));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [formData, id, screeningAnswers, submitted]);

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

  const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_RESUME_EXTS = ["pdf", "doc", "docx"];
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function handleResumeChange(file: File | null) {
    if (!file) {
      setResumeFile(null);
      return;
    }
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_RESUME_EXTS.includes(ext)) {
      toast({
        title: "Formato não suportado",
        description: "Envie o currículo em PDF, DOC ou DOCX.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      toast({
        title: "Arquivo muito grande",
        description: `O currículo tem ${sizeMB}MB. O limite é 10MB. Tente compactar o PDF.`,
        variant: "destructive",
      });
      return;
    }
    setResumeFile(file);
  }

  function focusField(id: string) {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        try { (el as HTMLInputElement).focus({ preventScroll: true }); } catch {}
      }
    }, 50);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job || submitting) return;

    const name = formData.candidate_name.trim();
    const email = formData.candidate_email.trim();
    const phone = formData.candidate_phone.trim();
    const city = formData.candidate_city.trim();
    const state = formData.candidate_state.trim();
    const position = formData.desired_position.trim();
    const seniority = formData.desired_seniority.trim();
    const coverLetter = formData.cover_letter.trim();
    const pcdType = formData.candidate_pcd_type.trim();

    // Validação núcleo
    if (!name) {
      toast({ title: "Falta seu nome completo", description: "Esse campo é obrigatório.", variant: "destructive" });
      focusField("name");
      return;
    }
    if (name.length < 3) {
      toast({ title: "Nome muito curto", description: "Digite seu nome completo.", variant: "destructive" });
      focusField("name");
      return;
    }
    if (!email) {
      toast({ title: "Falta seu e-mail", description: "Esse campo é obrigatório.", variant: "destructive" });
      focusField("email");
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      toast({ title: "E-mail inválido", description: "Confira se digitou corretamente.", variant: "destructive" });
      focusField("email");
      return;
    }
    if (formData.candidate_pcd && !pcdType) {
      toast({ title: "Informe o tipo de deficiência", description: "Esse campo é obrigatório quando PCD está marcado.", variant: "destructive" });
      return;
    }
    if (job.require_cover_letter && !coverLetter) {
      toast({ title: "Falta a carta de apresentação", description: "Essa vaga exige carta.", variant: "destructive" });
      return;
    }

    // Validação das perguntas de triagem
    for (const q of screeningQuestions) {
      const v = (screeningAnswers[q.id] || "").trim();
      if (q.required && !v) {
        toast({ title: "Responda com calma", description: `Falta responder: "${q.label}"`, variant: "destructive" });
        return;
      }
      if (q.minLength && v.length < q.minLength) {
        toast({
          title: "Resposta muito curta",
          description: `"${q.label}" precisa de pelo menos ${q.minLength} caracteres. Você escreveu ${v.length}.`,
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      let resume_url: string | null = null;

      if (resumeFile) {
        // Revalida antes do upload (defesa em profundidade)
        if (resumeFile.size > MAX_RESUME_BYTES) {
          throw new Error("Currículo acima de 10MB. Compacte o arquivo e tente novamente.");
        }
        const ext = (resumeFile.name.split(".").pop() || "pdf").toLowerCase();
        if (!ALLOWED_RESUME_EXTS.includes(ext)) {
          throw new Error("Formato de currículo não suportado. Use PDF, DOC ou DOCX.");
        }
        const safeName = (name || "candidato").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60);
        const path = `${job.id}/${Date.now()}_${safeName}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("hr-resumes")
          .upload(path, resumeFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: resumeFile.type || undefined,
          });

        if (uploadError) {
          console.error("[PublicJobApplication] resume upload failed", uploadError);
          throw new Error(
            "Não conseguimos enviar seu currículo agora. Tente outro arquivo (PDF até 10MB) ou prossiga sem anexo."
          );
        }
        resume_url = path;
      }

      const payload = {
        job_id: job.id,
        account_id: job.account_id,
        candidate_name: name.slice(0, 200),
        candidate_email: email.slice(0, 200).toLowerCase(),
        candidate_phone: phone ? phone.slice(0, 40) : null,
        candidate_city: city ? city.slice(0, 100) : null,
        candidate_state: state || null,
        desired_position: position ? position.slice(0, 200) : null,
        desired_seniority: seniority || null,
        cover_letter: coverLetter ? coverLetter.slice(0, 5000) : null,
        candidate_pcd: formData.candidate_pcd,
        candidate_pcd_type: formData.candidate_pcd ? pcdType.slice(0, 200) : null,
        resume_url,
        screening_answers: screeningAnswers as any,
        stage: "applied" as const,
        status: "active",
      };

      const { error: insertError } = await supabase
        .from("hr_job_applications")
        .insert(payload);

      if (insertError) {
        console.error("[PublicJobApplication] insert failed", insertError);
        throw new Error(
          "Não conseguimos registrar sua candidatura agora. Verifique sua conexão e tente novamente em alguns segundos."
        );
      }

      const draftKey = getDraftKey(id);
      if (draftKey) window.localStorage.removeItem(draftKey);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      toast({
        title: "Erro ao enviar candidatura",
        description: err?.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: BG, fontFamily: SANS }}>
        <div className="text-center max-w-md space-y-3" style={{ color: CARD }}>
          <AlertCircle className="h-12 w-12 mx-auto opacity-60" style={{ color: GOLD }} />
          <h1 className="text-xl" style={{ fontFamily: SERIF, fontWeight: 400 }}>{error || "Vaga não encontrada"}</h1>
          <p className="text-sm opacity-70">Esta vaga pode ter sido encerrada ou o link está incorreto.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          background: BG,
          backgroundImage: `radial-gradient(circle at 20% 0%, ${GOLD}18, transparent 50%), radial-gradient(circle at 80% 100%, ${GOLD}12, transparent 50%)`,
          fontFamily: SANS,
        }}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-xl w-full text-center"
        >
          <div className="flex justify-center mb-8">
            <img src={letreiro.url} alt="Eternum" className="h-7 sm:h-9 object-contain opacity-95" />
          </div>
          <div
            className="rounded-sm p-8 sm:p-12 relative"
            style={{
              background: `linear-gradient(135deg, ${CARD} 0%, ${CARD_SOFT} 100%)`,
              boxShadow: `0 30px 80px -30px rgba(0,0,0,0.5), inset 0 0 0 1px ${GOLD}40`,
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
            <CheckCircle2 className="h-14 w-14 mx-auto mb-5" style={{ color: GOLD }} />
            <p className="text-[10px] uppercase tracking-[0.4em] mb-3" style={{ color: GOLD, fontWeight: 600 }}>
              Candidatura recebida
            </p>
            <h2 className="text-2xl sm:text-3xl mb-4" style={{ fontFamily: SERIF, color: TEXT_DARK, fontWeight: 400 }}>
              Obrigado, {formData.candidate_name.split(" ")[0]}.
            </h2>
            <p className="text-[15px] leading-relaxed" style={{ color: TEXT_DARK, fontFamily: SERIF, opacity: 0.85 }}>
              Recebemos seu interesse pela vaga de <strong>{job.title}</strong>. Cada candidatura é lida com atenção pelo nosso time.
              Em breve entraremos em contato pelos canais informados.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        background: BG,
        color: CARD,
        fontFamily: SANS,
        backgroundImage: `radial-gradient(circle at 20% 0%, ${GOLD}15, transparent 50%), radial-gradient(circle at 80% 100%, ${GOLD}10, transparent 50%)`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <style>{`
        .eternum-apply input:-webkit-autofill,
        .eternum-apply input:-webkit-autofill:hover,
        .eternum-apply input:-webkit-autofill:focus,
        .eternum-apply input:-webkit-autofill:active,
        .eternum-apply textarea:-webkit-autofill,
        .eternum-apply textarea:-webkit-autofill:hover,
        .eternum-apply textarea:-webkit-autofill:focus {
          -webkit-text-fill-color: ${CARD} !important;
          -webkit-box-shadow: 0 0 0px 1000px ${BG_DEEP} inset !important;
          box-shadow: 0 0 0px 1000px ${BG_DEEP} inset !important;
          caret-color: ${CARD} !important;
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>
      {/* HERO */}

      <header className="relative overflow-hidden" style={{ background: `linear-gradient(180deg, ${BG_DEEP} 0%, ${BG} 100%)` }}>
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(${GOLD} 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative max-w-5xl mx-auto px-5 sm:px-6 pt-10 pb-12 sm:pt-12 sm:pb-16 md:pt-16 md:pb-20">
          <div className="flex justify-center mb-8 sm:mb-10">
            <img src={letreiro.url} alt="Eternum" className="h-6 sm:h-7 md:h-9 object-contain opacity-95" />
          </div>

          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-5 sm:mb-6">
            <span className="h-px w-10 sm:w-12" style={{ background: GOLD }} />
            <span
              className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] font-light"
              style={{ color: GOLD, fontFamily: SANS }}
            >
              Vaga aberta · {job.department || "Eternum"}
            </span>
            <span className="h-px w-10 sm:w-12" style={{ background: GOLD }} />
          </div>

          <h1
            className="text-center text-[30px] leading-[1.15] sm:text-4xl md:text-5xl lg:text-6xl max-w-3xl mx-auto pb-3"
            style={{ fontFamily: SERIF, color: CARD, fontWeight: 300, letterSpacing: "-0.01em" }}
          >
            {job.title}
          </h1>
          <p
            className="text-center text-[15px] sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed mt-4"
            style={{ color: "#e8dcc0", fontFamily: SERIF, fontWeight: 300, fontStyle: "italic", opacity: 0.85 }}
          >
            Esta pode ser a sua cadeira. Conte-nos quem você é.
          </p>

          {/* Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-8 sm:mt-10">
            {job.work_model && (
              <span className="text-[11px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-sm flex items-center gap-1.5"
                style={{ background: `${BG_DEEP}aa`, border: `1px solid ${GOLD}55`, color: CARD }}>
                <MapPin className="h-3 w-3" style={{ color: GOLD }} />
                {WORK_MODEL_LABELS[job.work_model as WorkModel] || job.work_model}
              </span>
            )}
            {job.contract_type && (
              <span className="text-[11px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-sm flex items-center gap-1.5"
                style={{ background: `${BG_DEEP}aa`, border: `1px solid ${GOLD}55`, color: CARD }}>
                <FileText className="h-3 w-3" style={{ color: GOLD }} />
                {CONTRACT_TYPE_LABELS[job.contract_type as JobContractType] || job.contract_type}
              </span>
            )}
            {job.seniority && (
              <span className="text-[11px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-sm flex items-center gap-1.5"
                style={{ background: `${BG_DEEP}aa`, border: `1px solid ${GOLD}55`, color: CARD }}>
                <GraduationCap className="h-3 w-3" style={{ color: GOLD }} />
                {JOB_SENIORITY_LABELS[job.seniority as JobSeniority] || job.seniority}
              </span>
            )}
            {job.unit && (
              <span className="text-[11px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-sm flex items-center gap-1.5"
                style={{ background: `${BG_DEEP}aa`, border: `1px solid ${GOLD}55`, color: CARD }}>
                <Building className="h-3 w-3" style={{ color: GOLD }} />
                {job.unit}
              </span>
            )}
            {job.openings_count && job.openings_count > 1 && (
              <span className="text-[11px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-sm flex items-center gap-1.5"
                style={{ background: `${BG_DEEP}aa`, border: `1px solid ${GOLD}55`, color: CARD }}>
                <Users className="h-3 w-3" style={{ color: GOLD }} />
                {job.openings_count} vagas
              </span>
            )}
          </div>
        </div>
      </header>

      {/* CORPO */}
      <main className="max-w-4xl mx-auto px-5 sm:px-6 py-12 sm:py-16 md:py-20 space-y-14 sm:space-y-20">
        {/* SOBRE A VAGA */}
        {job.description && (
          <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            <SectionLabel>Sobre a vaga</SectionLabel>
            <div className="grid md:grid-cols-5 gap-8 items-start">
              <div className="md:col-span-3 space-y-4">
                {(() => {
                  const renderInline = (text: string) => {
                    const parts: (string | JSX.Element)[] = [];
                    const regex = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|`(.+?)`|\[(.+?)\]\((.+?)\)/g;
                    let lastIndex = 0;
                    let m: RegExpExecArray | null;
                    let key = 0;
                    while ((m = regex.exec(text)) !== null) {
                      if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
                      if (m[1] !== undefined || m[2] !== undefined) {
                        parts.push(<strong key={key++} style={{ color: GOLD, fontWeight: 600 }}>{m[1] ?? m[2]}</strong>);
                      } else if (m[3] !== undefined || m[4] !== undefined) {
                        parts.push(<em key={key++}>{m[3] ?? m[4]}</em>);
                      } else if (m[5] !== undefined) {
                        parts.push(<code key={key++} style={{ fontFamily: "monospace", fontSize: "0.9em" }}>{m[5]}</code>);
                      } else if (m[6] !== undefined && m[7] !== undefined) {
                        parts.push(<a key={key++} href={m[7]} target="_blank" rel="noopener noreferrer" style={{ color: GOLD, textDecoration: "underline" }}>{m[6]}</a>);
                      }
                      lastIndex = m.index + m[0].length;
                    }
                    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
                    return parts;
                  };

                  // Remove seção "O que oferecemos" da descrição (já renderizada como badges abaixo)
                  // e remove travessões (em-dash / en-dash) por regra do projeto.
                  const cleanedDescription = job.description
                    .replace(
                      /(^|\n)\s*#{1,6}\s*O que oferec[^\n]*\n[\s\S]*?(?=\n\s*#{1,6}\s|\s*$)/gi,
                      "$1"
                    )
                    .replace(/\s*[—–]\s*/g, ", ");
                  const lines = cleanedDescription.split("\n");
                  const blocks: JSX.Element[] = [];
                  let listBuffer: string[] = [];
                  let key = 0;

                  const flushList = () => {
                    if (listBuffer.length === 0) return;
                    const items = [...listBuffer];
                    listBuffer = [];
                    blocks.push(
                      <ul key={`ul-${key++}`} className="list-disc pl-5 space-y-2 text-[15px] md:text-base leading-relaxed" style={{ fontFamily: SERIF, color: "#e8dcc0", fontWeight: 300 }}>
                        {items.map((it, idx) => (
                          <li key={idx}>{renderInline(it)}</li>
                        ))}
                      </ul>
                    );
                  };

                  for (const raw of lines) {
                    const trimmed = raw.trim();
                    if (!trimmed) { flushList(); continue; }

                    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
                    if (listMatch) { listBuffer.push(listMatch[1]); continue; }
                    flushList();

                    const hMatch = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*$/);
                    const boldHeadingMatch = !hMatch && trimmed.match(/^\*\*(.+?)\*\*$/);

                    if (hMatch || boldHeadingMatch) {
                      const text = hMatch ? hMatch[2] : boldHeadingMatch![1];
                      const level = hMatch ? hMatch[1].length : 2;
                      const size = level <= 2 ? "text-xl md:text-2xl" : "text-lg md:text-xl";
                      blocks.push(
                        <h3
                          key={`h-${key++}`}
                          className={`${size} pt-4 first:pt-0`}
                          style={{ fontFamily: SERIF, color: GOLD, fontWeight: 500, letterSpacing: "0.02em" }}
                        >
                          {renderInline(text)}
                        </h3>
                      );
                      continue;
                    }

                    blocks.push(
                      <p
                        key={`p-${key++}`}
                        className="text-[15px] md:text-base leading-relaxed"
                        style={{ fontFamily: SERIF, color: "#e8dcc0", fontWeight: 300 }}
                      >
                        {renderInline(trimmed)}
                      </p>
                    );
                  }
                  flushList();
                  return blocks;
                })()}
              </div>
              <div className="md:col-span-2">
                <div
                  className="relative rounded-sm overflow-hidden"
                  style={{ boxShadow: `0 20px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px ${GOLD}30` }}
                >
                  <img src={everBru.url} alt="Fundadores da Eternum" className="w-full h-auto block" />
                  <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(180deg, transparent 60%, ${BG_DEEP}cc)` }} />
                  <div className="absolute bottom-3 left-4 right-4" style={{ color: CARD }}>
                    <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: GOLD }}>Fundadores</p>
                    <p className="text-sm mt-1" style={{ fontFamily: SERIF }}>Ever & Bruna</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* DETALHES */}
        <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
          <SectionLabel>Detalhes da posição</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {job.work_model && <DetailCard icon={<Briefcase className="h-4 w-4" />} label="Modelo de trabalho" value={WORK_MODEL_LABELS[job.work_model as WorkModel] || job.work_model} />}
            {job.contract_type && <DetailCard icon={<FileText className="h-4 w-4" />} label="Contratação" value={CONTRACT_TYPE_LABELS[job.contract_type as JobContractType] || job.contract_type} />}
            {job.seniority && <DetailCard icon={<GraduationCap className="h-4 w-4" />} label="Senioridade" value={JOB_SENIORITY_LABELS[job.seniority as JobSeniority] || job.seniority} />}
            {job.unit && <DetailCard icon={<MapPin className="h-4 w-4" />} label="Local" value={job.unit} />}
            {job.department && <DetailCard icon={<Building className="h-4 w-4" />} label="Área" value={job.department} />}
            {job.openings_count && job.openings_count > 1 && <DetailCard icon={<Users className="h-4 w-4" />} label="Vagas abertas" value={`${job.openings_count} posições`} />}
          </div>
        </motion.section>

        {/* REQUISITOS */}
        {(job.required_skills?.length > 0 || job.desired_skills?.length > 0 || job.requirements) && (
          <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            <SectionLabel>O que buscamos</SectionLabel>
            <div
              className="rounded-sm p-6 sm:p-8 space-y-5"
              style={{ background: `${BG_DEEP}66`, border: `1px solid ${GOLD}33` }}
            >
              {job.requirements && (
                <div className="space-y-3">
                  {job.requirements.split("\n").filter(Boolean).map((p, i) => (
                    <p key={i} className="text-[15px] leading-relaxed" style={{ fontFamily: SERIF, color: "#e8dcc0", fontWeight: 300 }}>
                      {p}
                    </p>
                  ))}
                </div>
              )}
              {job.required_skills?.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] mb-3" style={{ color: GOLD, fontWeight: 600 }}>Indispensáveis</p>
                  <div className="flex flex-wrap gap-1.5">
                    {job.required_skills.map(s => (
                      <span key={s} className="text-xs px-2.5 py-1 rounded-sm"
                        style={{ background: GOLD, color: TEXT_DARK, fontWeight: 600, fontFamily: SANS }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {job.desired_skills?.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] mb-3" style={{ color: GOLD, fontWeight: 600 }}>Diferenciais</p>
                  <div className="flex flex-wrap gap-1.5">
                    {job.desired_skills.map(s => (
                      <span key={s} className="text-xs px-2.5 py-1 rounded-sm"
                        style={{ background: "transparent", border: `1px solid ${GOLD}66`, color: CARD, fontFamily: SANS }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* BENEFÍCIOS */}
        {job.benefits?.length > 0 && (
          <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
            <SectionLabel>O que oferecemos</SectionLabel>
            <div className="flex flex-wrap justify-center gap-2">
              {job.benefits.map(b => (
                <span
                  key={b}
                  className="text-sm px-4 py-2 rounded-sm"
                  style={{
                    background: `linear-gradient(135deg, ${CARD} 0%, ${CARD_SOFT} 100%)`,
                    color: TEXT_DARK,
                    fontFamily: SERIF,
                    boxShadow: `0 4px 14px -6px rgba(0,0,0,0.4), inset 0 0 0 1px ${GOLD}40`,
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          </motion.section>
        )}

        {/* FORMULÁRIO */}
        <motion.section initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <SectionLabel>Candidate-se</SectionLabel>
          <div
            className="rounded-sm p-6 sm:p-10 md:p-12 relative"
            style={{
              background: `linear-gradient(135deg, ${CARD} 0%, ${CARD_SOFT} 100%)`,
              boxShadow: `0 30px 80px -30px rgba(0,0,0,0.5), inset 0 0 0 1px ${GOLD}40`,
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />

            <div className="text-center mb-8 max-w-2xl mx-auto">
              <p className="text-[10px] uppercase tracking-[0.35em] mb-3" style={{ color: GOLD, fontWeight: 600 }}>
                Não é só um formulário
              </p>
              <h3 className="text-2xl sm:text-3xl mb-4" style={{ fontFamily: SERIF, color: TEXT_DARK, fontWeight: 400 }}>
                Aqui começa o filtro.
              </h3>
              <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: TEXT_DARK, opacity: 0.75, fontFamily: SERIF, fontStyle: "italic" }}>
                Pedimos algumas respostas que exigem tempo e honestidade. Se você quer mesmo essa cadeira,
                isso vai ser fácil. Se não quer tanto assim, tudo bem, esse não é o seu lugar.
              </p>
            </div>

            {draftRestored && (
              <div
                className="mb-6 rounded-sm px-4 py-3 text-center text-xs"
                style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}55`, color: TEXT_DARK, fontFamily: SANS }}
              >
                Rascunho recuperado automaticamente neste dispositivo.
              </div>
            )}


            <form onSubmit={handleSubmit} className="space-y-8" style={{ color: TEXT_DARK }}>
              {/* Dados Pessoais */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="h-px flex-1" style={{ background: `${GOLD}55` }} />
                  <span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: GOLD, fontWeight: 700, fontFamily: SANS }}>Dados pessoais</span>
                  <span className="h-px flex-1" style={{ background: `${GOLD}55` }} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-[11px] uppercase tracking-[0.2em]" style={{ color: TEXT_DARK, fontFamily: SANS, fontWeight: 600 }}>Nome completo *</Label>
                    <Input id="name" value={formData.candidate_name} onChange={e => updateField("candidate_name", e.target.value)} required
                      autoComplete="name" maxLength={200}
                      className="bg-white/70 border-[1.5px]"
                      style={{ borderColor: `${GOLD}66`, color: TEXT_DARK, fontFamily: SANS }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[11px] uppercase tracking-[0.2em]" style={{ color: TEXT_DARK, fontFamily: SANS, fontWeight: 600 }}>E-mail *</Label>
                    <Input id="email" type="email" value={formData.candidate_email} onChange={e => updateField("candidate_email", e.target.value)} required
                      autoComplete="email" inputMode="email" maxLength={200}
                      className="bg-white/70 border-[1.5px]"
                      style={{ borderColor: `${GOLD}66`, color: TEXT_DARK, fontFamily: SANS }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-[11px] uppercase tracking-[0.2em]" style={{ color: TEXT_DARK, fontFamily: SANS, fontWeight: 600 }}>WhatsApp</Label>
                    <Input id="phone" value={formData.candidate_phone} onChange={e => updateField("candidate_phone", e.target.value)} placeholder="(00) 00000-0000"
                      className="bg-white/70 border-[1.5px]"
                      style={{ borderColor: `${GOLD}66`, color: TEXT_DARK, fontFamily: SANS }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="city" className="text-[11px] uppercase tracking-[0.2em]" style={{ color: TEXT_DARK, fontFamily: SANS, fontWeight: 600 }}>Cidade</Label>
                      <Input id="city" value={formData.candidate_city} onChange={e => updateField("candidate_city", e.target.value)}
                        className="bg-white/70 border-[1.5px]"
                        style={{ borderColor: `${GOLD}66`, color: TEXT_DARK, fontFamily: SANS }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="state" className="text-[11px] uppercase tracking-[0.2em]" style={{ color: TEXT_DARK, fontFamily: SANS, fontWeight: 600 }}>UF</Label>
                      <Select value={formData.candidate_state} onValueChange={v => updateField("candidate_state", v)}>
                        <SelectTrigger className="bg-white/70 border-[1.5px]" style={{ borderColor: `${GOLD}66`, color: TEXT_DARK, fontFamily: SANS }}>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {BRAZILIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profissionais */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="h-px flex-1" style={{ background: `${GOLD}55` }} />
                  <span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: GOLD, fontWeight: 700, fontFamily: SANS }}>Trajetória</span>
                  <span className="h-px flex-1" style={{ background: `${GOLD}55` }} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="position" className="text-[11px] uppercase tracking-[0.2em]" style={{ color: TEXT_DARK, fontFamily: SANS, fontWeight: 600 }}>Cargo atual ou desejado</Label>
                    <Input id="position" value={formData.desired_position} onChange={e => updateField("desired_position", e.target.value)}
                      className="bg-white/70 border-[1.5px]"
                      style={{ borderColor: `${GOLD}66`, color: TEXT_DARK, fontFamily: SANS }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="seniority" className="text-[11px] uppercase tracking-[0.2em]" style={{ color: TEXT_DARK, fontFamily: SANS, fontWeight: 600 }}>Senioridade</Label>
                    <Select value={formData.desired_seniority} onValueChange={v => updateField("desired_seniority", v)}>
                      <SelectTrigger className="bg-white/70 border-[1.5px]" style={{ borderColor: `${GOLD}66`, color: TEXT_DARK, fontFamily: SANS }}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(JOB_SENIORITY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Currículo */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-2">
                  <span className="h-px flex-1" style={{ background: `${GOLD}55` }} />
                  <span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: GOLD, fontWeight: 700, fontFamily: SANS }}>Currículo</span>
                  <span className="h-px flex-1" style={{ background: `${GOLD}55` }} />
                </div>
                <input
                  id="resume"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={e => handleResumeChange(e.target.files?.[0] || null)}
                />

                <label
                  htmlFor="resume"
                  className="cursor-pointer block rounded-sm p-8 text-center transition-all hover:scale-[1.01]"
                  style={{
                    background: "rgba(255,255,255,0.45)",
                    border: `1.5px dashed ${GOLD}99`,
                  }}
                >
                  <Upload className="h-7 w-7 mx-auto mb-3" style={{ color: GOLD }} />
                  {resumeFile ? (
                    <p className="text-sm font-medium" style={{ color: TEXT_DARK, fontFamily: SANS }}>{resumeFile.name}</p>
                  ) : (
                    <>
                      <p className="text-sm" style={{ color: TEXT_DARK, fontFamily: SANS, fontWeight: 500 }}>Anexar currículo</p>
                      <p className="text-xs mt-1" style={{ color: TEXT_DARK, opacity: 0.6, fontFamily: SANS }}>PDF, DOC ou DOCX · até 10MB</p>
                    </>
                  )}
                </label>
              </div>

              {/* Perguntas de triagem */}
              {screeningQuestions.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="h-px flex-1" style={{ background: `${GOLD}55` }} />
                    <span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: GOLD, fontWeight: 700, fontFamily: SANS }}>Sobre você & a vaga</span>
                    <span className="h-px flex-1" style={{ background: `${GOLD}55` }} />
                  </div>
                  <p className="text-[13px] text-center -mt-2" style={{ color: TEXT_DARK, opacity: 0.7, fontFamily: SERIF, fontStyle: "italic" }}>
                    Responda com calma e na sua voz. Respostas genéricas (ou de IA) ficam evidentes.
                  </p>
                  {screeningQuestions.map((q, idx) => {
                    const value = screeningAnswers[q.id] || "";
                    const showCounter = q.type === "textarea" && q.minLength;
                    return (
                      <div key={q.id} className="space-y-2">
                        <Label
                          className="text-[13px] leading-snug block"
                          style={{ color: TEXT_DARK, fontFamily: SERIF, fontWeight: 600 }}
                        >
                          <span style={{ color: GOLD, fontFamily: SANS, fontWeight: 700, marginRight: 8 }}>
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          {q.label}
                          {q.required && <span style={{ color: GOLD }}> *</span>}
                        </Label>
                        {q.helper && (
                          <p className="text-[12px]" style={{ color: TEXT_DARK, opacity: 0.6, fontFamily: SANS }}>
                            {q.helper}
                          </p>
                        )}
                        {q.type === "text" ? (
                          <Input
                            value={value}
                            onChange={e => setScreeningAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                            className="bg-white/70 border-[1.5px]"
                            style={{ borderColor: `${GOLD}66`, color: TEXT_DARK, fontFamily: SANS }}
                          />
                        ) : (
                          <Textarea
                            value={value}
                            onChange={e => setScreeningAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                            rows={5}
                            className="bg-white/70 border-[1.5px] resize-none"
                            style={{ borderColor: `${GOLD}66`, color: TEXT_DARK, fontFamily: SERIF }}
                          />
                        )}
                        {showCounter && (
                          <p className="text-[11px] text-right" style={{
                            color: value.length >= (q.minLength || 0) ? GOLD : TEXT_DARK,
                            opacity: value.length >= (q.minLength || 0) ? 1 : 0.55,
                            fontFamily: SANS,
                          }}>
                            {value.length} / mín. {q.minLength}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Carta */}
              {job.require_cover_letter && (

                <div className="space-y-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="h-px flex-1" style={{ background: `${GOLD}55` }} />
                    <span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: GOLD, fontWeight: 700, fontFamily: SANS }}>Carta de apresentação</span>
                    <span className="h-px flex-1" style={{ background: `${GOLD}55` }} />
                  </div>
                  <Textarea
                    value={formData.cover_letter}
                    onChange={e => updateField("cover_letter", e.target.value)}
                    placeholder="Conte sua história. O que te move, o que você busca, por que essa vaga..."
                    rows={6}
                    className="bg-white/70 border-[1.5px] resize-none"
                    style={{ borderColor: `${GOLD}66`, color: TEXT_DARK, fontFamily: SERIF, fontStyle: "italic" }}
                  />
                </div>
              )}

              {/* PCD */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="pcd"
                    checked={formData.candidate_pcd}
                    onCheckedChange={v => updateField("candidate_pcd", !!v)}
                    style={{ borderColor: GOLD }}
                  />
                  <Label htmlFor="pcd" className="cursor-pointer text-sm" style={{ color: TEXT_DARK, fontFamily: SANS }}>
                    Sou pessoa com deficiência (PCD)
                  </Label>
                </div>
                <AnimatePresence>
                  {formData.candidate_pcd && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <Input
                        placeholder="Tipo de deficiência"
                        value={formData.candidate_pcd_type}
                        onChange={e => updateField("candidate_pcd_type", e.target.value)}
                        className="bg-white/70 border-[1.5px]"
                        style={{ borderColor: `${GOLD}66`, color: TEXT_DARK, fontFamily: SANS }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="w-full text-sm uppercase tracking-[0.3em] h-14 rounded-sm border-0 hover:opacity-90 transition-opacity"
                  style={{
                    background: `linear-gradient(135deg, ${TEXT_DARK} 0%, ${BG} 100%)`,
                    color: CARD,
                    fontFamily: SANS,
                    fontWeight: 600,
                    boxShadow: `0 10px 30px -10px rgba(0,0,0,0.5), inset 0 0 0 1px ${GOLD}`,
                  }}
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando…</>
                  ) : (
                    "Enviar candidatura"
                  )}
                </Button>
                <p className="text-[11px] text-center mt-4" style={{ color: TEXT_DARK, opacity: 0.6, fontFamily: SANS }}>
                  Ao enviar, você concorda com o tratamento dos seus dados conforme a LGPD.
                </p>
              </div>
            </form>
          </div>
        </motion.section>

        <div className="pt-4 pb-2 text-center">
          <span className="text-[10px] uppercase tracking-[0.4em]" style={{ color: GOLD, fontFamily: SANS }}>
            Eternum · Cada cadeira tem um nome
          </span>
        </div>
      </main>
    </div>
  );
}
