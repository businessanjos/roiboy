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
import { ArrowDownWideNarrow, MessageSquareText, Search, Users, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { countScreeningAnswers, normalizeSearch, screeningAnswersLength, screeningAnswersText } from "@/lib/hr/screeningAnswers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

function CandidateCard({ candidate, onClick, onAnswersClick, isDragging }: { candidate: HRJobApplication; onClick: () => void; onAnswersClick: () => void; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: candidate.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const answersCount = countScreeningAnswers((candidate as any).screening_answers);

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
      {answersCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onAnswersClick(); }}
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <MessageSquareText className="h-3 w-3" />
                {answersCount} {answersCount === 1 ? "resposta" : "respostas"}
              </button>
            </TooltipTrigger>
            <TooltipContent>Ver respostas de triagem</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

function KanbanColumn({ stage, candidates, onCandidateClick, activeId }: {
  stage: CandidateStage; candidates: HRJobApplication[]; onCandidateClick: (c: HRJobApplication, focusAnswers?: boolean) => void; activeId: string | null;
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
                <CandidateCard key={c.id} candidate={c} onClick={() => onCandidateClick(c)} onAnswersClick={() => onCandidateClick(c, true)} isDragging={activeId === c.id} />
              ))}
              {candidates.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">Nenhum candidato</div>}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}


export default function CandidateKanbanBoard({ jobId, jobTitle = "Vaga" }: { jobId: string; jobTitle?: string }) {
  const { data: candidates, isLoading } = useHRJobApplications(jobId);
  const updateStage = useUpdateCandidateStage();
  const [drawerState, setDrawerState] = useState<{ open: boolean; candidate: HRJobApplication | null; focusAnswers: boolean }>({ open: false, candidate: null, focusAnswers: false });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortByCompleteness, setSortByCompleteness] = useState(false);

  const filteredCandidates = useMemo(() => {
    const term = normalizeSearch(search.trim());
    let list = candidates || [];
    if (term) {
      list = list.filter((c) => {
        const haystack = normalizeSearch(
          [c.candidate_name, c.candidate_email, screeningAnswersText((c as any).screening_answers)]
            .filter(Boolean)
            .join(" ")
        );
        return haystack.includes(term);
      });
    }
    if (sortByCompleteness) {
      list = [...list].sort((a, b) => {
        const diff =
          countScreeningAnswers((b as any).screening_answers) -
          countScreeningAnswers((a as any).screening_answers);
        if (diff !== 0) return diff;
        return (
          screeningAnswersLength((b as any).screening_answers) -
          screeningAnswersLength((a as any).screening_answers)
        );
      });
    }
    return list;
  }, [candidates, search, sortByCompleteness]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor));

  const candidatesByStage = useMemo(() => {
    const result: Record<CandidateStage, HRJobApplication[]> = {
      applied: [], screening: [], interview: [], technical_test: [], offer: [], hired: [], rejected: [],
    };
    filteredCandidates.forEach(c => { if (result[c.stage]) result[c.stage].push(c); });
    return result;
  }, [filteredCandidates]);

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
            <Users className="h-5 w-5" />
            Seleção ({filteredCandidates.length}
            {search.trim() && candidates ? ` de ${candidates.length}` : ""} candidatos)
          </CardTitle>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, e-mail ou conteúdo das respostas de triagem..."
                className="pl-9 pr-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              type="button"
              variant={sortByCompleteness ? "default" : "outline"}
              size="sm"
              onClick={() => setSortByCompleteness((v) => !v)}
              className="gap-2 whitespace-nowrap"
            >
              <ArrowDownWideNarrow className="h-4 w-4" />
              Mais completos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={e => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {KANBAN_STAGES.map(stage => (
                <KanbanColumn key={stage} stage={stage} candidates={candidatesByStage[stage]} onCandidateClick={(c, focusAnswers) => setDrawerState({ open: true, candidate: c, focusAnswers: !!focusAnswers })} activeId={activeId} />
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
      <CandidateDetailDrawer open={drawerState.open} onOpenChange={o => setDrawerState({ ...drawerState, open: o })} candidate={drawerState.candidate} jobId={jobId} focusAnswers={drawerState.focusAnswers} />
    </>
  );
}
