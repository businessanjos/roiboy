import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, GripVertical, LayoutDashboard, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { InsightsDashboard } from "@/hooks/useInsightsDashboards";
import { RenameDashboardDialog } from "./RenameDashboardDialog";
import { DeleteDashboardDialog } from "./DeleteDashboardDialog";

interface InsightsDashboardItemProps {
  dashboard: InsightsDashboard;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: (id: string) => Promise<void>;
  onRename?: (id: string, name: string) => Promise<void>;
  onDuplicate?: (id: string) => Promise<void>;
  readOnly?: boolean;
}

export function InsightsDashboardItem({
  dashboard,
  isActive,
  onSelect,
  onDelete,
  onRename,
  readOnly = false,
}: InsightsDashboardItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dashboard.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer group transition-colors",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted",
          isDragging && "opacity-50 z-50"
        )}
        onClick={onSelect}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="flex items-center gap-1 truncate min-w-0">
          {/* Grip handle */}
          {!readOnly && (
            <button
              className="touch-none p-0.5 -ml-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          )}
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm">{dashboard.name}</span>
        </div>

        {/* Actions dropdown */}
        {!readOnly && (showActions || dropdownOpen || renameDialogOpen || deleteDialogOpen) && (
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-70 hover:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => setRenameDialogOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {onRename && (
        <RenameDashboardDialog
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
          dashboard={dashboard}
          onRename={onRename}
        />
      )}

      {onDelete && (
        <DeleteDashboardDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          dashboard={dashboard}
          onDelete={onDelete}
        />
      )}
    </>
  );
}
