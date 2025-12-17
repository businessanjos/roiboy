import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  TrendingDown,
  DollarSign,
  Search,
  XCircle,
  Ban,
  PauseCircle,
  FileText,
  Download,
  Calendar,
} from "lucide-react";
import { Link } from "react-router-dom";

interface ChurnContract {
  id: string;
  client_id: string;
  start_date: string;
  end_date: string | null;
  value: number;
  status: string;
  status_reason: string | null;
  status_changed_at: string | null;
  client: {
    id: string;
    full_name: string;
    phone_e164: string;
  } | null;
}

const STATUS_CONFIG = {
  cancelled: { label: "Cancelado (Churn)", icon: XCircle, className: "bg-red-100 text-red-700 border-red-200" },
  ended: { label: "Encerrado", icon: Ban, className: "bg-slate-100 text-slate-700 border-slate-200" },
  paused: { label: "Pausado", icon: PauseCircle, className: "bg-amber-100 text-amber-700 border-amber-200" },
};

const PERIOD_OPTIONS = [
  { value: "1", label: "Último mês" },
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "12", label: "Último ano" },
  { value: "all", label: "Todo o período" },
];

export default function ChurnReport() {
  const [contracts, setContracts] = useState<ChurnContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("6");

  useEffect(() => {
    fetchChurnContracts();
  }, [periodFilter]);

  const fetchChurnContracts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("client_contracts")
        .select(`
          id,
          client_id,
          start_date,
          end_date,
          value,
          status,
          status_reason,
          status_changed_at,
          client:clients(id, full_name, phone_e164)
        `)
        .in("status", ["cancelled", "ended", "paused"])
        .order("status_changed_at", { ascending: false });

      // Apply period filter
      if (periodFilter !== "all") {
        const months = parseInt(periodFilter);
        const startDate = startOfMonth(subMonths(new Date(), months));
        query = query.gte("status_changed_at", startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error("Error fetching churn contracts:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContracts = contracts.filter((contract) => {
    const matchesSearch =
      !search ||
      contract.client?.full_name.toLowerCase().includes(search.toLowerCase()) ||
      contract.status_reason?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || contract.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate metrics
  const metrics = {
    totalChurned: filteredContracts.filter((c) => c.status === "cancelled").length,
    totalEnded: filteredContracts.filter((c) => c.status === "ended").length,
    totalPaused: filteredContracts.filter((c) => c.status === "paused").length,
    totalValue: filteredContracts
      .filter((c) => c.status === "cancelled")
      .reduce((sum, c) => sum + c.value, 0),
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const exportCSV = () => {
    const headers = ["Cliente", "Status", "Motivo", "Data", "Valor do Contrato", "Início", "Término"];
    const rows = filteredContracts.map((c) => [
      c.client?.full_name || "-",
      STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG]?.label || c.status,
      c.status_reason || "-",
      c.status_changed_at ? format(new Date(c.status_changed_at), "dd/MM/yyyy") : "-",
      c.value.toString(),
      format(new Date(c.start_date), "dd/MM/yyyy"),
      c.end_date ? format(new Date(c.end_date), "dd/MM/yyyy") : "-",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-churn-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Relatório de Churn</h1>
            <p className="text-muted-foreground">
              Histórico de contratos cancelados, encerrados e pausados
            </p>
          </div>
          <Button variant="outline" onClick={exportCSV} disabled={filteredContracts.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Churn (Cancelados)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{metrics.totalChurned}</div>
              <p className="text-xs text-muted-foreground">contratos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Ban className="h-4 w-4 text-slate-500" />
                Encerrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-600">{metrics.totalEnded}</div>
              <p className="text-xs text-muted-foreground">contratos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <PauseCircle className="h-4 w-4 text-amber-500" />
                Pausados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{metrics.totalPaused}</div>
              <p className="text-xs text-muted-foreground">contratos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-red-500" />
                Receita Perdida (Churn)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(metrics.totalValue)}</div>
              <p className="text-xs text-muted-foreground">valor total</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou motivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="cancelled">Cancelados (Churn)</SelectItem>
              <SelectItem value="ended">Encerrados</SelectItem>
              <SelectItem value="paused">Pausados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Contracts Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredContracts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TrendingDown className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhum contrato encontrado</p>
              <p className="text-sm text-muted-foreground">
                Ajuste os filtros ou período para ver mais resultados
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data da Mudança</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Período do Contrato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract) => {
                    const statusConfig = STATUS_CONFIG[contract.status as keyof typeof STATUS_CONFIG];
                    const StatusIcon = statusConfig?.icon || FileText;

                    return (
                      <TableRow key={contract.id}>
                        <TableCell>
                          {contract.client ? (
                            <Link
                              to={`/clients/${contract.client.id}`}
                              className="font-medium hover:underline text-primary"
                            >
                              {contract.client.full_name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Cliente removido</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConfig?.className}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig?.label || contract.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {contract.status_reason ? (
                            <span className="text-sm max-w-[250px] truncate block" title={contract.status_reason}>
                              {contract.status_reason}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {contract.status_changed_at ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(contract.status_changed_at), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{formatCurrency(contract.value)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(contract.start_date), "dd/MM/yyyy", { locale: ptBR })}
                            {contract.end_date && (
                              <span className="text-muted-foreground">
                                {" → "}
                                {format(new Date(contract.end_date), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
