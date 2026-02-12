import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { InsightsDashboard } from "@/hooks/useInsightsDashboards";
import { RenameDashboardDialog } from "./RenameDashboardDialog";
import { DeleteDashboardDialog } from "./DeleteDashboardDialog";

interface InsightsDashboardItemProps {
  dashboard: InsightsDashboard;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: (id: string) => Promise<void>;
  onRename?: (id: string, name: string) => Promise<void>;
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
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm">{dashboard.name}</span>
        </div>

        {/* Actions dropdown - shows on hover */}
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
