import { useEffect, useState, useCallback } from "react";
import { RenewalThermometer } from "@/components/renewals/RenewalThermometer";
import { RenewalLosses } from "@/components/renewals/RenewalLosses";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Loader2, ArrowRight, CalendarDays, AlertTriangle, Clock, RefreshCw, DollarSign, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  renewal_value: number;
  responsible_name: string | null;
  responsible_user_id: string | null;
}

// Users with full visibility on renewals (everyone else sees only their own)
const RENEWALS_FULL_ACCESS_USER_IDS = [
  "d20201f6-a9bd-4934-ae50-07ce7a47574b", // Maikol
  "de43a643-0109-4afb-ac35-be768dbf4090", // Everton
  "1232ec15-5f66-4b5f-9e74-f40d436f9d0f", // Jonathan
  "a1625047-8b72-4b1b-a42c-24bbdc9fd143", // Jéssica Campos
  "c064c5d5-cdb5-47cc-99ce-ad416b6407b1", // Jéssica Marcato
  "b625a448-23e6-40bf-a503-d876a9a701db", // Bruna
];

export default function Renewals() {
  const { currentUser } = useCurrentUser();
  const [contracts, setContracts] = useState<RenewalContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterConsultora, setFilterConsultora] = useState("all");
  const [filterProduto, setFilterProduto] = useState("all");
  const [filterTempo, setFilterTempo] = useState("all");
  const [filterChance, setFilterChance] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [chanceScores, setChanceScores] = useState<Record<string, number>>({});
  const [outcomeMap, setOutcomeMap] = useState<Record<string, { id: string; outcome: string }>>({});
  const [products, setProducts] = useState<{ id: string; name: string; price: number }[]>([]);
  const [renewalDialog, setRenewalDialog] = useState<{ open: boolean; contract: RenewalContract | null }>({ open: false, contract: null });
  const [renewalForm, setRenewalForm] = useState({ product_id: "", payment_method: "", value: "" });
  const [savingRenewal, setSavingRenewal] = useState(false);

  const handleScoreCalculated = useCallback((clientId: string, score: number) => {
    setChanceScores(prev => {
      if (prev[clientId] === score) return prev;
      return { ...prev, [clientId]: score };
    });
  }, []);

  const handleOutcomeChange = useCallback(async (contract: RenewalContract, newOutcome: string) => {
    if (!currentUser?.account_id) return;

    // If selecting "renewed", open dialog instead of saving directly
    if (newOutcome === "renewed") {
      setRenewalForm({ product_id: "", payment_method: "", value: String(contract.renewal_value) });
      setRenewalDialog({ open: true, contract });
      return;
    }

    const existing = outcomeMap[contract.id];
    try {
      if (existing) {
        await supabase
          .from("renewal_outcomes")
          .update({ outcome: newOutcome, resolved_at: new Date().toISOString(), resolved_by: currentUser.id })
          .eq("id", existing.id);
        setOutcomeMap(prev => ({ ...prev, [contract.id]: { ...existing, outcome: newOutcome } }));
      } else {
        const { data } = await supabase
          .from("renewal_outcomes")
          .insert({
            account_id: currentUser.account_id,
            client_id: contract.client_id,
            contract_id: contract.id,
            outcome: newOutcome,
            renewal_value: contract.renewal_value,
            resolved_at: new Date().toISOString(),
            resolved_by: currentUser.id,
          })
          .select("id")
          .single();
        if (data) {
          setOutcomeMap(prev => ({ ...prev, [contract.id]: { id: data.id, outcome: newOutcome } }));
        }
      }
      const labels: Record<string, string> = { negotiating: "Em Negociação", renewed: "Renovado", lost: "Cancelou", pending: "Pendente" };
      toast.success(`Status alterado para "${labels[newOutcome] || newOutcome}"`);
      // If lost, remove from pending list
      if (newOutcome === "lost") {
        setContracts(prev => prev.filter(c => c.id !== contract.id));
      }
    } catch (err) {
      console.error("Error saving outcome:", err);
      toast.error("Erro ao salvar status");
    }
  }, [currentUser, outcomeMap]);

  const handleConfirmRenewal = async () => {
    const contract = renewalDialog.contract;
    if (!contract || !currentUser?.account_id) return;
    setSavingRenewal(true);

    const existing = outcomeMap[contract.id];
    const renewalValue = parseFloat(renewalForm.value) || contract.renewal_value;

    try {
      const payload: any = {
        account_id: currentUser.account_id,
        client_id: contract.client_id,
        contract_id: contract.id,
        outcome: "renewed",
        renewal_value: renewalValue,
        resolved_at: new Date().toISOString(),
        resolved_by: currentUser.id,
        loss_notes: renewalForm.product_id || renewalForm.payment_method
          ? `Produto: ${products.find(p => p.id === renewalForm.product_id)?.name || "—"} | Forma: ${renewalForm.payment_method || "—"}`
          : null,
      };

      if (existing) {
        await supabase.from("renewal_outcomes").update(payload).eq("id", existing.id);
        setOutcomeMap(prev => ({ ...prev, [contract.id]: { ...existing, outcome: "renewed" } }));
      } else {
        const { data } = await supabase.from("renewal_outcomes").insert(payload).select("id").single();
        if (data) {
          setOutcomeMap(prev => ({ ...prev, [contract.id]: { id: data.id, outcome: "renewed" } }));
        }
      }

      toast.success("Renovação registrada com sucesso!");
      setRenewalDialog({ open: false, contract: null });
      // Remove from pending list
      setContracts(prev => prev.filter(c => c.id !== contract.id));
    } catch (err) {
      console.error("Error confirming renewal:", err);
      toast.error("Erro ao registrar renovação");
    } finally {
      setSavingRenewal(false);
    }
  };

  const fetchRenewals = async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);

    try {
      const today = new Date();
      const in90Days = new Date(today);
      in90Days.setDate(today.getDate() + 90);
      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      // 1) Fetch contracts expiring in next 90 days (future renewals)
      const { data: futureData, error: futureError } = await supabase
        .from("client_contracts")
        .select(`
          id, client_id, status, start_date, end_date, value, currency, product_id, payment_option,
          clients!inner(full_name, phone_e164, emails, logo_url, status, responsible_user_id, users:responsible_user_id(name)),
          products(name, color, price, cash_price, installment_price, renewal_discount_percent)
        `)
        .eq("account_id", currentUser.account_id)
        .eq("status", "active")
        .not("end_date", "is", null)
        .gte("end_date", formatDate(today))
        .lte("end_date", formatDate(in90Days))
        .is("parent_contract_id", null)
        .order("end_date", { ascending: true });

      // 2) Fetch already expired contracts that have pending/negotiating outcomes
      const { data: expiredPendingOutcomes } = await supabase
        .from("renewal_outcomes")
        .select("contract_id")
        .eq("account_id", currentUser.account_id)
        .in("outcome", ["pending", "negotiating"]);

      const pendingContractIds = (expiredPendingOutcomes || []).map((o: any) => o.contract_id);
      
      let expiredPendingData: any[] = [];
      if (pendingContractIds.length > 0) {
        const { data } = await supabase
          .from("client_contracts")
          .select(`
            id, client_id, status, start_date, end_date, value, currency, product_id, payment_option,
            clients!inner(full_name, phone_e164, emails, logo_url, status, responsible_user_id, users:responsible_user_id(name)),
            products(name, color, price, cash_price, installment_price, renewal_discount_percent)
          `)
          .eq("account_id", currentUser.account_id)
          .in("id", pendingContractIds)
          .not("end_date", "is", null)
          .lt("end_date", formatDate(today))
          .is("parent_contract_id", null)
          .order("end_date", { ascending: true });
        expiredPendingData = data || [];
      }

      // 3) Also fetch expired contracts without any outcome at all (truly pending)
      const { data: expiredNoOutcome } = await supabase
        .from("client_contracts")
        .select(`
          id, client_id, status, start_date, end_date, value, currency, product_id, payment_option,
          clients!inner(full_name, phone_e164, emails, logo_url, status, responsible_user_id, users:responsible_user_id(name)),
          products(name, color, price, cash_price, installment_price, renewal_discount_percent)
        `)
        .eq("account_id", currentUser.account_id)
        .not("end_date", "is", null)
        .lt("end_date", formatDate(today))
        .gte("end_date", "2025-03-01")
        .is("parent_contract_id", null)
        .order("end_date", { ascending: true });

      if (futureError) {
        console.error("Error fetching renewal contracts:", futureError);
        setContracts([]);
        setLoading(false);
        return;
      }

      // Merge all, dedup by contract id
      const allRaw = [...(futureData || []), ...expiredPendingData, ...(expiredNoOutcome || [])];
      const seen = new Set<string>();
      const deduped = allRaw.filter((c: any) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      // Fetch all outcomes for these contracts to know which are already resolved
      const allContractIds = deduped.map((c: any) => c.id);
      let allOutcomesMap: Record<string, { id: string; outcome: string }> = {};
      if (allContractIds.length > 0) {
        const { data: outcomes } = await supabase
          .from("renewal_outcomes")
          .select("id, contract_id, outcome")
          .in("contract_id", allContractIds);
        (outcomes || []).forEach((o: any) => {
          allOutcomesMap[o.contract_id] = { id: o.id, outcome: o.outcome };
        });
      }

      // Filter out contracts already marked as renewed or lost
      const pendingContracts = deduped.filter((c: any) => {
        const outcome = allOutcomesMap[c.id]?.outcome;
        return !outcome || outcome === "pending" || outcome === "negotiating";
      });

      const mapped: RenewalContract[] = pendingContracts.map((c: any) => {
        const endDate = parseLocalDate(c.end_date);
        const diffMs = endDate ? endDate.getTime() - today.getTime() : 0;
        const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        return {
          id: c.id,
          client_id: c.client_id,
          client_name: c.clients?.full_name || "—",
          client_phone: c.clients?.phone_e164 || null,
          client_email: (() => {
            const emails = c.clients?.emails;
            if (!emails) return null;
            if (Array.isArray(emails)) {
              const first = emails[0];
              return typeof first === 'object' && first !== null ? (first as any).email : first;
            }
            return typeof emails === 'object' ? (emails as any).email : String(emails);
          })(),
          client_photo_url: c.clients?.logo_url || null,
          client_status: c.clients?.status || "active",
          contract_status: c.status,
          start_date: c.start_date,
          end_date: c.end_date,
          value: c.value || 0,
          currency: c.currency || "BRL",
          product_name: c.products?.name || null,
          product_color: c.products?.color || null,
          days_until_expiry: daysUntil,
          renewal_value: (() => {
            const discountPercent = c.products?.renewal_discount_percent ?? 50;
            const paymentOption = c.payment_option || '';
            const isCash = paymentOption === 'a_vista' || paymentOption === 'parcelado_1x' || paymentOption === 'parcelado_1x_cheque';
            const installmentPrice = c.products?.installment_price;
            const cashPrice = c.products?.cash_price;
            const basePrice = c.products?.price;
            let priceToUse: number;
            if (isCash && cashPrice && cashPrice > 0) priceToUse = cashPrice;
            else if (installmentPrice && installmentPrice > 0) priceToUse = installmentPrice;
            else if (basePrice && basePrice > 0) priceToUse = basePrice;
            else priceToUse = c.value || 0;
            return priceToUse * (discountPercent / 100);
          })(),
          responsible_name: (c.clients as any)?.users?.name || null,
          responsible_user_id: (c.clients as any)?.responsible_user_id || null,
        };
      });

      const hasFullAccess = currentUser.role === "admin" || currentUser.role === "super_admin" 
        || currentUser.is_also_admin 
        || RENEWALS_FULL_ACCESS_USER_IDS.includes(currentUser.id);
      
      const finalContracts = hasFullAccess ? mapped : mapped.filter(c => c.responsible_user_id === currentUser.id);
      setContracts(finalContracts);
      setOutcomeMap(allOutcomesMap);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRenewals();
    // Fetch products for renewal dialog
    const fetchProducts = async () => {
      const { data } = await supabase.from("products").select("id, name, price").eq("is_active", true).order("name");
      setProducts(data || []);
    };
    fetchProducts();
  }, [currentUser?.account_id]);

  // Extract unique values for filters
  const uniqueConsultoras = [...new Set(contracts.map(c => c.responsible_name).filter(Boolean))] as string[];
  const uniqueProdutos = [...new Set(contracts.map(c => c.product_name).filter(Boolean))] as string[];

  const filtered = contracts.filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !c.client_name.toLowerCase().includes(q) &&
        !c.client_email?.toLowerCase().includes(q) &&
        !c.product_name?.toLowerCase().includes(q)
      ) return false;
    }
    if (filterConsultora !== "all" && c.responsible_name !== filterConsultora) return false;
    if (filterProduto !== "all" && c.product_name !== filterProduto) return false;
    if (filterTempo !== "all") {
      if (filterTempo === "urgent" && c.days_until_expiry > 30) return false;
      if (filterTempo === "warning" && (c.days_until_expiry <= 30 || c.days_until_expiry > 60)) return false;
      if (filterTempo === "ok" && c.days_until_expiry <= 60) return false;
    }
    if (filterChance !== "all") {
      const score = chanceScores[c.client_id];
      if (score === undefined) return true; // still loading, show it
      if (filterChance === "alta" && score < 70) return false;
      if (filterChance === "media" && (score < 40 || score >= 70)) return false;
      if (filterChance === "baixa" && score >= 40) return false;
    }
    if (filterStatus !== "all") {
      const currentOutcome = outcomeMap[c.id]?.outcome || "pending";
      if (filterStatus !== currentOutcome) return false;
    }
    return true;
  });

  const urgentCount = filtered.filter((c) => c.days_until_expiry <= 30).length;
  const warningCount = filtered.filter((c) => c.days_until_expiry > 30 && c.days_until_expiry <= 60).length;
  const okCount = filtered.filter((c) => c.days_until_expiry > 60).length;
  const totalRenewalValue = filtered.reduce((sum, c) => sum + c.renewal_value, 0);

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
        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 gap-1">
          <Clock className="h-3 w-3" />
          {days} dias
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
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

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            A Vencer ({filtered.length})
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-2">
            <TrendingDown className="h-4 w-4" />
            Resultados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(totalRenewalValue, "BRL")}</p>
                  <p className="text-xs text-muted-foreground">Valor total de renovação</p>
                </div>
              </CardContent>
            </Card>
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
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{warningCount}</p>
                  <p className="text-xs text-muted-foreground">31 a 60 dias</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <CalendarDays className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{okCount}</p>
                  <p className="text-xs text-muted-foreground">61 a 90 dias</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterConsultora} onValueChange={setFilterConsultora}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Consultora" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas consultoras</SelectItem>
                {uniqueConsultoras.sort().map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterProduto} onValueChange={setFilterProduto}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos produtos</SelectItem>
                {uniqueProdutos.sort().map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTempo} onValueChange={setFilterTempo}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tempo Restante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os prazos</SelectItem>
                <SelectItem value="urgent">Até 30 dias</SelectItem>
                <SelectItem value="warning">31 a 60 dias</SelectItem>
                <SelectItem value="ok">61 a 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterChance} onValueChange={setFilterChance}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Chance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas chances</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="negotiating">Em Negociação</SelectItem>
              </SelectContent>
            </Select>
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
                      <TableHead className="text-center">Consultora</TableHead>
                      <TableHead className="text-center">Produto</TableHead>
                      <TableHead className="text-center">Valor Renovação</TableHead>
                      <TableHead className="text-center">Início</TableHead>
                      <TableHead className="text-center">Vencimento</TableHead>
                      <TableHead className="text-center">Tempo Restante</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Chance</TableHead>
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
                              <p className="text-sm font-medium break-words whitespace-normal max-w-[220px]">{contract.client_name}</p>
                              {contract.client_email && (
                                <p className="text-xs text-muted-foreground truncate">{contract.client_email}</p>
                              )}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {contract.responsible_name || "—"}
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
                          {formatCurrency(contract.renewal_value, contract.currency)}
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
                        <TableCell className="text-center">
                          <Select
                            value={outcomeMap[contract.id]?.outcome || "pending"}
                            onValueChange={(val) => handleOutcomeChange(contract, val)}
                          >
                            <SelectTrigger className={cn(
                              "h-8 w-[140px] text-xs mx-auto",
                              outcomeMap[contract.id]?.outcome === "renewed" && "border-emerald-500 text-emerald-700 dark:text-emerald-400",
                              outcomeMap[contract.id]?.outcome === "negotiating" && "border-blue-500 text-blue-700 dark:text-blue-400",
                              outcomeMap[contract.id]?.outcome === "lost" && "border-red-500 text-red-700 dark:text-red-400",
                            )}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="negotiating">Em Negociação</SelectItem>
                              <SelectItem value="renewed">Renovado</SelectItem>
                              <SelectItem value="lost">Cancelou</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <RenewalThermometer
                            clientId={contract.client_id}
                            accountId={currentUser?.account_id || ""}
                            onScoreCalculated={handleScoreCalculated}
                          />
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
        </TabsContent>

        <TabsContent value="results">
          <RenewalLosses />
        </TabsContent>
      </Tabs>

      {/* Renewal Confirmation Dialog */}
      <Dialog open={renewalDialog.open} onOpenChange={(open) => !open && setRenewalDialog({ open: false, contract: null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Renovação</DialogTitle>
          </DialogHeader>
          {renewalDialog.contract && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cliente: <strong>{renewalDialog.contract.client_name}</strong>
              </p>

              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={renewalForm.product_id} onValueChange={(v) => setRenewalForm(prev => ({ ...prev, product_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={renewalForm.payment_method} onValueChange={(v) => setRenewalForm(prev => ({ ...prev, payment_method: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a forma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="parcelado">Parcelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valor da Renovação (R$)</Label>
                <Input
                  type="number"
                  value={renewalForm.value}
                  onChange={(e) => setRenewalForm(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewalDialog({ open: false, contract: null })}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmRenewal} disabled={savingRenewal}>
              {savingRenewal && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Renovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
