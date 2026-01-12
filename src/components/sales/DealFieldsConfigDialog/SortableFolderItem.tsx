import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, FolderOpen, Folder, ChevronDown, ChevronRight, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SortableFieldItem } from "./SortableFieldItem";
import { FieldConfig, FolderConfig } from "./types";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

interface SortableFolderItemProps {
  folder: FolderConfig;
  fields: FieldConfig[];
  onToggleField: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function SortableFolderItem({
  folder,
  fields,
  onToggleField,
  onToggleExpand,
  onRename,
  onDelete,
}: SortableFolderItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `folder-${folder.id}`, data: { type: "folder" } });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `droppable-folder-${folder.id}`,
    data: { type: "folder-drop", folderId: folder.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSaveRename = () => {
    if (editName.trim()) {
      onRename(folder.id, editName.trim());
      setIsEditing(false);
    }
  };

  const handleCancelRename = () => {
    setEditName(folder.name);
    setIsEditing(false);
  };

  const folderFields = fields.filter((f) => f.folder_id === folder.id);

  return (
    <div ref={setSortableRef} style={style} className="space-y-1">
      <div
        className={`flex items-center gap-2 p-2 bg-muted/50 border rounded-lg ${
          isOver ? "ring-2 ring-primary" : ""
        }`}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <button
          onClick={() => onToggleExpand(folder.id)}
          className="text-muted-foreground hover:text-foreground"
        >
          {folder.is_expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {folder.is_expanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500" />
        )}

        {isEditing ? (
          <div className="flex-1 flex items-center gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename();
                if (e.key === "Escape") handleCancelRename();
              }}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveRename}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelRename}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <span className="flex-1 text-sm font-medium">{folder.name}</span>
            <span className="text-xs text-muted-foreground">
              {folderFields.length} campo{folderFields.length !== 1 ? "s" : ""}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(folder.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>

      {folder.is_expanded && (
        <div
          ref={setDroppableRef}
          className={`ml-6 space-y-1 min-h-[40px] p-1 rounded-lg border border-dashed transition-colors ${
            isOver ? "border-primary bg-primary/5" : "border-transparent"
          }`}
        >
          {folderFields.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-3">
              Arraste campos para esta pasta
            </div>
          ) : (
            <SortableContext
              items={folderFields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              {folderFields.map((field) => (
                <SortableFieldItem
                  key={field.id}
                  field={field}
                  onToggle={onToggleField}
                />
              ))}
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
}
