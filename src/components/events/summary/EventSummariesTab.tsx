import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, FileText, Sparkles, Download, Trash2, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { pdf, PDFDownloadLink } from "@react-pdf/renderer";
import SummaryPDF, { type SummaryDoc } from "./SummaryPDF";
import SummaryEditor from "./SummaryEditor";

interface Props {
  eventId: string;
  accountId: string | null;
  eventCoverUrl?: string | null;
  eventTitle?: string;
}

interface SummaryRow {
  id: string;
  day_number: number;
  event_date: string | null;
  title: string | null;
  status: string;
  transcript_text: string | null;
  cover_image_url: string | null;
  generated_content: any;
  ai_model: string | null;
  updated_at: string;
}

const STATUS_LABEL: Record<string, { label: string; variant: any }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  generated: { label: "Gerado", variant: "default" },
  published: { label: "Publicado", variant: "default" },
};

export default function EventSummariesTab({ eventId, accountId, eventCoverUrl, eventTitle }: Props) {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SummaryRow | null>(null);
  const [editorDoc, setEditorDoc] = useState<SummaryDoc | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // New summary form state
  const [form, setForm] = useState({
    day_number: 1,
    event_date: "",
    transcript: "",
  });

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_summaries")
      .select("id, day_number, event_date, title, status, transcript_text, cover_image_url, generated_content, ai_model, updated_at")
      .eq("event_id", eventId)
      .order("day_number", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar resumos", description: error.message, variant: "destructive" });
    } else {
      setRows((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (eventId) fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const handleCreate = async () => {
    if (!accountId) {
      toast({ title: "Conta não identificada", variant: "destructive" });
      return;
    }
    if (!form.transcript || form.transcript.trim().length < 50) {
      toast({ title: "Cole a transcrição antes de gerar (mínimo 50 caracteres)", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const insertRes = await supabase
        .from("event_summaries")
        .insert({
          event_id: eventId,
          account_id: accountId,
          day_number: form.day_number,
          event_date: form.event_date || null,
          transcript_text: form.transcript,
          title: `DIA ${form.day_number}`,
          cover_image_url: eventCoverUrl || null,
          created_by: currentUser?.id || null,
          status: "draft",
        })
        .select()
        .single();

      if (insertRes.error) throw insertRes.error;
      const newId = insertRes.data.id;

      const { data, error } = await supabase.functions.invoke("generate-event-summary", {
        body: {
          summary_id: newId,
          transcript_text: form.transcript,
          day_number: form.day_number,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({ title: "Resumo gerado com sucesso!" });
      setCreating(false);
      setForm({ day_number: form.day_number + 1, event_date: "", transcript: "" });
      await fetchRows();

      // open editor on the freshly generated row
      const fresh = await supabase
        .from("event_summaries")
        .select("id, day_number, event_date, title, status, transcript_text, cover_image_url, generated_content, ai_model, updated_at")
        .eq("id", newId)
        .single();
      if (fresh.data) openEditor(fresh.data as any);
    } catch (e: any) {
      toast({ title: "Falha ao gerar resumo", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const openEditor = (row: SummaryRow) => {
    setEditing(row);
    const gc = row.generated_content || {};
    setEditorDoc({
      title: gc.title || row.title || `DIA ${row.day_number}`,
      subtitle: gc.subtitle || "",
      date: gc.date || (row.event_date ? format(new Date(row.event_date + "T00:00:00"), "dd/MM/yyyy") : ""),
      coverImageUrl: row.cover_image_url || eventCoverUrl || null,
      sections: Array.isArray(gc.sections) ? gc.sections : [],
    });
  };

  const handleSaveEditor = async () => {
    if (!editing || !editorDoc) return;
    setSaving(true);
    const { error } = await supabase
      .from("event_summaries")
      .update({
        generated_content: editorDoc as any,
        title: editorDoc.title,
        cover_image_url: editorDoc.coverImageUrl || null,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Salvo!" });
      await fetchRows();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este resumo?")) return;
    const { error } = await supabase.from("event_summaries").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Excluído" }); fetchRows(); }
  };

  const handleDownloadFromRow = async (row: SummaryRow) => {
    const gc = row.generated_content || {};
    const doc: SummaryDoc = {
      title: gc.title || row.title || `DIA ${row.day_number}`,
      subtitle: gc.subtitle || "",
      date: gc.date || (row.event_date ? format(new Date(row.event_date + "T00:00:00"), "dd/MM/yyyy") : ""),
      coverImageUrl: row.cover_image_url || eventCoverUrl || null,
      sections: Array.isArray(gc.sections) ? gc.sections : [],
    };
    const blob = await pdf(<SummaryPDF doc={doc} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Resumo-Dia-${row.day_number}-${(eventTitle || "evento").replace(/\s+/g, "-")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Resumos IA por dia</h3>
          <p className="text-sm text-muted-foreground">Suba a transcrição de cada dia e gere o PDF no padrão Eternum Club.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Novo resumo</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Nenhum resumo gerado ainda. Clique em "Novo resumo" para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => {
            const st = STATUS_LABEL[r.status] || { label: r.status, variant: "outline" };
            const sectionCount = Array.isArray(r.generated_content?.sections) ? r.generated_content.sections.length : 0;
            return (
              <Card key={r.id}>
                <CardContent className="py-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-600" />
                      <span className="font-semibold">DIA {r.day_number}</span>
                      {r.event_date && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(r.event_date + "T00:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </span>
                      )}
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {sectionCount} seções · atualizado {format(new Date(r.updated_at), "dd/MM HH:mm")}
                      {r.ai_model && ` · ${r.ai_model}`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditor(r)} title="Editar / preview">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDownloadFromRow(r)} title="Baixar PDF" disabled={sectionCount === 0}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={(o) => !generating && setCreating(o)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Novo resumo do dia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Dia</label>
                <Input type="number" min={1} value={form.day_number} onChange={(e) => setForm({ ...form, day_number: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Data do dia</label>
                <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Transcrição completa (cole abaixo)</label>
              <Textarea
                value={form.transcript}
                onChange={(e) => setForm({ ...form, transcript: e.target.value })}
                rows={14}
                placeholder="Cole aqui toda a transcrição do dia..."
              />
              <div className="text-xs text-muted-foreground mt-1">{form.transcript.length.toLocaleString("pt-BR")} caracteres</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={generating}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={generating}>
              {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando com IA...</> : <><Sparkles className="h-4 w-4 mr-2" />Gerar resumo</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setEditorDoc(null); } }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar resumo — DIA {editing?.day_number}</DialogTitle>
          </DialogHeader>
          {editorDoc && (
            <SummaryEditor value={editorDoc} onChange={setEditorDoc} />
          )}
          <DialogFooter className="gap-2">
            {editorDoc && (
              <PDFDownloadLink
                document={<SummaryPDF doc={editorDoc} />}
                fileName={`Resumo-Dia-${editing?.day_number}.pdf`}
              >
                {({ loading }) => (
                  <Button variant="outline" disabled={loading}>
                    <Download className="h-4 w-4 mr-2" />{loading ? "Preparando..." : "Baixar PDF"}
                  </Button>
                )}
              </PDFDownloadLink>
            )}
            <Button onClick={handleSaveEditor} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
