import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Phone, Wifi, WifiOff, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Sector name mapping for display
const SECTOR_NAMES: Record<string, string> = {
  operacoes: "Operações",
  financeiro: "Finanças",
  vendas: "Vendas",
  diretoria: "Diretoria",
};

interface UazapiInstance {
  name: string;
  status: string;
  owner: string;
  profileName: string;
  profilePicUrl: string;
  hasToken: boolean;
  linked_sector_id: string | null;
  linked_integration_id: string | null;
  linked_status: string | null;
}

interface AddInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  sectorName: string;
  existingInstanceNames: string[]; // To filter out already added instances
  onSuccess: () => void;
}

export function AddInstanceDialog({
  open,
  onOpenChange,
  sectorId,
  sectorName,
  existingInstanceNames,
  onSuccess,
}: AddInstanceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [availableInstances, setAvailableInstances] = useState<UazapiInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [displayName, setDisplayName] = useState("");
  const [usePin, setUsePin] = useState(false);
  const [pin, setPin] = useState("");

  // Fetch available UAZAPI instances
  useEffect(() => {
    if (open) {
      fetchAvailableInstances();
    }
  }, [open]);

  const fetchAvailableInstances = async () => {
    setLoadingInstances(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "list_instances" },
      });

      if (error) throw error;

      // Access nested data structure correctly (response comes as data.data.instances)
      const allInstances = data?.data?.instances || data?.instances || [];
      
      console.log("[AddInstanceDialog] Raw instances from API:", allInstances.length);
      console.log("[AddInstanceDialog] Existing instances in sector:", existingInstanceNames);

      // Show ALL instances EXCEPT those already in THIS sector
      // Instances linked to OTHER sectors will be shown with indication
      const instances = allInstances.filter(
        (inst: UazapiInstance) => {
          const isNotInThisSector = !existingInstanceNames.includes(inst.name);
          console.log(`[AddInstanceDialog] Instance ${inst.name}: linked_sector_id=${inst.linked_sector_id}, isNotInThisSector=${isNotInThisSector}`);
          return isNotInThisSector;
        }
      );
      
      console.log("[AddInstanceDialog] Available instances after filter:", instances.length);
      setAvailableInstances(instances);
    } catch (err) {
      console.error("Failed to fetch instances:", err);
      toast.error("Erro ao carregar instâncias");
    } finally {
      setLoadingInstances(false);
    }
  };

  // Get display name for a sector
  const getSectorDisplayName = (sectorId: string | null): string => {
    if (!sectorId) return "Desconhecido";
    return SECTOR_NAMES[sectorId] || sectorId;
  };

  const handleSubmit = async () => {
    if (!selectedInstance) {
      toast.error("Selecione uma instância");
      return;
    }

    if (usePin && pin.length < 4) {
      toast.error("O PIN deve ter 4 dígitos");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: {
          action: "add_instance_to_sector",
          sector_id: sectorId,
          instance_name: selectedInstance,
          display_name: displayName || null,
          pin: usePin ? pin : null,
        },
      });

      if (error) throw error;

      toast.success(`Instância adicionada ao setor ${sectorName}`);
      onSuccess();
      handleClose();
    } catch (err) {
      console.error("Failed to add instance:", err);
      toast.error("Erro ao adicionar instância");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedInstance("");
    setDisplayName("");
    setUsePin(false);
    setPin("");
    onOpenChange(false);
  };

  const selectedInstanceData = availableInstances.find(i => i.name === selectedInstance);
  
  // Check if selected instance is linked to another sector
  const isLinkedToOtherSector = selectedInstanceData && 
    selectedInstanceData.linked_sector_id !== null && 
    selectedInstanceData.linked_sector_id !== sectorId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isLinkedToOtherSector ? "Mover Instância para Setor" : "Adicionar Instância ao Setor"}
          </DialogTitle>
          <DialogDescription>
            Selecione uma instância UAZAPI para {isLinkedToOtherSector ? "mover para" : "adicionar ao"} setor <strong>{sectorName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Instance selector */}
          <div className="space-y-2">
            <Label>Instância UAZAPI</Label>
            {loadingInstances ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : availableInstances.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg text-center">
                Nenhuma instância disponível para adicionar.
                <br />
                Verifique se há instâncias no painel UAZAPI.
              </div>
            ) : (
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma instância..." />
                </SelectTrigger>
                <SelectContent>
                  {availableInstances.map((instance) => {
                    const isLinked = instance.linked_sector_id !== null;
                    const linkedSectorName = isLinked ? getSectorDisplayName(instance.linked_sector_id) : null;
                    
                    return (
                      <SelectItem key={instance.name} value={instance.name}>
                        <div className="flex items-center gap-2 w-full">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            instance.status === "connected" ? "bg-green-500" : "bg-red-500"
                          }`} />
                          <span className="truncate">{instance.profileName || instance.name}</span>
                          {instance.owner && (
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              ({instance.owner.replace(/^(\d{2})(\d{2})(\d{5})(\d{4})$/, "+$1 $2 $3-$4")})
                            </span>
                          )}
                          {isLinked ? (
                            <span className="ml-auto flex items-center gap-1 text-xs text-amber-600 flex-shrink-0">
                              <ArrowRightLeft className="h-3 w-3" />
                              {linkedSectorName}
                            </span>
                          ) : (
                            <span className="ml-auto text-xs text-green-600 flex-shrink-0">✓ Disponível</span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Warning for instances linked to other sectors */}
          {isLinkedToOtherSector && (
            <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                Esta instância está atualmente vinculada ao setor <strong>"{getSectorDisplayName(selectedInstanceData.linked_sector_id)}"</strong>.
                <br />
                Ao confirmar, ela será <strong>MOVIDA</strong> para "{sectorName}".
              </AlertDescription>
            </Alert>
          )}

          {/* Selected instance preview */}
          {selectedInstanceData && (
            <div className="p-3 bg-muted/50 rounded-lg border space-y-1">
              <div className="flex items-center gap-2">
                {selectedInstanceData.status === "connected" ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="font-medium">
                  {selectedInstanceData.profileName || selectedInstanceData.name}
                </span>
              </div>
              {selectedInstanceData.owner && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {selectedInstanceData.owner}
                </div>
              )}
            </div>
          )}

          {/* Display name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Nome de exibição (opcional)</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: WhatsApp Vendas Principal"
            />
          </div>

          {/* PIN protection */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="usePin"
                checked={usePin}
                onCheckedChange={(checked) => setUsePin(checked === true)}
              />
              <Label htmlFor="usePin" className="cursor-pointer">
                Proteger com PIN
              </Label>
            </div>

            {usePin && (
              <div className="space-y-2">
                <Label>PIN (4 dígitos)</Label>
                <InputOTP
                  maxLength={4}
                  value={pin}
                  onChange={setPin}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !selectedInstance}
            variant={isLinkedToOtherSector ? "default" : "default"}
            className={isLinkedToOtherSector ? "bg-amber-600 hover:bg-amber-700" : ""}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {isLinkedToOtherSector ? "Movendo..." : "Adicionando..."}</>
            ) : isLinkedToOtherSector ? (
              <><ArrowRightLeft className="h-4 w-4 mr-2" /> Mover para este setor</>
            ) : (
              "Adicionar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
