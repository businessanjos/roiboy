import { useEffect, useId, useRef, useState } from "react";
import { parseLocalDate } from "@/lib/dateUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Copy, Loader2, Trash2, AlignLeft, Users, CalendarDays, Settings2, ImagePlus, ChevronDown, Check, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { useMarketingTeamUsers } from "@/hooks/useMarketingTeamUsers";
import { filterMarketingTaskAssignees, isHiddenMarketingTaskAssignee } from "@/lib/marketing/marketingPeopleVisibility";
import { useMarketingTasks, MarketingTask, MarketingTaskPriority, MediaAttachment } from "@/hooks/useMarketingTasks";
import { useMarketingTaskColumns } from "@/hooks/useMarketingTaskColumns";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SubtaskList } from "./SubtaskList";
import { MarketingTaskMediaUpload } from "./MarketingTaskMediaUpload";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { toast } from "sonner";
import { readTaskDetails, writeTaskDetails, taskCopyDraft, taskLabelCatalog, validDeliveryTime, deliveryTimeInput, hasTaskResponsible, type TaskLabel, type TaskCopySubtask } from "@/lib/marketing/taskDetails";
import { TaskLabelEditor } from "./TaskLabels";
import { TaskCoverEditor } from "./TaskCover";
import { TaskComments } from "./TaskComments";
import { TaskDescriptionEditor } from "./TaskDescriptionEditor";
import { TaskDeliveryDate } from "./TaskDeliveryDate";
import { taskDescriptionContent, readTaskMarkerColors, writeTaskDescription } from "@/lib/marketing/taskDescription";
import type { JSONContent } from "@tiptap/react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { attachmentKey, readTaskCover, writeTaskCover, TASK_FILES_BUCKET, type TaskCover } from "@/lib/marketing/taskPresentation";

interface MarketingTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: string | null;
  defaultSectionId?: string | null;
  defaultColumnId?: string | null;
  defaultAssigneeId?: string | null;
  focusCommentId?: string | null;
}

export function MarketingTaskDialog({
  open,
  onOpenChange,
  taskId,
  defaultSectionId,
  defaultColumnId,
  defaultAssigneeId,
  focusCommentId,
}: MarketingTaskDialogProps) {
  const { tasks, createTask, updateTask, deleteTask } = useMarketingTasks();
  const { columns } = useMarketingTaskColumns();
  const { currentUser } = useCurrentUser();

  const existingTask = taskId ? tasks.find((t) => t.id === taskId) : null;
  const [copySource, setCopySource] = useState<MarketingTask | null>(null);
  const [copySubtasks, setCopySubtasks] = useState<TaskCopySubtask[]>([]);
  const isEditing = !!existingTask && !copySource;
  const formId = useId();
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [dueTime, setDueTime] = useState("");
  const [requesterId, setRequesterId] = useState<string | undefined>();
  const [labels, setLabels] = useState<TaskLabel[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionDocument, setDescriptionDocument] = useState<JSONContent>({ type: "doc", content: [{ type: "paragraph" }] });
  const [markerColors, setMarkerColors] = useState<string[]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [dateValid, setDateValid] = useState(true);
  const [sectionId, setSectionId] = useState<string | undefined>(undefined);
  const [columnId, setColumnId] = useState<string | undefined>(undefined);
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<MarketingTaskPriority>("medium");
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
  const [cover, setCover] = useState<TaskCover>(null);
  const [isUploading, setIsUploading] = useState(false);
  const draftUploads = useRef<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch team members
  const { data: teamMembers = [] } = useMarketingTeamUsers();

  const labelCatalog = taskLabelCatalog(tasks);

  useEffect(() => {
    if (!open) { setCopySource(null); setCopySubtasks([]); return; }
    const source = copySource ?? existingTask;
    if (source) {
      const draft = copySource ? taskCopyDraft(source, columns.find((column) => !column.is_done)?.id) : source;
      const details = readTaskDetails(source);
      setTitle(draft.title);
      setDescription(draft.description || "");
      setDescriptionDocument(taskDescriptionContent(draft.description || "", source.custom_fields?.description_editor));
      setMarkerColors(readTaskMarkerColors(source.custom_fields));
      setSectionId(draft.section_id || undefined);
      setColumnId(draft.column_id || undefined);
      setAssigneeId(draft.assignee_id || undefined);
      setDueDate(draft.due_date ? parseLocalDate(draft.due_date) || undefined : undefined);
      setDueTime(details.dueTime);
      setRequesterId(details.requesterId || undefined);
      setLabels(details.labels);
      setPriority(draft.priority);
      setMediaAttachments(draft.media_attachments || []);
      setCover(readTaskCover(source));
    } else {
      setTitle(""); setDescription("");
      setDescriptionDocument(taskDescriptionContent("", undefined)); setMarkerColors([]);
      setSectionId(defaultSectionId || undefined);
      setColumnId(defaultColumnId || columns[0]?.id);
      setAssigneeId(defaultAssigneeId || undefined);
      setDueDate(undefined); setDueTime("");
      setRequesterId(teamMembers.some((member) => member.id === currentUser?.id) ? currentUser?.id : undefined);
      setLabels([]); setPriority("medium"); setMediaAttachments([]);
      setCover(null);
    }
    setDateValid(true); setEditorKey((key) => key + 1);
  }, [open, existingTask, copySource, defaultSectionId, defaultColumnId, defaultAssigneeId, columns]);

  const cleanupUploads = async (kept: MediaAttachment[] = []) => {
    const keptPaths = new Set(kept.filter((a) => a.bucket === TASK_FILES_BUCKET).map((a) => a.path));
    const unused = draftUploads.current.filter((path) => !keptPaths.has(path));
    draftUploads.current = [];
    if (unused.length) await supabase.storage.from(TASK_FILES_BUCKET).remove(unused);
  };
  const closeDraft = async () => {
    if (isSubmitting || isUploading) return;
    setIsSubmitting(true);
    try { await cleanupUploads(); onOpenChange(false); }
    finally { setIsSubmitting(false); }
  };

  const handleDuplicate = async () => {
    if (!existingTask || isSubmitting || isUploading) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await fetchAllRows<TaskCopySubtask>((from, to) => supabase
        .from("marketing_task_subtasks").select("title, due_date, assignee_id, display_order")
        .eq("task_id", existingTask.id).eq("account_id", existingTask.account_id)
        .order("display_order").order("id").range(from, to));
      if (error) throw error;
      setCopySubtasks(data ?? []);
      setCopySource(existingTask);
    } catch { toast.error("Não foi possível preparar a cópia da tarefa. Tente novamente."); }
    finally { setIsSubmitting(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isUploading || !dateValid || !title.trim() || (dueTime && (!dueDate || !validDeliveryTime(dueTime)))) return;
    if (!hasTaskResponsible(assigneeId)) {
      toast.error("Selecione um responsável pela execução.");
      document.getElementById("task-assignee")?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const finalColumn = columns.find((column) => column.id === columnId);
      const finalRequesterId = requesterId && requesterId !== "none" ? requesterId : null;
      const source = copySource ?? existingTask;
      const previousDetails = source ? readTaskDetails(source) : null;
      const customFields = writeTaskDetails(source?.custom_fields, {
        dueTime: dueDate ? dueTime : "",
        requesterId: finalRequesterId,
        requesterName: teamMembers.find((member) => member.id === finalRequesterId)?.name
          ?? (previousDetails?.requesterId === finalRequesterId ? previousDetails?.requesterName ?? null : null),
        labels,
      });
      const input = {
        title: title.trim(),
        description: description.trim() || null,
        section_id: sectionId && sectionId !== "none" ? sectionId : null,
        column_id: finalColumn?.id ?? null,
        assignee_id: assigneeId,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        priority,
        status: finalColumn?.is_done ? "done" as const : "pending" as const,
        is_completed: !!finalColumn?.is_done,
        tags: labels.map((label) => label.name),
        custom_fields: writeTaskDescription(writeTaskCover(customFields, cover), description.trim(), descriptionDocument, markerColors),
        media_attachments: mediaAttachments,
      };
      if (isEditing && taskId) await updateTask.mutateAsync({ id: taskId, ...input });
      else await createTask.mutateAsync({ ...input, ...(copySource ? { copy_subtasks: copySubtasks } : {}) });
      await cleanupUploads(mediaAttachments);
      onOpenChange(false);
    } catch {
      // Mutation owns the error toast; keep the draft open for correction.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    await deleteTask.mutateAsync(taskId);
    await cleanupUploads();
    setShowDeleteDialog(false);
    onOpenChange(false);
  };

  const source = copySource ?? existingTask;
  const blocked = isSubmitting || isUploading;
  const hasResponsible = hasTaskResponsible(assigneeId);
  const selectPeople = (kind: "assignee" | "requester") => {
    const required = kind === "assignee";
    const personId = required ? (hasResponsible ? assigneeId : undefined) : requesterId;
    const label = kind === "assignee" ? "Responsável pela execução" : "Solicitante da demanda";
    const none = kind === "assignee" ? "Sem responsável" : "Sem solicitante";
    const fallbackName = kind === "assignee" ? source?.assignee?.name : source ? readTaskDetails(source).requesterName : null;
    const people = required ? filterMarketingTaskAssignees(teamMembers) : teamMembers;
    const currentName = teamMembers.find((member) => member.id === personId)?.name ?? fallbackName;
    const hiddenCurrent = required && !!personId && isHiddenMarketingTaskAssignee({ id: personId, name: currentName });
    return <div className="space-y-1.5">
      <Label htmlFor={`task-${kind}`} className="text-xs text-muted-foreground">{label}{required ? " *" : ""}</Label>
      <Select value={personId || (required ? "" : "none")} onValueChange={required ? setAssigneeId : setRequesterId} disabled={blocked}>
        <SelectTrigger id={`task-${kind}`} className="h-11" aria-required={required} aria-invalid={required && !hasResponsible && !!title.trim()} aria-describedby={required && !hasResponsible && title.trim() ? "task-assignee-error" : undefined}><SelectValue placeholder={required ? "Selecione o responsável" : undefined} /></SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value="none">{none}</SelectItem>}
          {/* Keep the legacy value in Radix's native form select without offering it as a choice. */}
          {hiddenCurrent && personId && <SelectItem value={personId} disabled aria-hidden="true" className="hidden">{currentName || "Pessoa atual"}</SelectItem>}
          {personId && personId !== "none" && !hiddenCurrent && !people.some((member) => member.id === personId) && <SelectItem value={personId}>{fallbackName || "Pessoa atual"}</SelectItem>}
          {people.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {required && !hasResponsible && title.trim() && <p id="task-assignee-error" className="text-xs text-destructive">Selecione um responsável pela execução.</p>}
    </div>;
  };

  return <>
    <Dialog open={open} onOpenChange={(next) => { if (!next) void closeDraft(); else onOpenChange(true); }}>
      <DialogContent ref={setPortalContainer} aria-describedby={undefined} className="flex h-[90dvh] max-h-[900px] w-[calc(100%-1.5rem)] max-w-[1060px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-2.5 pr-10 text-base tracking-normal"><ClipboardList className="h-5 w-5 text-primary" />{copySource ? "Duplicar Tarefa" : isEditing ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto md:overflow-hidden">
          <div className="grid min-w-0 md:h-full md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_320px]">
            <div role="region" aria-label="Conteúdo da tarefa" className="min-h-0 min-w-0 space-y-5 p-4 sm:p-5 md:overflow-y-auto">
              <form id={formId} onSubmit={handleSubmit} className="min-w-0 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-xs text-muted-foreground">Título *</Label>
                  <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nome da tarefa" disabled={blocked} autoFocus
                    className="h-auto min-h-12 border-0 border-b bg-transparent px-0 py-2 text-lg font-semibold shadow-none rounded-none focus-visible:ring-0 md:text-xl" />
                </div>
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2"><AlignLeft className="h-4 w-4 text-muted-foreground" />Descrição</Label>
                  <TaskDescriptionEditor key={editorKey} initialContent={descriptionDocument} valueKey={String(editorKey)}
                    onChange={(text, document) => { setDescription(text); setDescriptionDocument(document); }} colors={markerColors} onColorsChange={setMarkerColors}
                    disabled={blocked} portalContainer={portalContainer} />
                </div>
              </form>
              <div className="space-y-3 border-t pt-4">
                <MarketingTaskMediaUpload attachments={mediaAttachments} onAttachmentsChange={(next) => { setMediaAttachments(next); if (cover?.kind === "image" && !next.some((attachment) => attachmentKey(attachment) === cover.attachment)) setCover(null); }}
                  accountId={currentUser?.account_id || ""} disabled={isSubmitting} onUploadingChange={setIsUploading} onUploaded={(path) => draftUploads.current.push(path)} />
                <Collapsible><CollapsibleTrigger asChild><Button type="button" variant="ghost" className="w-full justify-between px-0" disabled={blocked}><span className="flex items-center gap-2"><ImagePlus className="h-4 w-4" />Capa {cover && <Check className="h-3.5 w-3.5 text-primary" />}</span><ChevronDown className="h-4 w-4 text-muted-foreground" /></Button></CollapsibleTrigger><CollapsibleContent className="pt-3"><TaskCoverEditor value={cover} onChange={setCover} attachments={mediaAttachments} disabled={blocked} /></CollapsibleContent></Collapsible>
              </div>
              <div className="border-t pt-4">
                {copySource ? <div className="space-y-2"><Label>Subtarefas ({copySubtasks.length})</Label>{copySubtasks.map((subtask, index) => <p key={index} className="border-b py-2 text-sm">{subtask.title}</p>)}</div>
                  : <SubtaskList taskId={isEditing ? taskId : null} />}
              </div>
              <div className="border-t pt-4"><TaskComments key={copySource ? "copy" : taskId || "new"} taskId={isEditing ? taskId : null} focusCommentId={isEditing ? focusCommentId : null} /></div>
            </div>
            <aside aria-label="Detalhes da tarefa" className="min-h-0 min-w-0 space-y-4 border-t bg-muted/15 p-4 sm:p-5 md:overflow-y-auto md:border-l md:border-t-0">
              <div className="space-y-3"><h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Users className="h-4 w-4" />Pessoas</h3>{selectPeople("requester")}{selectPeople("assignee")}</div>
              <div className="space-y-3 border-t pt-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><CalendarDays className="h-4 w-4" />Entrega</h3>
                <div className="grid gap-3">
                <div className="space-y-1.5"><Label htmlFor="task-delivery-date" className="text-xs text-muted-foreground">Data de entrega</Label>
                  <TaskDeliveryDate value={dueDate} onChange={(date) => { setDueDate(date); if (!date) setDueTime(""); }} onValidityChange={setDateValid} disabled={blocked} portalContainer={portalContainer} />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_116px] items-center gap-3"><Label htmlFor="task-delivery-time" className="text-xs text-muted-foreground">Horário de entrega</Label><div className="relative">
                  <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="task-delivery-time" type="text" inputMode="numeric" placeholder="HH:mm" maxLength={5} className="h-11 pl-9" value={dueTime} onChange={(event) => setDueTime(deliveryTimeInput(event.target.value))} disabled={blocked || !dueDate} aria-invalid={!!dueTime && !validDeliveryTime(dueTime)} />
                </div></div>
                </div>
              </div>
              <div className="space-y-3 border-t pt-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Settings2 className="h-4 w-4" />Organização</h3>
                <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="task-stage" className="text-xs text-muted-foreground">Etapa</Label><Select value={columnId} onValueChange={setColumnId} disabled={blocked}><SelectTrigger id="task-stage"><SelectValue placeholder="Selecione a etapa" /></SelectTrigger><SelectContent>{columns.map((column) => <SelectItem key={column.id} value={column.id}>{column.title}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label htmlFor="task-priority" className="text-xs text-muted-foreground">Prioridade</Label><Select value={priority} onValueChange={(value) => setPriority(value as MarketingTaskPriority)} disabled={blocked}><SelectTrigger id="task-priority"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Baixa</SelectItem><SelectItem value="medium">Média</SelectItem><SelectItem value="high">Alta</SelectItem></SelectContent></Select></div>
                </div>
                <TaskLabelEditor value={labels} onChange={setLabels} catalog={labelCatalog} portalContainer={portalContainer} />
              </div>
            </aside>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background px-4 py-3 sm:px-6">
          <div className="flex items-center gap-1">{isEditing && <>
            <Button type="button" variant="ghost" size="sm" className="h-10" onClick={handleDuplicate} disabled={blocked} aria-label="Duplicar tarefa"><Copy className="h-4 w-4" /><span className="hidden sm:inline">Duplicar tarefa</span></Button>
            <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-destructive" aria-label="Excluir tarefa" title="Excluir tarefa" onClick={() => setShowDeleteDialog(true)} disabled={blocked}><Trash2 className="h-4 w-4" /></Button>
          </>}</div>
          <div className="ml-auto flex items-center gap-2"><Button type="button" variant="outline" className="h-10" onClick={closeDraft} disabled={blocked}>Cancelar</Button><Button type="submit" form={formId} className="h-10" disabled={blocked || !dateValid || !title.trim() || !hasResponsible || (!!dueTime && (!dueDate || !validDeliveryTime(dueTime)))}>{isSubmitting && <Loader2 className="h-4 w-4 motion-safe:animate-spin" />}{copySource ? "Criar cópia" : isEditing ? "Salvar" : "Criar"}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir tarefa?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita. A tarefa e suas subtarefas serão permanentemente excluídas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
