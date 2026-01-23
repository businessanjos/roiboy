import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare, Lock, Check } from "lucide-react";
import { ZappPinDialog } from "./ZappPinDialog";
import { cn } from "@/lib/utils";

interface InstanceInfo {
  id: string;
  name?: string;
  displayName: string;
  hasPinHash: boolean;
  useSectorPin?: boolean; // NEW: Indicates if this uses sector-level PIN
}

interface ZappInstanceSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: InstanceInfo[];
  onSelect: (integrationId: string) => void;
  contactName?: string;
  sectorId?: string; // NEW: Sector ID for sector-level PIN verification
}

export function ZappInstanceSelectorDialog({
  open,
  onOpenChange,
  instances,
  onSelect,
  contactName,
  sectorId,
}: ZappInstanceSelectorDialogProps) {
  const [selectedInstance, setSelectedInstance] = useState<InstanceInfo | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);

  const handleInstanceClick = (instance: InstanceInfo) => {
    if (instance.hasPinHash) {
      setSelectedInstance(instance);
      setShowPinDialog(true);
    } else {
      onSelect(instance.id);
      onOpenChange(false);
    }
  };

  const handlePinSuccess = () => {
    if (selectedInstance) {
      onSelect(selectedInstance.id);
      setShowPinDialog(false);
      setSelectedInstance(null);
      onOpenChange(false);
    }
  };

  const handlePinDialogClose = (isOpen: boolean) => {
    if (!isOpen) {
      setShowPinDialog(false);
      setSelectedInstance(null);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedInstance(null);
      setShowPinDialog(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <>
      <Dialog open={open && !showPinDialog} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-600" />
              Selecione a Instância
            </DialogTitle>
            <DialogDescription>
              {contactName 
                ? `Escolha em qual instância deseja abrir a conversa com ${contactName}`
                : "Escolha em qual instância deseja abrir a conversa"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 mt-4">
            {instances.map((instance) => (
              <button
                key={instance.id}
                onClick={() => handleInstanceClick(instance)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-lg border transition-all",
                  "hover:bg-accent hover:border-primary/50",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  "text-left w-full"
                )}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {instance.displayName || instance.name || "Instância"}
                  </p>
                  {instance.hasPinHash && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Lock className="h-3 w-3" />
                      Protegida com PIN
                    </p>
                  )}
                </div>

                {instance.hasPinHash ? (
                  <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                )}
              </button>
            ))}
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedInstance && (
        <ZappPinDialog
          open={showPinDialog}
          onOpenChange={handlePinDialogClose}
          sectorId={sectorId}
          integrationId={selectedInstance.useSectorPin ? undefined : selectedInstance.id}
          instanceName={selectedInstance.displayName || selectedInstance.name}
          useSectorPin={selectedInstance.useSectorPin}
          onSuccess={handlePinSuccess}
        />
      )}
    </>
  );
}
