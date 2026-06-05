import { useEffect, useState } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useMarketingTasks, MarketingTask, MarketingTaskPriority, MarketingTaskStatus, MediaAttachment } from "@/hooks/useMarketingTasks";
import { useMarketingTaskSections } from "@/hooks/useMarketingTaskSections";
import { useMarketingTaskColumns } from "@/hooks/useMarketingTaskColumns";
import { useQuery } from "@tanstack/react-query";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarketingTaskMediaUpload } from "./MarketingTaskMediaUpload";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface MarketingTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: string | null;
  defaultSectionId?: string | null;
  defaultColumnId?: string | null;
}

export function MarketingTaskDialog({
  open,
  onOpenChange,
  taskId,
  defaultSectionId,
  defaultColumnId,
}: MarketingTaskDialogProps) {
  const { tasks, createTask, updateTask, deleteTask } = useMarketingTasks();
  const { sections } = useMarketingTaskSections();
  const { columns } = useMarketingTaskColumns();
  const { currentUser } = useCurrentUser();

  const existingTask = taskId ? tasks.find((t) => t.id === taskId) : null;
  const isEditing = !!existingTask;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sectionId, setSectionId] = useState<string | undefined>(undefined);
  const [columnId, setColumnId] = useState<string | undefined>(undefined);
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<MarketingTaskPriority>("medium");
  const [status, setStatus] = useState<MarketingTaskStatus>("pending");
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (existingTask) {
        setTitle(existingTask.title);
        setDescription(existingTask.description || "");
        setSectionId(existingTask.section_id || undefined);
        setColumnId(existingTask.column_id || undefined);
        setAssigneeId(existingTask.assignee_id || undefined);
        setDueDate(existingTask.due_date ? (parseLocalDate(existingTask.due_date) || undefined) : undefined);
        setPriority(existingTask.priority);
        setStatus(existingTask.status);
        setMediaAttachments(existingTask.media_attachments || []);
      } else {
        setTitle("");
        setDescription("");
        setSectionId(defaultSectionId || undefined);
        setColumnId(defaultColumnId || columns[0]?.id);
        setAssigneeId(undefined);
        setDueDate(undefined);
        setPriority("medium");
        setStatus("pending");
        setMediaAttachments([]);
      }
    }
  }, [open, existingTask, defaultSectionId, defaultColumnId, columns]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const finalSectionId = sectionId === "none" ? undefined : sectionId;
      const finalAssigneeId = assigneeId === "none" ? undefined : assigneeId;
      const finalColumn = columns.find((c) => c.id === columnId);
      const derivedStatus: MarketingTaskStatus = finalColumn?.is_done ? "done" : "pending";
      const derivedCompleted = !!finalColumn?.is_done;

      if (isEditing && taskId) {
        await updateTask.mutateAsync({
          id: taskId,
          title: title.trim(),
          description: description.trim() || undefined,
          section_id: finalSectionId,
          column_id: finalColumn?.id,
          assignee_id: finalAssigneeId,
          due_date: dueDate?.toISOString().split("T")[0],
          priority,
          status: derivedStatus,
          is_completed: derivedCompleted,
          media_attachments: mediaAttachments,
        });
      } else {
        await createTask.mutateAsync({
          title: title.trim(),
          description: description.trim() || undefined,
          section_id: finalSectionId,
          column_id: finalColumn?.id,
          assignee_id: finalAssigneeId,
          due_date: dueDate?.toISOString().split("T")[0],
          priority,
          status: derivedStatus,
          media_attachments: mediaAttachments,
        });
      }
      onOpenChange(false);
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>{isEditing ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-100px)]">
            <div className="px-6 pb-6 space-y-4">
              {/* Main task form */}
              <form onSubmit={handleSubmit} className="space-y-4">
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

                <div className="grid grid-cols-2 gap-4">
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
                    <Label>Responsável</Label>
                    <Select value={assigneeId} onValueChange={setAssigneeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem responsável</SelectItem>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Due Date */}
                <div className="space-y-2">
                  <Label>Data de vencimento</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dueDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "PPP", { locale: ptBR }) : "Selecione uma data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Priority & Status */}
                <div className="grid grid-cols-2 gap-4">
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

                {/* Actions - inside form for submit button */}
                <div className="flex items-center justify-between pt-4">
                  {isEditing ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !title.trim()}>
                      {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {isEditing ? "Salvar" : "Criar"}
                    </Button>
                  </div>
                </div>
              </form>

              {/* Subtasks Section - OUTSIDE the main form to prevent event bubbling */}
              <Separator className="my-4" />
              <SubtaskList taskId={isEditing ? taskId : null} />

              {/* Media Attachments Section - OUTSIDE the main form */}
              <Separator className="my-4" />
              <MarketingTaskMediaUpload
                attachments={mediaAttachments}
                onAttachmentsChange={setMediaAttachments}
                accountId={currentUser?.account_id || ""}
              />
            </div>
          </ScrollArea>
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
