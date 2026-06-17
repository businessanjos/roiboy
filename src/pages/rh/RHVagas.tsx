import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Briefcase, Plus, MoreVertical, Pencil, Trash2, Users, Send, XCircle, ArrowLeft, CheckSquare, Settings2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useHRJobs, useDeleteHRJob, useUpdateHRJob, useHRJobStats } from "@/hooks/useHRJobs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HRJob, JobStatus } from "@/types/job";
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS } from "@/types/job";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAccountUsersForJobs } from "@/hooks/useHRJobStages";
import { OPENING_REASON_LABELS } from "@/types/job";
import { Clock, User as UserIcon, AlertTriangle } from "lucide-react";
import { JobsBulkEditDialog } from "@/components/rh/jobs/JobsBulkEditDialog";

export default function RHVagas() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const { data: jobs, isLoading } = useHRJobs({ status: statusFilter });
  const { data: stats } = useHRJobStats();
  const deleteJob = useDeleteHRJob();
  const updateJob = useUpdateHRJob();
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; job: HRJob | null }>({ open: false, job: null });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const allSelected = jobs && jobs.length > 0 && selectedIds.length === jobs.length;
  const toggleAll = () => setSelectedIds(allSelected ? [] : (jobs || []).map(j => j.id));

  const confirmDelete = async () => {
    if (deleteDialog.job) { await deleteJob.mutateAsync(deleteDialog.job.id); setDeleteDialog({ open: false, job: null }); }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/rh")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Vagas</h1>
            <p className="text-sm text-muted-foreground">Gerencie vagas e candidaturas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={selectMode ? "default" : "outline"} onClick={() => { setSelectMode(s => !s); setSelectedIds([]); }}>
            <CheckSquare className="h-4 w-4 mr-2" />{selectMode ? "Sair da seleção" : "Editar em lote"}
          </Button>
          <Button onClick={() => navigate("/rh/vacancies/new")}><Plus className="h-4 w-4 mr-2" />Nova Vaga</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground font-medium">Vagas Ativas</p><p className="text-2xl font-bold">{stats?.activeJobs ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground font-medium">Total Candidaturas</p><p className="text-2xl font-bold">{stats?.totalApplications ?? 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground font-medium">Contratados</p><p className="text-2xl font-bold">{stats?.hiredCount ?? 0}</p></Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as JobStatus | "all")}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(JOB_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectMode && (
          <>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {allSelected ? "Limpar seleção" : "Selecionar todas"}
            </Button>
            <span className="text-sm text-muted-foreground">{selectedIds.length} selecionada(s)</span>
            <Button size="sm" disabled={selectedIds.length === 0} onClick={() => setBulkOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2" />Aplicar alterações
            </Button>
          </>
        )}
      </div>

      {/* Jobs list */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>
      ) : !jobs?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-20 w-20 rounded-xl border-2 border-muted-foreground/20 bg-muted/50 flex items-center justify-center mb-6">
            <Briefcase className="h-10 w-10 text-muted-foreground/60" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Nenhuma vaga ainda</h3>
          <p className="text-muted-foreground max-w-sm mb-6">Comece criando sua primeira vaga.</p>
          <Button onClick={() => navigate("/rh/vacancies/new")} size="lg"><Plus className="h-4 w-4 mr-2" />Nova Vaga</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map(job => (
            <Card key={job.id} className={`hover:shadow-md transition-shadow cursor-pointer ${selectMode && selectedIds.includes(job.id) ? "ring-2 ring-primary" : ""}`} onClick={() => selectMode ? toggleSelect(job.id) : navigate(`/rh/vacancies/${job.id}`)}>
              <CardHeader className="pb-2">
                {selectMode && (
                  <div className="mb-2" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.includes(job.id)} onCheckedChange={() => toggleSelect(job.id)} />
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg truncate">{job.title}</CardTitle>
                      {(job.openings_count ?? 1) > 1 && (
                        <Badge variant="secondary" className="text-[10px] py-0">{job.openings_count} posições</Badge>
                      )}
                    </div>
                    {job.position && <p className="text-sm text-muted-foreground">{job.position}</p>}
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Badge variant="outline" className={JOB_STATUS_COLORS[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/rh/vacancies/${job.id}/edit`)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                        {job.status === "draft" && <DropdownMenuItem onClick={() => updateJob.mutate({ id: job.id, status: "active" })}><Send className="h-4 w-4 mr-2" />Publicar</DropdownMenuItem>}
                        {job.status === "active" && <DropdownMenuItem onClick={() => updateJob.mutate({ id: job.id, status: "closed" })}><XCircle className="h-4 w-4 mr-2" />Encerrar</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => navigate(`/rh/vacancies/${job.id}`)}><Users className="h-4 w-4 mr-2" />Ver Candidatos</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteDialog({ open: true, job })} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {job.department && <p className="text-sm text-muted-foreground">Departamento: {job.department}</p>}
                <JobMetaRow job={job} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialog.open} onOpenChange={o => setDeleteDialog({ ...deleteDialog, open: o })}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir vaga?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "{deleteDialog.job?.title}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <JobsBulkEditDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        jobs={jobs || []}
        selectedIds={selectedIds}
      />
    </div>
  );
}

function JobMetaRow({ job }: { job: HRJob }) {
  const { data: users } = useAccountUsersForJobs();
  const manager = users?.find(u => u.id === (job as any).hiring_manager_id);
  const openedAt = (job as any).opened_at || job.created_at;
  const daysOpen = differenceInCalendarDays(new Date(), new Date(openedAt));
  const target = (job as any).target_fill_date ? new Date((job as any).target_fill_date) : null;
  const daysLeft = target ? differenceInCalendarDays(target, new Date()) : null;

  let slaTone: string | null = null;
  let slaText: string | null = null;
  if (job.status === "active" && daysLeft !== null) {
    if (daysLeft < 0) { slaTone = "bg-red-500/15 text-red-700 border-red-300"; slaText = `Atrasada ${Math.abs(daysLeft)}d`; }
    else if (daysLeft <= 7) { slaTone = "bg-amber-500/15 text-amber-700 border-amber-300"; slaText = `${daysLeft}d para o prazo`; }
    else { slaTone = "bg-emerald-500/15 text-emerald-700 border-emerald-300"; slaText = `${daysLeft}d no prazo`; }
  }
  const reason = (job as any).opening_reason;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{daysOpen}d em aberto</span>
      {manager && <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" />{manager.name?.split(" ")[0] || manager.email}</span>}
      {reason && OPENING_REASON_LABELS[reason] && <Badge variant="outline" className="text-[10px] py-0">{OPENING_REASON_LABELS[reason]}</Badge>}
      {slaText && (
        <Badge variant="outline" className={`text-[10px] py-0 ${slaTone}`}>
          {daysLeft! < 0 && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}{slaText}
        </Badge>
      )}
      <span className="ml-auto">{format(new Date(job.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
    </div>
  );
}
