import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { FOLLOWUP_KINDS } from "@/lib/rh/pdaContent";
import { formatDateBR } from "@/lib/rh/pda";

type Followup = {
  id: string;
  followup_date: string;
  kind: string;
  angel_feedback: string | null;
  management_feedback: string | null;
  attention_points: string | null;
  author_name: string | null;
};

const EMPTY = {
  followup_date: new Date().toISOString().slice(0, 10),
  kind: "Pontual",
  angel_feedback: "",
  management_feedback: "",
  attention_points: "",
};

export default function PdaFollowupsTab({
  personId,
  accountId,
  sourceTable = "hr_collaborators",
}: {
  personId: string;
  accountId?: string | null;
  sourceTable?: string;
}) {
  const { currentUser } = useCurrentUser();
  const [items, setItems] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Followup | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hr_pda_followups")
      .select("id, followup_date, kind, angel_feedback, management_feedback, attention_points, author_name")
      .eq("person_id", personId)
      .order("followup_date", { ascending: false });
    setItems((data || []) as Followup[]);
    setLoading(false);
  }, [personId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openDialog = (f?: Followup) => {
    if (f) {
      setEditing(f);
      setForm({
        followup_date: f.followup_date,
        kind: f.kind,
        angel_feedback: f.angel_feedback || "",
        management_feedback: f.management_feedback || "",
        attention_points: f.attention_points || "",
      });
    } else {
      setEditing(null);
      setForm(EMPTY);
    }
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      account_id: accountId,
      person_id: personId,
      source_table: sourceTable,
      followup_date: form.followup_date,
      kind: form.kind,
      angel_feedback: form.angel_feedback.trim() || null,
      management_feedback: form.management_feedback.trim() || null,
      attention_points: form.attention_points.trim() || null,
      author_id: currentUser?.id || null,
      author_name: currentUser?.name || null,
    };
    const { error } = editing
      ? await supabase.from("hr_pda_followups").update(payload as any).eq("id", editing.id)
      : await supabase.from("hr_pda_followups").insert(payload as any);
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar o acompanhamento"); return; }
    toast.success("Acompanhamento salvo");
    setOpen(false);
    fetchItems();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este acompanhamento?")) return;
    const { error } = await supabase.from("hr_pda_followups").delete().eq("id", id);
    if (error) { toast.error("Não foi possível excluir"); return; }
    fetchItems();
  };

  const isFuture = (d: string) => d > new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Registros de 30/60/90 dias, de ciclo e pontuais. Datas futuras aparecem no Calendário do RH.
        </p>
        <Button size="sm" onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2" /> Novo acompanhamento</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="border border-dashed rounded-xl py-10 text-center text-sm text-muted-foreground">
          <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nenhum acompanhamento registrado.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{f.kind}</Badge>
                  <span className="text-sm font-medium">{formatDateBR(f.followup_date)}</span>
                  {isFuture(f.followup_date) && (
                    <Badge className="text-[10px] bg-primary/15 text-primary border-0">Agendado</Badge>
                  )}
                  {f.author_name && <span className="text-xs text-muted-foreground">por {f.author_name}</span>}
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(f)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(f.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {f.angel_feedback && (
                  <div className="text-xs"><span className="font-medium">Feedback do Anjo: </span>
                    <span className="text-muted-foreground whitespace-pre-wrap">{f.angel_feedback}</span></div>
                )}
                {f.management_feedback && (
                  <div className="text-xs"><span className="font-medium">Feedback da gestão: </span>
                    <span className="text-muted-foreground whitespace-pre-wrap">{f.management_feedback}</span></div>
                )}
                {f.attention_points && (
                  <div className="text-xs"><span className="font-medium">Pontos de atenção: </span>
                    <span className="text-muted-foreground whitespace-pre-wrap">{f.attention_points}</span></div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar acompanhamento" : "Novo acompanhamento"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.followup_date} onChange={(e) => setForm(f => ({ ...f, followup_date: e.target.value }))} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.kind} onValueChange={(v) => setForm(f => ({ ...f, kind: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FOLLOWUP_KINDS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Feedback do Anjo</Label>
              <Textarea rows={3} value={form.angel_feedback} onChange={(e) => setForm(f => ({ ...f, angel_feedback: e.target.value }))} />
            </div>
            <div>
              <Label>Feedback da gestão</Label>
              <Textarea rows={3} value={form.management_feedback} onChange={(e) => setForm(f => ({ ...f, management_feedback: e.target.value }))} />
            </div>
            <div>
              <Label>Pontos de atenção</Label>
              <Textarea rows={3} value={form.attention_points} onChange={(e) => setForm(f => ({ ...f, attention_points: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
