import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Pencil, Copy, Check, FileText, ExternalLink, Mail, Clock, User as UserIcon, Calendar as CalIcon, AlertTriangle } from "lucide-react";
import { useHRJobById } from "@/hooks/useHRJobs";
import { useHRJobStages, useAccountUsersForJobs } from "@/hooks/useHRJobStages";
import { useRecruitmentPartners } from "@/hooks/useRecruitmentPartners";
import CandidateKanbanBoard from "@/components/rh/jobs/CandidateKanbanBoard";
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS, OPENING_REASON_LABELS } from "@/types/job";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPublicOrigin } from "@/lib/publicLink";

interface JobOfferRow {
  id: string;
  public_token: string;
  candidate_name: string | null;
  candidate_email: string | null;
  status: string;
  salary_amount: number | null;
  salary_currency: string | null;
  sent_at: string | null;
  responded_at: string | null;
  view_count: number | null;
  created_at: string;
}

const OFFER_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  viewed: "Visualizada",
  accepted: "Aceita",
  declined: "Recusada",
  expired: "Expirada",
};

const OFFER_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  viewed: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  accepted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  declined: "bg-red-500/10 text-red-600 border-red-500/30",
  expired: "bg-muted text-muted-foreground",
};


function JobManagementPanel({ jobId, job }: { jobId: string; job: any }) {
  const { data: users } = useAccountUsersForJobs();
  const { data: partners } = useRecruitmentPartners();
  const manager = users?.find(u => u.id === job.hiring_manager_id);
  const recruiterUser = users?.find(u => u.id === job.recruiter_id);
  const recruiterPartner = partners?.find(p => p.id === job.recruiter_provider_id);
  const recruiterLabel = recruiterPartner
    ? (recruiterPartner.company_name ? `${recruiterPartner.company_name} (parceiro)` : `${recruiterPartner.full_name} (parceiro)`)
    : (recruiterUser?.name || recruiterUser?.email || "—");
  const openedAt = job.opened_at || job.created_at;
  const daysOpen = differenceInCalendarDays(new Date(), new Date(openedAt));
  const target = job.target_fill_date ? new Date(job.target_fill_date) : null;
  const daysLeft = target ? differenceInCalendarDays(target, new Date()) : null;
  let slaTone = ""; let slaText: string | null = null;
  if (daysLeft !== null) {
    if (daysLeft < 0) { slaTone = "bg-red-500/15 text-red-700 border-red-300"; slaText = `Atrasada ${Math.abs(daysLeft)}d`; }
    else if (daysLeft <= 7) { slaTone = "bg-amber-500/15 text-amber-700 border-amber-300"; slaText = `${daysLeft}d para o prazo`; }
    else { slaTone = "bg-emerald-500/15 text-emerald-700 border-emerald-300"; slaText = `${daysLeft}d no prazo`; }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Gestão da vaga</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><UserIcon className="h-3 w-3" />Gestor</p><p className="font-medium">{manager?.name || manager?.email || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><UserIcon className="h-3 w-3" />Recrutador</p><p className="font-medium">{recruiterLabel}</p></div>
          <div><p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Clock className="h-3 w-3" />Em aberto</p><p className="font-medium">{daysOpen}d</p></div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><CalIcon className="h-3 w-3" />Prazo</p>
            {target ? (
              <div className="flex items-center gap-2">
                <p className="font-medium">{format(target, "dd/MM/yyyy", { locale: ptBR })}</p>
                {slaText && <Badge variant="outline" className={`text-[10px] ${slaTone}`}>{daysLeft! < 0 && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}{slaText}</Badge>}
              </div>
            ) : <p className="text-muted-foreground">—</p>}
          </div>
        </div>
        {job.opening_reason && OPENING_REASON_LABELS[job.opening_reason] && (
          <p className="text-xs text-muted-foreground mt-3">Motivo da abertura: <span className="font-medium text-foreground">{OPENING_REASON_LABELS[job.opening_reason]}</span></p>
        )}
      </CardContent>
    </Card>
  );
}

function JobStagesPanel({ jobId }: { jobId: string }) {
  const { data: stages } = useHRJobStages(jobId);
  const { data: partners } = useRecruitmentPartners();
  if (!stages || stages.length === 0) return null;
  const partnerName = (id: string | null) => {
    if (!id) return null;
    const p = partners?.find(x => x.id === id);
    if (!p) return null;
    return p.company_name ? `${p.company_name} (parceiro)` : `${p.full_name} (parceiro)`;
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Etapas do processo seletivo</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stages.map((s, i) => {
            const pName = partnerName((s as any).owner_provider_id);
            const conduz = pName || s.owner_name;
            return (
              <div key={s.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-medium text-sm flex items-center gap-2"><Badge variant="secondary">{i + 1}</Badge>{s.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {s.owner_role && <Badge variant="outline" className="text-[10px]">{s.owner_role}</Badge>}
                    {s.sla_days && <span>{s.sla_days}d SLA</span>}
                  </div>
                </div>
                {conduz && <p className="text-xs text-muted-foreground mb-1"><strong>Conduz:</strong> {conduz}</p>}
                {s.what_to_do && <p className="text-xs mb-1">{s.what_to_do}</p>}
                {s.test_or_material && <p className="text-xs mb-2"><Badge variant="outline" className="text-[10px] mr-1">Teste/Material</Badge>{s.test_or_material}</p>}
                {s.evaluation_criteria?.length > 0 && (
                  <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                    {s.evaluation_criteria.map((c, j) => <li key={j}>{c}</li>)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}


export default function RHJobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading } = useHRJobById(id);
  const [copied, setCopied] = useState(false);
  const [offers, setOffers] = useState<JobOfferRow[]>([]);
  const applicationUrl = `${getPublicOrigin()}/rh/vacancies/${id}/aplicar`;

  useEffect(() => {
    if (!id) return;
    supabase
      .from("hr_job_offers")
      .select("id,public_token,candidate_name,candidate_email,status,salary_amount,salary_currency,sent_at,responded_at,view_count,created_at")
      .eq("job_id", id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setOffers((data as JobOfferRow[]) || []));
  }, [id]);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(applicationUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const copyOfferLink = async (token: string) => {
    await navigator.clipboard.writeText(`${getPublicOrigin()}/oferta/${token}`);
    toast.success("Link da carta-proposta copiado!");
  };


  if (isLoading) return <div className="p-6 space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  if (!job) return (
    <div className="text-center py-12 p-6">
      <h1 className="text-2xl font-bold mb-4">Vaga não encontrada</h1>
      <Button onClick={() => navigate("/rh/vacancies")}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
    </div>
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/rh/vacancies")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
              <Badge variant="outline" className={JOB_STATUS_COLORS[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
              {job.department && <span>{job.department}</span>}
              <span>{format(new Date(job.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/rh/vacancies/${job.id}/edit`)}><Pencil className="h-4 w-4 mr-2" />Editar</Button>
          <Button variant="outline" onClick={handleCopyLink}>{copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}{copied ? "Copiado!" : "Copiar Link"}</Button>
        </div>
      </div>
      <JobManagementPanel jobId={job.id} job={job as any} />
      <JobStagesPanel jobId={job.id} />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cartas-Proposta ({offers.length})
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => navigate(`/rh/offers/new?job=${job.id}`)}>
            Nova carta-proposta
          </Button>
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma carta-proposta vinculada a esta vaga ainda.</p>
          ) : (
            <div className="space-y-2">
              {offers.map((o) => (
                <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{o.candidate_name || "Sem nome"}</span>
                      <Badge variant="outline" className={OFFER_STATUS_COLORS[o.status] || ""}>
                        {OFFER_STATUS_LABELS[o.status] || o.status}
                      </Badge>
                      {o.salary_amount && (
                        <span className="text-xs text-muted-foreground">
                          {o.salary_currency || "BRL"} {Number(o.salary_amount).toLocaleString("pt-BR")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {o.candidate_email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{o.candidate_email}</span>}
                      <span>Criada em {format(new Date(o.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                      {o.sent_at && <span>Enviada em {format(new Date(o.sent_at), "dd/MM/yyyy", { locale: ptBR })}</span>}
                      {typeof o.view_count === "number" && o.view_count > 0 && <span>{o.view_count} visualização(ões)</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => copyOfferLink(o.public_token)} title="Copiar link">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" asChild title="Abrir carta-proposta">
                      <a href={`${getPublicOrigin()}/oferta/${o.public_token}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" asChild title="Editar">
                      <Link to={`/rh/offers/${o.id}/edit`}><Pencil className="h-3.5 w-3.5" /></Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CandidateKanbanBoard jobId={job.id} jobTitle={job.title} />
    </div>

  );
}

