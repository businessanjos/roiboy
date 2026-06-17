import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, BookOpen, Search, Mail, Phone, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { HRJobApplication, CandidateStage } from "@/types/job";
import { CANDIDATE_STAGE_LABELS } from "@/types/job";
import CandidateDetailDrawer from "@/components/rh/jobs/CandidateDetailDrawer";

const STAGE_VARIANTS: Record<CandidateStage, "default" | "secondary" | "outline" | "destructive"> = {
  applied: "secondary",
  screening: "secondary",
  interview: "default",
  technical_test: "default",
  offer: "default",
  hired: "default",
  rejected: "destructive",
};

const getScoreColor = (score: number | null): "default" | "secondary" | "outline" => {
  if (score === null) return "outline";
  if (score >= 80) return "default";
  if (score >= 60) return "secondary";
  return "outline";
};

interface TalentRow extends HRJobApplication {
  job_title: string | null;
  job_status: string | null;
}

export default function RHTalentPool() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<CandidateStage | "all">("all");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [drawer, setDrawer] = useState<{ open: boolean; candidate: HRJobApplication | null; jobId: string }>({
    open: false, candidate: null, jobId: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["rh-talent-pool", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_job_applications")
        .select("*, hr_jobs!inner(title, status, account_id)")
        .eq("account_id", currentUser!.account_id)
        .order("applied_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        job_title: r.hr_jobs?.title ?? null,
        job_status: r.hr_jobs?.status ?? null,
      })) as TalentRow[];
    },
  });

  const jobOptions = useMemo(() => {
    const map = new Map<string, string>();
    (data || []).forEach((r) => { if (r.job_id && r.job_title) map.set(r.job_id, r.job_title); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter((r) => {
      if (stageFilter !== "all" && r.stage !== stageFilter) return false;
      if (jobFilter !== "all" && r.job_id !== jobFilter) return false;
      if (!q) return true;
      return (
        r.candidate_name?.toLowerCase().includes(q) ||
        r.candidate_email?.toLowerCase().includes(q) ||
        (r.candidate_phone || "").toLowerCase().includes(q) ||
        (r.candidate_city || "").toLowerCase().includes(q) ||
        (r.desired_position || "").toLowerCase().includes(q) ||
        (r.job_title || "").toLowerCase().includes(q)
      );
    });
  }, [data, search, stageFilter, jobFilter]);

  const stats = useMemo(() => {
    const total = (data || []).length;
    const uniqueByEmail = new Set((data || []).map(r => r.candidate_email?.toLowerCase()).filter(Boolean)).size;
    const rejected = (data || []).filter(r => r.stage === "rejected").length;
    const hired = (data || []).filter(r => r.stage === "hired").length;
    return { total, uniqueByEmail, rejected, hired };
  }, [data]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rh")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Banco de Talentos</h1>
          <p className="text-sm text-muted-foreground">Todos os candidatos que já se aplicaram a alguma vaga</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground font-medium">Candidaturas</p><p className="text-2xl font-bold">{stats.total}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground font-medium">Pessoas únicas</p><p className="text-2xl font-bold">{stats.uniqueByEmail}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground font-medium">Contratados</p><p className="text-2xl font-bold">{stats.hired}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground font-medium">Em recolocação</p><p className="text-2xl font-bold">{stats.rejected}</p></Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, e-mail, telefone, cidade, cargo..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as CandidateStage | "all")}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etapas</SelectItem>
            {(Object.keys(CANDIDATE_STAGE_LABELS) as CandidateStage[]).map((s) => (
              <SelectItem key={s} value={s}>{CANDIDATE_STAGE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={jobFilter} onValueChange={setJobFilter}>
          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as vagas</SelectItem>
            {jobOptions.map(([id, title]) => (<SelectItem key={id} value={id}>{title}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum candidato encontrado.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidato</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Vaga</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Score IA</TableHead>
                <TableHead className="text-right">Aplicou em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setDrawer({ open: true, candidate: r, jobId: r.job_id })}>
                  <TableCell>
                    <div className="font-medium">{r.candidate_name}</div>
                    {r.desired_position && <div className="text-xs text-muted-foreground">{r.desired_position}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" />{r.candidate_email}</div>
                    {r.candidate_phone && <div className="text-xs flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{r.candidate_phone}</div>}
                  </TableCell>
                  <TableCell>
                    {(r.candidate_city || r.candidate_state) && (
                      <div className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" />{[r.candidate_city, r.candidate_state].filter(Boolean).join(", ")}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{r.job_title || "—"}</TableCell>
                  <TableCell><Badge variant={STAGE_VARIANTS[r.stage]}>{CANDIDATE_STAGE_LABELS[r.stage]}</Badge></TableCell>
                  <TableCell className="text-right">
                    {r.ai_score !== null ? <Badge variant={getScoreColor(r.ai_score)}>{r.ai_score}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {format(new Date(r.applied_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CandidateDetailDrawer
        open={drawer.open}
        onOpenChange={(o) => setDrawer((d) => ({ ...d, open: o }))}
        candidate={drawer.candidate}
        jobId={drawer.jobId}
      />
    </div>
  );
}
