import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Check, Upload, Users, FileText, Phone, CreditCard, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ImportRow {
  lineNumber: number;
  nome: string;
  telefone: string;
  cpf: string | null;
  cnpj: string | null;
  email: string | null;
  produto: string | null;
  valorContrato: number;
  dataInicio: string | null;
  dataFim: string | null;
  status: string;
  observacao: string | null;
  rawData: Record<string, string>;
}

export interface DuplicateInfo {
  type: "phone" | "cpf" | "cnpj";
  existingClientId: string;
  existingClientName: string;
  matchValue: string;
}

export interface ImportRowWithDuplicate extends ImportRow {
  duplicates: DuplicateInfo[];
  selected: boolean;
  hasError: boolean;
  errorMessage?: string;
}

interface ContractImportPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ImportRowWithDuplicate[];
  onConfirmImport: (selectedRows: ImportRowWithDuplicate[], createNewClients: boolean) => void;
  importing: boolean;
  products: { id: string; name: string }[];
}

export function ContractImportPreview({
  open,
  onOpenChange,
  rows,
  onConfirmImport,
  importing,
  products,
}: ContractImportPreviewProps) {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(
    new Set(rows.filter(r => !r.hasError).map(r => r.lineNumber))
  );
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [createNewClients, setCreateNewClients] = useState(true);

  const stats = useMemo(() => {
    const duplicatesCount = rows.filter(r => r.duplicates.length > 0).length;
    const errorsCount = rows.filter(r => r.hasError).length;
    const validCount = rows.filter(r => !r.hasError).length;
    const selectedCount = selectedRows.size;
    
    return { duplicatesCount, errorsCount, validCount, selectedCount, total: rows.length };
  }, [rows, selectedRows]);

  const filteredRows = useMemo(() => {
    let filtered = rows;
    if (showOnlyDuplicates) {
      filtered = filtered.filter(r => r.duplicates.length > 0);
    }
    if (showOnlyErrors) {
      filtered = filtered.filter(r => r.hasError);
    }
    return filtered;
  }, [rows, showOnlyDuplicates, showOnlyErrors]);

  const toggleRow = (lineNumber: number) => {
    const row = rows.find(r => r.lineNumber === lineNumber);
    if (row?.hasError) return;
    
    const newSelected = new Set(selectedRows);
    if (newSelected.has(lineNumber)) {
      newSelected.delete(lineNumber);
    } else {
      newSelected.add(lineNumber);
    }
    setSelectedRows(newSelected);
  };

  const toggleAll = () => {
    const validRows = rows.filter(r => !r.hasError);
    if (selectedRows.size === validRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(validRows.map(r => r.lineNumber)));
    }
  };

  const handleConfirm = () => {
    const rowsToImport = rows
      .filter(r => selectedRows.has(r.lineNumber))
      .map(r => ({ ...r, selected: true }));
    onConfirmImport(rowsToImport, createNewClients);
  };

  const getDuplicateIcon = (type: "phone" | "cpf" | "cnpj") => {
    switch (type) {
      case "phone": return Phone;
      case "cpf": return CreditCard;
      case "cnpj": return Building2;
    }
  };

  const getDuplicateLabel = (type: "phone" | "cpf" | "cnpj") => {
    switch (type) {
      case "phone": return "Telefone";
      case "cpf": return "CPF";
      case "cnpj": return "CNPJ";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Pré-visualização da Importação
          </DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total de linhas</div>
          </div>
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
            <div className="text-2xl font-bold text-green-600">{stats.validCount}</div>
            <div className="text-xs text-green-600">Válidos</div>
          </div>
          <div 
            className={cn(
              "rounded-lg p-3 text-center cursor-pointer transition-all border",
              stats.duplicatesCount > 0 
                ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" 
                : "bg-muted/50 border-transparent"
            )}
            onClick={() => setShowOnlyDuplicates(!showOnlyDuplicates)}
          >
            <div className={cn("text-2xl font-bold", stats.duplicatesCount > 0 ? "text-amber-600" : "text-muted-foreground")}>
              {stats.duplicatesCount}
            </div>
            <div className={cn("text-xs", stats.duplicatesCount > 0 ? "text-amber-600" : "text-muted-foreground")}>
              Duplicatas {showOnlyDuplicates && "✓"}
            </div>
          </div>
          <div 
            className={cn(
              "rounded-lg p-3 text-center cursor-pointer transition-all border",
              stats.errorsCount > 0 
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" 
                : "bg-muted/50 border-transparent"
            )}
            onClick={() => setShowOnlyErrors(!showOnlyErrors)}
          >
            <div className={cn("text-2xl font-bold", stats.errorsCount > 0 ? "text-red-600" : "text-muted-foreground")}>
              {stats.errorsCount}
            </div>
            <div className={cn("text-xs", stats.errorsCount > 0 ? "text-red-600" : "text-muted-foreground")}>
              Erros {showOnlyErrors && "✓"}
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center justify-between gap-4 py-2 border-y">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedRows.size === rows.filter(r => !r.hasError).length}
                onCheckedChange={toggleAll}
              />
              <Label className="text-sm cursor-pointer" onClick={toggleAll}>
                Selecionar todos ({stats.selectedCount} de {stats.validCount})
              </Label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch 
              checked={createNewClients} 
              onCheckedChange={setCreateNewClients}
              id="create-new"
            />
            <Label htmlFor="create-new" className="text-sm cursor-pointer">
              Criar clientes novos automaticamente
            </Label>
          </div>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1 min-h-0 border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => {
                const isSelected = selectedRows.has(row.lineNumber);
                const hasDuplicates = row.duplicates.length > 0;
                
                return (
                  <TableRow 
                    key={row.lineNumber}
                    className={cn(
                      row.hasError && "bg-red-50/50 dark:bg-red-950/20",
                      hasDuplicates && !row.hasError && "bg-amber-50/50 dark:bg-amber-950/20"
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        disabled={row.hasError}
                        onCheckedChange={() => toggleRow(row.lineNumber)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{row.lineNumber}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{row.nome}</TableCell>
                    <TableCell className="text-sm">{row.telefone}</TableCell>
                    <TableCell className="text-sm">
                      {row.cpf && <span className="text-muted-foreground">CPF: {row.cpf}</span>}
                      {row.cnpj && <span className="text-muted-foreground">CNPJ: {row.cnpj}</span>}
                      {!row.cpf && !row.cnpj && <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {row.produto ? (
                        <Badge variant="secondary" className="text-xs">{row.produto}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.valorContrato)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{row.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {row.hasError ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Erro
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{row.errorMessage}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : hasDuplicates ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600 bg-amber-50">
                                <Users className="h-3 w-3" />
                                Duplicata
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-medium">Clientes similares encontrados:</p>
                                {row.duplicates.map((dup, idx) => {
                                  const Icon = getDuplicateIcon(dup.type);
                                  return (
                                    <div key={idx} className="flex items-center gap-2 text-sm">
                                      <Icon className="h-3 w-3" />
                                      <span>{getDuplicateLabel(dup.type)}:</span>
                                      <span className="font-medium">{dup.existingClientName}</span>
                                    </div>
                                  );
                                })}
                                <p className="text-xs text-muted-foreground mt-2">
                                  O contrato será vinculado ao cliente existente.
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-green-500 text-green-600 bg-green-50">
                          <Check className="h-3 w-3" />
                          Novo
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado com os filtros atuais
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={stats.selectedCount === 0 || importing}>
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Importar {stats.selectedCount} contrato{stats.selectedCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
