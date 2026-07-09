import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  AlertCircle,
  FileCheck,
  MapPin,
  User,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConciliationValidation } from "@/hooks/useConciliationValidation";

interface ConciliateButtonProps {
  contractId: string;
  clientId?: string;
  validation: ConciliationValidation | undefined;
  onSuccess: () => void;
}

type PendencyKey = "entries" | "document" | "address" | "product";

const PENDENCY_GUIDE: Record<
  PendencyKey,
  { title: string; where: string; how: string }
> = {
  entries: {
    title: "Lançamentos financeiros",
    where: "Cliente > aba Financeiro (ou Contrato > Gerar recebíveis)",
    how: "Abra o contrato e clique em 'Gerar recebíveis' para criar as parcelas no financeiro.",
  },
  document: {
    title: "CPF ou CNPJ",
    where: "Cliente > aba Dados > campo CPF/CNPJ",
    how: "Abra o cadastro do cliente e preencha CPF (pessoa física) ou CNPJ (empresa).",
  },
  address: {
    title: "Endereço completo",
    where: "Cliente > aba Dados > seção Endereço",
    how: "Preencha rua, cidade, estado e CEP no cadastro do cliente.",
  },
  product: {
    title: "Produto vinculado",
    where: "Contrato > campo Produto",
    how: "Edite o contrato e selecione o produto correspondente.",
  },
};

function mapMissing(items: string[] = []): PendencyKey[] {
  const keys: PendencyKey[] = [];
  for (const it of items) {
    const l = it.toLowerCase();
    if (l.includes("lançamento")) keys.push("entries");
    else if (l.includes("cpf") || l.includes("cnpj")) keys.push("document");
    else if (l.includes("endereço")) keys.push("address");
    else if (l.includes("produto")) keys.push("product");
  }
  return keys;
}

export function ConciliateButton({
  contractId,
  clientId,
  validation,
  onSuccess,
}: ConciliateButtonProps) {
  const [isConciliating, setIsConciliating] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConciliate = async () => {
    if (!validation?.canConciliate) {
      setErrorMsg(null);
      setPendingOpen(true);
      return;
    }

    setIsConciliating(true);
    try {
      const { error } = await supabase
        .from("client_contracts")
        .update({
          receivables_generated: true,
          receivables_generated_at: new Date().toISOString(),
        })
        .eq("id", contractId);

      if (error) throw error;

      toast.success("Contrato marcado como conciliado");
      onSuccess();
    } catch (error: any) {
      console.error("Error conciliating:", error);
      setErrorMsg(
        error?.message ||
          "Erro desconhecido ao atualizar o contrato. Tente novamente."
      );
      setPendingOpen(true);
    } finally {
      setIsConciliating(false);
    }
  };

  if (validation?.isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        Verificando...
      </Button>
    );
  }

  const canConciliate = validation?.canConciliate ?? false;
  const missingKeys = mapMissing(validation?.missingItems);

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="hidden xl:flex items-center gap-1.5">
          {[
            {
              ok: validation?.hasFinancialEntries,
              icon: FileCheck,
              okLabel: "Lançamentos financeiros gerados",
              pendingLabel: "Lançamentos financeiros pendentes",
            },
            {
              ok: validation?.hasDocument,
              icon: User,
              okLabel: "CPF/CNPJ preenchido",
              pendingLabel: "CPF ou CNPJ pendente",
            },
            {
              ok: validation?.hasAddress,
              icon: MapPin,
              okLabel: "Endereço completo",
              pendingLabel: "Endereço pendente",
            },
            {
              ok: validation?.hasProduct,
              icon: Package,
              okLabel: "Produto vinculado",
              pendingLabel: "Produto pendente",
            },
          ].map((s, i) => (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center",
                      s.ok
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-amber-100 text-amber-600"
                    )}
                  >
                    <s.icon className="h-3 w-3" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {s.ok ? s.okLabel : s.pendingLabel}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        <Button
          variant={canConciliate ? "default" : "outline"}
          size="sm"
          disabled={isConciliating}
          onClick={(e) => {
            e.stopPropagation();
            handleConciliate();
          }}
          className={cn(!canConciliate && "border-amber-300 text-amber-700")}
        >
          {isConciliating ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : canConciliate ? (
            <Check className="h-4 w-4 mr-1" />
          ) : (
            <AlertCircle className="h-4 w-4 mr-1" />
          )}
          Conciliar
        </Button>
      </div>

      <Dialog open={pendingOpen} onOpenChange={setPendingOpen}>
        <DialogContent
          className="max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              {errorMsg
                ? "Não foi possível conciliar"
                : "Pendências para conciliar"}
            </DialogTitle>
            <DialogDescription>
              {errorMsg
                ? "O sistema retornou um erro ao atualizar o contrato."
                : "Preencha os itens abaixo antes de marcar o contrato como conciliado."}
            </DialogDescription>
          </DialogHeader>

          {errorMsg ? (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3 border border-destructive/20">
              {errorMsg}
            </div>
          ) : (
            <ul className="space-y-3">
              {missingKeys.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nenhuma pendência detectada.
                </li>
              )}
              {missingKeys.map((k) => {
                const g = PENDENCY_GUIDE[k];
                return (
                  <li
                    key={k}
                    className="rounded-md border p-3 space-y-1 bg-amber-50/50"
                  >
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      {g.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Onde preencher:</span>{" "}
                      {g.where}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Como resolver:</span>{" "}
                      {g.how}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {clientId && (
              <Button
                variant="outline"
                onClick={() => window.open(`/clients/${clientId}`, "_blank")}
              >
                Abrir cliente
              </Button>
            )}
            <Button onClick={() => setPendingOpen(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
