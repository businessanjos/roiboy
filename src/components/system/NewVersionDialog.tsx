import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAppVersionCheck, hardReloadApp } from "@/hooks/useAppVersionCheck";

export function NewVersionDialog() {
  const { hasNewVersion, remoteVersion, canDefer, deferUpdate } = useAppVersionCheck();
  const [updating, setUpdating] = useState(false);

  const handleUpdate = () => {
    setUpdating(true);
    hardReloadApp(remoteVersion);
  };

  return (
    <AlertDialog open={hasNewVersion}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Nova versão disponível
          </AlertDialogTitle>
          <AlertDialogDescription>
            {canDefer
              ? "Uma nova versão do sistema foi publicada. Você pode atualizar agora ou adiar por 30 minutos para terminar o que está fazendo. Os arquivos antigos em cache serão limpos automaticamente."
              : "Você já adiou esta atualização o máximo de vezes permitido. Para evitar erros, é necessário atualizar agora. Os arquivos antigos em cache serão limpos automaticamente."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {canDefer && (
            <Button type="button" variant="outline" onClick={deferUpdate} disabled={updating}>
              Atualizar depois
            </Button>
          )}
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleUpdate();
            }}
            disabled={updating}
          >
            {updating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Atualizando...
              </>
            ) : (
              "Atualizar agora"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
