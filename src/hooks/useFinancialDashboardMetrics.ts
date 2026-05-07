import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { addMonths, format, startOfMonth, endOfMonth, subMonths, differenceInDays } from "date-fns";

export interface FinancialEntryRow {
  id: string;
  amount: number;
  status: string;
  due_date: string;
  payment_date: string | null;
  entry_type: string;
  client_id: string | null;
  bank_account_id: string | null;
  category_id: string | null;
}

export interface ContractRow {
  id: string;
  status: string;
  value: number;
  start_date: string;
  end_date: string | null;
  client_id: string;
  product_id: string | null;
}

export interface ClientLite { id: string; full_name: string; logo_url: string | null }
export interface ProductLite { id: string; name: string; color: string | null }

async function fetchAllPaginated<T>(builder: () => any, pageSize = 1000): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await builder().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export function useFinancialDashboardMetrics() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  return useQuery({
    enabled: !!accountId,
    queryKey: ["financial-dashboard-metrics", accountId],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      // ---- pull data in parallel
      const [entries, contracts, clients, products] = await Promise.all([
        fetchAllPaginated<FinancialEntryRow>(() =>
          supabase
            .from("financial_entries")
            .select("id, amount, status, due_date, payment_date, entry_type, client_id, bank_account_id, category_id")
            .eq("account_id", accountId)
        ),
        fetchAllPaginated<ContractRow>(() =>
          supabase
            .from("client_contracts")
            .select("id, status, value, start_date, end_date, client_id, product_id")
            .eq("account_id", accountId)
        ),
        fetchAllPaginated<ClientLite>(() =>
          supabase.from("clients").select("id, full_name, logo_url").eq("account_id", accountId)
        ),
        fetchAllPaginated<ProductLite>(() =>
          supabase.from("products").select("id, name, color").eq("account_id", accountId)
        ),
      ]);

      const clientMap = new Map(clients.map((c) => [c.id, c]));
      const productMap = new Map(products.map((p) => [p.id, p]));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      // ===== KPIs
      const receivables = entries.filter((e) => e.entry_type === "receivable");
      const payables = entries.filter((e) => e.entry_type === "payable");

      const isOpen = (s: string) => ["pending", "overdue", "partially_paid"].includes(s);

      const totalOpen = receivables.filter((e) => isOpen(e.status)).reduce((s, e) => s + Number(e.amount || 0), 0);
      const totalOverdue = receivables
        .filter((e) => isOpen(e.status) && new Date(e.due_date) < today)
        .reduce((s, e) => s + Number(e.amount || 0), 0);

      const receivedThisMonth = receivables
        .filter((e) => e.status === "paid" && e.payment_date && new Date(e.payment_date) >= monthStart && new Date(e.payment_date) <= monthEnd)
        .reduce((s, e) => s + Number(e.amount || 0), 0);

      const expectedThisMonth = receivables
        .filter((e) => new Date(e.due_date) >= monthStart && new Date(e.due_date) <= monthEnd)
        .reduce((s, e) => s + Number(e.amount || 0), 0);

      const paidThisMonthCount = receivables.filter((e) => e.status === "paid" && e.payment_date && new Date(e.payment_date) >= monthStart && new Date(e.payment_date) <= monthEnd).length;
      const expectedCountThisMonth = receivables.filter((e) => new Date(e.due_date) >= monthStart && new Date(e.due_date) <= monthEnd).length;

      const payablesThisMonth = payables
        .filter((e) => new Date(e.due_date) >= monthStart && new Date(e.due_date) <= monthEnd)
        .reduce((s, e) => s + Number(e.amount || 0), 0);

      // MRR from active contracts (value spread over contract months)
      const activeContracts = contracts.filter((c) => c.status === "active");
      const mrr = activeContracts.reduce((sum, c) => {
        const start = new Date(c.start_date);
        const end = c.end_date ? new Date(c.end_date) : addMonths(start, 12);
        const months = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
        return sum + Number(c.value || 0) / months;
      }, 0);

      const arr = mrr * 12;

      const ticketMedio = activeContracts.length > 0 ? activeContracts.reduce((s, c) => s + Number(c.value || 0), 0) / activeContracts.length : 0;

      // ===== Forecast 12 months (receivables pending, by due_date)
      const forecast: { month: string; label: string; expected: number; received: number }[] = [];
      for (let i = 0; i < 12; i++) {
        const d = addMonths(monthStart, i);
        const ms = startOfMonth(d);
        const me = endOfMonth(d);
        const expected = receivables
          .filter((e) => new Date(e.due_date) >= ms && new Date(e.due_date) <= me)
          .reduce((s, e) => s + Number(e.amount || 0), 0);
        const received = receivables
          .filter((e) => e.status === "paid" && e.payment_date && new Date(e.payment_date) >= ms && new Date(e.payment_date) <= me)
          .reduce((s, e) => s + Number(e.amount || 0), 0);
        forecast.push({
          month: format(d, "yyyy-MM"),
          label: format(d, "MMM/yy"),
          expected,
          received,
        });
      }

      // ===== Histórico 6 meses (Recebido vs Previsto)
      const history: { month: string; label: string; expected: number; received: number }[] = [];
      for (let i = 6; i >= 1; i--) {
        const d = subMonths(monthStart, i);
        const ms = startOfMonth(d);
        const me = endOfMonth(d);
        const expected = receivables
          .filter((e) => new Date(e.due_date) >= ms && new Date(e.due_date) <= me)
          .reduce((s, e) => s + Number(e.amount || 0), 0);
        const received = receivables
          .filter((e) => e.status === "paid" && e.payment_date && new Date(e.payment_date) >= ms && new Date(e.payment_date) <= me)
          .reduce((s, e) => s + Number(e.amount || 0), 0);
        history.push({ month: format(d, "yyyy-MM"), label: format(d, "MMM/yy"), expected, received });
      }

      // ===== Aging (overdue buckets)
      const aging = { d_0_30: 0, d_31_60: 0, d_61_90: 0, d_90_plus: 0 };
      const agingCount = { d_0_30: 0, d_31_60: 0, d_61_90: 0, d_90_plus: 0 };
      receivables
        .filter((e) => isOpen(e.status) && new Date(e.due_date) < today)
        .forEach((e) => {
          const days = differenceInDays(today, new Date(e.due_date));
          const amt = Number(e.amount || 0);
          if (days <= 30) { aging.d_0_30 += amt; agingCount.d_0_30 += 1; }
          else if (days <= 60) { aging.d_31_60 += amt; agingCount.d_31_60 += 1; }
          else if (days <= 90) { aging.d_61_90 += amt; agingCount.d_61_90 += 1; }
          else { aging.d_90_plus += amt; agingCount.d_90_plus += 1; }
        });

      // ===== Contratos por status
      const contractStatus: Record<string, { count: number; value: number }> = {};
      contracts.forEach((c) => {
        const k = c.status || "unknown";
        if (!contractStatus[k]) contractStatus[k] = { count: 0, value: 0 };
        contractStatus[k].count += 1;
        contractStatus[k].value += Number(c.value || 0);
      });

      // ===== Top inadimplentes
      const debtorMap = new Map<string, { client: ClientLite | null; total: number; count: number; oldest: number }>();
      receivables
        .filter((e) => isOpen(e.status) && new Date(e.due_date) < today && e.client_id)
        .forEach((e) => {
          const cid = e.client_id!;
          const days = differenceInDays(today, new Date(e.due_date));
          if (!debtorMap.has(cid)) debtorMap.set(cid, { client: clientMap.get(cid) || null, total: 0, count: 0, oldest: 0 });
          const cur = debtorMap.get(cid)!;
          cur.total += Number(e.amount || 0);
          cur.count += 1;
          cur.oldest = Math.max(cur.oldest, days);
        });
      const topDebtors = [...debtorMap.values()].sort((a, b) => b.total - a.total).slice(0, 8);

      // ===== Próximos vencimentos (7 dias)
      const next7End = addMonths(today, 0);
      next7End.setDate(today.getDate() + 7);
      const upcoming = receivables
        .filter((e) => isOpen(e.status) && new Date(e.due_date) >= today && new Date(e.due_date) <= next7End)
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 10)
        .map((e) => ({
          id: e.id,
          amount: Number(e.amount || 0),
          due_date: e.due_date,
          client: e.client_id ? clientMap.get(e.client_id) || null : null,
        }));

      // ===== Receita por produto (active contracts MRR distribution)
      const productRevenue = new Map<string, { product: ProductLite | null; total: number; count: number }>();
      activeContracts.forEach((c) => {
        const key = c.product_id || "none";
        if (!productRevenue.has(key)) {
          productRevenue.set(key, { product: c.product_id ? productMap.get(c.product_id) || null : null, total: 0, count: 0 });
        }
        const cur = productRevenue.get(key)!;
        cur.total += Number(c.value || 0);
        cur.count += 1;
      });
      const productBreakdown = [...productRevenue.values()].sort((a, b) => b.total - a.total);

      const collectionRate = expectedThisMonth > 0 ? (receivedThisMonth / expectedThisMonth) * 100 : 0;

      return {
        kpis: {
          mrr,
          arr,
          totalOpen,
          totalOverdue,
          receivedThisMonth,
          expectedThisMonth,
          paidThisMonthCount,
          expectedCountThisMonth,
          payablesThisMonth,
          ticketMedio,
          collectionRate,
          activeContractsCount: activeContracts.length,
          totalContracts: contracts.length,
        },
        forecast,
        history,
        aging,
        agingCount,
        contractStatus,
        topDebtors,
        upcoming,
        productBreakdown,
      };
    },
  });
}
