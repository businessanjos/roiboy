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
import { Search, Loader2, ArrowRight, CalendarDays, AlertTriangle, Clock, RefreshCw, DollarSign, TrendingDown, CalendarX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseLocalDate, formatLocalDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { MultiSelectFilter } from "@/components/renewals/MultiSelectFilter";

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
  const [filterConsultora, setFilterConsultora] = useState<string[]>([]);
  const [filterProduto, setFilterProduto] = useState<string[]>([]);
  const [filterTempo, setFilterTempo] = useState<string[]>([]);
  const [filterChance, setFilterChance] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterQuarter, setFilterQuarter] = useState<string[]>([]);
  // Filtros independentes da aba "Vencidos"
  const [expiredFilterConsultora, setExpiredFilterConsultora] = useState<string[]>([]);
  const [expiredFilterProduto, setExpiredFilterProduto] = useState<string[]>([]);
  const [expiredFilterChance, setExpiredFilterChance] = useState<string[]>([]);
  const [expiredFilterAno, setExpiredFilterAno] = useState<string[]>([]);
  const [chanceScores, setChanceScores] = useState<Record<string, number>>({});
  const [outcomeMap, setOutcomeMap] = useState<Record<string, { id: string; outcome: string }>>({});
  const [products, setProducts] = useState<{ id: string; name: string; price: number }[]>([]);
  const [renewalDialog, setRenewalDialog] = useState<{ open: boolean; contract: RenewalContract | null }>({ open: false, contract: null });
  const [renewalForm, setRenewalForm] = useState({ product_id: "", payment_method: "", value: "" });
  const [savingRenewal, setSavingRenewal] = useState(false);
  const PAGE_SIZE = 20;
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [expiredPage, setExpiredPage] = useState(1);

  useEffect(() => { setUpcomingPage(1); }, [searchQuery, filterConsultora, filterProduto, filterTempo, filterChance, filterStatus, filterQuarter]);
  useEffect(() => { setExpiredPage(1); }, [expiredFilterConsultora, expiredFilterProduto, expiredFilterChance, expiredFilterAno]);

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
      // Estender janela: tudo a vencer até o fim de 2026 (ou pelo menos 90 dias à frente)
      const endOf2026 = new Date("2026-12-31T23:59:59");
      const in90Days = new Date(today);
      in90Days.setDate(today.getDate() + 90);
      const futureLimit = endOf2026 > in90Days ? endOf2026 : in90Days;
      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      // 1) Fetch contracts expiring from today through end of 2026 (future renewals)
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
        .lte("end_date", formatDate(futureLimit))
        .is("parent_contract_id", null)
        .order("end_date", { ascending: true })
        .limit(2000);

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

      // Auto-detect successor contracts (renewals already closed by sales).
      // For each contract in the list, check if the same client has another active contract
      // for the same product whose start_date is around (or after) this contract's end_date.
      // If so, treat the old contract as already renewed and skip it.
      const clientIds = [...new Set(deduped.map((c: any) => c.client_id))];
      let successorMap: Record<string, { id: string; start_date: string; product_id: string | null }[]> = {};
      if (clientIds.length > 0) {
        const { data: allClientContracts } = await supabase
          .from("client_contracts")
          .select("id, client_id, product_id, start_date, end_date, status")
          .eq("account_id", currentUser.account_id)
          .in("client_id", clientIds)
          .eq("status", "active");
        (allClientContracts || []).forEach((cc: any) => {
          if (!successorMap[cc.client_id]) successorMap[cc.client_id] = [];
          successorMap[cc.client_id].push({ id: cc.id, start_date: cc.start_date, product_id: cc.product_id });
        });
      }

      const hasSuccessor = (c: any): boolean => {
        const peers = successorMap[c.client_id] || [];
        const oldEnd = parseLocalDate(c.end_date);
        if (!oldEnd) return false;
        // window: successor starts within [oldEnd - 30d, oldEnd + 365d]
        const windowStart = new Date(oldEnd); windowStart.setDate(windowStart.getDate() - 30);
        const windowEnd = new Date(oldEnd); windowEnd.setDate(windowEnd.getDate() + 365);
        return peers.some(p => {
          if (p.id === c.id) return false;
          if (c.product_id && p.product_id && p.product_id !== c.product_id) return false;
          const start = parseLocalDate(p.start_date);
          if (!start) return false;
          return start >= windowStart && start <= windowEnd;
        });
      };

      const dedupedFiltered = deduped.filter((c: any) => !hasSuccessor(c));

      // Fetch all outcomes for these contracts to know which are already resolved
      const allContractIds = dedupedFiltered.map((c: any) => c.id);
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
      const pendingContracts = dedupedFiltered.filter((c: any) => {
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

  // Helpers para mapear contrato → categorias dos filtros
  const tempoCategory = (days: number): string | null => {
    if (days <= 30) return "urgent";
    if (days <= 60) return "warning";
    if (days <= 90) return "ok";
    return "later";
  };
  const chanceCategory = (score: number | undefined): string | null => {
    if (score === undefined) return null;
    if (score >= 70) return "alta";
    if (score >= 40) return "media";
    return "baixa";
  };

  const filtered = contracts.filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !c.client_name.toLowerCase().includes(q) &&
        !c.client_email?.toLowerCase().includes(q) &&
        !c.product_name?.toLowerCase().includes(q)
      ) return false;
    }
    if (filterConsultora.length > 0) {
      const cn = c.responsible_name || "Sem consultor";
      if (!filterConsultora.includes(cn)) return false;
    }
    if (filterProduto.length > 0) {
      const pn = c.product_name || "Sem produto";
      if (!filterProduto.includes(pn)) return false;
    }
    if (filterTempo.length > 0) {
      const cat = tempoCategory(c.days_until_expiry);
      const year = c.end_date ? new Date(c.end_date).getUTCFullYear() : 0;
      const matchesYear2026 = filterTempo.includes("year2026") && year === 2026;
      const matchesCat = cat ? filterTempo.includes(cat) : false;
      if (!matchesCat && !matchesYear2026) return false;
    }
    if (filterChance.length > 0) {
      const score = chanceScores[c.client_id];
      if (score === undefined) {
        // ainda carregando — manter visível
      } else {
        const cat = chanceCategory(score);
        if (!cat || !filterChance.includes(cat)) return false;
      }
    }
    if (filterStatus.length > 0) {
      const currentOutcome = outcomeMap[c.id]?.outcome || "pending";
      if (!filterStatus.includes(currentOutcome)) return false;
    }
    if (filterQuarter.length > 0 && c.end_date) {
      const month = new Date(c.end_date).getUTCMonth() + 1;
      const q = Math.ceil(month / 3);
      if (!filterQuarter.includes(`Q${q}`)) return false;
    }
    return true;
  });

  const filteredUpcoming = filtered.filter((c) => c.days_until_expiry >= 0);

  // Aba "Vencidos" usa filtros próprios (independentes de "A Vencer")
  const filteredExpired = contracts.filter((c) => {
    if (c.days_until_expiry >= 0) return false;
    // Apenas vencimentos de 2026
    const expYear = c.end_date ? new Date(c.end_date).getUTCFullYear() : 0;
    if (expYear !== 2026) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !c.client_name.toLowerCase().includes(q) &&
        !c.client_email?.toLowerCase().includes(q) &&
        !c.product_name?.toLowerCase().includes(q)
      ) return false;
    }
    if (expiredFilterConsultora.length > 0 && (!c.responsible_name || !expiredFilterConsultora.includes(c.responsible_name))) return false;
    if (expiredFilterProduto.length > 0 && (!c.product_name || !expiredFilterProduto.includes(c.product_name))) return false;
    if (expiredFilterChance.length > 0) {
      const score = chanceScores[c.client_id];
      if (score !== undefined) {
        const cat = chanceCategory(score);
        if (!cat || !expiredFilterChance.includes(cat)) return false;
      }
    }
    if (expiredFilterAno.length > 0) {
      const year = c.end_date ? new Date(c.end_date).getUTCFullYear().toString() : "";
      if (!expiredFilterAno.includes(year)) return false;
    }
    return true;
  });

  const expiredUniqueConsultoras = [...new Set(
    contracts.filter(c => c.days_until_expiry < 0).map(c => c.responsible_name).filter(Boolean)
  )] as string[];
  const expiredUniqueProdutos = [...new Set(
    contracts.filter(c => c.days_until_expiry < 0).map(c => c.product_name).filter(Boolean)
  )] as string[];

  const urgentCount = filteredUpcoming.filter((c) => c.days_until_expiry <= 30).length;
  const warningCount = filteredUpcoming.filter((c) => c.days_until_expiry > 30 && c.days_until_expiry <= 60).length;
  const okCount = filteredUpcoming.filter((c) => c.days_until_expiry > 60).length;
  const totalRenewalValue = filteredUpcoming.reduce((sum, c) => sum + c.renewal_value, 0);
  const totalExpiredValue = filteredExpired.reduce((sum, c) => sum + c.renewal_value, 0);

  const getUrgencyBadge = (days: number) => {
    if (days < 0) {
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 gap-1">
          <CalendarX className="h-3 w-3" />
          Vencido há {Math.abs(days)} dias
        </Badge>
      );
    }
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

  const renderContractsTable = (
    list: RenewalContract[],
    emptyTitle: string,
    emptySubtitle: string,
    page: number,
    setPage: (p: number) => void,
  ) => {
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CalendarDays className="h-10 w-10 mb-3 opacity-50" />
            <p className="font-medium">{emptyTitle}</p>
            <p className="text-sm">{emptySubtitle}</p>
          </div>
        ) : (
          <Table className="table-fixed lg:table-auto">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[190px] px-2 lg:w-[220px]">Cliente</TableHead>
                <TableHead className="hidden xl:table-cell text-center">Consultora</TableHead>
                <TableHead className="hidden xl:table-cell text-center">Produto</TableHead>
                <TableHead className="text-center px-2">Valor Renovação</TableHead>
                <TableHead className="hidden 2xl:table-cell text-center">Início</TableHead>
                <TableHead className="text-center px-2">Vencimento</TableHead>
                <TableHead className="hidden xl:table-cell text-center">Tempo Restante</TableHead>
                <TableHead className="text-center px-2">Status</TableHead>
                <TableHead className="hidden xl:table-cell text-center">Chance</TableHead>
                <TableHead className="w-[40px] px-2"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((contract) => (
                <TableRow key={contract.id} className="group">
                  <TableCell className="px-2">
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
                        <p className="text-sm font-medium break-words whitespace-normal max-w-[180px] lg:max-w-[210px]">{contract.client_name}</p>
                        {contract.client_email && (
                          <p className="text-xs text-muted-foreground truncate">{contract.client_email}</p>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-center text-sm text-muted-foreground">
                    {contract.responsible_name || "—"}
                  </TableCell>
                  <TableCell className="text-center min-w-0">
                    {contract.product_name ? (
                      <Badge
                        variant="outline"
                        className="max-w-[130px] truncate text-xs"
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
                  <TableCell className="text-center text-sm font-medium whitespace-nowrap">
                    {formatCurrency(contract.renewal_value, contract.currency)}
                  </TableCell>
                  <TableCell className="hidden 2xl:table-cell text-center text-sm text-muted-foreground">
                    {formatLocalDate(contract.start_date)}
                  </TableCell>
                  <TableCell className="text-center text-sm font-medium whitespace-nowrap">
                    {formatLocalDate(contract.end_date)}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {getUrgencyBadge(contract.days_until_expiry)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Select
                      value={outcomeMap[contract.id]?.outcome || "pending"}
                      onValueChange={(val) => handleOutcomeChange(contract, val)}
                    >
                      <SelectTrigger className={cn(
                        "h-8 w-[128px] text-xs mx-auto",
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
                  <TableCell className="hidden xl:table-cell text-center">
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
      {!loading && list.length > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t">
          <p className="text-xs text-muted-foreground">
            Mostrando {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, list.length)} de {list.length}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {safePage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </Card>
    );
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden p-4 md:p-6 space-y-6 mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Renovações</h1>
          <p className="text-sm text-muted-foreground">
            Contratos a vencer até o fim de 2026
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRenewals} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="pending" className="space-y-6 min-w-0">
        <TabsList className="w-full max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="pending" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            A Vencer ({filteredUpcoming.length})
          </TabsTrigger>
          <TabsTrigger value="expired" className="gap-2">
            <CalendarX className="h-4 w-4" />
            Vencidos ({filteredExpired.length})
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-2">
            <TrendingDown className="h-4 w-4" />
            Resultados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold truncate">{formatCurrency(totalRenewalValue, "BRL")}</p>
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

          {/* Breakdown by Consultora */}
          {(() => {
            const byConsultora = new Map<string, number>();
            const byProduto = new Map<string, number>();
            for (const c of filteredUpcoming) {
              const cn = c.responsible_name || "Sem consultor";
              byConsultora.set(cn, (byConsultora.get(cn) || 0) + 1);
              const pn = c.product_name || "Sem produto";
              byProduto.set(pn, (byProduto.get(pn) || 0) + 1);
            }
            const consultoras = Array.from(byConsultora.entries()).sort((a, b) => b[1] - a[1]);
            const produtos = Array.from(byProduto.entries()).sort((a, b) => b[1] - a[1]);
            return (
              <div className="space-y-4">
                {consultoras.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Por Consultor ({consultoras.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {consultoras.map(([name, count]) => {
                        const active = filterConsultora.includes(name);
                        return (
                          <Card
                            key={name}
                            onClick={() =>
                              setFilterConsultora((prev) =>
                                prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
                              )
                            }
                            className={cn(
                              "cursor-pointer transition-colors hover:border-primary/50",
                              active && "border-primary bg-primary/5 ring-1 ring-primary",
                            )}
                          >
                            <CardContent className="p-3">
                              <p className="text-xs text-muted-foreground truncate" title={name}>{name}</p>
                              <p className="text-xl font-bold">{count} <span className="text-xs font-normal text-muted-foreground">renovaç{count === 1 ? "ão" : "ões"}</span></p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
                {produtos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Por Produto ({produtos.length})
                    </p>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),260px))] justify-center gap-3 auto-rows-fr">
                      {produtos.map(([name, count]) => {
                        const active = filterProduto.includes(name);
                        return (
                          <Card
                            key={name}
                            onClick={() =>
                              setFilterProduto((prev) =>
                                prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
                              )
                            }
                            className={cn(
                              "cursor-pointer transition-colors hover:border-primary/50 h-full",
                              active && "border-primary bg-primary/5 ring-1 ring-primary",
                            )}
                          >
                            <CardContent className="p-3 h-full flex flex-col justify-center">
                              <p className="text-xs text-muted-foreground truncate" title={name}>{name}</p>
                              <p className="text-xl font-bold">{count} <span className="text-xs font-normal text-muted-foreground">renovaç{count === 1 ? "ão" : "ões"}</span></p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <MultiSelectFilter
              label="Prazo"
              width="w-full sm:w-[200px]"
              selected={filterTempo}
              onChange={setFilterTempo}
              options={[
                { value: "urgent", label: "Até 30 dias" },
                { value: "warning", label: "31 a 60 dias" },
                { value: "ok", label: "61 a 90 dias" },
                { value: "later", label: "Mais de 90 dias" },
                { value: "year2026", label: "Vencimento em 2026" },
              ]}
            />
            <MultiSelectFilter
              label="Chance"
              width="w-full sm:w-[150px]"
              selected={filterChance}
              onChange={setFilterChance}
              options={[
                { value: "alta", label: "Alta" },
                { value: "media", label: "Média" },
                { value: "baixa", label: "Baixa" },
              ]}
            />
            <MultiSelectFilter
              label="Quarter"
              width="w-full sm:w-[150px]"
              selected={filterQuarter}
              onChange={setFilterQuarter}
              options={[
                { value: "Q1", label: "Q1" },
                { value: "Q2", label: "Q2" },
                { value: "Q3", label: "Q3" },
                { value: "Q4", label: "Q4" },
              ]}
            />
            <MultiSelectFilter
              label="Status"
              width="w-full sm:w-[180px]"
              selected={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: "pending", label: "Pendente" },
                { value: "negotiating", label: "Em Negociação" },
              ]}
            />
            {(filterConsultora.length > 0 ||
              filterProduto.length > 0 ||
              filterTempo.length > 0 ||
              filterChance.length > 0 ||
              filterStatus.length > 0 ||
              filterQuarter.length > 0 ||
              searchQuery.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterConsultora([]);
                  setFilterProduto([]);
                  setFilterTempo([]);
                  setFilterChance([]);
                  setFilterStatus([]);
                  setFilterQuarter([]);
                  setSearchQuery("");
                }}
                className="self-end h-10"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Table */}
          {renderContractsTable(
            filteredUpcoming,
            "Nenhum contrato a vencer até o fim de 2026",
            "Todos os contratos estão com vencimento distante.",
            upcomingPage,
            setUpcomingPage,
          )}
        </TabsContent>

        <TabsContent value="expired" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <CalendarX className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{filteredExpired.length}</p>
                  <p className="text-xs text-muted-foreground">Contratos vencidos pendentes</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(totalExpiredValue, "BRL")}</p>
                  <p className="text-xs text-muted-foreground">Valor potencial em vencidos</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <MultiSelectFilter
              label="Produto"
              width="w-full sm:w-[180px]"
              selected={expiredFilterProduto}
              onChange={setExpiredFilterProduto}
              options={expiredUniqueProdutos.sort().map((n) => ({ value: n, label: n }))}
            />
            <MultiSelectFilter
              label="Consultora"
              width="w-full sm:w-[180px]"
              selected={expiredFilterConsultora}
              onChange={setExpiredFilterConsultora}
              options={expiredUniqueConsultoras.sort().map((n) => ({ value: n, label: n }))}
            />
            <MultiSelectFilter
              label="Chance"
              width="w-full sm:w-[150px]"
              selected={expiredFilterChance}
              onChange={setExpiredFilterChance}
              options={[
                { value: "alta", label: "Alta" },
                { value: "media", label: "Média" },
                { value: "baixa", label: "Baixa" },
              ]}
            />
            <MultiSelectFilter
              label="Ano"
              width="w-full sm:w-[140px]"
              selected={expiredFilterAno}
              onChange={setExpiredFilterAno}
              options={[
                { value: "2025", label: "2025" },
                { value: "2026", label: "2026" },
              ]}
            />
          </div>

          {renderContractsTable(
            filteredExpired,
            "Nenhum contrato vencido pendente",
            "Todos os contratos vencidos já foram resolvidos.",
            expiredPage,
            setExpiredPage,
          )}
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
