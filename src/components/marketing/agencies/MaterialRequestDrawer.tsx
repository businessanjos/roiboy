import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMaterialRequests, useRequestComments, useAddRequestComment, useUpdateMaterialRequest } from "@/hooks/useMaterialRequests";
import { MATERIAL_REQUEST_STATUSES, categoryLabel, statusColor, statusLabel } from "@/lib/agency";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  requestId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agencyView?: boolean;
}

export function MaterialRequestDrawer({ requestId, open, onOpenChange, agencyView }: Props) {
  const { data: requests = [] } = useMaterialRequests();
  const req: any = requests.find((r: any) => r.id === requestId);
  const { data: comments = [] } = useRequestComments(requestId);
  const addComment = useAddRequestComment();
  const update = useUpdateMaterialRequest();
  const [body, setBody] = useState("");

  if (!req) return null;

  async function send() {
    if (!body.trim()) return;
    await addComment.mutateAsync({ request_id: requestId, body: body.trim() });
    setBody("");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-8">{req.title}</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge style={{ background: statusColor(req.status), color: "#fff" }}>
              {statusLabel(req.status)}
            </Badge>
            <Badge variant="outline">{categoryLabel(req.category)}</Badge>
            {req.priority && <Badge variant="secondary" className="capitalize">{req.priority}</Badge>}
            {req.agency && (
              <Badge variant="outline" style={{ borderColor: req.agency.color, color: req.agency.color }}>
                {req.agency.name}
              </Badge>
            )}
          </div>

          {!agencyView && (
            <div>
              <label className="text-xs text-muted-foreground">Alterar status</label>
              <Select
                value={req.status}
                onValueChange={(v) => update.mutate({ id: req.id, patch: { status: v as any } })}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MATERIAL_REQUEST_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {req.description && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Descrição</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{req.description}</p>
            </div>
          )}

          {req.payload && Object.keys(req.payload).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1">Briefing</h4>
              <dl className="text-sm space-y-1">
                {Object.entries(req.payload).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="text-muted-foreground capitalize min-w-[120px]">{k.replace(/_/g, " ")}:</dt>
                    <dd className="font-medium">{String(v) || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {req.due_date && (
            <div className="text-sm">
              <span className="text-muted-foreground">Prazo: </span>
              <span className="font-medium">{format(new Date(req.due_date), "dd/MM/yyyy")}</span>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold mb-2">Comentários</h4>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {comments.map((c: any) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={c.user?.avatar_url} />
                    <AvatarFallback>{(c.user?.name ?? "?").slice(0,1)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-xs">
                      <span className="font-medium">{c.user?.name ?? "Usuário"}</span>
                      <span className="text-muted-foreground ml-2">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap mt-1">{c.body}</p>
                  </div>
                </div>
              ))}
              {!comments.length && <p className="text-xs text-muted-foreground">Sem comentários ainda.</p>}
            </div>
            <div className="mt-3 space-y-2">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escreva um comentário..."
                rows={2}
              />
              <Button size="sm" onClick={send} disabled={!body.trim() || addComment.isPending}>
                Enviar
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
