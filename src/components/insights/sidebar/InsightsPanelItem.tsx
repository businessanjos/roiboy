import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, FileText, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { InsightsPanel } from "@/hooks/useInsightsPanels";
import { RenamePanelDialog } from "./RenamePanelDialog";
import { DeletePanelDialog } from "./DeletePanelDialog";

interface InsightsPanelItemProps {
  panel: InsightsPanel;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: (id: string) => Promise<void>;
  onRename?: (id: string, name: string) => Promise<void>;
  readOnly?: boolean;
}

export function InsightsPanelItem({
  panel,
  isActive,
  onSelect,
  onDelete,
  onRename,
  readOnly = false,
}: InsightsPanelItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer group transition-colors",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted"
        )}
        onClick={onSelect}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {panel.type === "dashboard" ? (
            <LayoutDashboard className="h-4 w-4 shrink-0" />
          ) : (
            <FileText className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate text-sm">{panel.name}</span>
        </div>

        {/* Actions dropdown - shows on hover */}
        {!readOnly && (showActions || renameDialogOpen || deleteDialogOpen) && (
          <DropdownMenu>
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
        <RenamePanelDialog
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
          panel={panel}
          onRename={onRename}
        />
      )}

      {onDelete && (
        <DeletePanelDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          panel={panel}
          onDelete={onDelete}
        />
      )}
    </>
  );
}
