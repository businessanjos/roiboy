import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, FileText, Download, Trash2, Upload, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const DOC_TYPES: Record<string, string> = {
  contract: "Contrato",
  id_document: "Documento de Identidade",
  certificate: "Certificado/Diploma",
  medical: "Atestado Médico",
  training: "Treinamento",
  admission: "Admissão",
  termination: "Rescisão",
  other: "Outro",
};

interface Props {
  collaboratorId: string;
  accountId: string;
}

interface HRDocument {
  id: string;
  document_type: string;
  title: string;
  description: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  created_at: string;
}

export default function CollaboratorDocuments({ collaboratorId, accountId }: Props) {
  const { currentUser } = useCurrentUser();
  const [documents, setDocuments] = useState<HRDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "", document_type: "other", description: "", issue_date: "", expiry_date: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from("hr_documents")
      .select("*")
      .eq("collaborator_id", collaboratorId)
      .order("created_at", { ascending: false });
    setDocuments((data || []) as HRDocument[]);
    setLoading(false);
  }, [collaboratorId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUpload = async () => {
    if (!form.title.trim()) return;
    setUploading(true);
    try {
      let fileUrl = null;
      let fileName = null;
      let fileSize = null;

      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${accountId}/${collaboratorId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("hr-documents")
          .upload(path, file);
        if (uploadError) throw uploadError;

        // Store the storage path (bucket is private; signed URLs are generated on download)
        fileUrl = path;
        fileName = file.name;
        fileSize = file.size;
      }

      const { error } = await supabase.from("hr_documents").insert({
        account_id: accountId,
        collaborator_id: collaboratorId,
        title: form.title,
        document_type: form.document_type,
        description: form.description || null,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        uploaded_by: currentUser?.id || null,
      } as any);

      if (error) throw error;
      toast.success("Documento adicionado!");
      setDialogOpen(false);
      setForm({ title: "", document_type: "other", description: "", issue_date: "", expiry_date: "" });
      setFile(null);
      fetchDocs();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    const { error } = await supabase.from("hr_documents").delete().eq("id", docId);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Documento excluído");
    fetchDocs();
  };

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const d = new Date(date);
    return !isPast(d) && d <= addDays(new Date(), 30);
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando documentos...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-muted-foreground">{documents.length} documento{documents.length !== 1 ? "s" : ""}</h3>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Documento
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Nenhum documento cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{doc.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{DOC_TYPES[doc.document_type] || doc.document_type}</span>
                  {doc.expiry_date && (
                    <>
                      <span>•</span>
                      <span className={isPast(new Date(doc.expiry_date)) ? "text-destructive" : isExpiringSoon(doc.expiry_date) ? "text-yellow-600" : ""}>
                        {isPast(new Date(doc.expiry_date)) && <AlertCircle className="h-3 w-3 inline mr-0.5" />}
                        Vence: {format(new Date(doc.expiry_date), "dd/MM/yyyy")}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {doc.expiry_date && isPast(new Date(doc.expiry_date)) && (
                <Badge variant="destructive" className="text-xs">Vencido</Badge>
              )}
              {doc.expiry_date && isExpiringSoon(doc.expiry_date) && (
                <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">Vencendo</Badge>
              )}
              {doc.file_url && (
                <Button variant="ghost" size="icon" asChild>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(doc.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Documento</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Contrato de trabalho" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.document_type} onValueChange={v => setForm(f => ({ ...f, document_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de emissão</Label>
                <Input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
              </div>
              <div>
                <Label>Data de vencimento</Label>
                <Input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Arquivo</Label>
              <div className="mt-1">
                <label className="flex items-center gap-2 p-3 border border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{file ? file.name : "Selecionar arquivo..."}</span>
                  <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleUpload} disabled={!form.title.trim() || uploading}>
                {uploading ? "Enviando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
