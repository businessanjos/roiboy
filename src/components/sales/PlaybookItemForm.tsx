import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WhatsAppFormattingToolbar } from '@/components/ui/whatsapp-formatting-toolbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Mic,
  Image,
  Video,
  File,
  Sticker,
  List,
  Upload,
  X,
  Loader2,
  Plus,
  Trash2,
  Play,
  Pause,
} from 'lucide-react';
import { usePlaybook, PlaybookItem, PlaybookContentType, PlaybookFolder, CreatePlaybookItemInput } from '@/hooks/usePlaybook';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PlaybookItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: PlaybookItem | null;
  folders: PlaybookFolder[];
  onClose: () => void;
  sectorId?: string | null;
}

const contentTypeOptions: { value: PlaybookContentType; label: string; icon: React.ReactNode }[] = [
  { value: 'text', label: 'Texto', icon: <FileText className="h-4 w-4" /> },
  { value: 'audio', label: 'Áudio', icon: <Mic className="h-4 w-4" /> },
  { value: 'image', label: 'Imagem', icon: <Image className="h-4 w-4" /> },
  { value: 'video', label: 'Vídeo', icon: <Video className="h-4 w-4" /> },
  { value: 'document', label: 'Documento', icon: <File className="h-4 w-4" /> },
  { value: 'sticker', label: 'Sticker', icon: <Sticker className="h-4 w-4" /> },
  { value: 'list', label: 'Lista', icon: <List className="h-4 w-4" /> },
];

interface ListItem {
  title: string;
  description: string;
}

export function PlaybookItemForm({
  open,
  onOpenChange,
  editingItem,
  folders,
  onClose,
  sectorId,
}: PlaybookItemFormProps) {
  const { createItemAsync, updateItem, uploadMedia, isCreatingItem, uploadProgress } = usePlaybook({ sectorId });

  const [name, setName] = useState('');
  const [contentType, setContentType] = useState<PlaybookContentType>('text');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [textContent, setTextContent] = useState('');
  const [listItems, setListItems] = useState<ListItem[]>([{ title: '', description: '' }]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Reset form when opening/editing
  useEffect(() => {
    if (open) {
      if (editingItem) {
        setName(editingItem.name);
        setContentType(editingItem.content_type);
        setFolderId(editingItem.folder_id);
        setTextContent(editingItem.text_content || '');
        setListItems(editingItem.list_items || [{ title: '', description: '' }]);
        setExistingMediaUrl(editingItem.media_url);
        setMediaFile(null);
        setMediaPreview(null);
      } else {
        setName('');
        setContentType('text');
        setFolderId(null);
        setTextContent('');
        setListItems([{ title: '', description: '' }]);
        setMediaFile(null);
        setMediaPreview(null);
        setExistingMediaUrl(null);
      }
    }
  }, [open, editingItem]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type based on content type
    const validTypes: Record<string, string[]> = {
      audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'],
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      video: ['video/mp4', 'video/webm'],
      document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      sticker: ['image/webp', 'image/png'],
    };

    if (!validTypes[contentType]?.includes(file.type)) {
      toast.error(`Tipo de arquivo inválido para ${contentType}`);
      return;
    }

    setMediaFile(file);
    setExistingMediaUrl(null);

    // Create preview
    if (contentType === 'image' || contentType === 'sticker') {
      const reader = new FileReader();
      reader.onload = e => setMediaPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else if (contentType === 'audio' || contentType === 'video') {
      setMediaPreview(URL.createObjectURL(file));
    } else {
      setMediaPreview(null);
    }
  };

  // Handle form submit
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (contentType === 'text' && !textContent.trim()) {
      toast.error('Conteúdo do texto é obrigatório');
      return;
    }

    if (['audio', 'image', 'video', 'document', 'sticker'].includes(contentType)) {
      if (!mediaFile && !existingMediaUrl) {
        toast.error('Arquivo é obrigatório');
        return;
      }
    }

    if (contentType === 'list') {
      const validItems = listItems.filter(item => item.title.trim());
      if (validItems.length === 0) {
        toast.error('Adicione pelo menos um item à lista');
        return;
      }
    }

    try {
      setIsUploading(true);
      let mediaUrl = existingMediaUrl;

      // Upload new file if needed
      if (mediaFile) {
        mediaUrl = await uploadMedia(mediaFile);
      }

      const input: CreatePlaybookItemInput = {
        name: name.trim(),
        content_type: contentType,
        folder_id: folderId,
        text_content: contentType === 'text' ? textContent : null,
        media_url: mediaUrl,
        media_filename: mediaFile?.name || editingItem?.media_filename,
        media_size: mediaFile?.size || editingItem?.media_size,
        list_items: contentType === 'list' ? listItems.filter(item => item.title.trim()) : null,
      };

      if (editingItem) {
        updateItem({
          id: editingItem.id,
          ...input,
        });
      } else {
        await createItemAsync(input);
      }

      onClose();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Add list item
  const addListItem = () => {
    setListItems([...listItems, { title: '', description: '' }]);
  };

  // Remove list item
  const removeListItem = (index: number) => {
    setListItems(listItems.filter((_, i) => i !== index));
  };

  // Update list item
  const updateListItem = (index: number, field: 'title' | 'description', value: string) => {
    const updated = [...listItems];
    updated[index][field] = value;
    setListItems(updated);
  };

  // Toggle audio playback
  const toggleAudioPlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const getAcceptedFileTypes = () => {
    switch (contentType) {
      case 'audio':
        return 'audio/mpeg,audio/ogg,audio/wav,audio/webm';
      case 'image':
        return 'image/jpeg,image/png,image/gif,image/webp';
      case 'video':
        return 'video/mp4,video/webm';
      case 'document':
        return '.pdf,.doc,.docx,.xls,.xlsx';
      case 'sticker':
        return 'image/webp,image/png';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? 'Editar Item' : 'Novo Item do Playbook'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Nome do item"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            {/* Content Type */}
            <div className="space-y-2">
              <Label>Tipo de Conteúdo *</Label>
              <div className="grid grid-cols-4 gap-2">
                {contentTypeOptions.map(option => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={contentType === option.value ? 'default' : 'outline'}
                    className="flex flex-col gap-1 h-auto py-3"
                    onClick={() => {
                      setContentType(option.value);
                      setMediaFile(null);
                      setMediaPreview(null);
                      setExistingMediaUrl(null);
                    }}
                  >
                    {option.icon}
                    <span className="text-xs">{option.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Folder */}
            <div className="space-y-2">
              <Label htmlFor="folder">Pasta (opcional)</Label>
              <Select
                value={folderId || 'none'}
                onValueChange={val => setFolderId(val === 'none' ? null : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pasta</SelectItem>
                  {folders.map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Content fields based on type */}
            {contentType === 'text' && (
              <div className="space-y-2">
                <Label>Conteúdo do Texto *</Label>
                <WhatsAppFormattingToolbar
                  value={textContent}
                  onChange={setTextContent}
                  placeholder="Digite o texto... Use {{nome_cliente}} para variáveis"
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis: {'{{nome_cliente}}'}, {'{{nome_empresa}}'}, {'{{valor_deal}}'}
                </p>
              </div>
            )}

            {contentType === 'list' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Itens da Lista *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addListItem}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
                {listItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex gap-2 items-start p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Título"
                        value={item.title}
                        onChange={e => updateListItem(index, 'title', e.target.value)}
                      />
                      <Input
                        placeholder="Descrição (opcional)"
                        value={item.description}
                        onChange={e => updateListItem(index, 'description', e.target.value)}
                      />
                    </div>
                    {listItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => removeListItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {['audio', 'image', 'video', 'document', 'sticker'].includes(contentType) && (
              <div className="space-y-2">
                <Label>Arquivo *</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={getAcceptedFileTypes()}
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {!mediaPreview && !existingMediaUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-32 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Clique para fazer upload
                      </span>
                    </div>
                  </Button>
                ) : (
                  <div className="relative rounded-lg border overflow-hidden">
                    {/* Image/Sticker preview */}
                    {(contentType === 'image' || contentType === 'sticker') && (
                      <img
                        src={mediaPreview || existingMediaUrl!}
                        alt="Preview"
                        className="w-full h-48 object-contain bg-muted"
                      />
                    )}

                    {/* Audio preview */}
                    {contentType === 'audio' && (
                      <div className="p-4 bg-muted flex items-center gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={toggleAudioPlayback}
                        >
                          {isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <audio
                          ref={audioRef}
                          src={mediaPreview || existingMediaUrl!}
                          onEnded={() => setIsPlaying(false)}
                          className="hidden"
                        />
                        <span className="text-sm text-muted-foreground">
                          {mediaFile?.name || editingItem?.media_filename}
                        </span>
                      </div>
                    )}

                    {/* Video preview */}
                    {contentType === 'video' && (
                      <video
                        src={mediaPreview || existingMediaUrl!}
                        controls
                        className="w-full h-48 bg-black"
                      />
                    )}

                    {/* Document preview */}
                    {contentType === 'document' && (
                      <div className="p-4 bg-muted flex items-center gap-3">
                        <File className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm">
                          {mediaFile?.name || editingItem?.media_filename}
                        </span>
                      </div>
                    )}

                    {/* Remove button */}
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => {
                        setMediaFile(null);
                        setMediaPreview(null);
                        setExistingMediaUrl(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreatingItem || isUploading}
          >
            {(isCreatingItem || isUploading) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {editingItem ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
