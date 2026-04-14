import { useState, useMemo } from "react";
import {
  DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor,
  useSensor, useSensors, useDroppable, type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users } from "lucide-react";
import { useHRJobApplications, useUpdateCandidateStage } from "@/hooks/useHRJobs";
import type { HRJobApplication, CandidateStage } from "@/types/job";
import { CANDIDATE_STAGE_LABELS, KANBAN_STAGES } from "@/types/job";
import CandidateDetailDrawer from "./CandidateDetailDrawer";

const getScoreColor = (score: number | null) => {
  if (score === null) return "secondary";
  if (score >= 80) return "default";
  if (score >= 60) return "secondary";
  return "outline";
};

function CandidateCard({ candidate, onClick, isDragging }: { candidate: HRJobApplication; onClick: () => void; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: candidate.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
      onClick={onClick}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{candidate.candidate_name}</p>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {[candidate.candidate_city, candidate.candidate_state].filter(Boolean).join(", ") || candidate.candidate_email}
          </p>
        </div>
        {candidate.ai_score !== null && (
          <Badge variant={getScoreColor(candidate.ai_score)} className="text-xs font-semibold">{candidate.ai_score}</Badge>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ stage, candidates, onCandidateClick, activeId }: {
  stage: CandidateStage; candidates: HRJobApplication[]; onCandidateClick: (c: HRJobApplication) => void; activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${stage}`, data: { stage } });
  return (
    <div className="flex-1 min-w-[220px] max-w-[280px]">
      <div ref={setNodeRef} className={`bg-muted/50 rounded-lg p-3 h-full flex flex-col transition-colors ${isOver ? "bg-muted ring-2 ring-primary/50" : ""}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{CANDIDATE_STAGE_LABELS[stage]}</h3>
          <Badge variant="secondary" className="text-xs">{candidates.length}</Badge>
        </div>
        <ScrollArea className="flex-1 -mx-1 px-1">
          <SortableContext items={candidates.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 min-h-[200px]">
              {candidates.map(c => (
                <CandidateCard key={c.id} candidate={c} onClick={() => onCandidateClick(c)} isDragging={activeId === c.id} />
              ))}
              {candidates.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">Nenhum candidato</div>}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}

function CandidateDrawer({ open, onOpenChange, candidate }: { open: boolean; onOpenChange: (o: boolean) => void; candidate: HRJobApplication | null }) {
  if (!candidate) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{candidate.candidate_name}</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{candidate.candidate_email}</span></div>
            {candidate.candidate_phone && <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{candidate.candidate_phone}</span></div>}
            {(candidate.candidate_city || candidate.candidate_state) && (
              <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{[candidate.candidate_city, candidate.candidate_state].filter(Boolean).join(", ")}</span></div>
            )}
            <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-muted-foreground" /><span className="text-sm">Candidatou-se em {format(new Date(candidate.applied_at), "dd/MM/yyyy", { locale: ptBR })}</span></div>
          </div>
          <Separator />
          {candidate.ai_score !== null && (
            <div><p className="text-sm text-muted-foreground">Score IA</p><Badge variant={getScoreColor(candidate.ai_score)} className="text-lg">{candidate.ai_score}</Badge></div>
          )}
          {candidate.ai_report && (
            <div><p className="text-sm text-muted-foreground mb-1">Relatório IA</p><p className="text-sm whitespace-pre-wrap">{candidate.ai_report}</p></div>
          )}
          {candidate.notes && (
            <><Separator /><div><p className="text-sm text-muted-foreground mb-1">Notas</p><p className="text-sm">{candidate.notes}</p></div></>
          )}
          {candidate.resume_url && (
            <><Separator /><a href={candidate.resume_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Ver currículo</a></>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function CandidateKanbanBoard({ jobId, jobTitle = "Vaga" }: { jobId: string; jobTitle?: string }) {
  const { data: candidates, isLoading } = useHRJobApplications(jobId);
  const updateStage = useUpdateCandidateStage();
  const [drawerState, setDrawerState] = useState<{ open: boolean; candidate: HRJobApplication | null }>({ open: false, candidate: null });
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor));

  const candidatesByStage = useMemo(() => {
    const result: Record<CandidateStage, HRJobApplication[]> = {
      applied: [], screening: [], interview: [], technical_test: [], offer: [], hired: [], rejected: [],
    };
    (candidates || []).forEach(c => { if (result[c.stage]) result[c.stage].push(c); });
    return result;
  }, [candidates]);

  const activeCandidate = useMemo(() => candidates?.find(c => c.id === activeId) || null, [activeId, candidates]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const candidateId = active.id as string;
    const candidate = candidates?.find(c => c.id === candidateId);
    if (!candidate) return;
    let targetStage: CandidateStage | null = null;
    const overId = over.id as string;
    if (overId.startsWith("column-")) targetStage = overId.replace("column-", "") as CandidateStage;
    else {
      const target = candidates?.find(c => c.id === overId);
      if (target) targetStage = target.stage;
    }
    if (targetStage && KANBAN_STAGES.includes(targetStage) && candidate.stage !== targetStage) {
      updateStage.mutate({ candidateIds: [candidateId], stage: targetStage, jobId });
    }
  };

  if (isLoading) {
    return (
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Seleção</CardTitle></CardHeader>
        <CardContent><div className="flex gap-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-[400px] w-[250px]" />)}</div></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />Seleção ({candidates?.length || 0} candidatos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={e => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {KANBAN_STAGES.map(stage => (
                <KanbanColumn key={stage} stage={stage} candidates={candidatesByStage[stage]} onCandidateClick={c => setDrawerState({ open: true, candidate: c })} activeId={activeId} />
              ))}
            </div>
            <DragOverlay>
              {activeCandidate && (
                <div className="bg-card border rounded-lg p-3 shadow-lg cursor-grabbing">
                  <p className="font-medium text-sm">{activeCandidate.candidate_name}</p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </CardContent>
      </Card>
      <CandidateDrawer open={drawerState.open} onOpenChange={o => setDrawerState({ ...drawerState, open: o })} candidate={drawerState.candidate} />
    </>
  );
}
