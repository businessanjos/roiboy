import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, format, isBefore, addYears, differenceInDays } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";

interface ClientBasic {
  id: string;
  full_name: string;
  phone_e164: string;
  status: string;
  product_ids?: string[];
  hasActiveContract?: boolean;
}

interface Product {
  id: string;
  name: string;
}

interface LifeEvent {
  id: string;
  client_id: string;
  client_name: string;
  event_type: string;
  title: string;
  event_date: string | null;
  is_recurring: boolean;
  source: string;
  daysUntil?: number;
  nextDate?: Date;
}

interface ContractData {
  id: string;
  status: string;
  status_changed_at: string | null;
  cancelled_at: string | null;
  start_date: string;
  end_date: string | null;
  value: number;
  client_id: string;
  product_id: string | null;
  cancellation_reason: string | null;
  cancellation_justification: string | null;
}

// Fetch all products
export function useProducts() {
  return useQuery({
    queryKey: ["dashboard-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return (data || []) as Product[];
    },
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
  });
}

// Helper: fetch all rows with automatic pagination (bypasses 1000-row limit)
async function fetchAllPaginated<T>(
  queryBuilder: () => any,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await queryBuilder().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    hasMore = data.length === pageSize;
    from += pageSize;
  }
  return all;
}

// Fetch all clients with active/pending contracts
// Optimized: uses paginated fetches and batched IN queries (max 200 per batch)
export function useClientsWithScores() {
  return useQuery({
    queryKey: ["dashboard-clients-optimized"],
    queryFn: async () => {
      // Step 1: Get ALL contract client_ids with pagination
      const contractsData = await fetchAllPaginated<{ client_id: string; status: string }>(
        () => supabase.from("client_contracts").select("client_id, status").in("status", ["active", "pending"]),
      );
      
      const clientIdsWithContracts = [...new Set(contractsData.map(c => c.client_id))];
      if (clientIdsWithContracts.length === 0) return [];

      // Step 2: Fetch clients in batches of 200 to avoid huge URL params
      const BATCH_SIZE = 200;
      const clientBatches: ClientBasic[][] = [];
      
      for (let i = 0; i < clientIdsWithContracts.length; i += BATCH_SIZE) {
        const batch = clientIdsWithContracts.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
          .from("clients")
          .select("id, full_name, phone_e164, status")
          .in("id", batch)
          .order("full_name", { ascending: true });
        if (error) throw error;
        if (data) clientBatches.push(data as ClientBasic[]);
      }
      
      const clientsData = clientBatches.flat();
      if (clientsData.length === 0) return [];

      const clientIds = clientsData.map(c => c.id);

      // Step 3: Fetch products and active contracts in batches too
      const productPromises: Promise<any[]>[] = [];
      const activeContractPromises: Promise<any[]>[] = [];
      
      for (let i = 0; i < clientIds.length; i += BATCH_SIZE) {
        const batch = clientIds.slice(i, i + BATCH_SIZE);
        productPromises.push(
          (async () => { const { data } = await supabase.from("client_products").select("client_id, product_id").in("client_id", batch); return data || []; })()
        );
        activeContractPromises.push(
          (async () => { const { data } = await supabase.from("client_contracts").select("client_id").eq("status", "active").in("client_id", batch); return data || []; })()
        );
      }

      const [productResults, activeResults] = await Promise.all([
        Promise.all(productPromises),
        Promise.all(activeContractPromises),
      ]);

      const clientProductsMap: Record<string, string[]> = {};
      productResults.flat().forEach((cp: any) => {
        if (!clientProductsMap[cp.client_id]) clientProductsMap[cp.client_id] = [];
        clientProductsMap[cp.client_id].push(cp.product_id);
      });

      const activeContractsSet = new Set(activeResults.flat().map((c: any) => c.client_id));

      const clients: ClientBasic[] = clientsData.map((client) => ({
        id: client.id,
        full_name: client.full_name,
        phone_e164: client.phone_e164,
        status: client.status,
        product_ids: clientProductsMap[client.id] || [],
        hasActiveContract: activeContractsSet.has(client.id),
      }));

      return clients;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  });
}

// Fetch upcoming life events
export function useUpcomingLifeEvents() {
  return useQuery({
    queryKey: ["dashboard-life-events"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayStr = format(today, "yyyy-MM-dd");
      const in30Days = format(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
      
      const { data: eventsData, error } = await supabase
        .from("client_life_events")
        .select("id, client_id, event_type, title, event_date, is_recurring, source, clients!inner(full_name)")
        .not("event_date", "is", null)
        .or(`and(is_recurring.eq.false,event_date.gte.${todayStr},event_date.lte.${in30Days}),is_recurring.eq.true`)
        .order("event_date", { ascending: true })
        .limit(200);

      if (error) throw error;

      const upcoming = (eventsData || [])
        .map((event: any) => {
          const eventDate = parseLocalDate(event.event_date)!;
          let nextDate = new Date(eventDate);
          
          if (event.is_recurring) {
            nextDate.setFullYear(today.getFullYear());
            if (isBefore(nextDate, today)) {
              nextDate = addYears(nextDate, 1);
            }
          }
          
          const daysUntil = differenceInDays(nextDate, today);
          
          return {
            ...event,
            client_name: event.clients?.full_name || "Cliente",
            daysUntil,
            nextDate,
          };
        })
        .filter((e: any) => e.daysUntil >= 0 && e.daysUntil <= 30)
        .sort((a: any, b: any) => a.daysUntil - b.daysUntil)
        .slice(0, 10);

      return upcoming as LifeEvent[];
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 20,
  });
}

// Fetch contract data for charts
export function useContractData() {
  return useQuery({
    queryKey: ["dashboard-contracts"],
    queryFn: async () => {
      const twelveMonthsAgo = subMonths(new Date(), 12);
      
      const { data, error } = await supabase
        .from("client_contracts")
        .select("id, status, status_changed_at, cancelled_at, start_date, value, client_id")
        .or(`start_date.gte.${format(twelveMonthsAgo, "yyyy-MM-dd")},status_changed_at.gte.${twelveMonthsAgo.toISOString()},cancelled_at.gte.${twelveMonthsAgo.toISOString()}`)
        .order("start_date", { ascending: true });

      if (error) throw error;
      return (data || []) as ContractData[];
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 20,
  });
}

// Combined hook for all dashboard data
export function useDashboardData() {
  const productsQuery = useProducts();
  const clientsQuery = useClientsWithScores();
  const lifeEventsQuery = useUpcomingLifeEvents();
  const contractsQuery = useContractData();

  const isLoading = 
    productsQuery.isLoading || 
    clientsQuery.isLoading || 
    lifeEventsQuery.isLoading || 
    contractsQuery.isLoading;

  const refetchAll = () => {
    productsQuery.refetch();
    clientsQuery.refetch();
    lifeEventsQuery.refetch();
    contractsQuery.refetch();
  };

  return {
    products: productsQuery.data || [],
    clients: clientsQuery.data || [],
    upcomingEvents: lifeEventsQuery.data || [],
    contractData: contractsQuery.data || [],
    isLoading,
    refetchAll,
  };
}
