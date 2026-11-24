import { useCallback, useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { MessageSquare, Send, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useMarketingTaskComments } from "@/hooks/useMarketingTaskComments";
import { useMarketingTeamUsers } from "@/hooks/useMarketingTeamUsers";
import { plainTaskDocument } from "@/lib/marketing/taskDescription";
import { writeTaskComment } from "@/lib/marketing/taskCommentContent";
import { cn } from "@/lib/utils";
import { TaskDescriptionEditor } from "./TaskDescriptionEditor";
import { TaskCommentBody } from "./TaskCommentBody";

const commentDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" });
const commentTime = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" });
const fullCommentDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
export function TaskComments({ taskId, focusCommentId }: { taskId?: string | null; focusCommentId?: string | null }) {
  const { comments, isLoading, error, add, remove, currentUser } = useMarketingTaskComments(taskId);
  const { data: mentionPeople = [] } = useMarketingTeamUsers();
  const [body, setBody] = useState("");
  const [document, setDocument] = useState<JSONContent>(() => plainTaskDocument(""));
  const [colors, setColors] = useState<string[]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastCommentId = comments.at(-1)?.id;
  const focusedComment = useRef<string | null>(null);
  const rootRef = useCallback((element: HTMLDivElement | null) => setPortalContainer(element?.closest<HTMLElement>('[role="dialog"]') ?? null), []);
  useEffect(() => {
    const element = conversation.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [lastCommentId]);
  useEffect(() => {
    if (!focusCommentId || focusedComment.current === focusCommentId) return;
    const element = conversation.current?.querySelector<HTMLElement>(`[data-comment-id="${CSS.escape(focusCommentId)}"]`);
    if (element) { focusedComment.current = focusCommentId; element.scrollIntoView({ block: "center" }); }
  }, [focusCommentId, comments]);
  const submit = async () => {
    if (!taskId || !body.trim() || add.isPending) return;
    try {
      stickToBottom.current = true;
      await add.mutateAsync(writeTaskComment(body, document));
      setBody(""); setDocument(plainTaskDocument("")); setEditorKey((key) => key + 1);
    } catch { /* Keep text and formatting on failure. */ }
  };
  return <div className="min-w-0 space-y-3" ref={rootRef}>
    <Label className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-muted-foreground" />Comentários {comments.length > 0 && <span className="text-xs text-muted-foreground">({comments.length})</span>}</Label>
    {error && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os comentários.</p>}
    <div ref={conversation} role="log" aria-label="Conversa da tarefa" aria-live="polite" className="max-h-80 min-w-0 space-y-3 overflow-y-auto overscroll-contain rounded-md border bg-muted/40 p-3 sm:p-4"
      onScroll={(event) => { const element = event.currentTarget; stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48; }}>
      {isLoading && taskId && <div className="flex justify-center py-3"><Loader2 aria-label="Carregando comentários" className="h-4 w-4 motion-safe:animate-spin text-muted-foreground" /></div>}
      {!isLoading && !error && !comments.length && <p className="py-3 text-center text-xs text-muted-foreground">{taskId ? "Nenhum comentário ainda." : "Salve a tarefa para comentar."}</p>}
      {comments.map((comment, index) => {
        const own = comment.user_id === currentUser?.id;
        const fullName = comment.author?.name || comment.author_name || "Usuário";
        const name = fullName.trim().split(/\s+/)[0] || "Usuário";
        const date = new Date(comment.created_at);
        const day = commentDate.format(date);
        const previous = comments[index - 1];
        const showDay = !previous || commentDate.format(new Date(previous.created_at)) !== day;
        return <div key={comment.id} data-comment-id={comment.id} className="space-y-3">
          {showDay && <div className="flex justify-center"><span className="rounded px-2 py-1 text-[11px] text-muted-foreground">{day}</span></div>}
          <div className={cn("flex items-end gap-2", own && "flex-row-reverse")}>
            <Avatar className="h-8 w-8 shrink-0 border border-background" title={fullName}>
              <AvatarImage src={comment.author?.avatar_url || undefined} alt={name} />
              <AvatarFallback className="bg-secondary text-xs font-medium text-secondary-foreground">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className={cn("min-w-0 max-w-[85%] rounded-lg border px-3 py-2 text-foreground", own ? "rounded-br-none border-primary/15 bg-zapp-message-out" : "rounded-bl-none border-border/60 bg-background", comment.id === focusCommentId && "ring-1 ring-primary/40")}>
              <p className="mb-1 truncate text-xs font-semibold text-foreground/80" title={fullName}>{name}</p>
              <TaskCommentBody body={comment.body} />
              <div className="mt-1 flex items-center justify-end gap-1.5">
                <time className="text-[10px] text-muted-foreground" dateTime={comment.created_at} title={fullCommentDate.format(date)}>{commentTime.format(date)}</time>
                {own && <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" aria-label="Excluir meu comentário" title="Excluir meu comentário" disabled={remove.isPending} onClick={() => setDeleting(comment.id)}><Trash2 className="h-3 w-3" /></Button>}
              </div>
            </div>
          </div>
        </div>
      })}
    </div>
    <TaskDescriptionEditor initialContent={document} valueKey={String(editorKey)} label="Novo comentário" compact
      onChange={(text, next) => { setBody(text); setDocument(next); }} colors={colors} onColorsChange={setColors}
      disabled={!taskId || add.isPending} portalContainer={portalContainer} mentionPeople={mentionPeople} />
    <div className="flex justify-end"><Button type="button" variant="default" size="sm" onClick={submit} disabled={!taskId || !body.trim() || add.isPending}>{add.isPending ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <Send className="h-4 w-4" />}Comentar</Button></div>
    <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open && !remove.isPending) setDeleting(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir seu comentário?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter>
        <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
        <Button variant="destructive" disabled={remove.isPending} onClick={async () => { if (!deleting) return; try { await remove.mutateAsync(deleting); setDeleting(null); } catch { /* Keep confirmation open. */ } }}>Excluir comentário</Button>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}