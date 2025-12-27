import { memo, useRef, useState } from "react";
import {
  Bold,
  Code,
  Contact,
  FileText,
  Image as ImageIcon,
  Italic,
  Loader2,
  Mic,
  Play,
  Plus,
  Send,
  Square,
  Strikethrough,
  Trash2,
  X,
  Zap,
  Reply,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { ZappGroupMentionInput, MentionData } from "./ZappGroupMentionInput";
import { Message } from "./types";

export type { MentionData };

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
  messageInputRef?: React.RefObject<HTMLInputElement>;
  imageInputRef?: React.RefObject<HTMLInputElement>;
  fileInputRef?: React.RefObject<HTMLInputElement>;
  isGroup?: boolean;
  groupJid?: string | null;
  replyingTo?: ReplyingToMessage | null;
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
}: ZappMessageInputProps) {
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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
      <div className="bg-zapp-panel px-4 py-3 flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn(
                "flex-shrink-0",
                showFormatting 
                  ? "text-zapp-accent hover:bg-zapp-hover" 
                  : "text-zapp-text-muted hover:bg-zapp-hover"
              )}
              onClick={onToggleFormatting}
            >
              <Bold className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Formatação</TooltipContent>
        </Tooltip>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-zapp-text-muted hover:bg-zapp-hover flex-shrink-0"
              disabled={uploadingMedia}
            >
              {uploadingMedia ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Plus className="h-6 w-6" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="bg-[#233138] border-zapp-border z-50">
            <DropdownMenuItem 
              onClick={() => fileInputRef?.current?.click()}
              className="text-zapp-text hover:bg-zapp-hover cursor-pointer"
            >
              <FileText className="h-4 w-4 mr-2 text-[#7f66ff]" />
              Documento
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => imageInputRef?.current?.click()}
              className="text-zapp-text hover:bg-zapp-hover cursor-pointer"
            >
              <ImageIcon className="h-4 w-4 mr-2 text-[#007bfc]" />
              Fotos e vídeos
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zapp-border" />
            <DropdownMenuItem 
              onClick={onOpenContactPicker}
              className="text-zapp-text hover:bg-zapp-hover cursor-pointer"
            >
              <Contact className="h-4 w-4 mr-2 text-[#02a698]" />
              Contato
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={onOpenQuickReplies}
              className="text-zapp-text hover:bg-zapp-hover cursor-pointer"
            >
              <Zap className="h-4 w-4 mr-2 text-[#ffb000]" />
              Resposta rápida
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {audioPreview ? (
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
                onChange={onMessageChange}
                onKeyDown={onKeyPress}
                disabled={sendingMessage}
                groupJid={groupJid}
                onMentionInsert={onMentionInsert}
              />
            ) : (
              <Input
                ref={messageInputRef}
                placeholder="Digite uma mensagem"
                value={messageInput}
                onChange={(e) => onMessageChange(e.target.value)}
                onKeyDown={onKeyPress}
                disabled={sendingMessage}
                className="flex-1 bg-zapp-input border-0 text-zapp-text placeholder:text-zapp-text-muted focus-visible:ring-0 rounded-lg h-10"
              />
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
