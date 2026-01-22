import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddWidgetDialog } from "./AddWidgetDialog";

export function AddWidgetButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Adicionar Visual
      </Button>
      <AddWidgetDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
