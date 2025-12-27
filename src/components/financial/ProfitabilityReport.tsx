import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

interface ProfitabilityReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ClientProfitability {
  client_id: string;
  client_name: string;
  total_revenue: number;
  total_costs: number;
  profit: number;
  margin: number;
  entries_count: number;
}

export function ProfitabilityReport({ open, onOpenChange }: ProfitabilityReportProps) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [period, setPeriod] = useState<"month" | "year" | "all">("month");

  const dateRange = useMemo(() => {
    if (period === "all") {
      return { start: null, end: null };
    }
    if (period === "year") {
      return {
        start: format(new Date(currentMonth.getFullYear(), 0, 1), "yyyy-MM-dd"),
        end: format(new Date(currentMonth.getFullYear(), 11, 31), "yyyy-MM-dd"),
      };
    }
    return {
      start: format(startOfMonth(currentMonth), "yyyy-MM-dd"),
      end: format(endOfMonth(currentMonth), "yyyy-MM-dd"),
    };
  }, [currentMonth, period]);

  const { data: profitability = [], isLoading } = useQuery({
    queryKey: ["client-profitability", accountId, dateRange],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase.rpc("get_client_profitability", {
        p_account_id: accountId,
        p_start_date: dateRange.start,
        p_end_date: dateRange.end,
      });
      if (error) throw error;
      return data as ClientProfitability[];
    },
    enabled: !!accountId && open,
  });

  const totals = useMemo(() => {
    return {
      revenue: profitability.reduce((sum, p) => sum + p.total_revenue, 0),
      costs: profitability.reduce((sum, p) => sum + p.total_costs, 0),
      profit: profitability.reduce((sum, p) => sum + p.profit, 0),
    };
  }, [profitability]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const maxProfit = useMemo(() => {
    if (profitability.length === 0) return 0;
    return Math.max(...profitability.map(p => Math.abs(p.profit)));
  }, [profitability]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Rentabilidade por Cliente
          </DialogTitle>
          <DialogDescription>
            Análise de lucro e margem por cliente
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mensal</SelectItem>
              <SelectItem value="year">Anual</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
            </SelectContent>
          </Select>
          
          {period === "month" && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[140px] text-center capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, -1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {period === "year" && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear() - 1, 0, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[80px] text-center">
                {currentMonth.getFullYear()}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear() + 1, 0, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Receita Total
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.revenue)}</p>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Custos Total
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.costs)}</p>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              Lucro Líquido
            </div>
            <p className={`text-2xl font-bold ${totals.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(totals.profit)}
            </p>
            <p className="text-sm text-muted-foreground">
              Margem: {totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : profitability.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado de rentabilidade para este período
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Custos</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead>Proporção</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profitability.map((client) => (
                <TableRow key={client.client_id}>
                  <TableCell className="font-medium">{client.client_name}</TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(client.total_revenue)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(client.total_costs)}
                  </TableCell>
                  <TableCell className={`text-right font-bold ${client.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(client.profit)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={client.margin >= 20 ? "default" : client.margin >= 0 ? "secondary" : "destructive"}>
                      {client.margin.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="w-[150px]">
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={maxProfit > 0 ? (Math.abs(client.profit) / maxProfit) * 100 : 0} 
                        className={`h-2 ${client.profit >= 0 ? "" : "[&>div]:bg-red-500"}`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
