import { useEffect, useId, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Copy, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useMarketingTeamUsers } from "@/hooks/useMarketingTeamUsers";
import { useMarketingTasks, MarketingTask, MarketingTaskPriority, MediaAttachment } from "@/hooks/useMarketingTasks";
import { useMarketingTaskSections } from "@/hooks/useMarketingTaskSections";
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
import { Separator } from "@/components/ui/separator";
import { MarketingTaskMediaUpload } from "./MarketingTaskMediaUpload";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { toast } from "sonner";
import { readTaskDetails, writeTaskDetails, taskCopyDraft, taskLabelCatalog, validDeliveryTime, deliveryTimeInput, type TaskLabel, type TaskCopySubtask } from "@/lib/marketing/taskDetails";
import { TaskLabelEditor } from "./TaskLabels";

interface MarketingTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: string | null;
  defaultSectionId?: string | null;
  defaultColumnId?: string | null;
  defaultAssigneeId?: string | null;
}

export function MarketingTaskDialog({
  open,
  onOpenChange,
  taskId,
  defaultSectionId,
  defaultColumnId,
  defaultAssigneeId,
}: MarketingTaskDialogProps) {
  const { tasks, createTask, updateTask, deleteTask } = useMarketingTasks();
  const { sections } = useMarketingTaskSections();
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
  const [sectionId, setSectionId] = useState<string | undefined>(undefined);
  const [columnId, setColumnId] = useState<string | undefined>(undefined);
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<MarketingTaskPriority>("medium");
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
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
      setSectionId(draft.section_id || undefined);
      setColumnId(draft.column_id || undefined);
      setAssigneeId(draft.assignee_id || undefined);
      setDueDate(draft.due_date ? parseLocalDate(draft.due_date) || undefined : undefined);
      setDueTime(details.dueTime);
      setRequesterId(details.requesterId || undefined);
      setLabels(details.labels);
      setPriority(draft.priority);
      setMediaAttachments(draft.media_attachments || []);
    } else {
      setTitle(""); setDescription("");
      setSectionId(defaultSectionId || undefined);
      setColumnId(defaultColumnId || columns[0]?.id);
      setAssigneeId(defaultAssigneeId || undefined);
      setDueDate(undefined); setDueTime("");
      setRequesterId(teamMembers.some((member) => member.id === currentUser?.id) ? currentUser?.id : undefined);
      setLabels([]); setPriority("medium"); setMediaAttachments([]);
    }
  }, [open, existingTask, copySource, defaultSectionId, defaultColumnId, defaultAssigneeId, columns]);

  const handleDuplicate = async () => {
    if (!existingTask || isSubmitting) return;
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
    if (isSubmitting || !title.trim() || (dueTime && (!dueDate || !validDeliveryTime(dueTime)))) return;

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
        assignee_id: assigneeId && assigneeId !== "none" ? assigneeId : null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        priority,
        status: finalColumn?.is_done ? "done" as const : "pending" as const,
        is_completed: !!finalColumn?.is_done,
        tags: labels.map((label) => label.name),
        custom_fields: customFields,
        media_attachments: mediaAttachments,
      };
      if (isEditing && taskId) await updateTask.mutateAsync({ id: taskId, ...input });
      else await createTask.mutateAsync({ ...input, ...(copySource ? { copy_subtasks: copySubtasks } : {}) });
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
    setShowDeleteDialog(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!isSubmitting) onOpenChange(next); }}>
        <DialogContent ref={setPortalContainer} aria-describedby={undefined} className="flex max-w-2xl max-h-[90dvh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-4 py-5 sm:px-6">
            <DialogTitle className="pr-10 tracking-normal">{copySource ? "Duplicar Tarefa" : isEditing ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6 space-y-4">
              {/* Main task form */}
              <form id={formId} onSubmit={handleSubmit} className="space-y-4">
                <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nome da tarefa"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detalhes da tarefa..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Section */}
                  <div className="space-y-2">
                    <Label>Seção</Label>
                    <Select value={sectionId} onValueChange={setSectionId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma seção" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem seção</SelectItem>
                        {sections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assignee */}
                  <div className="space-y-2">
                    <Label htmlFor="task-assignee">Responsável pela execução</Label>
                    <Select value={assigneeId || "none"} onValueChange={setAssigneeId}>
                      <SelectTrigger id="task-assignee" className="h-11 text-base sm:text-sm">
                        <SelectValue placeholder="Selecione o responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem responsável</SelectItem>
                        {assigneeId && assigneeId !== "none" && !teamMembers.some((member) => member.id === assigneeId) && (
                          <SelectItem value={assigneeId}>{existingTask?.assignee?.name || "Responsável atual"}</SelectItem>
                        )}
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-requester">Solicitante da demanda</Label>
                  <Select value={requesterId || "none"} onValueChange={setRequesterId}>
                    <SelectTrigger id="task-requester" className="h-11 text-base sm:text-sm"><SelectValue placeholder="Selecione o solicitante" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem solicitante</SelectItem>
                      {requesterId && requesterId !== "none" && !teamMembers.some((member) => member.id === requesterId) && (
                        <SelectItem value={requesterId}>{readTaskDetails(copySource ?? existingTask ?? { custom_fields: {}, tags: [] }).requesterName || "Solicitante atual"}</SelectItem>
                      )}
                      {teamMembers.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px]">
                  <div className="space-y-2">
                    <Label htmlFor="task-delivery-date">Data de entrega</Label>
                    <Input id="task-delivery-date" type="date" className="h-11" value={dueDate ? format(dueDate, "yyyy-MM-dd") : ""}
                      onChange={(event) => { setDueDate(event.target.value ? parseLocalDate(event.target.value) || undefined : undefined); if (!event.target.value) setDueTime(""); }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-delivery-time">Horário de entrega</Label>
                    <div className="relative">
                      <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="task-delivery-time" type="text" inputMode="numeric" placeholder="HH:mm" maxLength={5} className="h-11 pl-9"
                        value={dueTime} onChange={(event) => setDueTime(deliveryTimeInput(event.target.value))} disabled={!dueDate}
                        aria-invalid={!!dueTime && !validDeliveryTime(dueTime)} />
                    </div>
                  </div>
                </div>

                <TaskLabelEditor value={labels} onChange={setLabels} catalog={labelCatalog} portalContainer={portalContainer} />

                {/* Priority & Status */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as MarketingTaskPriority)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Etapa</Label>
                    <Select value={columnId} onValueChange={setColumnId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full" style={{ background: c.color }} />
                              {c.title}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                </fieldset>
              </form>

              {/* Subtasks Section - OUTSIDE the main form to prevent event bubbling */}
              <Separator className="my-4" />
              {copySource ? <div className="space-y-2">
                <Label>Subtarefas ({copySubtasks.length})</Label>
                {copySubtasks.map((subtask, index) => <p key={index} className="border-b py-2 text-sm">{subtask.title}</p>)}
              </div> : <SubtaskList taskId={isEditing ? taskId : null} />}

              {/* Media Attachments Section - OUTSIDE the main form */}
              <Separator className="my-4" />
              <MarketingTaskMediaUpload
                attachments={mediaAttachments}
                onAttachmentsChange={setMediaAttachments}
                accountId={currentUser?.account_id || ""}
              />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 py-3 sm:px-6">
            <div className="flex gap-1">
              {isEditing && <>
                <Button type="button" variant="outline" className="h-11" onClick={handleDuplicate} disabled={isSubmitting}><Copy />Duplicar tarefa</Button>
                <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-destructive" aria-label="Excluir tarefa" title="Excluir tarefa" onClick={() => setShowDeleteDialog(true)} disabled={isSubmitting}><Trash2 /></Button>
              </>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" form={formId} className="h-11" disabled={isSubmitting || !title.trim() || (!!dueTime && (!dueDate || !validDeliveryTime(dueTime)))}>
                {isSubmitting && <Loader2 className="motion-safe:animate-spin" />}{copySource ? "Criar cópia" : isEditing ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tarefa e suas subtarefas serão permanentemente excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
