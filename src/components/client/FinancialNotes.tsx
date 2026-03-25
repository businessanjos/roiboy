import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MentionInput } from "@/components/ui/mention-input";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { 
  Loader2, 
  Send, 
  Camera, 
  Paperclip, 
  Trash2, 
  Pencil, 
  X, 
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface FinancialNote {
  id: string;
  type: string;
  content: string | null;
  title: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
}

interface FinancialNotesProps {
  clientId: string;
  currentUser: { id: string; name: string; avatar_url: string | null; account_id: string } | null;
}

export function FinancialNotes({ clientId, currentUser }: FinancialNotesProps) {
  const [notes, setNotes] = useState<FinancialNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickComment, setQuickComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from("client_followups")
        .select(`
          id, type, content, title, file_url, file_name, file_size, created_at, updated_at,
          user:user_id(id, name, avatar_url)
        `)
        .eq("client_id", clientId)
        .in("type", ["financial_note", "image", "file"])
        .is("parent_id", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes((data as unknown as FinancialNote[]) || []);
    } catch (error) {
      console.error("Error fetching financial notes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();

    const channel = supabase
      .channel(`financial-notes-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_followups',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          fetchNotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const handleQuickComment = async () => {
    if (!quickComment.trim() || !currentUser) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from("client_followups").insert({
        account_id: currentUser.account_id,
        client_id: clientId,
        user_id: currentUser.id,
        type: "financial_note",
        title: null,
        content: quickComment.trim(),
      });

      if (error) throw error;
      toast.success("Nota financeira adicionada!");
      setQuickComment("");
    } catch (error: any) {
      console.error("Error adding note:", error);
      toast.error(error.message || "Erro ao adicionar nota");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuickComment();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 50MB.");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentUser.account_id}/${clientId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("client-followups")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("client-followups")
        .getPublicUrl(fileName);

      const { error } = await supabase.from("client_followups").insert({
        account_id: currentUser.account_id,
        client_id: clientId,
        user_id: currentUser.id,
        type: type,
        title: file.name,
        content: null,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
      });

      if (error) throw error;
      toast.success(type === "image" ? "Imagem enviada!" : "Arquivo enviado!");
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error(error?.message || "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleEditNote = (note: FinancialNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content || "");
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent("");
  };

  const handleSaveEdit = async (noteId: string) => {
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("client_followups")
        .update({ content: editContent.trim(), updated_at: new Date().toISOString() })
        .eq("id", noteId);

      if (error) throw error;
      toast.success("Nota atualizada!");
      setEditingNoteId(null);
      setEditContent("");
    } catch (error: any) {
      console.error("Error saving note:", error);
      toast.error("Erro ao salvar nota");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setDeletingId(noteId);
    try {
      const { error } = await supabase
        .from("client_followups")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
      toast.success("Nota excluída!");
    } catch (error: any) {
      console.error("Error deleting note:", error);
      toast.error("Erro ao excluir nota");
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImageFile = (url: string | null, fileName: string | null) => {
    if (!url && !fileName) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const name = (fileName || url || '').toLowerCase();
    return imageExtensions.some(ext => name.endsWith(ext));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-[600px]">
      {/* Scrollable Notes Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {/* Notes List */}
        {notes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma anotação financeira</p>
            <p className="text-sm mt-1">
              Adicione comentários, comprovantes ou documentos do setor financeiro
            </p>
          </div>
        ) : (
          <div className="space-y-3">
          {notes.map((note) => {
            const isOwner = currentUser?.id === note.user?.id;
            const isEditing = editingNoteId === note.id;
            const isDeleting = deletingId === note.id;
            const wasEdited = note.updated_at !== note.created_at;
            const isImage = note.type === "image" || isImageFile(note.file_url, note.file_name);
            const isFile = note.type === "file" && !isImage;

            return (
              <div key={note.id} className="p-4 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={note.user?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {note.user?.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{note.user?.name || "Usuário"}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        {wasEdited && (
                          <span className="text-xs text-muted-foreground italic">(editado)</span>
                        )}
                        {isImage && (
                          <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                            <ImageIcon className="h-3 w-3" />
                            Imagem
                          </Badge>
                        )}
                        {isFile && (
                          <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                            <FileText className="h-3 w-3" />
                            Arquivo
                          </Badge>
                        )}
                      </div>
                      
                      {isOwner && !isEditing && (
                        <div className="flex items-center gap-1">
                          {note.type === "financial_note" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleEditNote(note)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteNote(note.id)}
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[80px] text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(note.id)}
                            disabled={savingEdit}
                          >
                            {savingEdit ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3 mr-1" />
                            )}
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            disabled={savingEdit}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Text content */}
                        {note.content && (
                          <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                            {note.content}
                          </p>
                        )}

                        {/* Image preview */}
                        {isImage && note.file_url && (
                          <div className="mt-2">
                            <img
                              src={note.file_url}
                              alt={note.file_name || "Imagem"}
                              className="max-h-48 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setLightboxImage(note.file_url)}
                            />
                          </div>
                        )}

                        {/* File download */}
                        {isFile && note.file_url && (
                          <a
                            href={note.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={note.file_name}
                            className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm transition-colors"
                          >
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium truncate max-w-[200px]">
                              {note.file_name || "Arquivo"}
                            </span>
                            {note.file_size && (
                              <span className="text-xs text-muted-foreground">
                                ({formatFileSize(note.file_size)})
                              </span>
                            )}
                            <Download className="h-4 w-4 text-primary ml-auto" />
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Comment Input - Fixed at bottom */}
      {currentUser && (
        <div className="flex-shrink-0 flex gap-3 p-4 mt-4 bg-muted/30 rounded-lg border">
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage src={currentUser.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {currentUser.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 relative">
            <MentionInput
              placeholder="Escreva uma nota financeira... Use @ para mencionar"
              value={quickComment}
              onChange={setQuickComment}
              onKeyDown={handleQuickKeyDown}
              className="pr-24"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e, "image")}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFileSelect(e, "file")}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading}
                className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                title="Enviar imagem"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                title="Enviar arquivo"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              {(quickComment.trim() || saving) && (
                <button
                  type="button"
                  onClick={handleQuickComment}
                  disabled={saving || !quickComment.trim()}
                  className="p-1.5 rounded-full text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      <ImageLightbox
        src={lightboxImage || ""}
        alt="Imagem anexada"
        open={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}
