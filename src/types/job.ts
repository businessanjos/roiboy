export type JobStatus = "active" | "closed" | "draft" | "on_hold";
export type WorkModel = "remote" | "hybrid" | "onsite";
export type JobContractType = "clt" | "pj" | "internship" | "temporary" | "freelancer";
export type JobSeniority = "intern" | "junior" | "pleno" | "senior" | "specialist" | "lead" | "manager" | "director";
export type SalaryType = "not_disclosed" | "negotiable" | "fixed" | "range";
export type JobUrgency = "low" | "medium" | "high" | "urgent";
export type DescriptionTone = "startup" | "corporate" | "balanced" | "creative";
export type EducationLevel = "elementary" | "high_school" | "technical" | "undergraduate" | "postgraduate" | "masters" | "doctorate" | "postdoc";
export type CandidateStage = "applied" | "screening" | "interview" | "technical_test" | "offer" | "hired" | "rejected";

export interface JobLanguage {
  language: string;
  level: string;
}

export interface HRJob {
  id: string;
  account_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  requirements: string | null;
  department: string | null;
  position: string | null;
  unit: string | null;
  work_model: string | null;
  contract_type: string | null;
  seniority: string | null;
  openings_count: number | null;
  description_tone: string | null;
  description_context: string | null;
  required_skills: string[];
  desired_skills: string[];
  experience_years: number | null;
  education_level: string | null;
  languages: JobLanguage[] | null;
  salary_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  benefits: string[];
  application_deadline: string | null;
  expected_start_date: string | null;
  urgency: string | null;
  require_cover_letter: boolean | null;
  tags: string[];
  status: JobStatus;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  hiring_manager_id?: string | null;
  recruiter_id?: string | null;
  target_fill_date?: string | null;
  opening_reason?: string | null;
  opened_at?: string | null;
}

export interface HRJobApplication {
  id: string;
  job_id: string;
  account_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  candidate_city: string | null;
  candidate_state: string | null;
  candidate_birth_date: string | null;
  candidate_gender: string | null;
  candidate_race: string | null;
  candidate_sexual_orientation: string | null;
  candidate_pcd: boolean | null;
  candidate_pcd_type: string | null;
  desired_position: string | null;
  desired_seniority: string | null;
  resume_url: string | null;
  cover_letter: string | null;
  stage: CandidateStage;
  status: string;
  notes: string | null;
  ai_analysis_status: string | null;
  ai_score: number | null;
  ai_report: string | null;
  profiler_result_code: string | null;
  profiler_result_detail: any | null;
  profiler_completed_at: string | null;
  applied_at: string;
  updated_at: string;
}

export interface JobFormData {
  title: string;
  department: string;
  unit: string;
  work_model: WorkModel;
  contract_type: JobContractType;
  seniority: JobSeniority | "";
  openings_count: number;
  position: string;
  description_tone: DescriptionTone | "";
  description_context: string;
  description: string;
  required_skills: string[];
  desired_skills: string[];
  experience_years: number | null;
  education_level: EducationLevel | "";
  languages: JobLanguage[];
  requirements: string;
  salary_type: SalaryType;
  salary_min: number | null;
  salary_max: number | null;
  benefits: string[];
  application_deadline: Date | null;
  expected_start_date: Date | null;
  urgency: JobUrgency;
  require_cover_letter: boolean;
  tags: string[];
  status: JobStatus;
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  active: "Ativa",
  closed: "Encerrada",
  draft: "Rascunho",
  on_hold: "Em Análise",
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  active: "bg-green-500/15 text-green-700 border-green-300",
  closed: "bg-gray-500/15 text-gray-700 border-gray-300",
  draft: "bg-amber-500/15 text-amber-700 border-amber-300",
  on_hold: "bg-blue-500/15 text-blue-700 border-blue-300",
};

export const CANDIDATE_STAGE_LABELS: Record<CandidateStage, string> = {
  applied: "Candidaturas",
  screening: "Triagem",
  interview: "Entrevista",
  technical_test: "Teste Técnico",
  offer: "Proposta",
  hired: "Contratado",
  rejected: "Rejeitado",
};

export const KANBAN_STAGES: CandidateStage[] = ["applied", "screening", "interview", "technical_test", "offer"];

export const DEFAULT_JOB_DESCRIPTION_TEMPLATE = `### Sobre a Empresa

[Descreva brevemente sua empresa, cultura e valores]

### Sobre a Vaga

[Descreva as responsabilidades e o dia-a-dia da posição]

### O que buscamos

[Liste as características desejadas no candidato ideal]

### O que oferecemos

[Destaque os benefícios e diferenciais da vaga]
`;

export const DEFAULT_JOB_FORM_DATA: JobFormData = {
  title: "",
  department: "",
  unit: "",
  work_model: "onsite",
  contract_type: "clt",
  seniority: "",
  openings_count: 1,
  position: "",
  description_tone: "",
  description_context: "",
  description: DEFAULT_JOB_DESCRIPTION_TEMPLATE,
  required_skills: [],
  desired_skills: [],
  experience_years: null,
  education_level: "",
  languages: [],
  requirements: "",
  salary_type: "not_disclosed",
  salary_min: null,
  salary_max: null,
  benefits: [],
  application_deadline: null,
  expected_start_date: null,
  urgency: "medium",
  require_cover_letter: false,
  tags: [],
  status: "draft",
};
