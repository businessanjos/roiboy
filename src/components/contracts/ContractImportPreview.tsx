import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Check, Upload, Users, FileText, Phone, CreditCard, Building2, Loader2, UserPlus, Filter, CircleCheck, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const CONTRACT_STATUS_OPTIONS = [
  { value: "keep", label: "Manter do CSV" },
  { value: "active", label: "Ativo" },
  { value: "pending", label: "Pendente" },
  { value: "scheduled", label: "A Iniciar" },
  { value: "suspended", label: "Suspenso" },
  { value: "paused", label: "Pausado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "ended", label: "Encerrado" },
  { value: "dismissed", label: "Demitida" },
  { value: "dropout_7d", label: "Desistência 7D" },
];

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
  hasActiveContract?: boolean;
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
  onConfirmImport: (selectedRows: ImportRowWithDuplicate[], createNewClients: boolean, overrideStatus: string | null) => void;
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
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [createNewClients, setCreateNewClients] = useState(true);
  const [overrideStatus, setOverrideStatus] = useState<string>("keep");

  // Reset selection when rows change
  useEffect(() => {
    setSelectedRows(new Set(rows.filter(r => !r.hasError).map(r => r.lineNumber)));
  }, [rows]);

  const stats = useMemo(() => {
    const duplicatesCount = rows.filter(r => r.duplicates.length > 0 && !r.hasError).length;
    const errorsCount = rows.filter(r => r.hasError).length;
    const newCount = rows.filter(r => r.duplicates.length === 0 && !r.hasError).length;
    const validCount = rows.filter(r => !r.hasError).length;
    const selectedCount = selectedRows.size;
    
    return { duplicatesCount, errorsCount, validCount, selectedCount, total: rows.length, newCount };
  }, [rows, selectedRows]);

  const filteredRows = useMemo(() => {
    let filtered = rows;
    if (showOnlyDuplicates) {
      filtered = filtered.filter(r => r.duplicates.length > 0 && !r.hasError);
    }
    if (showOnlyErrors) {
      filtered = filtered.filter(r => r.hasError);
    }
    if (showOnlyNew) {
      filtered = filtered.filter(r => r.duplicates.length === 0 && !r.hasError);
    }
    return filtered;
  }, [rows, showOnlyDuplicates, showOnlyErrors, showOnlyNew]);

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

  const selectOnlyNew = () => {
    const newRows = rows.filter(r => r.duplicates.length === 0 && !r.hasError);
    setSelectedRows(new Set(newRows.map(r => r.lineNumber)));
  };

  const selectOnlyDuplicates = () => {
    const dupRows = rows.filter(r => r.duplicates.length > 0 && !r.hasError);
    setSelectedRows(new Set(dupRows.map(r => r.lineNumber)));
  };

  const handleConfirm = () => {
    const rowsToImport = rows
      .filter(r => selectedRows.has(r.lineNumber))
      .map(r => ({ ...r, selected: true }));
    onConfirmImport(rowsToImport, createNewClients, overrideStatus === "keep" ? null : overrideStatus);
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

  const handleFilterClick = (filter: "duplicates" | "errors" | "new") => {
    if (filter === "duplicates") {
      setShowOnlyDuplicates(!showOnlyDuplicates);
      setShowOnlyErrors(false);
      setShowOnlyNew(false);
    } else if (filter === "errors") {
      setShowOnlyErrors(!showOnlyErrors);
      setShowOnlyDuplicates(false);
      setShowOnlyNew(false);
    } else {
      setShowOnlyNew(!showOnlyNew);
      setShowOnlyDuplicates(false);
      setShowOnlyErrors(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col gap-3 p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Pré-visualização da Importação
          </DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-2 flex-shrink-0">
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <div className="text-xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div 
            className={cn(
              "rounded-lg p-2 text-center cursor-pointer transition-all border",
              showOnlyNew
                ? "bg-green-100 dark:bg-green-900/50 border-green-400 dark:border-green-600 ring-2 ring-green-400"
                : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 hover:border-green-400"
            )}
            onClick={() => handleFilterClick("new")}
          >
            <div className="text-xl font-bold text-green-600">{stats.newCount}</div>
            <div className="text-xs text-green-600">Novos {showOnlyNew && "✓"}</div>
          </div>
          <div 
            className={cn(
              "rounded-lg p-2 text-center cursor-pointer transition-all border",
              showOnlyDuplicates
                ? "bg-amber-100 dark:bg-amber-900/50 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400"
                : stats.duplicatesCount > 0 
                  ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:border-amber-400" 
                  : "bg-muted/50 border-transparent"
            )}
            onClick={() => handleFilterClick("duplicates")}
          >
            <div className={cn("text-xl font-bold", stats.duplicatesCount > 0 ? "text-amber-600" : "text-muted-foreground")}>
              {stats.duplicatesCount}
            </div>
            <div className={cn("text-xs", stats.duplicatesCount > 0 ? "text-amber-600" : "text-muted-foreground")}>
              Duplicatas {showOnlyDuplicates && "✓"}
            </div>
          </div>
          <div 
            className={cn(
              "rounded-lg p-2 text-center cursor-pointer transition-all border",
              showOnlyErrors
                ? "bg-red-100 dark:bg-red-900/50 border-red-400 dark:border-red-600 ring-2 ring-red-400"
                : stats.errorsCount > 0 
                  ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 hover:border-red-400" 
                  : "bg-muted/50 border-transparent"
            )}
            onClick={() => handleFilterClick("errors")}
          >
            <div className={cn("text-xl font-bold", stats.errorsCount > 0 ? "text-red-600" : "text-muted-foreground")}>
              {stats.errorsCount}
            </div>
            <div className={cn("text-xs", stats.errorsCount > 0 ? "text-red-600" : "text-muted-foreground")}>
              Erros {showOnlyErrors && "✓"}
            </div>
          </div>
          <div className="bg-primary/10 rounded-lg p-2 text-center border border-primary/30">
            <div className="text-xl font-bold text-primary">{stats.selectedCount}</div>
            <div className="text-xs text-primary">Selecionados</div>
          </div>
        </div>

        {/* Quick Selection Options */}
        <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-y flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedRows.size === rows.filter(r => !r.hasError).length}
                onCheckedChange={toggleAll}
              />
              <Label className="text-sm cursor-pointer" onClick={toggleAll}>
                Todos
              </Label>
            </div>
            <div className="h-4 w-px bg-border" />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={selectOnlyNew}
              className="h-7 text-xs gap-1"
            >
              <UserPlus className="h-3 w-3" />
              Só novos ({stats.newCount})
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={selectOnlyDuplicates}
              className="h-7 text-xs gap-1"
              disabled={stats.duplicatesCount === 0}
            >
              <Users className="h-3 w-3" />
              Só duplicatas ({stats.duplicatesCount})
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedRows(new Set())}
              className="h-7 text-xs"
            >
              Limpar
            </Button>
          </div>
          <div className="flex items-center gap-4">
            {stats.newCount > 0 && (
              <div className="flex items-center gap-2">
                <Switch 
                  checked={createNewClients} 
                  onCheckedChange={setCreateNewClients}
                  id="create-new"
                />
                <Label htmlFor="create-new" className="text-sm cursor-pointer">
                  Criar clientes novos ({stats.newCount})
                </Label>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Status:</Label>
              <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                <SelectTrigger className="w-40 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Table with proper scrolling */}
        <div className="flex-1 overflow-hidden border rounded-lg" style={{ minHeight: 0 }}>
          <div className="h-full overflow-y-auto overflow-x-auto">
            <Table className="relative">
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead className="min-w-[180px]">Nome</TableHead>
                  <TableHead className="min-w-[120px]">Telefone</TableHead>
                  <TableHead className="min-w-[140px]">Documento</TableHead>
                  <TableHead className="min-w-[100px]">Produto</TableHead>
                  <TableHead className="text-right min-w-[100px]">Valor</TableHead>
                  <TableHead className="min-w-[80px]">Status</TableHead>
                  <TableHead className="min-w-[100px]">Situação</TableHead>
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
                        "cursor-pointer",
                        row.hasError && "bg-red-50/50 dark:bg-red-950/20",
                        hasDuplicates && !row.hasError && "bg-amber-50/50 dark:bg-amber-950/20",
                        isSelected && !row.hasError && !hasDuplicates && "bg-green-50/30 dark:bg-green-950/10"
                      )}
                      onClick={() => toggleRow(row.lineNumber)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
                              <TooltipTrigger asChild>
                                <Badge variant="destructive" className="gap-1 cursor-help">
                                  <AlertTriangle className="h-3 w-3" />
                                  Erro
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="bg-background border z-50">
                                <p>{row.errorMessage}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : hasDuplicates ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600 bg-amber-50 cursor-help">
                                  <Users className="h-3 w-3" />
                                  Duplicata
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs bg-background border z-50">
                                <div className="space-y-1">
                                  <p className="font-medium">Clientes similares encontrados:</p>
                                  {row.duplicates.map((dup, idx) => {
                                    const Icon = getDuplicateIcon(dup.type);
                                    return (
                                      <div key={idx} className="flex items-center gap-2 text-sm">
                                        <Icon className="h-3 w-3" />
                                        <span>{getDuplicateLabel(dup.type)}:</span>
                                        <span className="font-medium">{dup.existingClientName}</span>
                                        {dup.hasActiveContract !== undefined && (
                                          <span className={cn(
                                            "flex items-center gap-1 text-xs",
                                            dup.hasActiveContract ? "text-green-600" : "text-muted-foreground"
                                          )}>
                                            {dup.hasActiveContract ? (
                                              <>
                                                <CircleCheck className="h-3 w-3" />
                                                C/ contrato
                                              </>
                                            ) : (
                                              <>
                                                <CircleX className="h-3 w-3" />
                                                S/ contrato
                                              </>
                                            )}
                                          </span>
                                        )}
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
          </div>
        </div>

        <DialogFooter className="gap-2 flex-shrink-0">
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
