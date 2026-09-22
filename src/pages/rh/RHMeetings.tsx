import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, Download, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SECTOR_OPTIONS, formatDateBR } from "@/lib/rh/pda";

type Meeting = {
  id: string;
  title: string;
  scheduled_at: string;
  notes: string | null;
  decisions: string | null;
  participants: string[] | null;
};

type Alignment = {
  id: string;
  sector: string | null;
  title: string;
  alignment_date: string | null;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
};

const EMPTY_MEETING = { title: "", scheduled_at: new Date().toISOString().slice(0, 16), notes: "", decisions: "", participants: "" };
const EMPTY_ALIGNMENT = { sector: "", title: "", alignment_date: new Date().toISOString().slice(0, 10), content: "" };

export default function RHMeetings() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [alignments, setAlignments] = useState<Alignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [mOpen, setMOpen] = useState(false);
  const [mEditing, setMEditing] = useState<Meeting | null>(null);
  const [mForm, setMForm] = useState(EMPTY_MEETING);

  const [aOpen, setAOpen] = useState(false);
  const [aEditing, setAEditing] = useState<Alignment | null>(null);
  const [aForm, setAForm] = useState(EMPTY_ALIGNMENT);
  const [aFile, setAFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [m, a] = await Promise.all([
      supabase.from("hr_rh_meetings").select("id, title, scheduled_at, notes, decisions, participants").order("scheduled_at", { ascending: false }),
      supabase.from("hr_team_alignments").select("id, sector, title, alignment_date, content, file_path, file_name").order("created_at", { ascending: false }),
    ]);
    setMeetings((m.data || []) as Meeting[]);
    setAlignments((a.data || []) as Alignment[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openMeeting = (m?: Meeting) => {
    if (m) {
      setMEditing(m);
      setMForm({
        title: m.title || "",
        scheduled_at: new Date(m.scheduled_at).toISOString().slice(0, 16),
        notes: m.notes || "",
        decisions: m.decisions || "",
        participants: (m.participants || []).join(", "),
      });
    } else {
      setMEditing(null);
      setMForm(EMPTY_MEETING);
    }
    setMOpen(true);
  };

  const saveMeeting = async () => {
    if (!mForm.title.trim()) { toast.error("Informe a pauta"); return; }
    setSaving(true);
    const payload = {
      account_id: accountId,
      title: mForm.title.trim(),
      scheduled_at: new Date(mForm.scheduled_at).toISOString(),
      notes: mForm.notes.trim() || null,
      decisions: mForm.decisions.trim() || null,
      participants: mForm.participants.split(",").map(s => s.trim()).filter(Boolean),
      created_by: currentUser?.id || null,
    };
    const { error } = mEditing
      ? await supabase.from("hr_rh_meetings").update(payload as any).eq("id", mEditing.id)
      : await supabase.from("hr_rh_meetings").insert(payload as any);
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar a reunião"); return; }
    setMOpen(false);
    fetchAll();
  };

  const openAlignment = (a?: Alignment) => {
    if (a) {
      setAEditing(a);
      setAForm({
        sector: a.sector || "",
        title: a.title,
        alignment_date: a.alignment_date || "",
        content: a.content || "",
      });
    } else {
      setAEditing(null);
      setAForm(EMPTY_ALIGNMENT);
    }
    setAFile(null);
    setAOpen(true);
  };

  const saveAlignment = async () => {
    if (!aForm.title.trim()) { toast.error("Informe o título"); return; }
    setSaving(true);
    try {
      let path = aEditing?.file_path || null;
      let name = aEditing?.file_name || null;
      if (aFile) {
        const ext = aFile.name.split(".").pop();
        path = `${accountId}/alignments/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("hr-documents").upload(path, aFile);
        if (upErr) throw upErr;
        name = aFile.name;
      }
      const payload = {
        account_id: accountId,
        sector: aForm.sector || null,
        title: aForm.title.trim(),
        alignment_date: aForm.alignment_date || null,
        content: aForm.content.trim() || null,
        file_path: path,
        file_name: name,
        created_by: currentUser?.id || null,
      };
      const { error } = aEditing
        ? await supabase.from("hr_team_alignments").update(payload as any).eq("id", aEditing.id)
        : await supabase.from("hr_team_alignments").insert(payload as any);
      if (error) throw error;
      setAOpen(false);
      fetchAll();
    } catch {
      toast.error("Não foi possível salvar o alinhamento");
    } finally {
      setSaving(false);
    }
  };

  const removeMeeting = async (id: string) => {
    if (!confirm("Excluir esta reunião?")) return;
    await supabase.from("hr_rh_meetings").delete().eq("id", id);
    fetchAll();
  };

  const removeAlignment = async (id: string) => {
    if (!confirm("Excluir este alinhamento?")) return;
    await supabase.from("hr_team_alignments").delete().eq("id", id);
    fetchAll();
  };

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("hr-documents").createSignedUrl(path, 60);
    if (error || !data) { toast.error("Não foi possível abrir o anexo"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rh")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="p-2 rounded-xl bg-primary/10"><Users className="h-6 w-6 text-primary" strokeWidth={1.5} /></div>
        <div>
          <h1 className="text-xl font-semibold">Reuniões e alinhamentos</h1>
          <p className="text-sm text-muted-foreground">Reuniões RH-Diretoria e alinhamentos de equipe por setor</p>
        </div>
      </div>

      <Tabs defaultValue="meetings">
        <TabsList>
          <TabsTrigger value="meetings">Reuniões RH-Diretoria</TabsTrigger>
          <TabsTrigger value="alignments">Alinhamentos de equipe</TabsTrigger>
        </TabsList>

        <TabsContent value="meetings" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openMeeting()}><Plus className="h-4 w-4 mr-2" /> Nova reunião</Button>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Carregando…</p>
            : meetings.length === 0 ? (
              <div className="border border-dashed rounded-xl py-10 text-center text-sm text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" /> Nenhuma reunião registrada.
              </div>
            ) : meetings.map(m => (
              <Card key={m.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{m.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(m.scheduled_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </Badge>
                    <div className="ml-auto flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMeeting(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeMeeting(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  {(m.participants || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(m.participants || []).map((p, i) => <Badge key={i} variant="secondary" className="text-[10px]">{p}</Badge>)}
                    </div>
                  )}
                  {m.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap"><span className="font-medium text-foreground">Pauta: </span>{m.notes}</p>}
                  {m.decisions && <p className="text-xs text-muted-foreground whitespace-pre-wrap"><span className="font-medium text-foreground">Decisões: </span>{m.decisions}</p>}
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="alignments" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openAlignment()}><Plus className="h-4 w-4 mr-2" /> Novo alinhamento</Button>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Carregando…</p>
            : alignments.length === 0 ? (
              <div className="border border-dashed rounded-xl py-10 text-center text-sm text-muted-foreground">
                Nenhum alinhamento registrado.
              </div>
            ) : alignments.map(a => (
              <Card key={a.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.sector && <Badge variant="outline" className="text-[10px]">{a.sector}</Badge>}
                    <span className="font-medium text-sm">{a.title}</span>
                    {a.alignment_date && <span className="text-xs text-muted-foreground">{formatDateBR(a.alignment_date)}</span>}
                    <div className="ml-auto flex gap-1">
                      {a.file_path && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadFile(a.file_path!)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAlignment(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeAlignment(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  {a.content && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.content}</p>}
                </CardContent>
              </Card>
            ))}
        </TabsContent>
      </Tabs>

      {/* Dialog reunião */}
      <Dialog open={mOpen} onOpenChange={setMOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{mEditing ? "Editar reunião" : "Nova reunião"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Pauta (título)</Label><Input value={mForm.title} onChange={e => setMForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Data e hora</Label><Input type="datetime-local" value={mForm.scheduled_at} onChange={e => setMForm(f => ({ ...f, scheduled_at: e.target.value }))} /></div>
            <div><Label>Participantes (separados por vírgula)</Label><Input value={mForm.participants} onChange={e => setMForm(f => ({ ...f, participants: e.target.value }))} /></div>
            <div><Label>Pauta detalhada</Label><Textarea rows={3} value={mForm.notes} onChange={e => setMForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div><Label>Decisões</Label><Textarea rows={3} value={mForm.decisions} onChange={e => setMForm(f => ({ ...f, decisions: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMOpen(false)}>Cancelar</Button>
            <Button onClick={saveMeeting} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog alinhamento */}
      <Dialog open={aOpen} onOpenChange={setAOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{aEditing ? "Editar alinhamento" : "Novo alinhamento"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Setor</Label>
              <Select value={aForm.sector} onValueChange={v => setAForm(f => ({ ...f, sector: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {SECTOR_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Título</Label><Input value={aForm.title} onChange={e => setAForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Data</Label><Input type="date" value={aForm.alignment_date} onChange={e => setAForm(f => ({ ...f, alignment_date: e.target.value }))} /></div>
            <div><Label>Conteúdo</Label><Textarea rows={5} value={aForm.content} onChange={e => setAForm(f => ({ ...f, content: e.target.value }))} /></div>
            <div><Label>Anexo</Label><Input type="file" onChange={e => setAFile(e.target.files?.[0] || null)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAOpen(false)}>Cancelar</Button>
            <Button onClick={saveAlignment} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
