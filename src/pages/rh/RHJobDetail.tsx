import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Pencil, Copy, Check, FileText, ExternalLink, Mail } from "lucide-react";
import { useHRJobById } from "@/hooks/useHRJobs";
import CandidateKanbanBoard from "@/components/rh/jobs/CandidateKanbanBoard";
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS } from "@/types/job";
import { format } from "date-fns";
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


export default function RHJobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading } = useHRJobById(id);
  const [copied, setCopied] = useState(false);
  const [offers, setOffers] = useState<JobOfferRow[]>([]);
  const applicationUrl = `${window.location.origin}/rh/vacancies/${id}/aplicar`;

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
      <CandidateKanbanBoard jobId={job.id} jobTitle={job.title} />
    </div>
  );
}
