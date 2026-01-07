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
} from 'lucide-react';
import { usePlaybook, PlaybookItem, PlaybookContentType, PlaybookFolder } from '@/hooks/usePlaybook';
import { PlaybookItemForm } from './PlaybookItemForm';
import { cn } from '@/lib/utils';

interface PlaybookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseItem?: (item: PlaybookItem, processedText?: string) => void;
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

  const renderItem = (item: PlaybookItem) => (
    <div
      key={item.id}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
    >
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
            {item.media_filename}
          </p>
        )}
        {item.usage_count > 0 && (
          <Badge variant="secondary" className="text-xs mt-1">
            Usado {item.usage_count}x
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

        {onUseItem && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary"
                onClick={() => handleUseItem(item)}
              >
                <Send className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Usar</TooltipContent>
          </Tooltip>
        )}

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
    </div>
  );

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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Playbook</span>
              <Button onClick={() => {
                setEditingItem(null);
                setFormOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Item
              </Button>
            </DialogTitle>
          </DialogHeader>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 pb-2 border-b flex-none">
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewFolderInput(true)}
            >
              <Folder className="h-4 w-4 mr-2" />
              Nova Pasta
            </Button>
          </div>

          {/* New folder input */}
          {showNewFolderInput && (
            <div className="flex gap-2 py-2 flex-none">
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
          <div className="relative flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar no playbook..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
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
              <div className="space-y-2 py-2">
                {/* Folders */}
                {filterType === 'all' || filterType === 'folder' ? (
                  folders.map(renderFolder)
                ) : null}

                {/* Root items */}
                {groupedItems.rootItems.map(renderItem)}
              </div>
            )}
          </ScrollArea>
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
