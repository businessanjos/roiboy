import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Check, Loader2, AlertCircle, FileCheck, MapPin, User, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConciliationValidation } from "@/hooks/useConciliationValidation";

interface ConciliateButtonProps {
  contractId: string;
  validation: ConciliationValidation | undefined;
  onSuccess: () => void;
}

export function ConciliateButton({
  contractId,
  validation,
  onSuccess,
}: ConciliateButtonProps) {
  const [isConciliating, setIsConciliating] = useState(false);

  const handleConciliate = async () => {
    if (!validation?.canConciliate) return;

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
    } catch (error) {
      console.error("Error conciliating:", error);
      toast.error("Erro ao atualizar contrato");
    } finally {
      setIsConciliating(false);
    }
  };

  // Loading state
  if (validation?.isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        Verificando...
      </Button>
    );
  }

  const canConciliate = validation?.canConciliate ?? false;

  return (
    <div className="flex items-center gap-2">
      {/* Status indicators */}
      <div className="hidden xl:flex items-center gap-1.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center",
                  validation?.hasFinancialEntries
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-amber-100 text-amber-600"
                )}
              >
                <FileCheck className="h-3 w-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {validation?.hasFinancialEntries
                ? "Lançamentos financeiros gerados"
                : "Lançamentos financeiros pendentes"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center",
                  validation?.hasDocument
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-amber-100 text-amber-600"
                )}
              >
                <User className="h-3 w-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {validation?.hasDocument
                ? "CPF/CNPJ preenchido"
                : "CPF ou CNPJ pendente"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center",
                  validation?.hasAddress
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-amber-100 text-amber-600"
                )}
              >
                <MapPin className="h-3 w-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {validation?.hasAddress
                ? "Endereço completo"
                : "Endereço pendente"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center",
                  validation?.hasProduct
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-amber-100 text-amber-600"
                )}
              >
                <Package className="h-3 w-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {validation?.hasProduct
                ? "Produto vinculado"
                : "Produto pendente"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Conciliate button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant={canConciliate ? "default" : "outline"}
                size="sm"
                disabled={!canConciliate || isConciliating}
                onClick={(e) => {
                  e.stopPropagation();
                  handleConciliate();
                }}
                className={cn(
                  !canConciliate && "opacity-60 cursor-not-allowed"
                )}
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
            </span>
          </TooltipTrigger>
          {!canConciliate && validation?.missingItems && (
            <TooltipContent side="left" className="max-w-xs">
              <p className="font-medium mb-1">Pendências para conciliar:</p>
              <ul className="text-xs space-y-0.5">
                {validation.missingItems.map((item) => (
                  <li key={item} className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
