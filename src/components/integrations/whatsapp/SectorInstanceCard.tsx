import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Phone,
  Lock,
  Pencil,
  Trash2,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";

export interface SectorInstance {
  id: string;
  sector_id: string | null;
  status: string;
  display_name: string | null;
  has_pin: boolean;
  instance_name: string;
  phone_number: string;
  profile_name: string;
  profile_pic_url: string;
  created_at: string;
}

interface SectorInstanceCardProps {
  instance: SectorInstance;
  isAdmin: boolean;
  onEdit: (instance: SectorInstance) => void;
  onRemove: (instance: SectorInstance) => Promise<void>;
}

export function SectorInstanceCard({
  instance,
  isAdmin,
  onEdit,
  onRemove,
}: SectorInstanceCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const isConnected = instance.status === "connected";
  const displayName = instance.display_name || instance.profile_name || instance.instance_name;
  const phoneDisplay = instance.phone_number
    ? instance.phone_number.replace(/^(\d{2})(\d{2})(\d{5})(\d{4})$/, "+$1 ($2) $3-$4")
    : "";

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onRemove(instance);
    } finally {
      setIsRemoving(false);
      setShowRemoveDialog(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
          
          {/* Instance info */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{displayName}</span>
              {instance.has_pin && (
                <Lock className="h-3.5 w-3.5 text-amber-500" />
              )}
              <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
                {isConnected ? (
                  <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
                ) : (
                  <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>
                )}
              </Badge>
            </div>
            {phoneDisplay && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                {phoneDisplay}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {isAdmin && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(instance)}
              title="Editar nome e PIN"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setShowRemoveDialog(true)}
              disabled={isRemoving}
              title="Remover instância"
            >
              {isRemoving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Remove confirmation dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Instância</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{displayName}</strong> deste setor?
              {phoneDisplay && <> ({phoneDisplay})</>}
              <br /><br />
              A instância continuará disponível na UAZAPI e poderá ser adicionada novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemoving}
            >
              {isRemoving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Removendo...</>
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
