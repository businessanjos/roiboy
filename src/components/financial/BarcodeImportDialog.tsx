import { useState, useRef } from "react";
import { Upload, Check, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface BarcodeImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: (data: { barcode?: string; boletoFile?: File }) => void;
}

export function BarcodeImportDialog({
  open,
  onOpenChange,
  onContinue,
}: BarcodeImportDialogProps) {
  const { toast } = useToast();
  const [barcode, setBarcode] = useState("");
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleContinue = async () => {
    if (!barcode.trim() && !boletoFile) {
      toast({
        title: "Dados obrigatórios",
        description: "Digite o código de barras ou faça upload do boleto.",
        variant: "destructive",
      });
      return;
    }

    // Validar formato do código de barras (47 ou 48 dígitos para boletos)
    if (barcode.trim()) {
      const cleanBarcode = barcode.replace(/[\s.-]/g, "");
      if (cleanBarcode.length < 44 || cleanBarcode.length > 48) {
        toast({
          title: "Código inválido",
          description: "O código de barras deve ter entre 44 e 48 dígitos.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      onContinue({ 
        barcode: barcode.replace(/[\s.-]/g, ""), 
        boletoFile: boletoFile || undefined 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Arquivo inválido",
          description: "Selecione um arquivo PDF ou imagem (PNG, JPG).",
          variant: "destructive",
        });
        return;
      }
      setBoletoFile(file);
    }
  };

  const resetForm = () => {
    setBarcode("");
    setBoletoFile(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetForm();
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            Informar o Código de Barras
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Campo de código de barras */}
          <div className="space-y-2">
            <Label htmlFor="barcode">Digite o código de barras aqui</Label>
            <Input
              id="barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
              className="font-mono"
            />
          </div>

          {/* Upload de boleto */}
          <div className="text-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,image/png,image/jpeg,image/jpg"
              className="hidden"
            />

            {boletoFile ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{boletoFile.name}</span>
                <button
                  onClick={() => setBoletoFile(null)}
                  className="p-1 hover:bg-primary/20 rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 text-sm hover:underline"
              >
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span>
                  Ou clique aqui para{" "}
                  <span className="font-semibold text-foreground">
                    fazer o upload do boleto bancário
                  </span>
                </span>
              </button>
            )}
          </div>

          {/* Botão continuar */}
          <div className="flex justify-center">
            <Button
              onClick={handleContinue}
              disabled={isLoading || (!barcode.trim() && !boletoFile)}
              className="bg-primary hover:bg-primary/90 px-8"
            >
              <Check className="h-4 w-4 mr-2" />
              Continuar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
