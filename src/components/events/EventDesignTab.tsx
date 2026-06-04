import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Plus,
  Upload,
  ExternalLink,
  Trash2,
  Pencil,
  FileText,
  Image as ImageIcon,
  Link2,
  Search,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  eventId: string;
  accountId: string | null;
}

interface DesignFile {
  id: string;
  category: string;
  name: string;
  description: string | null;
  file_url: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: string;
  version: number;
  tags: string[] | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: "cracha", label: "Crachás", color: "bg-blue-500" },
  { value: "plaquinha", label: "Plaquinhas", color: "bg-amber-500" },
  { value: "slide", label: "Slides / Apresentações", color: "bg-purple-500" },
  { value: "banner", label: "Banners / Backdrops", color: "bg-pink-500" },
  { value: "identidade", label: "Identidade Visual", color: "bg-indigo-500" },
  { value: "convite", label: "Convites / Save the Date", color: "bg-emerald-500" },
  { value: "social", label: "Redes Sociais", color: "bg-sky-500" },
  { value: "impresso", label: "Impressos", color: "bg-orange-500" },
  { value: "video", label: "Vídeo / Motion", color: "bg-rose-500" },
  { value: "outros", label: "Outros", color: "bg-slate-500" },
];

const STATUSES = [
  { value: "wip", label: "Em produção", color: "bg-slate-500" },
  { value: "review", label: "Em aprovação", color: "bg-amber-500" },
  { value: "approved", label: "Aprovado", color: "bg-emerald-500" },
  { value: "rejected", label: "Rejeitado", color: "bg-red-500" },
];

const EMPTY: Partial<DesignFile> = {
  category: "outros",
  name: "",
  description: "",
  file_url: null,
  external_url: null,
  status: "wip",
  version: 1,
  tags: [],
};

export default function EventDesignTab({ eventId, accountId }: Props) {
  const { toast } = useToast();
  const { currentUser } = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<DesignFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [dialog, setDialog] = useState<{ open: boolean; data: Partial<DesignFile> | null }>({
    open: false,
    data: null,
  });
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (eventId) fetchFiles();
  }, [eventId]);

  const fetchFiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_design_files")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast({ title: "Erro ao carregar arquivos", variant: "destructive" });
    } else {
      setFiles((data as DesignFile[]) || []);
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return files.filter((f) => {
      if (filterCategory !== "all" && f.category !== filterCategory) return false;
      if (filterStatus !== "all" && f.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        const inName = f.name.toLowerCase().includes(q);
        const inDesc = (f.description || "").toLowerCase().includes(q);
        const inTags = (f.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!inName && !inDesc && !inTags) return false;
      }
      return true;
    });
  }, [files, filterCategory, filterStatus, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, DesignFile[]>();
    for (const f of filtered) {
      const arr = map.get(f.category) || [];
      arr.push(f);
      map.set(f.category, arr);
    }
    return map;
  }, [filtered]);

  const openNew = () => setDialog({ open: true, data: { ...EMPTY } });
  const openEdit = (f: DesignFile) => setDialog({ open: true, data: { ...f } });

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingUploadFile(file);
    setDialog({
      open: true,
      data: { ...EMPTY, name: file.name.replace(/\.[^.]+$/, "") },
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveItem = async () => {
    if (!dialog.data || !accountId || !currentUser) return;
    const d = dialog.data;
    if (!d.name?.trim()) {
      toast({ title: "Informe um nome", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let file_url = d.file_url || null;
      let file_size = d.file_size || null;
      let mime_type = d.mime_type || null;

      if (pendingUploadFile) {
        const ext = pendingUploadFile.name.split(".").pop();
        const path = `${accountId}/${eventId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("event-design")
          .upload(path, pendingUploadFile);
        if (upErr) throw upErr;
        file_url = path;
        file_size = pendingUploadFile.size;
        mime_type = pendingUploadFile.type;
      }

      const payload = {
        event_id: eventId,
        account_id: accountId,
        category: d.category || "outros",
        name: d.name.trim(),
        description: d.description?.trim() || null,
        file_url,
        external_url: d.external_url?.trim() || null,
        file_size,
        mime_type,
        status: d.status || "wip",
        version: d.version || 1,
        tags: d.tags || [],
        uploaded_by: d.id ? d.uploaded_by ?? currentUser.id : currentUser.id,
      };

      if (d.id) {
        const { error } = await supabase
          .from("event_design_files")
          .update(payload)
          .eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_design_files").insert(payload);
        if (error) throw error;
      }

      toast({ title: d.id ? "Arquivo atualizado" : "Arquivo cadastrado" });
      setDialog({ open: false, data: null });
      setPendingUploadFile(null);
      fetchFiles();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro ao salvar",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (f: DesignFile) => {
    if (!confirm(`Excluir "${f.name}"?`)) return;
    if (f.file_url && !f.file_url.startsWith("http")) {
      await supabase.storage.from("event-design").remove([f.file_url]);
    }
    const { error } = await supabase
      .from("event_design_files")
      .delete()
      .eq("id", f.id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Arquivo removido" });
      fetchFiles();
    }
  };

  const downloadFile = async (f: DesignFile) => {
    if (f.external_url) {
      window.open(f.external_url, "_blank");
      return;
    }
    if (!f.file_url) return;
    if (f.file_url.startsWith("http")) {
      window.open(f.file_url, "_blank");
      return;
    }
    const { data, error } = await supabase.storage
      .from("event-design")
      .createSignedUrl(f.file_url, 60 * 60);
    if (error || !data) {
      toast({ title: "Erro ao gerar link", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Carregando...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header / Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Arquivos de Design</h3>
          <p className="text-sm text-muted-foreground">
            Crachás, plaquinhas, slides, banners e demais peças. Suporta upload e link externo (Figma, Drive).
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onPickFile}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload de arquivo
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar link
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, descrição ou tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Files grouped by category */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Nenhum arquivo ainda"
          description="Adicione crachás, banners, slides e demais peças do time de design."
        />
      ) : (
        <div className="space-y-6">
          {CATEGORIES.filter((c) => grouped.has(c.value)).map((cat) => {
            const items = grouped.get(cat.value) || [];
            return (
              <div key={cat.value} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${cat.color}`} />
                  <h4 className="font-medium">{cat.label}</h4>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((f) => {
                    const statusInfo = STATUSES.find((s) => s.value === f.status);
                    const isExternal = !!f.external_url;
                    return (
                      <Card key={f.id} className="group hover:shadow-md transition-shadow">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {isExternal ? (
                                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                              ) : (
                                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                              <span className="font-medium truncate">{f.name}</span>
                            </div>
                            {statusInfo && (
                              <Badge
                                variant="secondary"
                                className={`${statusInfo.color} text-white border-0 shrink-0`}
                              >
                                {statusInfo.label}
                              </Badge>
                            )}
                          </div>

                          {f.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {f.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[10px]">
                              v{f.version}
                            </Badge>
                            {(f.tags || []).slice(0, 3).map((t) => (
                              <Badge key={t} variant="outline" className="text-[10px]">
                                #{t}
                              </Badge>
                            ))}
                          </div>

                          <div className="text-[11px] text-muted-foreground">
                            {format(new Date(f.updated_at), "dd MMM yyyy", { locale: ptBR })}
                          </div>

                          <div className="flex gap-1 pt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => downloadFile(f)}
                            >
                              {isExternal ? (
                                <>
                                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                  Abrir
                                </>
                              ) : (
                                <>
                                  <Download className="h-3.5 w-3.5 mr-1" />
                                  Baixar
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(f)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteItem(f)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog
        open={dialog.open}
        onOpenChange={(o) => {
          if (!o) {
            setDialog({ open: false, data: null });
            setPendingUploadFile(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialog.data?.id ? "Editar arquivo" : "Novo arquivo de design"}
            </DialogTitle>
            <DialogDescription>
              Use upload para versões finais (PDF/PNG) e link externo para arquivos editáveis (Figma, Drive).
            </DialogDescription>
          </DialogHeader>

          {dialog.data && (
            <div className="space-y-3">
              {pendingUploadFile && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="font-medium">{pendingUploadFile.name}</span>
                  <span className="text-muted-foreground text-xs">
                    ({(pendingUploadFile.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label>Nome *</Label>
                  <Input
                    value={dialog.data.name || ""}
                    onChange={(e) =>
                      setDialog((p) => ({
                        ...p,
                        data: { ...p.data, name: e.target.value },
                      }))
                    }
                    placeholder="Ex: Crachá - Modelo A"
                  />
                </div>

                <div>
                  <Label>Categoria *</Label>
                  <Select
                    value={dialog.data.category || "outros"}
                    onValueChange={(v) =>
                      setDialog((p) => ({ ...p, data: { ...p.data, category: v } }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select
                    value={dialog.data.status || "wip"}
                    onValueChange={(v) =>
                      setDialog((p) => ({ ...p, data: { ...p.data, status: v } }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Versão</Label>
                  <Input
                    type="number"
                    min={1}
                    value={dialog.data.version || 1}
                    onChange={(e) =>
                      setDialog((p) => ({
                        ...p,
                        data: { ...p.data, version: Number(e.target.value) || 1 },
                      }))
                    }
                  />
                </div>

                <div>
                  <Label>Tags (separadas por vírgula)</Label>
                  <Input
                    value={(dialog.data.tags || []).join(", ")}
                    onChange={(e) =>
                      setDialog((p) => ({
                        ...p,
                        data: {
                          ...p.data,
                          tags: e.target.value
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                    placeholder="aprovado-cliente, v2"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label>Link externo (Figma, Drive, Dropbox...)</Label>
                  <Input
                    value={dialog.data.external_url || ""}
                    onChange={(e) =>
                      setDialog((p) => ({
                        ...p,
                        data: { ...p.data, external_url: e.target.value },
                      }))
                    }
                    placeholder="https://figma.com/file/..."
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label>Descrição / Observações</Label>
                  <Textarea
                    value={dialog.data.description || ""}
                    onChange={(e) =>
                      setDialog((p) => ({
                        ...p,
                        data: { ...p.data, description: e.target.value },
                      }))
                    }
                    rows={3}
                    placeholder="Notas pro time, dimensões, especificações..."
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialog({ open: false, data: null });
                setPendingUploadFile(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={saveItem} disabled={saving || !dialog.data?.name}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
