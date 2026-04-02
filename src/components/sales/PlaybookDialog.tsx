import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Search,
  FileText,
  Mic,
  Image,
  Video,
  File,
  Sticker,
  List,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Star,
  StarOff,
  Edit2,
  Trash2,
  Copy,
  Send,
  MoreVertical,
  Loader2,
  Link2,
  LayoutTemplate,
  ListOrdered,
  Clock,
  X,
  GripVertical,
} from 'lucide-react';
import { usePlaybook, PlaybookItem, PlaybookContentType, PlaybookFolder } from '@/hooks/usePlaybook';
import { PlaybookItemForm } from './PlaybookItemForm';
import { cn } from '@/lib/utils';

export interface MultiSendPayload {
  items: PlaybookItem[];
  processedTexts: (string | undefined)[];
  delaySeconds: number;
}

interface PlaybookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseItem?: (item: PlaybookItem, processedText?: string) => void;
  onMultiSend?: (payload: MultiSendPayload) => void;
  variables?: Record<string, string>;
  sectorId?: string | null;
}

const contentTypeIcons: Record<PlaybookContentType, React.ReactNode> = {
  text: <FileText className="h-4 w-4" />,
  audio: <Mic className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  document: <File className="h-4 w-4" />,
  sticker: <Sticker className="h-4 w-4" />,
  list: <List className="h-4 w-4" />,
  link: <Link2 className="h-4 w-4" />,
  template: <LayoutTemplate className="h-4 w-4" />,
};

const contentTypeLabels: Record<PlaybookContentType, string> = {
  text: 'Texto',
  audio: 'Áudio',
  image: 'Imagem',
  video: 'Vídeo',
  document: 'Documento',
  sticker: 'Sticker',
  list: 'Lista',
  link: 'Link',
  template: 'Template',
};

const contentTypeColors: Record<PlaybookContentType, string> = {
  text: 'bg-blue-500/10 text-blue-500',
  audio: 'bg-purple-500/10 text-purple-500',
  image: 'bg-green-500/10 text-green-500',
  video: 'bg-red-500/10 text-red-500',
  document: 'bg-orange-500/10 text-orange-500',
  sticker: 'bg-yellow-500/10 text-yellow-500',
  list: 'bg-cyan-500/10 text-cyan-500',
  link: 'bg-indigo-500/10 text-indigo-500',
  template: 'bg-pink-500/10 text-pink-500',
};

export function PlaybookDialog({
  open,
  onOpenChange,
  onUseItem,
  onMultiSend,
  variables = {},
  sectorId,
}: PlaybookDialogProps) {
  const {
    folders,
    items,
    isLoading,
    createFolder,
    updateFolder,
    deleteFolder,
    deleteItem,
    toggleFavorite,
    trackUsage,
    replaceVariables,
    isCreatingFolder,
  } = usePlaybook({ sectorId });

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<PlaybookContentType | 'all' | 'folder'>('all');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlaybookItem | null>(null);
  const [editingFolder, setEditingFolder] = useState<PlaybookFolder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PlaybookItem | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<PlaybookFolder | null>(null);
  const [selectedItem, setSelectedItem] = useState<PlaybookItem | null>(null);

  // Multi-send state
  const [multiSendMode, setMultiSendMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<PlaybookItem[]>([]);
  const [delaySeconds, setDelaySeconds] = useState(5);

  const toggleMultiSendMode = useCallback(() => {
    setMultiSendMode(prev => {
      if (prev) {
        setSelectedItems([]);
      }
      return !prev;
    });
  }, []);

  const toggleItemSelection = useCallback((item: PlaybookItem) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.filter(i => i.id !== item.id);
      }
      return [...prev, item];
    });
  }, []);

  const removeFromSelection = useCallback((itemId: string) => {
    setSelectedItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const moveItemInSelection = useCallback((index: number, direction: 'up' | 'down') => {
    setSelectedItems(prev => {
      const newArr = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newArr.length) return prev;
      [newArr[index], newArr[targetIndex]] = [newArr[targetIndex], newArr[index]];
      return newArr;
    });
  }, []);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = items;

    // Filter by type
    if (filterType !== 'all' && filterType !== 'folder') {
      result = result.filter(item => item.content_type === filterType);
    }

    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.text_content?.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [items, filterType, search]);

  // Favorite items for virtual folder
  const favoriteItems = useMemo(() => {
    return filteredItems.filter(item => item.is_favorite);
  }, [filteredItems]);

  // Group items by folder
  const groupedItems = useMemo(() => {
    const rootItems = filteredItems.filter(item => !item.folder_id);
    const folderItems: Record<string, PlaybookItem[]> = {};

    folders.forEach(folder => {
      folderItems[folder.id] = filteredItems.filter(item => item.folder_id === folder.id);
    });

    return { rootItems, folderItems };
  }, [filteredItems, folders]);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleUseItem = useCallback(async (item: PlaybookItem) => {
    await trackUsage(item.id);
    const processedText = item.text_content
      ? replaceVariables(item.text_content, variables)
      : undefined;
    onUseItem?.(item, processedText);
    onOpenChange(false);
  }, [trackUsage, replaceVariables, variables, onUseItem, onOpenChange]);

  const handleMultiSend = useCallback(async () => {
    if (selectedItems.length === 0) return;
    const processedTexts = selectedItems.map(item =>
      item.text_content ? replaceVariables(item.text_content, variables) : undefined
    );
    // Track usage for all items
    for (const item of selectedItems) {
      await trackUsage(item.id);
    }
    onMultiSend?.({
      items: selectedItems,
      processedTexts,
      delaySeconds,
    });
    setMultiSendMode(false);
    setSelectedItems([]);
    onOpenChange(false);
  }, [selectedItems, delaySeconds, replaceVariables, variables, trackUsage, onMultiSend, onOpenChange]);

  const handleCopyItem = useCallback(async (item: PlaybookItem) => {
    if (item.text_content) {
      const processedText = replaceVariables(item.text_content, variables);
      await navigator.clipboard.writeText(processedText);
      await trackUsage(item.id);
    } else if (item.media_url) {
      await navigator.clipboard.writeText(item.media_url);
      await trackUsage(item.id);
    }
  }, [replaceVariables, variables, trackUsage]);

  const handleCreateFolder = useCallback(() => {
    if (newFolderName.trim()) {
      createFolder({ name: newFolderName.trim() });
      setNewFolderName('');
      setShowNewFolderInput(false);
    }
  }, [newFolderName, createFolder]);

  const handleDeleteItem = useCallback(() => {
    if (itemToDelete) {
      deleteItem(itemToDelete.id);
      setItemToDelete(null);
      setDeleteConfirmOpen(false);
    }
  }, [itemToDelete, deleteItem]);

  const handleDeleteFolder = useCallback(() => {
    if (folderToDelete) {
      deleteFolder(folderToDelete.id);
      setFolderToDelete(null);
      setDeleteConfirmOpen(false);
    }
  }, [folderToDelete, deleteFolder]);

  const renderItem = (item: PlaybookItem) => {
    const isSelected = multiSendMode
      ? selectedItems.some(i => i.id === item.id)
      : selectedItem?.id === item.id;
    const selectionIndex = multiSendMode
      ? selectedItems.findIndex(i => i.id === item.id)
      : -1;

    return (
      <div
        key={item.id}
        onClick={() => {
          if (multiSendMode) {
            toggleItemSelection(item);
          } else {
            setSelectedItem(isSelected ? null : item);
          }
        }}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group cursor-pointer",
          isSelected && "ring-2 ring-primary border-primary bg-primary/5"
        )}
      >
        {multiSendMode && (
          <div className="flex-shrink-0 flex items-center gap-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleItemSelection(item)}
              onClick={e => e.stopPropagation()}
            />
            {isSelected && (
              <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                {selectionIndex + 1}
              </Badge>
            )}
          </div>
        )}

        <div className={cn('p-2 rounded-lg', contentTypeColors[item.content_type])}>
          {contentTypeIcons[item.content_type]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{item.name}</span>
            {item.is_favorite && (
              <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
            )}
            {item.visibility === 'personal' && (
              <span className="text-xs text-muted-foreground" title="Apenas você pode ver">🔒</span>
            )}
          </div>
          {item.text_content && (
            <p className="text-sm text-muted-foreground truncate">
              {item.text_content.slice(0, 60)}...
            </p>
          )}
          {item.media_filename && (
            <p className="text-sm text-muted-foreground truncate">
              {item.content_type === 'document' && item.media_filename.includes('|')
                ? `${item.media_filename.split('|').length} arquivos`
                : item.media_filename}
            </p>
          )}
          {item.usage_count > 0 && (
            <Badge variant="secondary" className="text-xs mt-1">
              Usado {item.usage_count}x
            </Badge>
          )}
        </div>

        {!multiSendMode && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleFavorite(item)}
                >
                  {item.is_favorite ? (
                    <StarOff className="h-4 w-4" />
                  ) : (
                    <Star className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {item.is_favorite ? 'Remover favorito' : 'Favoritar'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleCopyItem(item)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copiar</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setEditingItem(item);
                  setFormOpen(true);
                }}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => {
                    setItemToDelete(item);
                    setDeleteConfirmOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    );
  };

  const renderFolder = (folder: PlaybookFolder) => {
    const folderItems = groupedItems.folderItems[folder.id] || [];
    const isExpanded = expandedFolders.has(folder.id);

    return (
      <div key={folder.id} className="space-y-1">
        <div
          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
          onClick={() => toggleFolder(folder.id)}
        >
          <div className="p-2 rounded-lg bg-muted">
            {isExpanded ? (
              <FolderOpen className="h-4 w-4" />
            ) : (
              <Folder className="h-4 w-4" />
            )}
          </div>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <span className="font-medium truncate">{folder.name}</span>
            <Badge variant="secondary" className="text-xs">
              {folderItems.length}
            </Badge>
          </div>

          {!multiSendMode && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={e => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={e => {
                    e.stopPropagation();
                    setEditingFolder(folder);
                    setNewFolderName(folder.name);
                    setShowNewFolderInput(true);
                  }}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Renomear
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={e => {
                      e.stopPropagation();
                      setFolderToDelete(folder);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {isExpanded && folderItems.length > 0 && (
          <div className="ml-6 space-y-1">
            {folderItems.map(renderItem)}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => {
        if (!v) {
          setMultiSendMode(false);
          setSelectedItems([]);
        }
        onOpenChange(v);
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0">
          {/* ===== HEADER (Fixed) ===== */}
          <div className="flex-none p-6 pb-4 space-y-4 border-b">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between pr-10">
                <span>Playbook</span>
                <div className="flex items-center gap-2">
                  {onMultiSend && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={multiSendMode ? "default" : "outline"}
                          size="sm"
                          onClick={toggleMultiSendMode}
                        >
                          <ListOrdered className="h-4 w-4 mr-2" />
                          Envio Múltiplo
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Selecione vários itens para enviar em sequência com delay</TooltipContent>
                    </Tooltip>
                  )}
                  <Button onClick={() => {
                    setEditingItem(null);
                    setFormOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Item
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={filterType === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType('all')}
                  >
                    Todos
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Todos os itens</TooltipContent>
              </Tooltip>

              {(Object.keys(contentTypeIcons) as PlaybookContentType[]).map(type => (
                <Tooltip key={type}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={filterType === type ? 'default' : 'outline'}
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setFilterType(type)}
                    >
                      {contentTypeIcons[type]}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{contentTypeLabels[type]}</TooltipContent>
                </Tooltip>
              ))}

              <div className="flex-1" />

              {!multiSendMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewFolderInput(true)}
                >
                  <Folder className="h-4 w-4 mr-2" />
                  Nova Pasta
                </Button>
              )}
            </div>

            {/* New folder input */}
            {showNewFolderInput && (
              <div className="flex gap-2">
                <Input
                  placeholder={editingFolder ? 'Novo nome da pasta' : 'Nome da pasta'}
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (editingFolder) {
                        updateFolder({ id: editingFolder.id, name: newFolderName });
                        setEditingFolder(null);
                      } else {
                        handleCreateFolder();
                      }
                      setShowNewFolderInput(false);
                      setNewFolderName('');
                    }
                    if (e.key === 'Escape') {
                      setShowNewFolderInput(false);
                      setNewFolderName('');
                      setEditingFolder(null);
                    }
                  }}
                  autoFocus
                />
                <Button
                  onClick={() => {
                    if (editingFolder) {
                      updateFolder({ id: editingFolder.id, name: newFolderName });
                      setEditingFolder(null);
                    } else {
                      handleCreateFolder();
                    }
                    setShowNewFolderInput(false);
                    setNewFolderName('');
                  }}
                  disabled={!newFolderName.trim() || isCreatingFolder}
                >
                  {isCreatingFolder ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Salvar'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowNewFolderInput(false);
                    setNewFolderName('');
                    setEditingFolder(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar no playbook..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* ===== BODY (Scrollable) ===== */}
          <div className="flex-1 min-h-0 overflow-y-auto playbook-scroll-native">
            <div className="p-6 pt-4 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredItems.length === 0 && folders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">Playbook vazio</p>
                  <p className="text-sm">Crie seu primeiro item para começar</p>
                </div>
              ) : (
                <>
                  {/* Virtual Favorites Folder - First */}
                  {favoriteItems.length > 0 && (
                    <div className="space-y-1">
                      <div
                        className="flex items-center gap-3 p-3 rounded-lg border bg-yellow-500/10 border-yellow-500/30 cursor-pointer hover:bg-yellow-500/20 transition-colors"
                        onClick={() => toggleFolder('__favorites__')}
                      >
                        <div className="p-2 rounded-lg bg-yellow-500/20">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          {expandedFolders.has('__favorites__') ? (
                            <ChevronDown className="h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          )}
                          <span className="font-medium">FAVORITOS</span>
                          <Badge variant="secondary" className="text-xs">
                            {favoriteItems.length}
                          </Badge>
                        </div>
                      </div>
                      {expandedFolders.has('__favorites__') && (
                        <div className="ml-6 space-y-1">
                          {favoriteItems.map(renderItem)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Folders */}
                  {filterType === 'all' || filterType === 'folder' ? (
                    folders.map(renderFolder)
                  ) : null}

                  {/* Root items */}
                  {groupedItems.rootItems.map(renderItem)}
                </>
              )}
            </div>
          </div>

          {/* ===== FOOTER (Fixed) ===== */}
          {multiSendMode ? (
            <div className="flex-none border-t bg-muted/30">
              {/* Selected items queue */}
              {selectedItems.length > 0 && (
                <div className="p-4 pb-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <ListOrdered className="h-4 w-4" />
                    <span>Fila de envio ({selectedItems.length} itens)</span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedItems.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2 p-1.5 rounded bg-card border text-sm">
                        <Badge variant="outline" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full flex-shrink-0">
                          {index + 1}
                        </Badge>
                        <div className={cn('flex-shrink-0', contentTypeColors[item.content_type].split(' ')[1])}>
                          {contentTypeIcons[item.content_type]}
                        </div>
                        <span className="truncate flex-1">{item.name}</span>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            disabled={index === 0}
                            onClick={() => moveItemInSelection(index, 'up')}
                          >
                            <ChevronDown className="h-3 w-3 rotate-180" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            disabled={index === selectedItems.length - 1}
                            onClick={() => moveItemInSelection(index, 'down')}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-destructive"
                            onClick={() => removeFromSelection(item.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="p-4 pt-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Delay entre envios:</span>
                  <Input
                    type="number"
                    min={1}
                    max={300}
                    value={delaySeconds}
                    onChange={e => setDelaySeconds(Math.max(1, Math.min(300, parseInt(e.target.value) || 1)))}
                    className="w-20 h-8 text-center"
                  />
                  <span className="text-sm text-muted-foreground">segundos</span>
                </div>
                <Button
                  onClick={handleMultiSend}
                  disabled={selectedItems.length < 2}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="lg"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar {selectedItems.length} itens
                </Button>
              </div>
            </div>
          ) : onUseItem && (
            <div className="flex-none p-4 border-t bg-muted/30 flex justify-end">
              <Button
                onClick={() => selectedItem && handleUseItem(selectedItem)}
                disabled={!selectedItem}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                size="lg"
              >
              <Send className="h-4 w-4 mr-2" />
                Enviar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Item form dialog */}
      <PlaybookItemForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editingItem={editingItem}
        folders={folders}
        sectorId={sectorId}
        onClose={() => {
          setFormOpen(false);
          setEditingItem(null);
        }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete
                ? `Tem certeza que deseja excluir o item "${itemToDelete.name}"?`
                : folderToDelete
                ? `Tem certeza que deseja excluir a pasta "${folderToDelete.name}"? Os itens dentro dela serão movidos para a raiz.`
                : 'Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setItemToDelete(null);
              setFolderToDelete(null);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={itemToDelete ? handleDeleteItem : handleDeleteFolder}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}