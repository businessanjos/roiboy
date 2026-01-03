import { useState, useRef } from "react";
import { Search, Upload, FileText, X } from "lucide-react";
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

interface NfeImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: { accessKey?: string; xmlFile?: File }) => void;
}

export function NfeImportDialog({
  open,
  onOpenChange,
  onImport,
}: NfeImportDialogProps) {
  const { toast } = useToast();
  const [accessKey, setAccessKey] = useState("");
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    if (!accessKey.trim()) {
      toast({
        title: "Chave de acesso obrigatória",
        description: "Digite a chave de acesso da NF-e para pesquisar.",
        variant: "destructive",
      });
      return;
    }

    // Validar formato da chave (44 dígitos)
    const cleanKey = accessKey.replace(/\s/g, "");
    if (cleanKey.length !== 44 || !/^\d+$/.test(cleanKey)) {
      toast({
        title: "Chave inválida",
        description: "A chave de acesso deve conter 44 dígitos numéricos.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      onImport({ accessKey: cleanKey });
      toast({
        title: "Em breve",
        description: "Consulta de NF-e via chave de acesso será implementada em breve.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".xml")) {
        toast({
          title: "Arquivo inválido",
          description: "Selecione um arquivo XML válido.",
          variant: "destructive",
        });
        return;
      }
      setXmlFile(file);
    }
  };

  const handleUpload = () => {
    if (!xmlFile) return;
    onImport({ xmlFile });
    toast({
      title: "Em breve",
      description: "Importação de XML será implementada em breve.",
    });
  };

  const resetForm = () => {
    setAccessKey("");
    setXmlFile(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetForm();
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            Importar Nota Fiscal Eletrônica
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Campo de chave de acesso */}
          <div className="space-y-2">
            <Label htmlFor="access-key">
              Digite aqui a chave de acesso da Nota Fiscal Eletrônica (NF-e)
            </Label>
            <div className="flex gap-2">
              <Input
                id="access-key"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                className="flex-1 font-mono"
                maxLength={54}
              />
              <Button
                onClick={handleSearch}
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90"
              >
                <Search className="h-4 w-4 mr-2" />
                Pesquisar NF-e
              </Button>
            </div>
          </div>

          {/* Área ilustrativa do DANFE */}
          <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 bg-muted/30">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center space-y-2">
                <FileText className="h-16 w-16 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  A chave de acesso está localizada no DANFE da NF-e
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal
                </p>
              </div>
            </div>
          </div>

          {/* Upload de arquivo XML */}
          <div className="text-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xml"
              className="hidden"
            />
            
            {xmlFile ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{xmlFile.name}</span>
                <button
                  onClick={() => setXmlFile(null)}
                  className="p-1 hover:bg-primary/20 rounded"
                >
                  <X className="h-3 w-3" />
                </button>
                <Button size="sm" onClick={handleUpload} className="ml-2">
                  <Upload className="h-3 w-3 mr-1" />
                  Importar
                </Button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-primary hover:underline text-sm"
              >
                Ou clique aqui para selecionar o arquivo da NF-e.
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
