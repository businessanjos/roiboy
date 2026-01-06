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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { WhatsAppFormattingToolbar } from '@/components/ui/whatsapp-formatting-toolbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VariablePickerDropdown } from '@/components/playbook/VariablePickerDropdown';
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
  Link2,
  LayoutTemplate,
  Phone,
  ExternalLink,
  MessageSquareReply,
  Lock,
  Users,
} from 'lucide-react';
import { usePlaybook, PlaybookItem, PlaybookContentType, PlaybookFolder, CreatePlaybookItemInput, TemplateButton, PlaybookVisibility } from '@/hooks/usePlaybook';
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
  { value: 'link', label: 'Link', icon: <Link2 className="h-4 w-4" /> },
  { value: 'template', label: 'Template', icon: <LayoutTemplate className="h-4 w-4" /> },
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
  // Link fields
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  // Template fields
  const [templateHeader, setTemplateHeader] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [templateFooter, setTemplateFooter] = useState('');
  const [templateButtons, setTemplateButtons] = useState<TemplateButton[]>([]);
  // Visibility
  const [visibility, setVisibility] = useState<PlaybookVisibility>('sector');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        // Link fields
        setLinkUrl(editingItem.link_url || '');
        setLinkTitle(editingItem.link_title || '');
        setLinkDescription(editingItem.link_description || '');
        // Template fields
        setTemplateHeader(editingItem.template_header || '');
        setTemplateBody(editingItem.template_body || '');
        setTemplateFooter(editingItem.template_footer || '');
        setTemplateButtons(editingItem.template_buttons || []);
        // Visibility
        setVisibility(editingItem.visibility || 'sector');
      } else {
        setName('');
        setContentType('text');
        setFolderId(null);
        setTextContent('');
        setListItems([{ title: '', description: '' }]);
        setMediaFile(null);
        setMediaPreview(null);
        setExistingMediaUrl(null);
        // Link fields
        setLinkUrl('');
        setLinkTitle('');
        setLinkDescription('');
        // Template fields
        setTemplateHeader('');
        setTemplateBody('');
        setTemplateFooter('');
        setTemplateButtons([]);
        // Visibility
        setVisibility('sector');
      }
    }
  }, [open, editingItem]);

  // Get file extension
  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('[Playbook Form] File selected:', {
      name: file.name,
      type: file.type,
      size: file.size,
      contentType,
    });

    // Validate file type based on content type - allow both MIME types and extensions
    const validTypes: Record<string, string[]> = {
      audio: ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/m4a', 'audio/aac', 'audio/x-m4a', 'audio/mp4'],
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
      document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/octet-stream', // Fallback for unknown types
      ],
      sticker: ['image/webp', 'image/png'],
    };

    // Also validate by extension as fallback
    const validExtensions: Record<string, string[]> = {
      audio: ['mp3', 'm4a', 'aac', 'ogg', 'wav', 'webm'],
      image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
      video: ['mp4', 'webm', 'mov', 'avi'],
      document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
      sticker: ['webp', 'png'],
    };

    const fileExtension = getFileExtension(file.name);
    const isValidByType = validTypes[contentType]?.includes(file.type);
    const isValidByExtension = validExtensions[contentType]?.includes(fileExtension);

    console.log('[Playbook Form] Validation:', { isValidByType, isValidByExtension, fileExtension });

    if (!isValidByType && !isValidByExtension) {
      toast.error(`Tipo de arquivo inválido para ${contentType}. Extensões aceitas: ${validExtensions[contentType]?.join(', ')}`);
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

    console.log('[Playbook Form] File accepted for upload');
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

    if (contentType === 'link' && !linkUrl.trim()) {
      toast.error('URL é obrigatória');
      return;
    }

    if (contentType === 'template' && !templateBody.trim()) {
      toast.error('Corpo da mensagem é obrigatório');
      return;
    }

    try {
      setIsUploading(true);
      console.log('[Playbook Form] Starting submit...', { contentType, hasMediaFile: !!mediaFile, hasExistingUrl: !!existingMediaUrl });
      
      let mediaUrl = existingMediaUrl;

      // Upload new file if needed
      if (mediaFile) {
        console.log('[Playbook Form] Uploading file:', mediaFile.name);
        try {
          mediaUrl = await uploadMedia(mediaFile);
          console.log('[Playbook Form] Upload complete, URL:', mediaUrl);
        } catch (uploadError: any) {
          console.error('[Playbook Form] Upload failed:', uploadError);
          const errorMessage = uploadError.message || 'Erro desconhecido';
          const errorDetails = uploadError.statusCode ? ` (${uploadError.statusCode})` : '';
          toast.error(`Falha no upload: ${errorMessage}${errorDetails}`);
          return;
        }
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
        // Link fields
        link_url: contentType === 'link' ? linkUrl : null,
        link_title: contentType === 'link' ? linkTitle : null,
        link_description: contentType === 'link' ? linkDescription : null,
        // Template fields
        template_header: contentType === 'template' ? templateHeader : null,
        template_body: contentType === 'template' ? templateBody : null,
        template_footer: contentType === 'template' ? templateFooter : null,
        template_buttons: contentType === 'template' ? templateButtons : null,
        // Visibility
        visibility,
      };

      console.log('[Playbook Form] Saving item:', input);

      if (editingItem) {
        updateItem({
          id: editingItem.id,
          ...input,
        });
      } else {
        await createItemAsync(input);
      }

      console.log('[Playbook Form] Item saved successfully');
      onClose();
    } catch (error: any) {
      console.error('[Playbook Form] Error saving:', error);
      toast.error('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
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

  // Template button management
  const addTemplateButton = (type: 'quick_reply' | 'url' | 'phone') => {
    if (templateButtons.length >= 3) {
      toast.error('Máximo de 3 botões permitidos');
      return;
    }
    const newButton: TemplateButton = { type, text: '', value: '' };
    setTemplateButtons([...templateButtons, newButton]);
  };

  const removeTemplateButton = (index: number) => {
    setTemplateButtons(templateButtons.filter((_, i) => i !== index));
  };

  const updateTemplateButton = (index: number, field: 'text' | 'value', value: string) => {
    const updated = [...templateButtons];
    updated[index] = { ...updated[index], [field]: value };
    setTemplateButtons(updated);
  };

  const getAcceptedFileTypes = () => {
    switch (contentType) {
      case 'audio':
        return '.mp3,.m4a,.aac,.ogg,.wav,.webm,audio/*';
      case 'image':
        return '.jpg,.jpeg,.png,.gif,.webp,.svg,image/*';
      case 'video':
        return '.mp4,.webm,.mov,.avi,video/*';
      case 'document':
        return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'sticker':
        return '.webp,.png,image/webp,image/png';
      default:
        return '*/*';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {editingItem ? 'Editar Item' : 'Novo Item do Playbook'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          <div className="space-y-4 py-2 pb-4">
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
              <div className="grid grid-cols-5 gap-2">
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

            {/* Visibility */}
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <Label>Visibilidade</Label>
              <RadioGroup
                value={visibility}
                onValueChange={(v) => setVisibility(v as PlaybookVisibility)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="personal" id="personal" />
                  <Label htmlFor="personal" className="flex items-center gap-1.5 cursor-pointer font-normal">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    Apenas para mim
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sector" id="sector" />
                  <Label htmlFor="sector" className="flex items-center gap-1.5 cursor-pointer font-normal">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    Compartilhar com o setor
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Content fields based on type */}
            {contentType === 'text' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Conteúdo do Texto *</Label>
                  <VariablePickerDropdown
                    onSelectVariable={(variable) => {
                      setTextContent(prev => prev + variable);
                    }}
                  />
                </div>
                <WhatsAppFormattingToolbar
                  value={textContent}
                  onChange={setTextContent}
                  placeholder="Digite o texto... Use {{nome_cliente}} para variáveis"
                  rows={6}
                />
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

            {/* Link fields */}
            {contentType === 'link' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="linkUrl">URL *</Label>
                  <Input
                    id="linkUrl"
                    type="url"
                    placeholder="https://exemplo.com"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkTitle">Título (opcional)</Label>
                  <Input
                    id="linkTitle"
                    placeholder="Título do link"
                    value={linkTitle}
                    onChange={e => setLinkTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkDescription">Descrição (opcional)</Label>
                  <Input
                    id="linkDescription"
                    placeholder="Descrição breve do link"
                    value={linkDescription}
                    onChange={e => setLinkDescription(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Template fields */}
            {contentType === 'template' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="templateHeader">Cabeçalho (opcional)</Label>
                  <Input
                    id="templateHeader"
                    placeholder="Cabeçalho do template"
                    value={templateHeader}
                    onChange={e => setTemplateHeader(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Texto que aparece no topo da mensagem
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Corpo da Mensagem *</Label>
                    <VariablePickerDropdown
                      onSelectVariable={(variable) => {
                        setTemplateBody(prev => prev + variable);
                      }}
                    />
                  </div>
                  <WhatsAppFormattingToolbar
                    value={templateBody}
                    onChange={setTemplateBody}
                    placeholder="Corpo da mensagem com suporte a variáveis..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="templateFooter">Rodapé (opcional)</Label>
                  <Input
                    id="templateFooter"
                    placeholder="Rodapé do template"
                    value={templateFooter}
                    onChange={e => setTemplateFooter(e.target.value)}
                  />
                </div>

                {/* Template Buttons */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Botões de Ação (máx. 3)</Label>
                    {templateButtons.length < 3 && (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addTemplateButton('quick_reply')}
                          title="Resposta rápida"
                        >
                          <MessageSquareReply className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addTemplateButton('url')}
                          title="Link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addTemplateButton('phone')}
                          title="Telefone"
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {templateButtons.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded-lg">
                      Clique nos ícones acima para adicionar botões
                    </p>
                  )}

                  {templateButtons.map((button, index) => (
                    <div
                      key={index}
                      className="flex gap-2 items-start p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex-shrink-0 pt-2">
                        {button.type === 'quick_reply' && (
                          <MessageSquareReply className="h-4 w-4 text-blue-500" />
                        )}
                        {button.type === 'url' && (
                          <ExternalLink className="h-4 w-4 text-green-500" />
                        )}
                        {button.type === 'phone' && (
                          <Phone className="h-4 w-4 text-purple-500" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Texto do botão"
                          value={button.text}
                          onChange={e => updateTemplateButton(index, 'text', e.target.value)}
                        />
                        {button.type === 'url' && (
                          <Input
                            placeholder="URL (https://...)"
                            value={button.value || ''}
                            onChange={e => updateTemplateButton(index, 'value', e.target.value)}
                          />
                        )}
                        {button.type === 'phone' && (
                          <Input
                            placeholder="Número de telefone (+5511...)"
                            value={button.value || ''}
                            onChange={e => updateTemplateButton(index, 'value', e.target.value)}
                          />
                        )}
                        {button.type === 'quick_reply' && (
                          <p className="text-xs text-muted-foreground">
                            O texto será enviado como resposta
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => removeTemplateButton(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
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

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
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
