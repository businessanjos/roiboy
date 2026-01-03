import { FileText, Barcode, PenLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ReceivableMethod = "nfe" | "barcode" | "manual";

interface ReceivableMethodSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (method: ReceivableMethod) => void;
}

const methods = [
  {
    id: "nfe" as const,
    title: "Nota Fiscal Eletrônica",
    description: "Importar dados de uma NF-e via chave de acesso ou XML",
    icon: FileText,
  },
  {
    id: "barcode" as const,
    title: "Código de Barras",
    description: "Inserir código de barras ou boleto para preenchimento automático",
    icon: Barcode,
  },
  {
    id: "manual" as const,
    title: "Inserção Manual",
    description: "Preencher todos os dados manualmente",
    icon: PenLine,
  },
];

export function ReceivableMethodSelector({
  open,
  onOpenChange,
  onSelect,
}: ReceivableMethodSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            Novo Recebimento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          {methods.map((method) => (
            <Button
              key={method.id}
              variant="outline"
              className="w-full justify-start h-auto p-4 text-left"
              onClick={() => {
                onSelect(method.id);
                onOpenChange(false);
              }}
            >
              <method.icon className="h-5 w-5 mr-3 text-primary" />
              <div>
                <div className="font-medium">{method.title}</div>
                <div className="text-xs text-muted-foreground">
                  {method.description}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
