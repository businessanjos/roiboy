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
  sectorId: string;
  sectorName: string;
  onSuccess: () => void;
}

export function ZappPinDialog({
  open,
  onOpenChange,
  sectorId,
  sectorName,
  onSuccess,
}: ZappPinDialogProps) {
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 3;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      setVerifying(false);
    }
  }, [open]);

  const handleVerify = async () => {
    if (pin.length !== 6) {
      setError("Digite o PIN completo de 6 dígitos");
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.functions.invoke("verify-sector-pin", {
        body: { sector_id: sectorId, pin },
      });

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
            Digite o PIN de 6 dígitos para acessar a área da {sectorName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <InputOTP
            maxLength={6}
            value={pin}
            onChange={setPin}
            disabled={verifying || isBlocked}
            onComplete={handleVerify}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
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
              disabled={pin.length !== 6 || verifying || isBlocked}
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
