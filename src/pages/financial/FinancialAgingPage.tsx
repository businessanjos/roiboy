import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format, parseISO, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  BarChart3,
  Calendar,
  Clock,
  AlertTriangle,
  Search,
  Download,
  User,
  ArrowDownCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AgingEntry {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  entry_type: string;
  status: string;
  days_overdue: number;
  aging_bucket: string;
  client_id: string | null;
  client?: { full_name: string } | null;
}

interface AgingBucket {
  label: string;
  min: number;
  max: number | null;
  color: string;
  entries: AgingEntry[];
  total: number;
}

export default function FinancialAgingPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBucket, setSelectedBucket] = useState<string>("all");

  const { data: overdueEntries = [], isLoading } = useQuery({
    queryKey: ["aging-report", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      
      const today = format(new Date(), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("financial_entries")
        .select(`
          id, description, amount, due_date, entry_type, status, client_id,
          client:clients(full_name)
        `)
        .eq("account_id", accountId)
        .eq("entry_type", "receivable")
        .in("status", ["pending", "overdue"])
        .lt("due_date", today)
        .order("due_date", { ascending: true });
      
      if (error) throw error;
      
      return (data || []).map(entry => {
        const daysOverdue = differenceInDays(new Date(), parseISO(entry.due_date));
        let bucket = "current";
        if (daysOverdue <= 30) bucket = "1-30";
        else if (daysOverdue <= 60) bucket = "31-60";
        else if (daysOverdue <= 90) bucket = "61-90";
        else if (daysOverdue <= 120) bucket = "91-120";
        else bucket = "120+";
        
        return {
          ...entry,
          days_overdue: daysOverdue,
          aging_bucket: bucket,
        };
      }) as AgingEntry[];
    },
    enabled: !!accountId,
  });

  const agingBuckets: AgingBucket[] = useMemo(() => {
    const buckets: AgingBucket[] = [
      { label: "1-30 dias", min: 1, max: 30, color: "bg-yellow-500", entries: [], total: 0 },
      { label: "31-60 dias", min: 31, max: 60, color: "bg-orange-500", entries: [], total: 0 },
      { label: "61-90 dias", min: 61, max: 90, color: "bg-red-500", entries: [], total: 0 },
      { label: "91-120 dias", min: 91, max: 120, color: "bg-red-700", entries: [], total: 0 },
      { label: "120+ dias", min: 121, max: null, color: "bg-red-900", entries: [], total: 0 },
    ];

    overdueEntries.forEach(entry => {
      const bucket = buckets.find(b => 
        entry.days_overdue >= b.min && (b.max === null || entry.days_overdue <= b.max)
      );
      if (bucket) {
        bucket.entries.push(entry);
        bucket.total += entry.amount;
      }
    });

    return buckets;
  }, [overdueEntries]);

  const byClient = useMemo(() => {
    const clientMap = new Map<string, { name: string; total: number; entries: AgingEntry[] }>();
    
    overdueEntries.forEach(entry => {
      const clientId = entry.client_id || "no-client";
      const clientName = entry.client?.full_name || "Sem cliente";
      
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, { name: clientName, total: 0, entries: [] });
      }
      
      const client = clientMap.get(clientId)!;
      client.total += entry.amount;
      client.entries.push(entry);
    });

    return Array.from(clientMap.values()).sort((a, b) => b.total - a.total);
  }, [overdueEntries]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const totalOverdue = overdueEntries.reduce((sum, e) => sum + e.amount, 0);
  const maxBucketTotal = Math.max(...agingBuckets.map(b => b.total));

  const filteredEntries = overdueEntries.filter(entry => {
    const matchesSearch = entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.client?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBucket = selectedBucket === "all" || entry.aging_bucket === selectedBucket;
    return matchesSearch && matchesBucket;
  });

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <div>
              <CardTitle>Relatório de Aging (Envelhecimento)</CardTitle>
              <CardDescription>
                Análise de contas a receber por tempo de atraso
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Total Atrasado
                </div>
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(totalOverdue)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {overdueEntries.length} lançamentos
                </div>
              </CardContent>
            </Card>
            
            {agingBuckets.map((bucket) => (
              <Card key={bucket.label}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <div className={`w-3 h-3 rounded-full ${bucket.color}`} />
                    {bucket.label}
                  </div>
                  <div className="text-xl font-bold">
                    {formatCurrency(bucket.total)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {bucket.entries.length} lançamentos
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Aging Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Distribuição por Idade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {agingBuckets.map((bucket) => (
                  <div key={bucket.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${bucket.color}`} />
                        {bucket.label}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(bucket.total)} ({bucket.entries.length})
                      </span>
                    </div>
                    <Progress 
                      value={maxBucketTotal > 0 ? (bucket.total / maxBucketTotal) * 100 : 0} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Clients */}
          {byClient.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top 5 Clientes com Maior Atraso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {byClient.slice(0, 5).map((client, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{client.name}</span>
                        <Badge variant="secondary">{client.entries.length}</Badge>
                      </div>
                      <span className="font-bold text-destructive">
                        {formatCurrency(client.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters and Table */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedBucket} onValueChange={setSelectedBucket}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="1-30">1-30 dias</SelectItem>
                <SelectItem value="31-60">31-60 dias</SelectItem>
                <SelectItem value="61-90">61-90 dias</SelectItem>
                <SelectItem value="91-120">91-120 dias</SelectItem>
                <SelectItem value="120+">120+ dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>

          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Nenhum lançamento atrasado</p>
                <p className="text-sm mt-2">
                  {searchQuery ? "Tente ajustar os filtros" : "Parabéns! Não há contas a receber atrasadas."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Dias Atraso</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Faixa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => {
                    const bucket = agingBuckets.find(b => 
                      entry.days_overdue >= b.min && (b.max === null || entry.days_overdue <= b.max)
                    );
                    
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ArrowDownCircle className="h-4 w-4 text-green-600" />
                            <span className="font-medium">{entry.description}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {entry.client?.full_name || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(entry.due_date), "dd/MM/yyyy")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-destructive" />
                            <span className="font-medium text-destructive">
                              {entry.days_overdue} dias
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(entry.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <div className={`w-2 h-2 rounded-full ${bucket?.color}`} />
                            {bucket?.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
