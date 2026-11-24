import { useState } from "react";
import { MessageSquare, Send, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useMarketingTaskComments } from "@/hooks/useMarketingTaskComments";

const commentDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
export function TaskComments({ taskId }: { taskId?: string | null }) {
  const { comments, isLoading, error, add, remove, currentUser } = useMarketingTaskComments(taskId);
  const [body, setBody] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const submit = async () => { try { await add.mutateAsync(body); setBody(""); } catch { /* Keep text on failure. */ } };
  return <div className="space-y-3">
    <Label className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />Comentários {comments.length > 0 && `(${comments.length})`}</Label>
    {error && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os comentários.</p>}
    {isLoading && taskId && <Loader2 className="h-4 w-4 motion-safe:animate-spin text-muted-foreground" />}
    <div className="max-h-72 space-y-4 overflow-y-auto">
      {comments.map((comment) => <div key={comment.id} className="flex gap-2.5">
        <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={comment.author?.avatar_url || undefined} /><AvatarFallback className="text-xs">{comment.author?.name?.slice(0, 2).toUpperCase() || "?"}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span className="text-sm font-medium">{comment.author?.name || "Usuário"}</span><time className="text-xs text-muted-foreground" dateTime={comment.created_at}>{commentDate.format(new Date(comment.created_at))}</time></div>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{comment.body}</p>
        </div>
        {comment.user_id === currentUser?.id && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Excluir meu comentário" title="Excluir meu comentário" disabled={remove.isPending} onClick={() => setDeleting(comment.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
      </div>)}
    </div>
    <Textarea aria-label="Novo comentário" placeholder={taskId ? "Escreva um comentário..." : "Salve a tarefa para comentar"} value={body} onChange={(e) => setBody(e.target.value)} rows={2} disabled={!taskId || add.isPending} />
    <div className="flex justify-end"><Button type="button" variant="secondary" onClick={submit} disabled={!taskId || !body.trim() || add.isPending}>{add.isPending ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <Send className="h-4 w-4" />}Comentar</Button></div>
    <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open && !remove.isPending) setDeleting(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir seu comentário?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter>
        <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
        <Button variant="destructive" disabled={remove.isPending} onClick={async () => { if (!deleting) return; try { await remove.mutateAsync(deleting); setDeleting(null); } catch { /* Keep confirmation open. */ } }}>Excluir comentário</Button>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}