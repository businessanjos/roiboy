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
import { AlertTriangle, Check, Upload, Filter, X, Users } from "lucide-react";

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
  hasError?: boolean;
  errorMessage?: string;
  isDuplicate?: boolean;
  duplicateInfo?: {
    type: "phone" | "email" | "cpf";
    existingName: string;
  };
}

interface LeadImportPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ImportLeadRow[];
  onConfirmImport: (selectedRows: ImportLeadRow[], skipDuplicates: boolean) => Promise<void>;
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
  { value: "outro", label: "Outro" },
];

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
  const [filterMode, setFilterMode] = useState<"all" | "valid" | "errors" | "duplicates">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [defaultSource, setDefaultSource] = useState<string>("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const filteredRows = useMemo(() => {
    let result = rows;

    // Filter by mode
    if (filterMode === "valid") {
      result = result.filter(r => !r.hasError && !r.isDuplicate);
    } else if (filterMode === "errors") {
      result = result.filter(r => r.hasError);
    } else if (filterMode === "duplicates") {
      result = result.filter(r => r.isDuplicate);
    }

    // Filter by search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        r =>
          r.full_name?.toLowerCase().includes(term) ||
          r.phone?.includes(term) ||
          r.email?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [rows, filterMode, searchTerm]);

  const validCount = rows.filter(r => !r.hasError && !r.isDuplicate).length;
  const errorCount = rows.filter(r => r.hasError).length;
  const duplicateCount = rows.filter(r => r.isDuplicate).length;

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
        source: r.source || defaultSource || undefined,
      }));
    await onConfirmImport(selectedData, skipDuplicates);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Leads
          </DialogTitle>
          <DialogDescription>
            Revise os dados antes de importar. Linhas com erros não podem ser selecionadas.
          </DialogDescription>
        </DialogHeader>

        {/* Stats and Filters */}
        <div className="flex flex-wrap items-center gap-2 py-2 border-b">
          <Button
            variant={filterMode === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilterMode("all")}
          >
            <Users className="h-4 w-4 mr-1" />
            Todos ({rows.length})
          </Button>
          <Button
            variant={filterMode === "valid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilterMode("valid")}
          >
            <Check className="h-4 w-4 mr-1 text-green-500" />
            Válidos ({validCount})
          </Button>
          {errorCount > 0 && (
            <Button
              variant={filterMode === "errors" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilterMode("errors")}
            >
              <X className="h-4 w-4 mr-1 text-red-500" />
              Com erros ({errorCount})
            </Button>
          )}
          {duplicateCount > 0 && (
            <Button
              variant={filterMode === "duplicates" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilterMode("duplicates")}
            >
              <AlertTriangle className="h-4 w-4 mr-1 text-amber-500" />
              Duplicados ({duplicateCount})
            </Button>
          )}

          <div className="flex-1" />

          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-40 h-8"
          />
        </div>

        {/* Default source selector */}
        <div className="flex items-center gap-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Origem padrão:</span>
            <Select value={defaultSource} onValueChange={setDefaultSource}>
              <SelectTrigger className="w-40 h-8">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhuma</SelectItem>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {duplicateCount > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="skip-duplicates"
                checked={skipDuplicates}
                onCheckedChange={(c) => setSkipDuplicates(!!c)}
              />
              <label htmlFor="skip-duplicates" className="text-sm cursor-pointer">
                Pular duplicados
              </label>
            </div>
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
                <TableHead>Origem</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Status</TableHead>
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
                filteredRows.map((row) => (
                  <TableRow
                    key={row.lineNumber}
                    className={
                      row.hasError
                        ? "bg-red-50 dark:bg-red-950/30"
                        : row.isDuplicate
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
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell className="text-sm">{row.phone || "-"}</TableCell>
                    <TableCell className="text-sm">{row.email || "-"}</TableCell>
                    <TableCell>
                      {row.source ? (
                        <Badge variant="outline" className="text-xs">
                          {LEAD_SOURCES.find(s => s.value === row.source)?.label || row.source}
                        </Badge>
                      ) : defaultSource ? (
                        <Badge variant="outline" className="text-xs opacity-50">
                          {LEAD_SOURCES.find(s => s.value === defaultSource)?.label}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.city && row.state
                        ? `${row.city}/${row.state}`
                        : row.city || row.state || "-"}
                    </TableCell>
                    <TableCell>
                      {row.hasError ? (
                        <Badge variant="destructive" className="text-xs">
                          <X className="h-3 w-3 mr-1" />
                          {row.errorMessage || "Erro"}
                        </Badge>
                      ) : row.isDuplicate ? (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Duplicado ({row.duplicateInfo?.type})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                          <Check className="h-3 w-3 mr-1" />
                          OK
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
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
