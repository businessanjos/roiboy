import { memo, useRef, useState, useMemo, useEffect } from "react";
import {
  Bold,
  BookOpen,
  Code,
  Contact,
  FileText,
  Image as ImageIcon,
  Italic,
  Loader2,
  Mic,
  PenLine,
  Play,
  Paperclip,
  Plus,
  Send,
  Smile,
  Square,
  Strikethrough,
  Trash2,
  X,
  Zap,
  Reply,
  Contrast,
  Check,
} from "lucide-react";
import { SECURITY_LIMITS } from "@/lib/security-validators";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ZappGroupMentionInput, MentionData } from "./ZappGroupMentionInput";
import { Message } from "./types";

export type { MentionData };

const HC_KEY = "royzapp-attachment-menu-hc";

function AttachmentMenu({
  uploadingMedia,
  fileInputRef,
  imageInputRef,
  onOpenContactPicker,
  onOpenQuickReplies,
}: {
  uploadingMedia: boolean;
  fileInputRef?: React.RefObject<HTMLInputElement>;
  imageInputRef?: React.RefObject<HTMLInputElement>;
  onOpenContactPicker?: () => void;
  onOpenQuickReplies?: () => void;
}) {
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(HC_KEY) === "1";
  });

  useEffect(() => {
    try {
      localStorage.setItem(HC_KEY, highContrast ? "1" : "0");
    } catch {}
  }, [highContrast]);

  const contentClass = highContrast
    ? "bg-black border-2 border-white text-white z-50 shadow-[0_0_0_1px_rgba(255,255,255,0.4)]"
    : "bg-zapp-panel border-zapp-border z-50";

  const itemClass = highContrast
    ? "text-white hover:bg-white hover:text-black focus:bg-white focus:text-black cursor-pointer font-medium"
    : "text-zapp-text hover:bg-zapp-hover focus:bg-zapp-hover focus:text-zapp-text cursor-pointer";

  const sepClass = highContrast ? "bg-white/40" : "bg-zapp-border";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-zapp-text-muted hover:bg-zapp-hover flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10"
          disabled={uploadingMedia}
        >
          {uploadingMedia ? (
            <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
          ) : (
            <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className={contentClass}>
        <DropdownMenuItem
          onClick={() => fileInputRef?.current?.click()}
          className={itemClass}
        >
          <FileText className={cn("h-4 w-4 mr-2", !highContrast && "text-[#7f66ff]")} />
          Documento
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => imageInputRef?.current?.click()}
          className={itemClass}
        >
          <ImageIcon className={cn("h-4 w-4 mr-2", !highContrast && "text-[#007bfc]")} />
          Fotos e vídeos
        </DropdownMenuItem>
        <DropdownMenuSeparator className={sepClass} />
        <DropdownMenuItem onClick={onOpenContactPicker} className={itemClass}>
          <Contact className={cn("h-4 w-4 mr-2", !highContrast && "text-[#02a698]")} />
          Contato
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenQuickReplies} className={itemClass}>
          <Zap className={cn("h-4 w-4 mr-2", !highContrast && "text-[#ffb000]")} />
          Resposta rápida
        </DropdownMenuItem>
        <DropdownMenuSeparator className={sepClass} />
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            setHighContrast((v) => !v);
          }}
          className={itemClass}
        >
          <Contrast className="h-4 w-4 mr-2" />
          <span className="flex-1">Alto contraste</span>
          {highContrast && <Check className="h-4 w-4 ml-2" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ReplyingToMessage {
  id: string;
  content: string | null;
  sender_name: string | null;
  is_from_client: boolean;
}

interface ZappMessageInputProps {
  messageInput: string;
  sendingMessage: boolean;
  uploadingMedia: boolean;
  isRecording: boolean;
  recordingDuration: number;
  audioPreview: { blob: Blob; url: string; duration: number } | null;
  showFormatting: boolean;
  messageInputRef?: React.RefObject<HTMLTextAreaElement>;
  imageInputRef?: React.RefObject<HTMLInputElement>;
  fileInputRef?: React.RefObject<HTMLInputElement>;
  isGroup?: boolean;
  groupJid?: string | null;
  replyingTo?: ReplyingToMessage | null;
  signatureEnabled?: boolean;
  hasSignature?: boolean;
  sectorId?: string;
  // Image preview props
  imagePreview?: { file: File; url: string } | null;
  onSetImagePreview?: (preview: { file: File; url: string } | null) => void;
  // File preview props (video/document)
  filePreview?: { file: File; url: string } | null;
  onSetFilePreview?: (preview: { file: File; url: string } | null) => void;
  onMessageChange: (value: string) => void;
  onSendMessage: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onToggleFormatting: () => void;
  onInsertFormatting: (type: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onDiscardAudioPreview: () => void;
  onConfirmAudioSend: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, type: string) => void;
  onOpenContactPicker: () => void;
  onOpenQuickReplies: () => void;
  onCancelReply?: () => void;
  onMentionInsert?: (mention: MentionData) => void;
  onToggleSignature?: () => void;
  onOpenPlaybook?: () => void;
}

const formatRecordingDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ZappMessageInput = memo(function ZappMessageInput({
  messageInput,
  sendingMessage,
  uploadingMedia,
  isRecording,
  recordingDuration,
  audioPreview,
  showFormatting,
  messageInputRef,
  imageInputRef,
  fileInputRef,
  isGroup,
  groupJid,
  replyingTo,
  signatureEnabled,
  hasSignature,
  sectorId,
  imagePreview,
  onSetImagePreview,
  filePreview,
  onSetFilePreview,
  onMessageChange,
  onSendMessage,
  onKeyPress,
  onToggleFormatting,
  onInsertFormatting,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onDiscardAudioPreview,
  onConfirmAudioSend,
  onFileSelect,
  onOpenContactPicker,
  onOpenQuickReplies,
  onCancelReply,
  onMentionInsert,
  onToggleSignature,
  onOpenPlaybook,
}: ZappMessageInputProps) {
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const toggleAudioPreview = () => {
    const audio = audioPreviewRef.current;
    if (audio) {
      if (audio.paused) {
        audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleEmojiSelect = (emojiData: EmojiClickData) => {
    onMessageChange(messageInput + emojiData.emoji);
    setEmojiPickerOpen(false);
    messageInputRef?.current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!onSetImagePreview) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const previewUrl = URL.createObjectURL(file);
          onSetImagePreview({ file, url: previewUrl });
        }
        break;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.type.startsWith('image/') && onSetImagePreview) {
      const previewUrl = URL.createObjectURL(file);
      onSetImagePreview({ file, url: previewUrl });
    } else if (onSetFilePreview) {
      const previewUrl = URL.createObjectURL(file);
      onSetFilePreview({ file, url: previewUrl });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const discardImagePreview = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview.url);
    }
    onSetImagePreview?.(null);
  };

  const discardFilePreview = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview.url);
    }
    onSetFilePreview?.(null);
  };

  const isVideo = filePreview?.file.type.startsWith('video/');

  return (
    <>
      {/* Formatting toolbar */}
      {showFormatting && (
        <div className="bg-zapp-panel px-4 py-2 border-b border-zapp-border flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-zapp-text-muted hover:bg-zapp-hover hover:text-zapp-text"
                onClick={() => onInsertFormatting('bold')}
              >
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Negrito (*texto*)</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-zapp-text-muted hover:bg-zapp-hover hover:text-zapp-text"
                onClick={() => onInsertFormatting('italic')}
              >
                <Italic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Itálico (_texto_)</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-zapp-text-muted hover:bg-zapp-hover hover:text-zapp-text"
                onClick={() => onInsertFormatting('strikethrough')}
              >
                <Strikethrough className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Tachado (~texto~)</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-zapp-text-muted hover:bg-zapp-hover hover:text-zapp-text"
                onClick={() => onInsertFormatting('monospace')}
              >
                <Code className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Monoespaçado (```texto```)</TooltipContent>
          </Tooltip>
          
          <span className="text-xs text-zapp-text-muted ml-2">Selecione e clique</span>
        </div>
      )}

      {/* Reply preview bar */}
      {replyingTo && (
        <div className="bg-zapp-panel border-b border-zapp-border px-4 py-2 flex items-center gap-3">
          <div className="w-1 h-10 bg-zapp-accent rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zapp-accent truncate">
              {replyingTo.is_from_client 
                ? (replyingTo.sender_name || "Cliente") 
                : "Você"}
            </p>
            <p className="text-sm text-zapp-text-muted truncate">
              {replyingTo.content || "[Mídia]"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zapp-text-muted hover:bg-zapp-hover flex-shrink-0"
            onClick={onCancelReply}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Message input */}
      <div 
        className={cn(
          "bg-zapp-panel px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-1 sm:gap-2 relative",
          isDragging && "ring-2 ring-zapp-accent ring-inset"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Drop overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-zapp-accent/10 border-2 border-dashed border-zapp-accent rounded-lg flex items-center justify-center z-50 pointer-events-none">
            <div className="flex items-center gap-2 text-zapp-accent font-medium">
              <Paperclip className="h-5 w-5" />
              <span className="hidden sm:inline">Solte o arquivo aqui</span>
            </div>
          </div>
        )}
        
        {/* Formatting toggle - hidden on mobile */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn(
                "hidden sm:flex flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10",
                showFormatting 
                  ? "text-zapp-accent hover:bg-zapp-hover" 
                  : "text-zapp-text-muted hover:bg-zapp-hover"
              )}
              onClick={onToggleFormatting}
            >
              <Bold className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Formatação</TooltipContent>
        </Tooltip>

        {/* Emoji Picker */}
        <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-zapp-text-muted hover:bg-zapp-hover flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10"
                >
                  <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Emoji</TooltipContent>
          </Tooltip>
          <PopoverContent 
            side="top" 
            align="start" 
            className="w-auto p-0 border-zapp-border bg-transparent"
            sideOffset={8}
          >
            <EmojiPicker
              onEmojiClick={handleEmojiSelect}
              theme={Theme.DARK}
              searchPlaceholder="Buscar emoji..."
              width={280}
              height={350}
              skinTonesDisabled
              lazyLoadEmojis
            />
          </PopoverContent>
        </Popover>
        
        {/* Signature toggle button - hidden on mobile */}
        {hasSignature && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "hidden sm:flex flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10",
                  signatureEnabled 
                    ? "text-zapp-accent hover:bg-zapp-hover" 
                    : "text-zapp-text-muted hover:bg-zapp-hover"
                )}
                onClick={onToggleSignature}
              >
                <PenLine className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {signatureEnabled ? "Desativar assinatura" : "Ativar assinatura"}
            </TooltipContent>
          </Tooltip>
        )}
        
        <AttachmentMenu
          uploadingMedia={uploadingMedia}
          fileInputRef={fileInputRef}
          imageInputRef={imageInputRef}
          onOpenContactPicker={onOpenContactPicker}
          onOpenQuickReplies={onOpenQuickReplies}
        />
        
        {/* Playbook button - hidden on mobile */}
        {onOpenPlaybook && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="hidden sm:flex text-zapp-text-muted hover:bg-zapp-hover flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10"
                onClick={onOpenPlaybook}
              >
                <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Playbook</TooltipContent>
          </Tooltip>
        )}
        
        {imagePreview ? (
          // Image preview UI
          <div className="flex items-center gap-2 flex-1 bg-zapp-input rounded-lg px-3 py-2">
            <img 
              src={imagePreview.url} 
              alt="Preview" 
              className="h-12 w-12 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zapp-text truncate">{imagePreview.file.name}</p>
              <p className="text-xs text-zapp-text-muted">Imagem pronta para envio</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-zapp-hover flex-shrink-0 h-8 w-8"
                  onClick={discardImagePreview}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Descartar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zapp-accent hover:bg-zapp-hover flex-shrink-0 h-8 w-8"
                  onClick={onSendMessage}
                  disabled={uploadingMedia}
                >
                  {uploadingMedia ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Enviar</TooltipContent>
            </Tooltip>
          </div>
        ) : filePreview ? (
          // File preview UI (video/document)
          <div className="flex items-center gap-2 flex-1 bg-zapp-input rounded-lg px-3 py-2">
            <div className="h-12 w-12 rounded bg-zapp-hover flex items-center justify-center flex-shrink-0">
              {isVideo ? (
                <Play className="h-6 w-6 text-zapp-accent" />
              ) : (
                <FileText className="h-6 w-6 text-[#7f66ff]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zapp-text truncate">{filePreview.file.name}</p>
              <p className="text-xs text-zapp-text-muted">
                {isVideo ? "Vídeo pronto para envio" : "Documento pronto para envio"}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-zapp-hover flex-shrink-0 h-8 w-8"
                  onClick={discardFilePreview}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Descartar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zapp-accent hover:bg-zapp-hover flex-shrink-0 h-8 w-8"
                  onClick={onSendMessage}
                  disabled={uploadingMedia}
                >
                  {uploadingMedia ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Enviar</TooltipContent>
            </Tooltip>
          </div>
        ) : audioPreview ? (
          // Audio preview UI
          <div className="flex items-center gap-2 flex-1 bg-zapp-input rounded-lg px-3 py-2">
            <audio
              ref={audioPreviewRef}
              src={audioPreview.url}
              className="hidden"
              onEnded={() => setIsPlaying(false)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="text-zapp-accent hover:bg-zapp-hover flex-shrink-0 h-8 w-8"
              onClick={toggleAudioPreview}
            >
              <Play className="h-5 w-5" />
            </Button>
            <div className="flex-1 h-1 bg-zapp-border rounded-full overflow-hidden">
              <div className="h-full bg-zapp-accent w-full" />
            </div>
            <span className="text-xs text-zapp-text-muted font-mono min-w-[40px]">
              {formatRecordingDuration(audioPreview.duration)}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-zapp-hover flex-shrink-0 h-8 w-8"
                  onClick={onDiscardAudioPreview}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Descartar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zapp-accent hover:bg-zapp-hover flex-shrink-0 h-8 w-8"
                  onClick={onConfirmAudioSend}
                  disabled={uploadingMedia}
                >
                  {uploadingMedia ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Enviar</TooltipContent>
            </Tooltip>
          </div>
        ) : isRecording ? (
          // Recording UI
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-mono text-destructive animate-pulse">
              ⏺ {formatRecordingDuration(recordingDuration)}
            </span>
            <div className="flex-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:bg-zapp-hover flex-shrink-0"
                  onClick={onCancelRecording}
                >
                  <X className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Cancelar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zapp-accent hover:bg-zapp-hover flex-shrink-0"
                  onClick={onStopRecording}
                >
                  <Square className="h-5 w-5 fill-current" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Parar</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <>
            {/* Hidden file inputs */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => onFileSelect(e, "image")}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
              className="hidden"
              onChange={(e) => onFileSelect(e, "document")}
            />
            
            {isGroup && groupJid ? (
              <ZappGroupMentionInput
                ref={messageInputRef}
                placeholder="Digite uma mensagem (@ para mencionar)"
                value={messageInput}
                onChange={(value) => {
                  if (value.length <= SECURITY_LIMITS.MESSAGE_MAX) {
                    onMessageChange(value);
                  }
                }}
                onKeyDown={onKeyPress}
                disabled={sendingMessage}
                groupJid={groupJid}
                sectorId={sectorId}
                onMentionInsert={onMentionInsert}
              />
            ) : (
              <div className="flex-1 relative">
                <Textarea
                  ref={messageInputRef}
                  placeholder="Digite uma mensagem"
                  value={messageInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Enforce character limit
                    if (value.length <= SECURITY_LIMITS.MESSAGE_MAX) {
                      onMessageChange(value);
                    }
                    // Auto-resize textarea
                    const target = e.target;
                    target.style.height = 'auto';
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={onKeyPress}
                  onPaste={handlePaste}
                  disabled={sendingMessage}
                  rows={2}
                  maxLength={SECURITY_LIMITS.MESSAGE_MAX}
                  className="flex-1 w-full bg-zapp-input border-0 text-zapp-text placeholder:text-zapp-text-muted focus-visible:ring-0 rounded-lg min-h-[52px] max-h-[120px] py-2.5 resize-none overflow-y-auto"
                />
                {/* Character count warning */}
                {messageInput.length > SECURITY_LIMITS.MESSAGE_MAX * 0.8 && (
                  <span className={cn(
                    "absolute bottom-1 right-2 text-[10px] pointer-events-none",
                    messageInput.length > SECURITY_LIMITS.MESSAGE_MAX * 0.95 
                      ? "text-destructive" 
                      : "text-zapp-text-muted"
                  )}>
                    {messageInput.length.toLocaleString()}/{SECURITY_LIMITS.MESSAGE_MAX.toLocaleString()}
                  </span>
                )}
              </div>
            )}
            
            {messageInput.trim() ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-zapp-accent hover:bg-zapp-hover flex-shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  onSendMessage();
                }}
                disabled={sendingMessage}
              >
                {sendingMessage ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Send className="h-6 w-6" />
                )}
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-zapp-text-muted hover:bg-zapp-hover flex-shrink-0"
                    onClick={onStartRecording}
                    disabled={uploadingMedia}
                  >
                    <Mic className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Gravar áudio</TooltipContent>
              </Tooltip>
            )}
          </>
        )}
      </div>
    </>
  );
});
