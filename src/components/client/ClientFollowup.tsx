import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MentionInput, extractMentions } from "@/components/ui/mention-input";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  ArrowDownUp,
  ArrowDown,
  ArrowUp,
  Search,
  X,
  Send,
  Camera,
  Paperclip,
  MessageSquare,
  CornerDownRight,
  Smile,
  Heart,
  ThumbsUp,
  Laugh,
  Angry,
  Frown,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  parent_id: string | null;
  users?: {
    name: string;
    avatar_url: string | null;
  };
  replies?: Followup[];
  reactions?: Reaction[];
}

interface Reaction {
  id: string;
  emoji: string;
  user_id: string;
  users?: {
    name: string;
  };
}

interface ReactionCount {
  emoji: string;
  count: number;
  userReacted: boolean;
}

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

interface ClientFollowupProps {
  clientId: string;
}

export function ClientFollowup({ clientId }: ClientFollowupProps) {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [followupToDelete, setFollowupToDelete] = useState<Followup | null>(null);
  const [editingFollowup, setEditingFollowup] = useState<Followup | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Reactions state
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});

  // Form state
  const [formType, setFormType] = useState<"note" | "file" | "image">("note");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Sort state
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Quick comment state
  const [quickComment, setQuickComment] = useState("");
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatar_url: string | null; account_id: string } | null>(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [savingReply, setSavingReply] = useState(false);
  
  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 10;

  useEffect(() => {
    fetchFollowups();
    fetchCurrentUser();
  }, [clientId, sortOrder]);

  const fetchFollowups = async (loadMore = false) => {
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setFollowups([]);
    }

    try {
      const offset = loadMore ? followups.length : 0;
      
      // Fetch only top-level comments (parent_id is null)
      const { data, error, count } = await supabase
        .from("client_followups")
        .select(`
          *,
          users (name, avatar_url)
        `, { count: "exact" })
        .eq("client_id", clientId)
        .is("parent_id", null)
        .order("created_at", { ascending: sortOrder === "asc" })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      // Fetch replies for these followups
      const followupIds = (data || []).map(f => f.id);
      let repliesData: any[] = [];
      
      if (followupIds.length > 0) {
        const { data: replies } = await supabase
          .from("client_followups")
          .select(`
            *,
            users (name, avatar_url)
          `)
          .in("parent_id", followupIds)
          .order("created_at", { ascending: true });
        
        repliesData = replies || [];
      }

      // Fetch all followup IDs (parents + replies) for reactions
      const allFollowupIds = [...followupIds, ...repliesData.map(r => r.id)];
      
      if (allFollowupIds.length > 0) {
        const { data: reactionsData } = await supabase
          .from("followup_reactions")
          .select(`
            id,
            followup_id,
            emoji,
            user_id,
            users (name)
          `)
          .in("followup_id", allFollowupIds);
        
        // Group reactions by followup_id
        const reactionsByFollowup: Record<string, Reaction[]> = {};
        (reactionsData || []).forEach((reaction: any) => {
          if (!reactionsByFollowup[reaction.followup_id]) {
            reactionsByFollowup[reaction.followup_id] = [];
          }
          reactionsByFollowup[reaction.followup_id].push({
            id: reaction.id,
            emoji: reaction.emoji,
            user_id: reaction.user_id,
            users: reaction.users,
          });
        });
        setReactions(prev => ({ ...prev, ...reactionsByFollowup }));
      }

      // Group replies by parent_id
      const repliesByParent: Record<string, Followup[]> = {};
      repliesData.forEach((reply) => {
        if (!repliesByParent[reply.parent_id]) {
          repliesByParent[reply.parent_id] = [];
        }
        repliesByParent[reply.parent_id].push(reply as Followup);
      });

      // Attach replies to their parent followups
      const followupsWithReplies = (data || []).map((followup) => ({
        ...followup,
        replies: repliesByParent[followup.id] || [],
      })) as Followup[];
      
      if (loadMore) {
        setFollowups((prev) => [...prev, ...followupsWithReplies]);
      } else {
        setFollowups(followupsWithReplies);
      }

      // Check if there are more items to load
      const totalLoaded = loadMore ? followups.length + followupsWithReplies.length : followupsWithReplies.length;
      setHasMore(count !== null && totalLoaded < count);
    } catch (error: any) {
      console.error("Error fetching followups:", error);
      toast.error("Erro ao carregar acompanhamentos");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Get reaction counts for a followup
  const getReactionCounts = (followupId: string): ReactionCount[] => {
    const followupReactions = reactions[followupId] || [];
    const counts: Record<string, { count: number; userReacted: boolean }> = {};
    
    followupReactions.forEach((r) => {
      if (!counts[r.emoji]) {
        counts[r.emoji] = { count: 0, userReacted: false };
      }
      counts[r.emoji].count++;
      if (currentUser && r.user_id === currentUser.id) {
        counts[r.emoji].userReacted = true;
      }
    });
    
    return Object.entries(counts).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      userReacted: data.userReacted,
    }));
  };

  // Toggle a reaction on a followup
  const toggleReaction = async (followupId: string, emoji: string) => {
    if (!currentUser) return;
    
    const existingReaction = (reactions[followupId] || []).find(
      (r) => r.user_id === currentUser.id && r.emoji === emoji
    );
    
    try {
      if (existingReaction) {
        // Remove reaction
        await supabase
          .from("followup_reactions")
          .delete()
          .eq("id", existingReaction.id);
        
        setReactions(prev => ({
          ...prev,
          [followupId]: (prev[followupId] || []).filter(r => r.id !== existingReaction.id),
        }));
      } else {
        // Add reaction
        const { data, error } = await supabase
          .from("followup_reactions")
          .insert({
            account_id: currentUser.account_id,
            followup_id: followupId,
            user_id: currentUser.id,
            emoji,
          })
          .select("id, emoji, user_id")
          .single();
        
        if (error) throw error;
        
        setReactions(prev => ({
          ...prev,
          [followupId]: [...(prev[followupId] || []), { ...data, users: { name: currentUser.name } }],
        }));
      }
    } catch (error: any) {
      console.error("Error toggling reaction:", error);
      toast.error("Erro ao reagir");
    }
  };

  const loadMoreFollowups = () => {
    if (!loadingMore && hasMore) {
      fetchFollowups(true);
    }
  };

  // Filter followups by search query
  const filteredFollowups = followups.filter((followup) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = followup.title?.toLowerCase().includes(query);
    const contentMatch = followup.content?.toLowerCase().includes(query);
    const fileNameMatch = followup.file_name?.toLowerCase().includes(query);
    return titleMatch || contentMatch || fileNameMatch;
  });

  const fetchCurrentUser = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, name, avatar_url, account_id")
      .single();
    if (data) setCurrentUser(data);
  };

  const handleQuickComment = async () => {
    if (!quickComment.trim() || !currentUser) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("client_followups")
        .insert({
          account_id: currentUser.account_id,
          client_id: clientId,
          user_id: currentUser.id,
          type: "note",
          title: null,
          content: quickComment.trim(),
        });

      if (error) throw error;
      toast.success("Nota adicionada!");
      setQuickComment("");
      fetchFollowups();
    } catch (error: any) {
      console.error("Error saving quick comment:", error);
      toast.error("Erro ao salvar nota");
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

  // Handle reply submission
  const handleReply = async (parentId: string) => {
    if (!replyContent.trim() || !currentUser) return;
    
    setSavingReply(true);
    try {
      const { error } = await supabase
        .from("client_followups")
        .insert({
          account_id: currentUser.account_id,
          client_id: clientId,
          user_id: currentUser.id,
          type: "note",
          title: null,
          content: replyContent.trim(),
          parent_id: parentId,
        });

      if (error) throw error;
      toast.success("Resposta enviada!");
      setReplyContent("");
      setReplyingTo(null);
      fetchFollowups();
    } catch (error: any) {
      console.error("Error saving reply:", error);
      toast.error("Erro ao enviar resposta");
    } finally {
      setSavingReply(false);
    }
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent, parentId: string) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleReply(parentId);
    }
    if (e.key === "Escape") {
      setReplyingTo(null);
      setReplyContent("");
    }
  };

  const startReply = (followupId: string) => {
    setReplyingTo(followupId);
    setReplyContent("");
    // Focus the reply input after state update
    setTimeout(() => {
      replyInputRef.current?.focus();
    }, 100);
  };

  const handleQuickFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setUploading(true);
    try {
      const fileData = await uploadFile(file);
      
      const { error } = await supabase
        .from("client_followups")
        .insert({
          account_id: currentUser.account_id,
          client_id: clientId,
          user_id: currentUser.id,
          type: type,
          title: file.name,
          content: null,
          file_url: fileData.url,
          file_name: fileData.name,
          file_size: fileData.size,
        });

      if (error) throw error;
      toast.success(type === "image" ? "Imagem enviada!" : "Arquivo enviado!");
      fetchFollowups();
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      // Reset input
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }
    setSelectedFile(file);
    if (!formTitle) {
      setFormTitle(file.name);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Filter out files that are too large
    const validFiles = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} é muito grande. Máximo 10MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // If single file, open dialog for adding title/description
    if (validFiles.length === 1) {
      const file = validFiles[0];
      const isImage = file.type.startsWith("image/");
      resetForm();
      setFormType(isImage ? "image" : "file");
      processFile(file);
      setDialogOpen(true);
      return;
    }

    // Multiple files - upload directly
    await handleBulkUpload(validFiles);
  };

  const handleBulkUpload = async (files: File[]) => {
    setUploading(true);
    
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("id, account_id")
        .single();

      if (!userData) {
        toast.error("Usuário não encontrado");
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const file of files) {
        try {
          const isImage = file.type.startsWith("image/");
          const fileData = await uploadFile(file);

          await supabase.from("client_followups").insert({
            account_id: userData.account_id,
            client_id: clientId,
            user_id: userData.id,
            type: isImage ? "image" : "file",
            title: file.name,
            content: null,
            file_url: fileData.url,
            file_name: fileData.name,
            file_size: fileData.size,
          });

          successCount++;
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} arquivo${successCount > 1 ? "s" : ""} enviado${successCount > 1 ? "s" : ""} com sucesso!`);
        fetchFollowups();
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} arquivo${errorCount > 1 ? "s" : ""} falhou${errorCount > 1 ? "aram" : ""}.`);
      }
    } catch (error: any) {
      console.error("Error in bulk upload:", error);
      toast.error("Erro ao enviar arquivos");
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
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
    <div
      className="space-y-4"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop Zone Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-primary rounded-xl p-12 bg-primary/5 animate-scale-in">
            <div className="flex flex-col items-center gap-3 text-primary">
              <Upload className="h-12 w-12" />
              <p className="text-lg font-medium">Solte os arquivos aqui</p>
              <p className="text-sm text-muted-foreground">Imagens ou documentos (múltiplos arquivos suportados)</p>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Progress */}
      {uploading && !dialogOpen && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/30 bg-primary/5">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium">Enviando arquivos...</span>
        </div>
      )}


      {/* Search and Sort */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 h-8"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
          className="gap-1 h-8 px-2"
        >
          {sortOrder === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
          <span className="text-xs">{sortOrder === "desc" ? "Recentes" : "Antigos"}</span>
        </Button>
      </div>

      {/* Followups List */}
      {filteredFollowups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          {searchQuery ? (
            <>
              <p>Nenhum resultado encontrado.</p>
              <p className="text-sm">Tente buscar por outros termos.</p>
            </>
          ) : (
            <>
              <p>Nenhum registro de acompanhamento ainda.</p>
              <p className="text-sm">Comece adicionando uma nota, arquivo ou imagem.</p>
            </>
          )}
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-4 pr-4">
            {filteredFollowups.map((followup) => (
              <div key={followup.id} className="space-y-2">
                {/* Main Comment */}
                <div className="flex gap-3 group">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={followup.users?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-muted">
                      {(followup.users?.name || "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{followup.users?.name || "Usuário"}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(followup.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {followup.type !== "note" && (
                        <Badge variant="outline" className="gap-1 h-5 text-xs">
                          {getTypeIcon(followup.type)}
                          {getTypeLabel(followup.type)}
                        </Badge>
                      )}
                      <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => openEditDialog(followup)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => {
                            setFollowupToDelete(followup);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {followup.content && (
                      <p className="text-sm text-foreground whitespace-pre-wrap mt-1">
                        {followup.content}
                      </p>
                    )}

                    {followup.type === "image" && followup.file_url && (
                      <div className="mt-2 relative group/img inline-block">
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
                          className="absolute bottom-2 right-2 h-6 w-6 opacity-0 group-hover/img:opacity-100 transition-opacity"
                          onClick={() => {
                            setLightboxImage({
                              url: followup.file_url!,
                              name: followup.file_name || followup.title || "Imagem",
                            });
                            setLightboxOpen(true);
                          }}
                        >
                          <Expand className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {followup.type === "file" && followup.file_url && (
                      <a
                        href={followup.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-1"
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

                    {/* Reactions & Reply Button */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {/* Existing Reactions */}
                      {getReactionCounts(followup.id).map((reaction) => (
                        <button
                          key={reaction.emoji}
                          onClick={() => toggleReaction(followup.id, reaction.emoji)}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                            reaction.userReacted
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "bg-muted hover:bg-muted/80"
                          }`}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.count}</span>
                        </button>
                      ))}

                      {/* Add Reaction Button */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <Smile className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="start">
                          <div className="flex gap-1">
                            {EMOJI_OPTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(followup.id, emoji)}
                                className="p-1.5 text-lg hover:bg-muted rounded transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>

                      <span className="text-muted-foreground">·</span>

                      {/* Reply Button */}
                      <button
                        onClick={() => startReply(followup.id)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                      >
                        <MessageSquare className="h-3 w-3" />
                        Responder
                      </button>
                      {followup.replies && followup.replies.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {followup.replies.length} {followup.replies.length === 1 ? "resposta" : "respostas"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {followup.replies && followup.replies.length > 0 && (
                  <div className="ml-11 space-y-3 border-l-2 border-muted pl-4">
                    {followup.replies.map((reply) => (
                      <div key={reply.id} className="flex gap-3 group">
                        <Avatar className="h-6 w-6 flex-shrink-0">
                          <AvatarImage src={reply.users?.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] bg-muted">
                            {(reply.users?.name || "U").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-xs">{reply.users?.name || "Usuário"}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(reply.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                            <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => openEditDialog(reply)}
                              >
                                <Pencil className="h-2.5 w-2.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setFollowupToDelete(reply);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          </div>
                          {reply.content && (
                            <p className="text-xs text-foreground whitespace-pre-wrap mt-0.5">
                              {reply.content}
                            </p>
                          )}
                          
                          {/* Reactions for replies */}
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {getReactionCounts(reply.id).map((reaction) => (
                              <button
                                key={reaction.emoji}
                                onClick={() => toggleReaction(reply.id, reaction.emoji)}
                                className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                                  reaction.userReacted
                                    ? "bg-primary/20 text-primary border border-primary/30"
                                    : "bg-muted hover:bg-muted/80"
                                }`}
                              >
                                <span>{reaction.emoji}</span>
                                <span>{reaction.count}</span>
                              </button>
                            ))}
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100">
                                  <Smile className="h-3 w-3" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-2" align="start">
                                <div className="flex gap-1">
                                  {EMOJI_OPTIONS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() => toggleReaction(reply.id, emoji)}
                                      className="p-1.5 text-lg hover:bg-muted rounded transition-colors"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Input */}
                {replyingTo === followup.id && currentUser && (
                  <div className="ml-11 flex gap-2 items-start">
                    <Avatar className="h-6 w-6 flex-shrink-0">
                      <AvatarImage src={currentUser.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {currentUser.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 relative">
                      <MentionInput
                        ref={replyInputRef}
                        placeholder="Escreva uma resposta..."
                        value={replyContent}
                        onChange={setReplyContent}
                        onKeyDown={(e) => handleReplyKeyDown(e, followup.id)}
                        className="text-sm pr-16 min-h-[36px]"
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyContent("");
                          }}
                          className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleReply(followup.id)}
                          disabled={savingReply || !replyContent.trim()}
                          className="p-1 rounded-full text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                        >
                          {savingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="pt-4 flex justify-center">
                <Button
                  variant="outline"
                  onClick={loadMoreFollowups}
                  disabled={loadingMore}
                  size="sm"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    "Carregar mais"
                  )}
                </Button>
              </div>
            )}

            {!hasMore && followups.length > PAGE_SIZE && (
              <p className="text-center text-sm text-muted-foreground pt-4">
                Todos os registros carregados
              </p>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Social Media Style Input - Bottom position */}
      {currentUser && (
        <div className="flex gap-3 pt-4 border-t">
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage src={currentUser.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {currentUser.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 relative">
            <MentionInput
              placeholder="Escreva uma nota... Use @ para mencionar"
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
                onChange={(e) => handleQuickFileSelect(e, "image")}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleQuickFileSelect(e, "file")}
              />
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploading}
                      className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Foto</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Arquivo</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {(quickComment.trim() || uploading) && (
                <button
                  type="button"
                  onClick={handleQuickComment}
                  disabled={saving || uploading || !quickComment.trim()}
                  className="p-1.5 rounded-full text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  {saving || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        </div>
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
