import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format, parseISO, addDays, differenceInDays } from "date-fns";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Bell,
  AlertTriangle,
  Calendar,
  Clock,
  CheckCircle2,
  ArrowDownCircle,
  ArrowUpCircle,
  Settings,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UpcomingEntry {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  entry_type: string;
  status: string;
  days_until: number;
  client?: { full_name: string } | null;
}

export default function FinancialAlertsPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const [activeTab, setActiveTab] = useState<"upcoming" | "config">("upcoming");
  const [filterDays, setFilterDays] = useState<string>("7");

  const { data: upcomingEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["upcoming-entries", accountId, filterDays],
    queryFn: async () => {
      if (!accountId) return [];
      
      const today = new Date();
      const futureDate = addDays(today, parseInt(filterDays));
      
      const { data, error } = await supabase
        .from("financial_entries")
        .select(`
          id, description, amount, due_date, entry_type, status,
          client:clients(full_name)
        `)
        .eq("account_id", accountId)
        .in("status", ["pending", "overdue"])
        .gte("due_date", format(today, "yyyy-MM-dd"))
        .lte("due_date", format(futureDate, "yyyy-MM-dd"))
        .order("due_date", { ascending: true });
      
      if (error) throw error;
      
      return (data || []).map(entry => ({
        ...entry,
        days_until: differenceInDays(parseISO(entry.due_date), today),
      })) as UpcomingEntry[];
    },
    enabled: !!accountId,
  });

  const { data: overdueEntries = [] } = useQuery({
    queryKey: ["overdue-entries", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      
      const today = format(new Date(), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("financial_entries")
        .select(`
          id, description, amount, due_date, entry_type, status,
          client:clients(full_name)
        `)
        .eq("account_id", accountId)
        .eq("status", "overdue")
        .lt("due_date", today)
        .order("due_date", { ascending: true });
      
      if (error) throw error;
      
      return (data || []).map(entry => ({
        ...entry,
        days_until: differenceInDays(parseISO(entry.due_date), new Date()),
      })) as UpcomingEntry[];
    },
    enabled: !!accountId,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const getDaysLabel = (days: number) => {
    if (days === 0) return "Vence hoje";
    if (days === 1) return "Vence amanhã";
    if (days < 0) return `${Math.abs(days)} dias atrasado`;
    return `Em ${days} dias`;
  };

  const getDaysBadgeVariant = (days: number) => {
    if (days < 0) return "destructive";
    if (days === 0) return "destructive";
    if (days <= 3) return "default";
    return "secondary";
  };

  const summary = {
    upcoming: upcomingEntries.length,
    overdue: overdueEntries.length,
    overdueAmount: overdueEntries.reduce((sum, e) => sum + e.amount, 0),
    upcomingAmount: upcomingEntries.reduce((sum, e) => sum + e.amount, 0),
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <div>
              <CardTitle>Alertas de Vencimento</CardTitle>
              <CardDescription>
                Acompanhe os vencimentos próximos e configure alertas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-yellow-600 text-sm">
                  <Clock className="h-4 w-4" />
                  Próximos
                </div>
                <div className="text-2xl font-bold">{summary.upcoming}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(summary.upcomingAmount)}</div>
              </CardContent>
            </Card>
            <Card className="border-destructive/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Atrasados
                </div>
                <div className="text-2xl font-bold text-destructive">{summary.overdue}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(summary.overdueAmount)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <ArrowDownCircle className="h-4 w-4" />
                  A Receber
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(upcomingEntries.filter(e => e.entry_type === "receivable").reduce((s, e) => s + e.amount, 0))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <ArrowUpCircle className="h-4 w-4" />
                  A Pagar
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(upcomingEntries.filter(e => e.entry_type === "payable").reduce((s, e) => s + e.amount, 0))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="upcoming" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Próximos Vencimentos
                </TabsTrigger>
                <TabsTrigger value="config" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configurações
                </TabsTrigger>
              </TabsList>

              {activeTab === "upcoming" && (
                <Select value={filterDays} onValueChange={setFilterDays}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">Próximos 3 dias</SelectItem>
                    <SelectItem value="7">Próximos 7 dias</SelectItem>
                    <SelectItem value="15">Próximos 15 dias</SelectItem>
                    <SelectItem value="30">Próximos 30 dias</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <TabsContent value="upcoming" className="mt-4">
              <ScrollArea className="h-[500px]">
                {/* Overdue Section */}
                {overdueEntries.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Atrasados ({overdueEntries.length})
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overdueEntries.map((entry) => (
                          <TableRow key={entry.id} className="bg-destructive/5">
                            <TableCell className="font-medium">{entry.description}</TableCell>
                            <TableCell>{entry.client?.full_name || "-"}</TableCell>
                            <TableCell>
                              {entry.entry_type === "receivable" ? (
                                <Badge variant="outline" className="border-green-500 text-green-600">
                                  <ArrowDownCircle className="h-3 w-3 mr-1" />
                                  Receita
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-red-500 text-red-600">
                                  <ArrowUpCircle className="h-3 w-3 mr-1" />
                                  Despesa
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(entry.due_date), "dd/MM/yyyy")}
                              </div>
                            </TableCell>
                            <TableCell className={`text-right font-medium ${entry.entry_type === "receivable" ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(entry.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive">
                                {getDaysLabel(entry.days_until)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Upcoming Section */}
                {entriesLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : upcomingEntries.length === 0 && overdueEntries.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p className="font-medium">Tudo em dia!</p>
                    <p className="text-sm mt-2">
                      Não há vencimentos nos próximos {filterDays} dias.
                    </p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Próximos {filterDays} dias ({upcomingEntries.length})
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {upcomingEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium">{entry.description}</TableCell>
                            <TableCell>{entry.client?.full_name || "-"}</TableCell>
                            <TableCell>
                              {entry.entry_type === "receivable" ? (
                                <Badge variant="outline" className="border-green-500 text-green-600">
                                  <ArrowDownCircle className="h-3 w-3 mr-1" />
                                  Receita
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-red-500 text-red-600">
                                  <ArrowUpCircle className="h-3 w-3 mr-1" />
                                  Despesa
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(entry.due_date), "dd/MM/yyyy")}
                              </div>
                            </TableCell>
                            <TableCell className={`text-right font-medium ${entry.entry_type === "receivable" ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(entry.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getDaysBadgeVariant(entry.days_until)}>
                                {getDaysLabel(entry.days_until)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="config" className="mt-4">
              <div className="p-12 text-center text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Configurações de alertas em breve</p>
                <p className="text-sm mt-2">
                  Configure notificações automáticas por WhatsApp e e-mail
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
