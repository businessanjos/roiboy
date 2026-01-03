import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Search,
  Users,
  Copy,
  Eye,
  RefreshCw,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Contract {
  id: string;
  client_id: string;
  status: string;
  value: number;
  client?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  product?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

interface CSVContract {
  nome: string;
  status: string;
  produto?: string;
  valor?: number;
  rowNumber: number;
}

interface ReconciliationResult {
  type: "matched" | "missing_in_system" | "missing_in_csv" | "status_divergent" | "duplicate_csv";
  csvData?: CSVContract;
  systemData?: Contract;
  details?: string;
}

interface ContractReconciliationProps {
  contracts: Contract[];
}

const STATUS_MAP: Record<string, string[]> = {
  active: ["ativo", "ativa", "active", "a"],
  suspended: ["suspenso", "suspensa", "suspended", "s"],
  paused: ["pausado", "pausada", "paused", "congelado", "congelada", "frozen", "c"],
  cancelled: ["cancelado", "cancelada", "cancelled", "x"],
  ended: ["encerrado", "encerrada", "ended", "finalizado", "finalizada"],
  pending: ["pendente", "pending", "p"],
};

function normalizeStatus(status: string): string {
  const lower = status.toLowerCase().trim();
  for (const [key, values] of Object.entries(STATUS_MAP)) {
    if (values.includes(lower)) return key;
  }
  return lower;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s]/g, "") // Remove special chars
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();
}

export function ContractReconciliation({ contracts }: ContractReconciliationProps) {
  const navigate = useNavigate();
  const [csvData, setCsvData] = useState<CSVContract[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const parseCSV = useCallback((text: string): CSVContract[] => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const nameIndex = headers.findIndex(h => 
      h.includes("nome") || h.includes("name") || h.includes("cliente") || h.includes("client")
    );
    const statusIndex = headers.findIndex(h => 
      h.includes("status") || h.includes("situação") || h.includes("situacao")
    );
    const productIndex = headers.findIndex(h => 
      h.includes("produto") || h.includes("product") || h.includes("plano") || h.includes("plan")
    );
    const valueIndex = headers.findIndex(h => 
      h.includes("valor") || h.includes("value") || h.includes("preço") || h.includes("preco")
    );

    if (nameIndex === -1) {
      toast.error("CSV inválido: coluna de nome não encontrada");
      return [];
    }

    const results: CSVContract[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim().replace(/^["']|["']$/g, ""));
      const nome = values[nameIndex]?.trim();
      if (!nome) continue;

      results.push({
        nome,
        status: statusIndex !== -1 ? values[statusIndex] || "" : "",
        produto: productIndex !== -1 ? values[productIndex] : undefined,
        valor: valueIndex !== -1 ? parseFloat(values[valueIndex]?.replace(/[^\d.,]/g, "").replace(",", ".")) : undefined,
        rowNumber: i + 1,
      });
    }
    return results;
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Por favor, envie um arquivo CSV");
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setCsvData(parsed);
      setIsProcessing(false);
      if (parsed.length > 0) {
        toast.success(`${parsed.length} registros importados do CSV`);
      }
    };
    reader.onerror = () => {
      toast.error("Erro ao ler arquivo");
      setIsProcessing(false);
    };
    reader.readAsText(file, "utf-8");
  }, [parseCSV]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setCsvData(parsed);
      setIsProcessing(false);
      if (parsed.length > 0) {
        toast.success(`${parsed.length} registros importados do CSV`);
      }
    };
    reader.onerror = () => {
      toast.error("Erro ao ler arquivo");
      setIsProcessing(false);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }, [parseCSV]);

  // Reconciliation logic
  const reconciliationResults = useMemo((): ReconciliationResult[] => {
    if (csvData.length === 0) return [];

    const results: ReconciliationResult[] = [];
    const csvNameMap = new Map<string, CSVContract[]>();
    const matchedSystemIds = new Set<string>();

    // Group CSV entries by normalized name to detect duplicates
    csvData.forEach(csv => {
      const normalized = normalizeName(csv.nome);
      const existing = csvNameMap.get(normalized) || [];
      existing.push(csv);
      csvNameMap.set(normalized, existing);
    });

    // Check for duplicates in CSV
    csvNameMap.forEach((entries, normalizedName) => {
      if (entries.length > 1) {
        entries.forEach(csv => {
          results.push({
            type: "duplicate_csv",
            csvData: csv,
            details: `Aparece ${entries.length}x no CSV`,
          });
        });
      }
    });

    // Match CSV entries with system contracts
    csvData.forEach(csv => {
      const normalizedCsvName = normalizeName(csv.nome);
      
      // Find matching contract in system
      const matchingContract = contracts.find(contract => {
        if (!contract.client?.full_name) return false;
        const normalizedSystemName = normalizeName(contract.client.full_name);
        return normalizedSystemName === normalizedCsvName || 
               normalizedSystemName.includes(normalizedCsvName) ||
               normalizedCsvName.includes(normalizedSystemName);
      });

      if (matchingContract) {
        matchedSystemIds.add(matchingContract.id);
        
        // Check status divergence
        const csvStatus = normalizeStatus(csv.status);
        const systemStatus = matchingContract.status;
        
        if (csvStatus && csvStatus !== systemStatus) {
          results.push({
            type: "status_divergent",
            csvData: csv,
            systemData: matchingContract,
            details: `CSV: ${csv.status} → Sistema: ${systemStatus}`,
          });
        } else {
          results.push({
            type: "matched",
            csvData: csv,
            systemData: matchingContract,
          });
        }
      } else {
        results.push({
          type: "missing_in_system",
          csvData: csv,
          details: "Não encontrado no sistema",
        });
      }
    });

    // Find contracts in system but not in CSV
    contracts.forEach(contract => {
      if (!matchedSystemIds.has(contract.id) && contract.status === "active") {
        results.push({
          type: "missing_in_csv",
          systemData: contract,
          details: "Ativo no sistema mas não está no CSV",
        });
      }
    });

    return results;
  }, [csvData, contracts]);

  // Filter and search results
  const filteredResults = useMemo(() => {
    let filtered = reconciliationResults;

    if (filterType !== "all") {
      filtered = filtered.filter(r => r.type === filterType);
    }

    if (searchTerm) {
      const search = normalizeName(searchTerm);
      filtered = filtered.filter(r => {
        const csvName = r.csvData?.nome ? normalizeName(r.csvData.nome) : "";
        const systemName = r.systemData?.client?.full_name ? normalizeName(r.systemData.client.full_name) : "";
        return csvName.includes(search) || systemName.includes(search);
      });
    }

    return filtered;
  }, [reconciliationResults, filterType, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const matched = reconciliationResults.filter(r => r.type === "matched").length;
    const missingInSystem = reconciliationResults.filter(r => r.type === "missing_in_system").length;
    const missingInCsv = reconciliationResults.filter(r => r.type === "missing_in_csv").length;
    const statusDivergent = reconciliationResults.filter(r => r.type === "status_divergent").length;
    const duplicates = reconciliationResults.filter(r => r.type === "duplicate_csv").length;

    return { matched, missingInSystem, missingInCsv, statusDivergent, duplicates };
  }, [reconciliationResults]);

  const getTypeConfig = (type: ReconciliationResult["type"]) => {
    switch (type) {
      case "matched":
        return { icon: CheckCircle, label: "Conciliado", className: "text-emerald-600 bg-emerald-50 border-emerald-200" };
      case "missing_in_system":
        return { icon: XCircle, label: "Falta no Sistema", className: "text-red-600 bg-red-50 border-red-200" };
      case "missing_in_csv":
        return { icon: AlertCircle, label: "Falta no CSV", className: "text-orange-600 bg-orange-50 border-orange-200" };
      case "status_divergent":
        return { icon: AlertTriangle, label: "Status Divergente", className: "text-amber-600 bg-amber-50 border-amber-200" };
      case "duplicate_csv":
        return { icon: Copy, label: "Duplicado", className: "text-purple-600 bg-purple-50 border-purple-200" };
    }
  };

  const exportResults = useCallback(() => {
    const rows = [
      ["Tipo", "Nome CSV", "Status CSV", "Nome Sistema", "Status Sistema", "Detalhes"],
      ...filteredResults.map(r => [
        getTypeConfig(r.type).label,
        r.csvData?.nome || "",
        r.csvData?.status || "",
        r.systemData?.client?.full_name || "",
        r.systemData?.status || "",
        r.details || "",
      ])
    ];
    
    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reconciliacao-contratos-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado!");
  }, [filteredResults]);

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      {csvData.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-12 text-center transition-all",
                isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-muted-foreground/20 hover:border-primary/50"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="h-12 w-12 text-primary animate-spin" />
                  <p className="text-lg font-medium">Processando arquivo...</p>
                </div>
              ) : (
                <>
                  <FileSpreadsheet className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Importar planilha de contratos</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Arraste um arquivo CSV ou clique para selecionar. O sistema irá comparar 
                    com os contratos cadastrados e identificar divergências.
                  </p>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="lg" asChild>
                      <span>
                        <Upload className="h-5 w-5 mr-2" />
                        Selecionar arquivo CSV
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileInput}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground mt-4">
                    O CSV deve conter uma coluna "Nome" ou "Cliente" com o nome completo
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card 
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                filterType === "matched" && "ring-2 ring-emerald-500"
              )}
              onClick={() => setFilterType(filterType === "matched" ? "all" : "matched")}
            >
              <CardContent className="p-4 text-center">
                <CheckCircle className="h-6 w-6 mx-auto text-emerald-600 mb-2" />
                <p className="text-2xl font-bold text-emerald-600">{stats.matched}</p>
                <p className="text-xs text-muted-foreground">Conciliados</p>
              </CardContent>
            </Card>

            <Card 
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                filterType === "missing_in_system" && "ring-2 ring-red-500"
              )}
              onClick={() => setFilterType(filterType === "missing_in_system" ? "all" : "missing_in_system")}
            >
              <CardContent className="p-4 text-center">
                <XCircle className="h-6 w-6 mx-auto text-red-600 mb-2" />
                <p className="text-2xl font-bold text-red-600">{stats.missingInSystem}</p>
                <p className="text-xs text-muted-foreground">Falta no Sistema</p>
              </CardContent>
            </Card>

            <Card 
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                filterType === "missing_in_csv" && "ring-2 ring-orange-500"
              )}
              onClick={() => setFilterType(filterType === "missing_in_csv" ? "all" : "missing_in_csv")}
            >
              <CardContent className="p-4 text-center">
                <AlertCircle className="h-6 w-6 mx-auto text-orange-600 mb-2" />
                <p className="text-2xl font-bold text-orange-600">{stats.missingInCsv}</p>
                <p className="text-xs text-muted-foreground">Falta no CSV</p>
              </CardContent>
            </Card>

            <Card 
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                filterType === "status_divergent" && "ring-2 ring-amber-500"
              )}
              onClick={() => setFilterType(filterType === "status_divergent" ? "all" : "status_divergent")}
            >
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-6 w-6 mx-auto text-amber-600 mb-2" />
                <p className="text-2xl font-bold text-amber-600">{stats.statusDivergent}</p>
                <p className="text-xs text-muted-foreground">Status Divergente</p>
              </CardContent>
            </Card>

            <Card 
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                filterType === "duplicate_csv" && "ring-2 ring-purple-500"
              )}
              onClick={() => setFilterType(filterType === "duplicate_csv" ? "all" : "duplicate_csv")}
            >
              <CardContent className="p-4 text-center">
                <Copy className="h-6 w-6 mx-auto text-purple-600 mb-2" />
                <p className="text-2xl font-bold text-purple-600">{stats.duplicates}</p>
                <p className="text-xs text-muted-foreground">Duplicados</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Actions */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col md:flex-row gap-4 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-48">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filtrar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="matched">Conciliados</SelectItem>
                      <SelectItem value="missing_in_system">Falta no Sistema</SelectItem>
                      <SelectItem value="missing_in_csv">Falta no CSV</SelectItem>
                      <SelectItem value="status_divergent">Status Divergente</SelectItem>
                      <SelectItem value="duplicate_csv">Duplicados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={exportResults}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                  <Button variant="outline" onClick={() => { setCsvData([]); setFilterType("all"); setSearchTerm(""); }}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Nova Importação
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Resultados da Conciliação
                <Badge variant="secondary" className="ml-2">
                  {filteredResults.length} de {reconciliationResults.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Status</TableHead>
                      <TableHead>Nome (CSV)</TableHead>
                      <TableHead>Nome (Sistema)</TableHead>
                      <TableHead>Status CSV</TableHead>
                      <TableHead>Status Sistema</TableHead>
                      <TableHead>Detalhes</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                          <p className="text-muted-foreground">Nenhum resultado encontrado</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredResults.map((result, idx) => {
                        const config = getTypeConfig(result.type);
                        const Icon = config.icon;
                        
                        return (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge className={cn("border", config.className)}>
                                <Icon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {result.csvData?.nome || "-"}
                              {result.csvData?.rowNumber && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  (linha {result.csvData.rowNumber})
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {result.systemData?.client?.full_name || "-"}
                            </TableCell>
                            <TableCell>
                              {result.csvData?.status || "-"}
                            </TableCell>
                            <TableCell>
                              {result.systemData?.status ? (
                                <Badge variant="outline" className="capitalize">
                                  {result.systemData.status}
                                </Badge>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {result.details || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {result.systemData?.client_id && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => navigate(`/clients/${result.systemData?.client_id}`)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
