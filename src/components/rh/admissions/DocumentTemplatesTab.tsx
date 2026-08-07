import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileSignature, Plus, Pencil, Trash2, Eye, RefreshCw, Loader2, Send } from "lucide-react";
import GenerateCandidateDocDialog from "./GenerateCandidateDocDialog";
import { toast } from "sonner";
import {
  useHRDocumentTemplates, useUpsertDocumentTemplate, useDeleteDocumentTemplate,
  useSeedDefaultTemplates, type HRDocumentTemplate,
} from "@/hooks/useHRDocumentTemplates";
import { TEMPLATE_VARIABLES, renderTemplate, sanitizeDocumentHtml, SIGNER_FIELDS } from "@/lib/hr/admissionDocVars";

const PREVIEW_SAMPLE: Record<string, string> = {
  NOME_COMPLETO: "Maria Souza da Silva",
  CPF: "123.456.789-00",
  RG: "12.345.678-9",
  RUA: "Rua Uirapuru",
  NUMERO: "550",
  BAIRRO: "Centro",
  CIDADE: "Arapongas",
  ESTADO: "PR",
};

const emptyDraft = {
  id: undefined as string | undefined,
  doc_key: "",
  title: "",
  description: "",
  body_html: "",
  default_selected: true,
  required: true,
  active: true,
  sort_order: 99,
};

export default function DocumentTemplatesTab() {
  const { data: templates, isLoading } = useHRDocumentTemplates();
  const upsert = useUpsertDocumentTemplate();
  const remove = useDeleteDocumentTemplate();
  const seed = useSeedDefaultTemplates();

  const [draft, setDraft] = useState<typeof emptyDraft | null>(null);
  const [preview, setPreview] = useState<HRDocumentTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HRDocumentTemplate | null>(null);

  const previewHtml = useMemo(
    () => (preview ? sanitizeDocumentHtml(renderTemplate(preview.body_html, PREVIEW_SAMPLE)) : ""),
    [preview],
  );

  const openNew = () => setDraft({ ...emptyDraft, sort_order: (templates?.length || 0) + 1 });
  const openEdit = (t: HRDocumentTemplate) =>
    setDraft({
      id: t.id,
      doc_key: t.doc_key,
      title: t.title,
      description: t.description || "",
      body_html: t.body_html,
      default_selected: t.default_selected,
      required: t.required,
      active: t.active,
      sort_order: t.sort_order,
    });

  const save = async () => {
    if (!draft) return;
    const key = draft.doc_key.trim() || draft.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
    if (!draft.title.trim()) return toast.error("Informe o título do documento");
    if (!draft.body_html.trim()) return toast.error("O documento está vazio");
    await upsert.mutateAsync({ ...draft, doc_key: key });
    setDraft(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-primary" />
              Modelos de documentos ({templates?.length || 0})
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Documentos que o novo colaborador lê e assina no portal de admissão. Use variáveis como{" "}
              <code className="text-xs bg-muted px-1 rounded">{"{{NOME_COMPLETO}}"}</code> — elas são preenchidas com os
              dados informados por ele.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => seed.mutate(false)} disabled={seed.isPending}>
              {seed.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">Carregar padrões</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setGenerate({ open: true })}>
              <Send className="h-4 w-4 mr-1.5" /> Gerar para candidato
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1.5" /> Novo modelo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : (templates || []).length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm text-muted-foreground">
                Nenhum modelo na biblioteca ainda. Carregue os 6 documentos padrão da Eternum.
              </p>
              <Button onClick={() => seed.mutate(false)} disabled={seed.isPending}>
                <RefreshCw className="h-4 w-4 mr-1.5" /> Carregar modelos padrão
              </Button>
            </div>
          ) : (
            (templates || []).map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{t.title}</p>
                    {t.default_selected && <Badge variant="secondary" className="text-[10px]">Padrão em toda admissão</Badge>}
                    {!t.active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreview(t)} title="Pré-visualizar">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setConfirmDelete(t)}
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Editor */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar modelo" : "Novo modelo"}</DialogTitle>
            <DialogDescription>
              Variáveis disponíveis: {TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(", ")}
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Título</Label>
                  <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Descrição curta</Label>
                  <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={draft.sort_order}
                    onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-6 pt-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={draft.default_selected}
                      onCheckedChange={(v) => setDraft({ ...draft, default_selected: v })}
                    />
                    <Label className="text-sm">Padrão</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
                    <Label className="text-sm">Ativo</Label>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Conteúdo (HTML simples: parágrafos, negrito, listas)</Label>
                <Textarea
                  value={draft.body_html}
                  onChange={(e) => setDraft({ ...draft, body_html: e.target.value })}
                  rows={16}
                  className="font-mono text-xs"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Campos preenchidos pelo colaborador: {SIGNER_FIELDS.map((f) => f.label).join(" · ")}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
            <DialogDescription>Pré-visualização com dados fictícios.</DialogDescription>
          </DialogHeader>
          <div
            className="admission-doc rounded-md border border-border bg-background p-5 text-sm"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.title}" sai da biblioteca. Documentos já assinados em admissões continuam intactos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (confirmDelete) remove.mutate(confirmDelete.id); setConfirmDelete(null); }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
