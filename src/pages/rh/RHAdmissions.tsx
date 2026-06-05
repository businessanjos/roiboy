import { useMemo, useState } from "react";
import {
  DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor,
  useSensor, useSensors, useDroppable, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserPlus, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useHRAdmissions, useUpdateAdmission, HRAdmission, AdmissionStage,
  ADMISSION_STAGES, ADMISSION_STAGE_LABELS,
} from "@/hooks/useHRAdmissions";
import AdmissionDrawer from "@/components/rh/admissions/AdmissionDrawer";

function AdmissionCard({ adm, onClick, dragging }: { adm: HRAdmission; onClick: () => void; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: adm.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: dragging ? 0.5 : 1 };
  const initials = adm.candidate_name.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <div
      ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <Avatar className="h-9 w-9">
          <AvatarImage src={adm.candidate_photo_url || undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{adm.candidate_name}</p>
          <p className="text-xs text-muted-foreground truncate">{adm.position_title || "—"}</p>
          {adm.start_date && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(adm.start_date + "T00:00:00"), "dd MMM", { locale: ptBR })}
            </div>
          )}
        </div>
        <Badge variant="outline" className="text-[10px] h-4 px-1 uppercase">{adm.contract_type}</Badge>
      </div>
    </div>
  );
}

function Column({ stage, items, onClick, activeId }: {
  stage: AdmissionStage; items: HRAdmission[]; onClick: (a: HRAdmission) => void; activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${stage}`, data: { stage } });
  return (
    <div className="flex-1 min-w-[240px] max-w-[300px]">
      <div ref={setNodeRef} className={`bg-muted/50 rounded-lg p-3 h-full flex flex-col transition-colors ${isOver ? "bg-muted ring-2 ring-primary/50" : ""}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{ADMISSION_STAGE_LABELS[stage]}</h3>
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        </div>
        <ScrollArea className="flex-1 -mx-1 px-1">
          <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 min-h-[200px]">
              {items.map((a) => <AdmissionCard key={a.id} adm={a} dragging={activeId === a.id} onClick={() => onClick(a)} />)}
              {items.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">Vazio</p>}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}

export default function RHAdmissions() {
  const { data: admissions, isLoading } = useHRAdmissions();
  const updateAdmission = useUpdateAdmission();
  const [drawer, setDrawer] = useState<{ open: boolean; admission: HRAdmission | null }>({ open: false, admission: null });
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor));

  const byStage = useMemo(() => {
    const r: Record<AdmissionStage, HRAdmission[]> = { accepted: [], documents: [], medical_exam: [], contract: [], onboarding: [], admitted: [] };
    (admissions || []).forEach((a) => { if (r[a.stage]) r[a.stage].push(a); });
    return r;
  }, [admissions]);

  const activeAdm = useMemo(() => admissions?.find((a) => a.id === activeId) || null, [activeId, admissions]);

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const overId = e.over.id as string;
    const adm = admissions?.find((a) => a.id === e.active.id);
    if (!adm) return;
    let target: AdmissionStage | null = null;
    if (overId.startsWith("col-")) target = overId.replace("col-", "") as AdmissionStage;
    else {
      const t = admissions?.find((a) => a.id === overId);
      if (t) target = t.stage;
    }
    if (target && ADMISSION_STAGES.includes(target) && adm.stage !== target) {
      const patch: any = { id: adm.id, stage: target };
      if (target === "admitted" && !adm.admitted_at) patch.admitted_at = new Date().toISOString();
      updateAdmission.mutate(patch);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-500/10">
          <UserPlus className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admissões</h1>
          <p className="text-sm text-muted-foreground">Processo CLT pós-aceite da proposta · exame admissional, documentos e contrato</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline de admissão ({admissions?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex gap-4">{[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-[420px] w-[270px]" />)}</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {ADMISSION_STAGES.map((s) => (
                  <Column key={s} stage={s} items={byStage[s]} activeId={activeId} onClick={(a) => setDrawer({ open: true, admission: a })} />
                ))}
              </div>
              <DragOverlay>
                {activeAdm && (
                  <div className="bg-card border rounded-lg p-3 shadow-lg">
                    <p className="text-sm font-medium">{activeAdm.candidate_name}</p>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <AdmissionDrawer
        open={drawer.open}
        admission={drawer.admission}
        onOpenChange={(o) => setDrawer({ ...drawer, open: o })}
      />
    </div>
  );
}
