import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MentionInput } from "@/components/ui/mention-input";
import { Camera, Paperclip, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CurrentUser {
  id: string;
  name: string;
  avatar_url: string | null;
  account_id: string;
}

interface FinancialQuickNoteInputProps {
  clientId: string;
  currentUser: CurrentUser;
  onNoteAdded?: () => void;
}

export function FinancialQuickNoteInput({
  clientId,
  currentUser,
  onNoteAdded,
}: FinancialQuickNoteInputProps) {
  const [quickComment, setQuickComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleQuickComment = async () => {
    if (!quickComment.trim() || !currentUser) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("client_followups").insert({
        client_id: clientId,
        account_id: currentUser.account_id,
        user_id: currentUser.id,
        type: "financial_note",
        content: quickComment.trim(),
      });

      if (error) throw error;

      setQuickComment("");
      toast.success("Anotação adicionada!");
      onNoteAdded?.();
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Erro ao adicionar anotação");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "file"
  ) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 50MB.");
      return;
    }

    const setUploading = type === "image" ? setIsUploadingImage : setIsUploadingFile;
    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${currentUser.account_id}/financial/${clientId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("client-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("client-files")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from("client_followups")
        .insert({
          client_id: clientId,
          account_id: currentUser.account_id,
          user_id: currentUser.id,
          type: type === "image" ? "image" : "file",
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_size: file.size,
        });

      if (insertError) throw insertError;

      toast.success(type === "image" ? "Imagem anexada!" : "Arquivo anexado!");
      onNoteAdded?.();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao fazer upload do arquivo");
    } finally {
      setUploading(false);
      // Reset input
      if (type === "image" && imageInputRef.current) {
        imageInputRef.current.value = "";
      } else if (type === "file" && fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuickComment();
    }
  };

  return (
    <div className="flex gap-3 p-4 bg-muted/30 rounded-lg border">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={currentUser.avatar_url || undefined} />
        <AvatarFallback className="text-xs bg-primary/10 text-primary">
          {currentUser.name?.charAt(0) || "U"}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 flex items-center gap-2">
        <MentionInput
          value={quickComment}
          onChange={setQuickComment}
          placeholder="Escreva uma nota financeira..."
          className="flex-1"
          onKeyDown={handleKeyDown}
        />

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e, "image")}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          className="hidden"
          onChange={(e) => handleFileSelect(e, "file")}
        />

        {/* Image button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => imageInputRef.current?.click()}
          disabled={isUploadingImage}
          title="Anexar imagem ou vídeo"
        >
          {isUploadingImage ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>

        {/* File button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingFile}
          title="Anexar documento"
        >
          {isUploadingFile ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>

        {/* Send button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleQuickComment}
          disabled={!quickComment.trim() || isSubmitting}
          title="Enviar nota"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4 text-primary" />
          )}
        </Button>
      </div>
    </div>
  );
}
