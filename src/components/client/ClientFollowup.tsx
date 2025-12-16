import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  Plus,
  FileText,
  Image,
  File,
  Loader2,
  Trash2,
  Pencil,
  Download,
  Upload,
  StickyNote,
  User,
  Expand,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Followup {
  id: string;
  type: "note" | "file" | "image";
  title: string | null;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  users?: {
    name: string;
  };
}

interface ClientFollowupProps {
  clientId: string;
}

export function ClientFollowup({ clientId }: ClientFollowupProps) {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [followupToDelete, setFollowupToDelete] = useState<Followup | null>(null);
  const [editingFollowup, setEditingFollowup] = useState<Followup | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [formType, setFormType] = useState<"note" | "file" | "image">("note");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    fetchFollowups();
  }, [clientId]);

  const fetchFollowups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_followups")
        .select(`
          *,
          users (name)
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFollowups((data || []) as Followup[]);
    } catch (error: any) {
      console.error("Error fetching followups:", error);
      toast.error("Erro ao carregar acompanhamentos");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormType("note");
    setFormTitle("");
    setFormContent("");
    setSelectedFile(null);
    setEditingFollowup(null);
  };

  const openNewDialog = (type: "note" | "file" | "image") => {
    resetForm();
    setFormType(type);
    setDialogOpen(true);
  };

  const openEditDialog = (followup: Followup) => {
    setEditingFollowup(followup);
    setFormType(followup.type);
    setFormTitle(followup.title || "");
    setFormContent(followup.content || "");
    setDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 10MB.");
        return;
      }
      setSelectedFile(file);
      if (!formTitle) {
        setFormTitle(file.name);
      }
    }
  };

  const uploadFile = async (file: File): Promise<{ url: string; name: string; size: number }> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${clientId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("client-followups")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("client-followups")
      .getPublicUrl(fileName);

    return {
      url: urlData.publicUrl,
      name: file.name,
      size: file.size,
    };
  };

  const handleSave = async () => {
    if (formType === "note" && !formContent.trim()) {
      toast.error("O conteúdo da nota é obrigatório");
      return;
    }

    if ((formType === "file" || formType === "image") && !selectedFile && !editingFollowup) {
      toast.error("Selecione um arquivo");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("id, account_id")
        .single();

      if (!userData) {
        toast.error("Usuário não encontrado");
        return;
      }

      let fileData = null;
      if (selectedFile) {
        setUploading(true);
        fileData = await uploadFile(selectedFile);
        setUploading(false);
      }

      if (editingFollowup) {
        // Update existing
        const updateData: any = {
          title: formTitle || null,
          content: formContent || null,
        };

        if (fileData) {
          updateData.file_url = fileData.url;
          updateData.file_name = fileData.name;
          updateData.file_size = fileData.size;
        }

        const { error } = await supabase
          .from("client_followups")
          .update(updateData)
          .eq("id", editingFollowup.id);

        if (error) throw error;
        toast.success("Acompanhamento atualizado!");
      } else {
        // Create new
        const { error } = await supabase
          .from("client_followups")
          .insert({
            account_id: userData.account_id,
            client_id: clientId,
            user_id: userData.id,
            type: formType,
            title: formTitle || null,
            content: formContent || null,
            file_url: fileData?.url || null,
            file_name: fileData?.name || null,
            file_size: fileData?.size || null,
          });

        if (error) throw error;
        toast.success("Acompanhamento adicionado!");
      }

      setDialogOpen(false);
      resetForm();
      fetchFollowups();
    } catch (error: any) {
      console.error("Error saving followup:", error);
      toast.error(error.message || "Erro ao salvar");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!followupToDelete) return;

    try {
      // Delete file from storage if exists
      if (followupToDelete.file_url) {
        const filePath = followupToDelete.file_url.split("/client-followups/")[1];
        if (filePath) {
          await supabase.storage.from("client-followups").remove([filePath]);
        }
      }

      const { error } = await supabase
        .from("client_followups")
        .delete()
        .eq("id", followupToDelete.id);

      if (error) throw error;

      toast.success("Acompanhamento excluído!");
      setDeleteDialogOpen(false);
      setFollowupToDelete(null);
      fetchFollowups();
    } catch (error: any) {
      console.error("Error deleting followup:", error);
      toast.error(error.message || "Erro ao excluir");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "note":
        return <StickyNote className="h-4 w-4" />;
      case "image":
        return <Image className="h-4 w-4" />;
      case "file":
        return <File className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "note":
        return "Nota";
      case "image":
        return "Imagem";
      case "file":
        return "Arquivo";
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => openNewDialog("note")}>
          <StickyNote className="h-4 w-4 mr-2" />
          Nova Nota
        </Button>
        <Button variant="outline" size="sm" onClick={() => openNewDialog("file")}>
          <File className="h-4 w-4 mr-2" />
          Subir Arquivo
        </Button>
        <Button variant="outline" size="sm" onClick={() => openNewDialog("image")}>
          <Image className="h-4 w-4 mr-2" />
          Subir Imagem
        </Button>
      </div>

      {/* Followups List */}
      {followups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhum registro de acompanhamento ainda.</p>
          <p className="text-sm">Comece adicionando uma nota, arquivo ou imagem.</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-3 pr-4">
            {followups.map((followup) => (
              <div
                key={followup.id}
                className="p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="gap-1">
                        {getTypeIcon(followup.type)}
                        {getTypeLabel(followup.type)}
                      </Badge>
                      {followup.title && (
                        <span className="font-medium truncate">{followup.title}</span>
                      )}
                    </div>

                    {followup.content && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">
                        {followup.content}
                      </p>
                    )}

                    {followup.type === "image" && followup.file_url && (
                      <div className="mb-2 relative group">
                        <img
                          src={followup.file_url}
                          alt={followup.file_name || "Imagem"}
                          className="max-w-xs max-h-48 rounded-md object-cover cursor-pointer transition-opacity hover:opacity-90"
                          onClick={() => {
                            setLightboxImage({
                              url: followup.file_url!,
                              name: followup.file_name || followup.title || "Imagem",
                            });
                            setLightboxOpen(true);
                          }}
                        />
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute bottom-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setLightboxImage({
                              url: followup.file_url!,
                              name: followup.file_name || followup.title || "Imagem",
                            });
                            setLightboxOpen(true);
                          }}
                        >
                          <Expand className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {followup.type === "file" && followup.file_url && (
                      <a
                        href={followup.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <Download className="h-4 w-4" />
                        {followup.file_name}
                        {followup.file_size && (
                          <span className="text-muted-foreground">
                            ({formatFileSize(followup.file_size)})
                          </span>
                        )}
                      </a>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                      <User className="h-3 w-3" />
                      <span>{followup.users?.name || "Usuário"}</span>
                      <span>•</span>
                      <span>
                        {format(new Date(followup.created_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(followup)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        setFollowupToDelete(followup);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        setDialogOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFollowup ? "Editar" : "Novo"} {getTypeLabel(formType)}
            </DialogTitle>
            <DialogDescription>
              {formType === "note"
                ? "Adicione uma nota de acompanhamento do cliente"
                : formType === "image"
                ? "Faça upload de uma imagem relacionada ao cliente"
                : "Faça upload de um arquivo relacionado ao cliente"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título (opcional)</Label>
              <Input
                placeholder="Ex: Reunião de alinhamento"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>

            {formType === "note" && (
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea
                  placeholder="Descreva o acompanhamento..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={5}
                />
              </div>
            )}

            {(formType === "file" || formType === "image") && (
              <>
                <div className="space-y-2">
                  <Label>Arquivo</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept={formType === "image" ? "image/*" : "*"}
                      onChange={handleFileChange}
                      className="flex-1"
                    />
                  </div>
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground">
                      Selecionado: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </p>
                  )}
                  {editingFollowup?.file_name && !selectedFile && (
                    <p className="text-sm text-muted-foreground">
                      Arquivo atual: {editingFollowup.file_name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    placeholder="Adicione uma descrição..."
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {(saving || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {uploading ? "Enviando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir acompanhamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O registro será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Lightbox */}
      <ImageLightbox
        src={lightboxImage?.url || ""}
        alt={lightboxImage?.name}
        open={lightboxOpen}
        onClose={() => {
          setLightboxOpen(false);
          setLightboxImage(null);
        }}
      />
    </div>
  );
}
