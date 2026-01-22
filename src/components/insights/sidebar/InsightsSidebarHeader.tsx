import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, ChevronDown, LayoutDashboard, FileText } from "lucide-react";
import { CreatePanelDialog } from "./CreatePanelDialog";

export function InsightsSidebarHeader() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<"dashboard" | "report">("dashboard");

  const handleOpenCreate = (type: "dashboard" | "report") => {
    setCreateType(type);
    setDialogOpen(true);
  };

  return (
    <div className="p-3 border-b">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Criar
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => handleOpenCreate("dashboard")}>
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Novo Painel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleOpenCreate("report")}>
            <FileText className="h-4 w-4 mr-2" />
            Novo Relatório
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreatePanelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={createType}
      />
    </div>
  );
}
