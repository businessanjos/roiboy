import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateDashboardDialog } from "./CreateDashboardDialog";

export function InsightsSidebarHeader() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="p-3 border-b">
      <Button 
        variant="outline" 
        className="w-full justify-start gap-2"
        onClick={() => setDialogOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Criar Painel
      </Button>

      <CreateDashboardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
