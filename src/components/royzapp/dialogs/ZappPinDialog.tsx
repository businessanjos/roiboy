import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Lock, AlertCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ZappPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Support both old sector-based and new instance-based verification
  sectorId?: string;
  sectorName?: string;
  integrationId?: string;
  instanceName?: string;
  // NEW: Force sector PIN mode even when integrationId is provided
  useSectorPin?: boolean;
  onSuccess: () => void;
}

export function ZappPinDialog({
  open,
  onOpenChange,
  sectorId,
  sectorName,
  integrationId,
  instanceName,
  useSectorPin = false,
  onSuccess,
}: ZappPinDialogProps) {
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 3;

  // Determine which mode we're in
  // Use sector PIN if explicitly requested OR if only sectorId is provided
  const shouldUseSectorPin = useSectorPin || (!!sectorId && !integrationId);
  const isInstanceMode = !!integrationId && !useSectorPin;
  const displayName = isInstanceMode ? instanceName : (instanceName || sectorName);
  
  // Sector PINs are 6 digits, Instance PINs are 4 digits
  const PIN_LENGTH = shouldUseSectorPin ? 6 : 4;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      setVerifying(false);
    }
  }, [open]);

  const handleVerify = async () => {
    if (pin.length !== PIN_LENGTH) {
      setError(`Digite o PIN completo de ${PIN_LENGTH} dígitos`);
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      let data, fetchError;

      if (shouldUseSectorPin && sectorId) {
        // Verify PIN for sector (legacy 6-digit or inherited protection)
        const response = await supabase.functions.invoke("verify-sector-pin", {
          body: { sector_id: sectorId, pin },
        });
        data = response.data;
        fetchError = response.error;
      } else if (isInstanceMode && integrationId) {
        // Verify PIN for specific instance (4-digit)
        const response = await supabase.functions.invoke("verify-instance-pin", {
          body: { integration_id: integrationId, pin },
        });
        data = response.data;
        fetchError = response.error;
      } else {
        setError("Configuração de PIN inválida");
        return;
      }

      if (fetchError) {
        throw fetchError;
      }

      if (data.valid) {
        toast.success("Acesso liberado");
        onSuccess();
        onOpenChange(false);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPin("");
        
        if (newAttempts >= MAX_ATTEMPTS) {
          setError("Número máximo de tentativas excedido. Tente novamente mais tarde.");
          toast.error("Bloqueado por excesso de tentativas");
        } else {
          setError(`PIN incorreto. ${MAX_ATTEMPTS - newAttempts} tentativa(s) restante(s).`);
        }
      }
    } catch (err) {
      console.error("Error verifying PIN:", err);
      setError("Erro ao verificar PIN. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  };

  const isBlocked = attempts >= MAX_ATTEMPTS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center">Acesso Restrito</DialogTitle>
          <DialogDescription className="text-center">
            Digite o PIN de {PIN_LENGTH} dígitos para acessar {shouldUseSectorPin ? "o setor" : "a instância"} <strong>{displayName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <InputOTP
            maxLength={PIN_LENGTH}
            value={pin}
            onChange={setPin}
            disabled={verifying || isBlocked}
            onComplete={handleVerify}
          >
            <InputOTPGroup>
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={verifying}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleVerify}
              disabled={pin.length !== PIN_LENGTH || verifying || isBlocked}
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Verificar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
