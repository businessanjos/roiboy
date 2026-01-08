import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, 
  Paperclip, 
  Mic, 
  Square, 
  X, 
  Bold, 
  Italic, 
  Strikethrough, 
  Code,
  Play,
  Pause,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TeamChatMessageInputProps {
  onSendMessage: (data: {
    content?: string;
    messageType: 'text' | 'audio' | 'file' | 'image';
    file?: File;
    audioDuration?: number;
  }) => void;
  disabled?: boolean;
}

export function TeamChatMessageInput({ onSendMessage, disabled }: TeamChatMessageInputProps) {
  const [messageInput, setMessageInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const insertFormatting = useCallback((type: 'bold' | 'italic' | 'strikethrough' | 'monospace') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = messageInput.substring(start, end);
    
    const markers = {
      bold: '*',
      italic: '_',
      strikethrough: '~',
      monospace: '```'
    };
    
    const marker = markers[type];
    const formattedText = `${marker}${selectedText || 'texto'}${marker}`;
    
    const newValue = messageInput.substring(0, start) + formattedText + messageInput.substring(end);
    setMessageInput(newValue);
    
    setTimeout(() => {
      textarea.focus();
      const cursorPos = start + marker.length + (selectedText ? selectedText.length : 5) + marker.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  }, [messageInput]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioPreview(audioUrl);
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingDuration(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
    discardAudio();
  };

  const discardAudio = () => {
    if (audioPreview) {
      URL.revokeObjectURL(audioPreview);
    }
    setAudioPreview(null);
    setAudioBlob(null);
    setRecordingDuration(0);
  };

  const toggleAudioPreview = () => {
    if (!audioRef.current || !audioPreview) return;
    
    if (isPlayingPreview) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlayingPreview(!isPlayingPreview);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const discardImage = useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setImageFile(null);
  }, [imagePreview]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const previewUrl = URL.createObjectURL(file);
          setImagePreview(previewUrl);
          setImageFile(file);
        }
        break;
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setImageFile(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      // For images, show preview instead of sending immediately
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setImageFile(file);
    } else {
      // For non-image files, send immediately
      onSendMessage({
        messageType: 'file',
        file
      });
    }
    
    e.target.value = '';
  };

  const handleSend = () => {
    // First: check for image preview
    if (imageFile) {
      onSendMessage({
        messageType: 'image',
        file: imageFile
      });
      discardImage();
      return;
    }

    if (audioBlob) {
      // Create a File from the blob
      const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
      onSendMessage({
        messageType: 'audio',
        file: audioFile,
        audioDuration: recordingDuration
      });
      discardAudio();
      return;
    }
    
    if (!messageInput.trim()) return;
    
    onSendMessage({
      content: messageInput.trim(),
      messageType: 'text'
    });
    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div 
      className={cn(
        "p-4 border-t bg-card relative",
        isDragging && "ring-2 ring-primary ring-inset"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-50 pointer-events-none">
          <div className="flex items-center gap-2 text-primary font-medium">
            <ImageIcon className="h-5 w-5" />
            Solte a imagem aqui
          </div>
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="flex items-center gap-2 mb-3 p-3 bg-muted rounded-lg">
          <img 
            src={imagePreview} 
            alt="Preview" 
            className="h-20 w-20 object-cover rounded"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Imagem pronta para envio</p>
            <p className="text-xs text-muted-foreground truncate">{imageFile?.name}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={discardImage}
            className="h-8 w-8 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Audio preview */}
      {audioPreview && (
        <div className="flex items-center gap-2 mb-3 p-3 bg-muted rounded-lg">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleAudioPreview}
            className="h-8 w-8"
          >
            {isPlayingPreview ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="flex-1 h-1 bg-primary/20 rounded-full">
            <div className="h-full bg-primary rounded-full" style={{ width: '100%' }} />
          </div>
          <span className="text-sm text-muted-foreground">{formatDuration(recordingDuration)}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={discardAudio}
            className="h-8 w-8 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <audio
            ref={audioRef}
            src={audioPreview}
            onEnded={() => setIsPlayingPreview(false)}
            className="hidden"
          />
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-3 mb-3 p-3 bg-destructive/10 rounded-lg">
          <div className="h-3 w-3 bg-destructive rounded-full animate-pulse" />
          <span className="text-sm font-medium text-destructive">Gravando...</span>
          <span className="text-sm text-destructive">{formatDuration(recordingDuration)}</span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={cancelRecording}
            className="text-destructive"
          >
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={stopRecording}
          >
            <Square className="h-4 w-4 mr-1" />
            Parar
          </Button>
        </div>
      )}

      {/* Main input area */}
      {!isRecording && !audioPreview && !imagePreview && (
        <div className="flex gap-2 items-end">
          {/* Formatting buttons */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Bold className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => insertFormatting('bold')}
                  title="Negrito (*texto*)"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => insertFormatting('italic')}
                  title="Itálico (_texto_)"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => insertFormatting('strikethrough')}
                  title="Riscado (~texto~)"
                >
                  <Strikethrough className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => insertFormatting('monospace')}
                  title="Código (```texto```)"
                >
                  <Code className="h-4 w-4" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* File attachment */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0"
            disabled={disabled}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
          />

          {/* Text input */}
          <Textarea
            ref={textareaRef}
            placeholder="Digite sua mensagem..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyPress}
            onPaste={handlePaste}
            disabled={disabled}
            className="flex-1 min-h-[40px] max-h-[120px] resize-none"
            rows={1}
          />

          {/* Audio recording or Send button */}
          {messageInput.trim() ? (
            <Button
              onClick={handleSend}
              disabled={disabled}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={startRecording}
              disabled={disabled}
              className="shrink-0"
            >
              <Mic className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Send button when audio is ready */}
      {audioPreview && (
        <div className="flex justify-end">
          <Button onClick={handleSend} disabled={disabled}>
            <Send className="h-4 w-4 mr-2" />
            Enviar áudio
          </Button>
        </div>
      )}

      {/* Send button when image is ready */}
      {imagePreview && (
        <div className="flex justify-end">
          <Button onClick={handleSend} disabled={disabled}>
            <Send className="h-4 w-4 mr-2" />
            Enviar imagem
          </Button>
        </div>
      )}
    </div>
  );
}
