import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, FileText, Plus, Trash2, Upload } from "lucide-react";
import { PDA_DOC_TYPES } from "@/lib/rh/pdaContent";
import { formatDateBR } from "@/lib/rh/pda";

type Doc = {
  id: string;
  doc_type: string;
  doc_date: string | null;
  description: string | null;
  file_path: string | null;
  file_name: string | null;
};

export default function PdaDocumentsTab({
  personId,
  accountId,
  sourceTable = "hr_collaborators",
}: {
  personId: string;
  accountId?: string | null;
  sourceTable?: string;
}) {
  const { currentUser } = useCurrentUser();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    doc_type: "Relatório de perfil",
    doc_date: new Date().toISOString().slice(0, 10),
    description: "",
  });

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hr_pda_documents")
      .select("id, doc_type, doc_date, description, file_path, file_name")
      .eq("person_id", personId)
      .order("created_at", { ascending: false });
    setDocs((data || []) as Doc[]);
    setLoading(false);
  }, [personId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const save = async () => {
    setUploading(true);
    try {
      let path: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop();
        path = `${accountId}/pda/${personId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("hr-documents").upload(path, file);
        if (upErr) throw upErr;
      }
      const { error } = await supabase.from("hr_pda_documents").insert({
        account_id: accountId,
        person_id: personId,
        source_table: sourceTable,
        doc_type: form.doc_type,
        doc_date: form.doc_date || null,
        description: form.description.trim() || null,
        file_path: path,
        file_name: file?.name || null,
        file_size: file?.size || null,
        uploaded_by: currentUser?.id || null,
      } as any);
      if (error) throw error;
      toast.success("Documento adicionado");
      setOpen(false);
      setFile(null);
      setForm({ doc_type: "Relatório de perfil", doc_date: new Date().toISOString().slice(0, 10), description: "" });
      fetchDocs();
    } catch (e: any) {
      toast.error("Não foi possível enviar o documento");
    } finally {
      setUploading(false);
    }
  };

  const download = async (d: Doc) => {
    if (!d.file_path) return;
    const { data, error } = await supabase.storage.from("hr-documents").createSignedUrl(d.file_path, 60);
    if (error || !data) { toast.error("Não foi possível abrir o arquivo"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (d: Doc) => {
    if (!confirm("Excluir este documento?")) return;
    if (d.file_path) await supabase.storage.from("hr-documents").remove([d.file_path]);
    const { error } = await supabase.from("hr_pda_documents").delete().eq("id", d.id);
    if (error) { toast.error("Não foi possível excluir"); return; }
    fetchDocs();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Relatórios de perfil, PDIs e avaliações da pessoa.</p>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo documento</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : docs.length === 0 ? (
        <div className="border border-dashed rounded-xl py-10 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nenhum documento enviado.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(d => (
            <Card key={d.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{d.doc_type}</Badge>
                    <span className="text-sm truncate">{d.file_name || "Sem arquivo"}</span>
                    <span className="text-xs text-muted-foreground">{formatDateBR(d.doc_date)}</span>
                  </div>
                  {d.description && <p className="text-xs text-muted-foreground truncate">{d.description}</p>}
                </div>
                {d.file_path && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => download(d)}>
                    <Download className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(d)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo documento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.doc_type} onValueChange={(v) => setForm(f => ({ ...f, doc_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PDA_DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.doc_date} onChange={(e) => setForm(f => ({ ...f, doc_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Arquivo</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" /> {uploading ? "Enviando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
