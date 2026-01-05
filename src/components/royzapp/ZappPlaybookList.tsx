import { memo, useState, useMemo } from "react";
import { 
  BookOpen, 
  FileText, 
  Mic, 
  Image, 
  Video, 
  File, 
  Sticker, 
  List, 
  Plus, 
  Folder, 
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Star,
  Edit2,
  Trash2,
  Search,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlaybook, PlaybookItem, PlaybookContentType, PlaybookFolder } from "@/hooks/usePlaybook";
import { PlaybookItemForm } from "@/components/sales/PlaybookItemForm";
import { cn } from "@/lib/utils";

const contentTypeIcons: Record<PlaybookContentType, React.ReactNode> = {
  text: <FileText className="h-4 w-4" />,
  audio: <Mic className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  document: <File className="h-4 w-4" />,
  sticker: <Sticker className="h-4 w-4" />,
  list: <List className="h-4 w-4" />,
};

const contentTypeColors: Record<PlaybookContentType, string> = {
  text: "text-blue-400",
  audio: "text-purple-400",
  image: "text-green-400",
  video: "text-red-400",
  document: "text-orange-400",
  sticker: "text-yellow-400",
  list: "text-cyan-400",
};

interface ZappPlaybookListProps {
  sectorId?: string | null;
}

export const ZappPlaybookList = memo(function ZappPlaybookList({ sectorId }: ZappPlaybookListProps) {
  const {
    folders,
    items,
    isLoading,
    createFolder,
    deleteFolder,
    deleteItem,
    toggleFavorite,
    isCreatingFolder,
  } = usePlaybook({ sectorId });

  const [search, setSearch] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlaybookItem | null>(null);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Filter items
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const searchLower = search.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(searchLower) ||
      item.text_content?.toLowerCase().includes(searchLower)
    );
  }, [items, search]);

  // Group items by folder
  const groupedItems = useMemo(() => {
    const rootItems = filteredItems.filter(item => !item.folder_id);
    const folderItems: Record<string, PlaybookItem[]> = {};
    folders.forEach(folder => {
      folderItems[folder.id] = filteredItems.filter(item => item.folder_id === folder.id);
    });
    return { rootItems, folderItems };
  }, [filteredItems, folders]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder({ name: newFolderName.trim() });
      setNewFolderName("");
      setShowNewFolderInput(false);
    }
  };

  const renderItem = (item: PlaybookItem) => (
    <div
      key={item.id}
      className="flex items-center gap-2 px-4 py-2.5 hover:bg-zapp-hover transition-colors cursor-pointer group"
      onClick={() => {
        setEditingItem(item);
        setFormOpen(true);
      }}
    >
      <div className={cn("flex-shrink-0", contentTypeColors[item.content_type])}>
        {contentTypeIcons[item.content_type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-zapp-text text-sm truncate">{item.name}</span>
          {item.is_favorite && (
            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
          )}
        </div>
        {item.usage_count > 0 && (
          <span className="text-[10px] text-zapp-text-muted">
            Usado {item.usage_count}x
          </span>
        )}
      </div>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-zapp-text-muted hover:text-zapp-text hover:bg-zapp-panel"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(item);
          }}
        >
          <Star className={cn("h-3.5 w-3.5", item.is_favorite && "fill-yellow-500 text-yellow-500")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive hover:bg-zapp-panel"
          onClick={(e) => {
            e.stopPropagation();
            deleteItem(item.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  const renderFolder = (folder: PlaybookFolder) => {
    const folderItems = groupedItems.folderItems[folder.id] || [];
    const isExpanded = expandedFolders.has(folder.id);

    return (
      <div key={folder.id}>
        <div
          className="flex items-center gap-2 px-4 py-2.5 hover:bg-zapp-hover transition-colors cursor-pointer group"
          onClick={() => toggleFolder(folder.id)}
        >
          <div className="text-zapp-text-muted">
            {isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-zapp-text-muted flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zapp-text-muted flex-shrink-0" />
            )}
            <span className="text-zapp-text text-sm truncate">{folder.name}</span>
            <Badge variant="secondary" className="text-[10px] bg-zapp-panel text-zapp-text-muted">
              {folderItems.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-zapp-panel"
            onClick={(e) => {
              e.stopPropagation();
              deleteFolder(folder.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {isExpanded && folderItems.length > 0 && (
          <div className="pl-4 border-l border-zapp-border ml-6">
            {folderItems.map(renderItem)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zapp-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-zapp-text">
            <BookOpen className="h-5 w-5 text-zapp-accent" />
            <span className="font-medium">Playbook</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-zapp-text-muted hover:text-zapp-text hover:bg-zapp-panel text-xs"
              onClick={() => setShowNewFolderInput(true)}
            >
              <Folder className="h-3.5 w-3.5 mr-1" />
              Pasta
            </Button>
            <Button
              size="sm"
              className="h-7 bg-zapp-accent hover:bg-zapp-accent/90 text-xs"
              onClick={() => {
                setEditingItem(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo
            </Button>
          </div>
        </div>

        {/* New folder input */}
        {showNewFolderInput && (
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Nome da pasta"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") {
                  setShowNewFolderInput(false);
                  setNewFolderName("");
                }
              }}
              className="h-8 bg-zapp-input border-0 text-zapp-text placeholder:text-zapp-text-muted text-sm"
              autoFocus
            />
            <Button
              size="sm"
              className="h-8"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || isCreatingFolder}
            >
              {isCreatingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zapp-text-muted" />
          <Input
            placeholder="Buscar no playbook..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 bg-zapp-input border-0 text-zapp-text placeholder:text-zapp-text-muted text-sm"
          />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-zapp-text-muted" />
          </div>
        ) : filteredItems.length === 0 && folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-zapp-panel flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-zapp-text-muted" />
            </div>
            <p className="text-zapp-text-muted text-sm">Playbook vazio</p>
            <p className="text-zapp-text-muted text-xs mt-1">Crie seu primeiro item</p>
          </div>
        ) : (
          <div className="divide-y divide-zapp-border">
            {folders.map(renderFolder)}
            {groupedItems.rootItems.map(renderItem)}
          </div>
        )}
      </ScrollArea>

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
    </div>
  );
});
