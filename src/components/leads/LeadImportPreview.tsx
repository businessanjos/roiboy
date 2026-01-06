import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Check, Upload, X, Users, RefreshCw, Plus, SkipForward, FileKey } from "lucide-react";

export type DuplicateMatchType = "external_id" | "phone" | "email" | "cpf" | "name";
export type DuplicateAction = "skip" | "update" | "create";

export interface ExistingLeadInfo {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  external_id?: string;
}

export interface ImportLeadRow {
  lineNumber: number;
  full_name: string;
  phone?: string;
  email?: string;
  source?: string;
  notes?: string;
  cpf?: string;
  company_name?: string;
  instagram?: string;
  city?: string;
  state?: string;
  revenue_range?: string;
  external_id?: string;
  external_source?: string;
  hasError?: boolean;
  errorMessage?: string;
  isDuplicate?: boolean;
  duplicateInfo?: {
    type: DuplicateMatchType;
    matchValue: string;
    existingLead?: ExistingLeadInfo;
  };
  duplicateAction?: DuplicateAction;
}

interface LeadImportPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ImportLeadRow[];
  onConfirmImport: (selectedRows: ImportLeadRow[]) => Promise<void>;
  importing?: boolean;
}

const LEAD_SOURCES = [
  { value: "website", label: "Website" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "indicacao", label: "Indicação" },
  { value: "evento", label: "Evento" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "pipedrive", label: "Pipedrive" },
  { value: "outro", label: "Outro" },
];

const DUPLICATE_ACTION_OPTIONS: { value: DuplicateAction; label: string; icon: React.ReactNode }[] = [
  { value: "skip", label: "Pular", icon: <SkipForward className="h-3 w-3" /> },
  { value: "update", label: "Atualizar", icon: <RefreshCw className="h-3 w-3" /> },
  { value: "create", label: "Criar mesmo assim", icon: <Plus className="h-3 w-3" /> },
];

const MATCH_TYPE_BADGES: Record<DuplicateMatchType, { label: string; className: string }> = {
  external_id: { label: "ID", className: "bg-blue-100 text-blue-700 border-blue-300" },
  phone: { label: "Tel", className: "bg-amber-100 text-amber-700 border-amber-300" },
  email: { label: "Email", className: "bg-orange-100 text-orange-700 border-orange-300" },
  cpf: { label: "CPF", className: "bg-purple-100 text-purple-700 border-purple-300" },
  name: { label: "Nome", className: "bg-gray-100 text-gray-700 border-gray-300" },
};

export function LeadImportPreview({
  open,
  onOpenChange,
  rows,
  onConfirmImport,
  importing = false,
}: LeadImportPreviewProps) {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(
    new Set(rows.filter(r => !r.hasError).map(r => r.lineNumber))
  );
  const [filterMode, setFilterMode] = useState<"all" | "new" | "update" | "duplicates" | "errors">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [defaultSource, setDefaultSource] = useState<string>("");
  const [defaultDuplicateAction, setDefaultDuplicateAction] = useState<DuplicateAction>("skip");
  const [rowActions, setRowActions] = useState<Record<number, DuplicateAction>>({});

  // Update row actions when default action changes
  const getRowAction = (row: ImportLeadRow): DuplicateAction => {
    if (!row.isDuplicate) return "create";
    return rowActions[row.lineNumber] ?? row.duplicateAction ?? defaultDuplicateAction;
  };

  const setRowAction = (lineNumber: number, action: DuplicateAction) => {
    setRowActions(prev => ({ ...prev, [lineNumber]: action }));
  };

  const filteredRows = useMemo(() => {
    let result = rows;

    // Filter by mode
    if (filterMode === "new") {
      result = result.filter(r => !r.hasError && !r.isDuplicate);
    } else if (filterMode === "update") {
      result = result.filter(r => r.isDuplicate && r.duplicateInfo?.type === "external_id");
    } else if (filterMode === "duplicates") {
      result = result.filter(r => r.isDuplicate && r.duplicateInfo?.type !== "external_id");
    } else if (filterMode === "errors") {
      result = result.filter(r => r.hasError);
    }

    // Filter by search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        r =>
          r.full_name?.toLowerCase().includes(term) ||
          r.phone?.includes(term) ||
          r.email?.toLowerCase().includes(term) ||
          r.external_id?.includes(term)
      );
    }

    return result;
  }, [rows, filterMode, searchTerm]);

  const stats = useMemo(() => {
    const newCount = rows.filter(r => !r.hasError && !r.isDuplicate).length;
    const updateCount = rows.filter(r => r.isDuplicate && r.duplicateInfo?.type === "external_id").length;
    const duplicateCount = rows.filter(r => r.isDuplicate && r.duplicateInfo?.type !== "external_id").length;
    const errorCount = rows.filter(r => r.hasError).length;
    return { newCount, updateCount, duplicateCount, errorCount };
  }, [rows]);

  const toggleRow = (lineNumber: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(lineNumber)) {
      newSelected.delete(lineNumber);
    } else {
      newSelected.add(lineNumber);
    }
    setSelectedRows(newSelected);
  };

  const toggleAll = () => {
    if (selectedRows.size === filteredRows.filter(r => !r.hasError).length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredRows.filter(r => !r.hasError).map(r => r.lineNumber)));
    }
  };

  const handleConfirm = async () => {
    const selectedData = rows
      .filter(r => selectedRows.has(r.lineNumber))
      .map(r => ({
        ...r,
        source: r.source || (defaultSource === "none" ? undefined : defaultSource) || undefined,
        duplicateAction: getRowAction(r),
      }));
    await onConfirmImport(selectedData);
  };

  const getRowStatus = (row: ImportLeadRow) => {
    if (row.hasError) return "error";
    if (row.isDuplicate) {
      if (row.duplicateInfo?.type === "external_id") return "update";
      return "duplicate";
    }
    return "new";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Leads
          </DialogTitle>
          <DialogDescription>
            Revise os dados antes de importar. Duplicatas são detectadas por ID, telefone, email ou nome.
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3 py-2">
          <button
            onClick={() => setFilterMode(filterMode === "new" ? "all" : "new")}
            className={`flex flex-col items-center p-3 rounded-lg border transition-colors ${
              filterMode === "new" ? "bg-green-50 border-green-300" : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-1 text-green-600">
              <Plus className="h-4 w-4" />
              <span className="text-lg font-bold">{stats.newCount}</span>
            </div>
            <span className="text-xs text-muted-foreground">Novos</span>
          </button>
          <button
            onClick={() => setFilterMode(filterMode === "update" ? "all" : "update")}
            className={`flex flex-col items-center p-3 rounded-lg border transition-colors ${
              filterMode === "update" ? "bg-blue-50 border-blue-300" : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-1 text-blue-600">
              <RefreshCw className="h-4 w-4" />
              <span className="text-lg font-bold">{stats.updateCount}</span>
            </div>
            <span className="text-xs text-muted-foreground">Atualizar (ID)</span>
          </button>
          <button
            onClick={() => setFilterMode(filterMode === "duplicates" ? "all" : "duplicates")}
            className={`flex flex-col items-center p-3 rounded-lg border transition-colors ${
              filterMode === "duplicates" ? "bg-amber-50 border-amber-300" : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-lg font-bold">{stats.duplicateCount}</span>
            </div>
            <span className="text-xs text-muted-foreground">Duplicados</span>
          </button>
          <button
            onClick={() => setFilterMode(filterMode === "errors" ? "all" : "errors")}
            className={`flex flex-col items-center p-3 rounded-lg border transition-colors ${
              filterMode === "errors" ? "bg-red-50 border-red-300" : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-1 text-red-600">
              <X className="h-4 w-4" />
              <span className="text-lg font-bold">{stats.errorCount}</span>
            </div>
            <span className="text-xs text-muted-foreground">Erros</span>
          </button>
        </div>

        {/* Filters and Options */}
        <div className="flex flex-wrap items-center gap-4 py-2 border-y">
          <Input
            placeholder="Buscar por nome, telefone, email ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 h-8"
          />

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Origem padrão:</span>
            <Select value={defaultSource} onValueChange={setDefaultSource}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(stats.duplicateCount > 0 || stats.updateCount > 0) && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Duplicatas:</span>
              <Select value={defaultDuplicateAction} onValueChange={(v) => setDefaultDuplicateAction(v as DuplicateAction)}>
                <SelectTrigger className="w-36 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DUPLICATE_ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        {opt.icon}
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {filterMode !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setFilterMode("all")}>
              <Users className="h-4 w-4 mr-1" />
              Mostrar todos
            </Button>
          )}
        </div>

        {/* Table */}
        <ScrollArea className="flex-1 border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedRows.size === filteredRows.filter(r => !r.hasError).length && filteredRows.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>ID Ext.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-36">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => {
                  const status = getRowStatus(row);
                  const action = getRowAction(row);
                  
                  return (
                    <TableRow
                      key={row.lineNumber}
                      className={
                        status === "error"
                          ? "bg-red-50 dark:bg-red-950/30"
                          : status === "update"
                          ? "bg-blue-50 dark:bg-blue-950/30"
                          : status === "duplicate"
                          ? "bg-amber-50 dark:bg-amber-950/30"
                          : ""
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedRows.has(row.lineNumber)}
                          onCheckedChange={() => toggleRow(row.lineNumber)}
                          disabled={row.hasError}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {row.lineNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{row.full_name}</span>
                          {row.duplicateInfo?.existingLead && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                                    → {row.duplicateInfo.existingLead.full_name}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs">
                                    <div><strong>Lead existente:</strong></div>
                                    <div>Nome: {row.duplicateInfo.existingLead.full_name}</div>
                                    {row.duplicateInfo.existingLead.phone && <div>Tel: {row.duplicateInfo.existingLead.phone}</div>}
                                    {row.duplicateInfo.existingLead.email && <div>Email: {row.duplicateInfo.existingLead.email}</div>}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{row.phone || "-"}</TableCell>
                      <TableCell className="text-sm truncate max-w-[150px]">{row.email || "-"}</TableCell>
                      <TableCell className="text-sm">
                        {row.external_id ? (
                          <Badge variant="outline" className="text-xs font-mono">
                            <FileKey className="h-3 w-3 mr-1" />
                            {row.external_id}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {row.hasError ? (
                          <Badge variant="destructive" className="text-xs">
                            <X className="h-3 w-3 mr-1" />
                            {row.errorMessage || "Erro"}
                          </Badge>
                        ) : row.isDuplicate && row.duplicateInfo ? (
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${MATCH_TYPE_BADGES[row.duplicateInfo.type].className}`}
                          >
                            {row.duplicateInfo.type === "external_id" ? (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            ) : (
                              <AlertTriangle className="h-3 w-3 mr-1" />
                            )}
                            {MATCH_TYPE_BADGES[row.duplicateInfo.type].label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                            <Check className="h-3 w-3 mr-1" />
                            Novo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.hasError ? (
                          <span className="text-xs text-muted-foreground">-</span>
                        ) : row.isDuplicate ? (
                          <Select 
                            value={action} 
                            onValueChange={(v) => setRowAction(row.lineNumber, v as DuplicateAction)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DUPLICATE_ACTION_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <div className="flex items-center gap-2">
                                    {opt.icon}
                                    {opt.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Plus className="h-3 w-3 mr-1" />
                            Criar
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter className="pt-4">
          <div className="flex-1 text-sm text-muted-foreground">
            {selectedRows.size} de {rows.length} selecionados
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={importing || selectedRows.size === 0}>
            {importing ? "Importando..." : `Importar ${selectedRows.size} leads`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
