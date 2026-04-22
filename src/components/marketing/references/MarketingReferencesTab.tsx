import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Upload, Link as LinkIcon, Trash2, FolderPlus, ExternalLink, Image as ImageIcon, Video, X } from "lucide-react";
import { useMarketingReferences, type MarketingReference } from "@/hooks/useMarketingReferences";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { useMarketingPersona } from "@/hooks/useMarketingPersona";
import { useMarketingBrandVoice } from "@/hooks/useMarketingBrandVoice";
import { buildMarketingConsistencyReport } from "@/lib/marketingConsistency";

export function MarketingReferencesTab() {
  const [boardId, setBoardId] = useState<string | null>(null);
  const { boards, references, isLoading, createBoard, deleteBoard, uploadFile, createReference, deleteReference } = useMarketingReferences(boardId);
  const { persona } = useMarketingPersona();
  const { voice } = useMarketingBrandVoice();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [boardDialog, setBoardDialog] = useState(false);
  const [linkDialog, setLinkDialog] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkNotes, setLinkNotes] = useState("");
  const [preview, setPreview] = useState<MarketingReference | null>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { url, path } = await uploadFile(file);
        await createReference.mutateAsync({
          url,
          storage_path: path,
          type: file.type.startsWith("video/") ? "video" : "image",
          title: file.name,
          board_id: boardId,
          thumbnail_url: file.type.startsWith("image/") ? url : null,
        });
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) return;
    await createReference.mutateAsync({
      url: linkUrl,
      type: "link",
      title: linkTitle || linkUrl,
      notes: linkNotes,
      source_url: linkUrl,
      board_id: boardId,
    });
    setLinkDialog(false);
    setLinkUrl(""); setLinkTitle(""); setLinkNotes("");
  };

  const handleCreateBoard = async () => {
    if (!boardName.trim()) return;
    await createBoard.mutateAsync({ name: boardName.trim() });
    setBoardName("");
    setBoardDialog(false);
  };

  const filtered = references.filter(r =>
    !search || r.title?.toLowerCase().includes(search.toLowerCase()) || r.notes?.toLowerCase().includes(search.toLowerCase())
  );
  const consistencyReport = buildMarketingConsistencyReport({ persona, voice, references });

  if (isLoading) return <Skeleton className="h-[600px]" />;

  return (
    <div className="space-y-4">
      {consistencyReport.issues.length > 0 && (
        <Alert>
          <AlertTitle>Validação automática de referências</AlertTitle>
          <AlertDescription>
            {consistencyReport.blockingIssues.length > 0
              ? `Há ${consistencyReport.blockingIssues.length} alerta(s) de coerência com Persona e Tom de Voz. Revise tags, notas e inspirações antes de usar nas sugestões.`
              : "As referências estão majoritariamente coerentes, mas ainda há ajustes recomendados para melhorar a precisão das próximas sugestões."}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
            <Upload className="h-4 w-4" />
            {uploading ? "Enviando..." : "Upload"}
          </Button>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handleUpload} className="hidden" />
          <Button variant="outline" onClick={() => setLinkDialog(true)} className="gap-2">
            <LinkIcon className="h-4 w-4" />
            Adicionar link
          </Button>
          <Button variant="outline" onClick={() => setBoardDialog(true)} className="gap-2">
            <FolderPlus className="h-4 w-4" />
            Novo board
          </Button>
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="w-56" />
        </div>
      </div>

      {/* Boards filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant={boardId === null ? "secondary" : "ghost"} onClick={() => setBoardId(null)}>
          Todos ({references.length})
        </Button>
        {boards.map(b => (
          <div key={b.id} className="group flex items-center">
            <Button size="sm" variant={boardId === b.id ? "secondary" : "ghost"} onClick={() => setBoardId(b.id)} className="gap-2">
              <div className="h-2 w-2 rounded-full" style={{ background: b.color }} />
              {b.name}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => { if (confirm(`Excluir board "${b.name}"?`)) deleteBoard.mutate(b.id); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {consistencyReport.issues.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {consistencyReport.issues.map((issue) => (
            <Card key={issue.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{issue.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                </div>
                <Badge variant="outline">{issue.severity === "high" ? "Alta" : issue.severity === "medium" ? "Média" : "Baixa"}</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="font-medium">Evidências</p>
                  <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                    {issue.evidence.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Sugestões</p>
                  <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                    {issue.suggestions.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Masonry grid */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma referência ainda. Faça upload de imagens/vídeos ou cole um link.</p>
        </Card>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 [column-fill:_balance]">
          {filtered.map(ref => (
            <Card
              key={ref.id}
              onClick={() => setPreview(ref)}
              className="mb-3 break-inside-avoid cursor-pointer overflow-hidden group hover:ring-2 hover:ring-primary/50 transition-all"
            >
              {ref.type === "image" && (
                <img src={ref.thumbnail_url || ref.url} alt={ref.title || ""} className="w-full block" loading="lazy" />
              )}
              {ref.type === "video" && (
                <div className="relative">
                  <video src={ref.url} className="w-full" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Video className="h-8 w-8 text-white" />
                  </div>
                </div>
              )}
              {ref.type === "link" && (
                <div className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 min-h-[120px] flex flex-col justify-between">
                  <ExternalLink className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium line-clamp-2">{ref.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1">{ref.source_url}</p>
                  </div>
                </div>
              )}
              <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs truncate">{ref.title}</p>
                {ref.tags?.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {ref.tags.slice(0, 3).map(t => <Badge key={t} variant="secondary" className="text-[9px] h-4">#{t}</Badge>)}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New board dialog */}
      <Dialog open={boardDialog} onOpenChange={setBoardDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo board de referências</DialogTitle></DialogHeader>
          <div>
            <Label>Nome</Label>
            <Input value={boardName} onChange={e => setBoardName(e.target.value)} placeholder="Ex: Identidade visual 2026" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBoardDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateBoard}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add link dialog */}
      <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar link/inspiração</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>URL *</Label>
              <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Título</Label>
              <Input value={linkTitle} onChange={e => setLinkTitle(e.target.value)} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={linkNotes} onChange={e => setLinkNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddLink}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      {preview && (
        <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>{preview.title}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {preview.type === "image" && <img src={preview.url} className="w-full rounded-md" />}
              {preview.type === "video" && <video src={preview.url} controls className="w-full rounded-md" />}
              {preview.type === "link" && (
                <a href={preview.source_url || preview.url} target="_blank" rel="noopener" className="text-primary underline flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" /> {preview.source_url}
                </a>
              )}
              {preview.notes && <p className="text-sm text-muted-foreground">{preview.notes}</p>}
            </div>
            <DialogFooter>
              <Button variant="destructive" onClick={() => { deleteReference.mutate(preview); setPreview(null); }} className="mr-auto gap-2">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
              <Button variant="outline" onClick={() => setPreview(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
