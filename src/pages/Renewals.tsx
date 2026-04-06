import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Loader2, ArrowRight, CalendarDays, AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseLocalDate, formatLocalDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

interface RenewalContract {
  id: string;
  client_id: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  client_photo_url: string | null;
  client_status: string;
  contract_status: string;
  start_date: string;
  end_date: string;
  value: number;
  currency: string;
  product_name: string | null;
  product_color: string | null;
  days_until_expiry: number;
}

export default function Renewals() {
  const { currentUser } = useCurrentUser();
  const [contracts, setContracts] = useState<RenewalContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchRenewals = async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);

    try {
      const today = new Date();
      const in90Days = new Date(today);
      in90Days.setDate(today.getDate() + 90);

      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("client_contracts")
        .select(`
          id,
          client_id,
          status,
          start_date,
          end_date,
          value,
          currency,
          product_id,
          clients!inner(full_name, phone_e164, email, photo_url, status),
          products(name, color)
        `)
        .eq("account_id", currentUser.account_id)
        .eq("status", "active")
        .not("end_date", "is", null)
        .gte("end_date", formatDate(today))
        .lte("end_date", formatDate(in90Days))
        .is("parent_contract_id", null)
        .order("end_date", { ascending: true });

      if (error) {
        console.error("Error fetching renewal contracts:", error);
        setContracts([]);
        setLoading(false);
        return;
      }

      const mapped: RenewalContract[] = (data || []).map((c: any) => {
        const endDate = parseLocalDate(c.end_date);
        const diffMs = endDate ? endDate.getTime() - today.getTime() : 0;
        const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        return {
          id: c.id,
          client_id: c.client_id,
          client_name: c.clients?.full_name || "—",
          client_phone: c.clients?.phone_e164 || null,
          client_email: c.clients?.email || null,
          client_photo_url: c.clients?.photo_url || null,
          client_status: c.clients?.status || "active",
          contract_status: c.status,
          start_date: c.start_date,
          end_date: c.end_date,
          value: c.value || 0,
          currency: c.currency || "BRL",
          product_name: c.products?.name || null,
          product_color: c.products?.color || null,
          days_until_expiry: daysUntil,
        };
      });

      setContracts(mapped);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRenewals();
  }, [currentUser?.account_id]);

  const filtered = contracts.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.client_name.toLowerCase().includes(q) ||
      c.client_email?.toLowerCase().includes(q) ||
      c.product_name?.toLowerCase().includes(q)
    );
  });

  const urgentCount = filtered.filter((c) => c.days_until_expiry <= 30).length;
  const warningCount = filtered.filter((c) => c.days_until_expiry > 30 && c.days_until_expiry <= 60).length;
  const okCount = filtered.filter((c) => c.days_until_expiry > 60).length;

  const getUrgencyBadge = (days: number) => {
    if (days <= 30) {
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 gap-1">
          <AlertTriangle className="h-3 w-3" />
          {days} dias
        </Badge>
      );
    }
    if (days <= 60) {
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
          <Clock className="h-3 w-3" />
          {days} dias
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 gap-1">
        <CalendarDays className="h-3 w-3" />
        {days} dias
      </Badge>
    );
  };

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency,
    }).format(value);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Renovações</h1>
          <p className="text-sm text-muted-foreground">
            Contratos com vencimento nos próximos 90 dias
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRenewals} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{urgentCount}</p>
              <p className="text-xs text-muted-foreground">Até 30 dias</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{warningCount}</p>
              <p className="text-xs text-muted-foreground">31 a 60 dias</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{okCount}</p>
              <p className="text-xs text-muted-foreground">61 a 90 dias</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email ou produto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CalendarDays className="h-10 w-10 mb-3 opacity-50" />
              <p className="font-medium">Nenhum contrato a vencer nos próximos 90 dias</p>
              <p className="text-sm">Todos os contratos estão com vencimento distante.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Cliente</TableHead>
                  <TableHead className="text-center">Produto</TableHead>
                  <TableHead className="text-center">Valor</TableHead>
                  <TableHead className="text-center">Início</TableHead>
                  <TableHead className="text-center">Vencimento</TableHead>
                  <TableHead className="text-center">Tempo Restante</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((contract) => (
                  <TableRow key={contract.id} className="group">
                    <TableCell>
                      <Link
                        to={`/clients/${contract.client_id}`}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                      >
                        <Avatar className="h-8 w-8">
                          {contract.client_photo_url ? (
                            <AvatarImage src={contract.client_photo_url} alt={contract.client_name} />
                          ) : null}
                          <AvatarFallback className="text-xs bg-muted">
                            {getInitials(contract.client_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{contract.client_name}</p>
                          {contract.client_email && (
                            <p className="text-xs text-muted-foreground truncate">{contract.client_email}</p>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      {contract.product_name ? (
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            borderColor: contract.product_color || undefined,
                            color: contract.product_color || undefined,
                          }}
                        >
                          {contract.product_name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      {formatCurrency(contract.value, contract.currency)}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {formatLocalDate(contract.start_date)}
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      {formatLocalDate(contract.end_date)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getUrgencyBadge(contract.days_until_expiry)}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link to={`/clients/${contract.client_id}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent>Ver cliente</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
