import { FileText, Barcode, Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PayableMethod = "nfe" | "barcode" | "manual";

interface PayableMethodSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (method: PayableMethod) => void;
}

const methods = [
  {
    id: "nfe" as PayableMethod,
    title: "Nota Fiscal Eletrônica",
    description: "Importe o arquivo XML de uma Nota Fiscal Eletrônica (NF-e) com os movimentos de estoque e as informações para Contas a Pagar. Válido para a NF-e âmbito nacional.",
    icon: FileText,
  },
  {
    id: "barcode" as PayableMethod,
    title: "Código de Barras",
    description: "Informe boletos de cobrança de qualquer banco, conta de água, luz, telefone, gás e de outras empresas conveniadas, impostos, tributos e pagamentos do Detran.",
    icon: Barcode,
  },
  {
    id: "manual" as PayableMethod,
    title: "Inserção Manual",
    description: "Digite manualmente a Conta a Pagar",
    icon: Keyboard,
  },
];

export function PayableMethodSelector({
  open,
  onOpenChange,
  onSelect,
}: PayableMethodSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            Incluir Conta a Pagar
          </DialogTitle>
          <DialogDescription className="sr-only">
            Selecione como deseja cadastrar a conta a pagar
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <button
                key={method.id}
                onClick={() => {
                  onSelect(method.id);
                  onOpenChange(false);
                }}
                className="w-full rounded-xl border-2 border-primary/20 bg-primary/5 p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-primary mb-1">
                      {method.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {method.description}
                    </p>
                  </div>
                  <div className="shrink-0 p-2 rounded-lg bg-primary/10">
                    <Icon className="h-8 w-8 text-primary/60" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
