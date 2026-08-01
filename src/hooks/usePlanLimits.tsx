import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

export type ResourceType = "clients" | "users" | "events" | "products" | "forms" | "ai_analyses" | "whatsapp_connections";

interface PlanLimits {
  max_clients: number;
  max_users: number;
  max_events: number;
  max_products: number;
  max_forms: number;
  max_ai_analyses: number;
  max_storage_mb: number;
  max_whatsapp_connections: number;
}

interface PlanUsage {
  clients: number;
  users: number;
  events: number;
  products: number;
  forms: number;
  ai_analyses: number;
  whatsapp_connections: number;
}

interface PlanFeatures {
  ai_analysis?: boolean;
  all_features?: boolean;
  custom_fields?: boolean;
  events?: boolean;
  forms?: boolean;
  live_tracking?: boolean;
  reports?: boolean;
  whatsapp_integration?: boolean;
  [key: string]: boolean | undefined;
}

interface PlanLimitsData {
  account_id: string;
  plan_id: string | null;
  plan_name: string;
  limits: PlanLimits;
  usage: PlanUsage;
  features: PlanFeatures;
}

interface PlanLimitsContextType {
  data: PlanLimitsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  canCreate: (resource: ResourceType) => boolean;
  getRemainingQuota: (resource: ResourceType) => number;
  getUsagePercentage: (resource: ResourceType) => number;
  isNearLimit: (resource: ResourceType, threshold?: number) => boolean;
  hasFeature: (feature: string) => boolean;
}

const PlanLimitsContext = createContext<PlanLimitsContextType | undefined>(undefined);

// Default limits for trial accounts
const DEFAULT_LIMITS: PlanLimits = {
  max_clients: 50,
  max_users: 3,
  max_events: 10,
  max_products: 20,
  max_forms: 5,
  max_ai_analyses: 100,
  max_storage_mb: 500,
  max_whatsapp_connections: 1,
};

const RESOURCE_LIMIT_MAP: Record<ResourceType, keyof PlanLimits> = {
  clients: "max_clients",
  users: "max_users",
  events: "max_events",
  products: "max_products",
  forms: "max_forms",
  ai_analyses: "max_ai_analyses",
  whatsapp_connections: "max_whatsapp_connections",
};

export function PlanLimitsProvider({ children }: { children: ReactNode }) {
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [data, setData] = useState<PlanLimitsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);
  const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache

  const dataRef = useRef<PlanLimitsData | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const fetchLimits = useCallback(async (force = false) => {
    if (!currentUser) {
      setData(null);
      setLoading(false);
      return;
    }

    // Skip if cached data is fresh (unless forced)
    const now = Date.now();
    if (!force && dataRef.current && now - lastFetchRef.current < CACHE_DURATION_MS) {
      setLoading(false);
      return;
    }

    // Dedupe concurrent calls (multiple consumers mounting at once)
    if (inFlightRef.current) return inFlightRef.current;

    const run = (async () => {
      try {
        setError(null);

        // Single round-trip: plan + limits + usage counters are computed server-side
        const { data: rpcData, error: rpcError } = await supabase.rpc("get_account_limits");
        if (rpcError) throw rpcError;

        const payload = (rpcData || {}) as any;
        if (payload.error) throw new Error(payload.error);

        const next: PlanLimitsData = {
          account_id: payload.account_id ?? currentUser.account_id,
          plan_id: payload.plan_id ?? null,
          plan_name: payload.plan_name ?? "Trial",
          limits: { ...DEFAULT_LIMITS, ...(payload.limits || {}) },
          usage: {
            clients: payload.usage?.clients ?? 0,
            users: payload.usage?.users ?? 0,
            events: payload.usage?.events ?? 0,
            products: payload.usage?.products ?? 0,
            forms: payload.usage?.forms ?? 0,
            ai_analyses: payload.usage?.ai_analyses ?? 0,
            whatsapp_connections: payload.usage?.whatsapp_connections ?? 0,
          },
          features: (payload.features || {}) as PlanFeatures,
        };

        lastFetchRef.current = Date.now();
        dataRef.current = next;
        setData(next);
      } catch (err) {
        console.error("Error fetching plan limits:", err);
        setError(err instanceof Error ? err.message : "Error fetching plan limits");
      } finally {
        setLoading(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;
    return run;
  }, [currentUser]);


  useEffect(() => {
    if (!userLoading) {
      fetchLimits();
    }
  }, [fetchLimits, userLoading]);

  const canCreate = useCallback(
    (resource: ResourceType): boolean => {
      if (!data) return true; // Allow if no data yet
      const limitKey = RESOURCE_LIMIT_MAP[resource];
      const limit = data.limits[limitKey];
      const usage = data.usage[resource];
      return usage < limit;
    },
    [data]
  );

  const getRemainingQuota = useCallback(
    (resource: ResourceType): number => {
      if (!data) return 0;
      const limitKey = RESOURCE_LIMIT_MAP[resource];
      const limit = data.limits[limitKey];
      const usage = data.usage[resource];
      return Math.max(0, limit - usage);
    },
    [data]
  );

  const getUsagePercentage = useCallback(
    (resource: ResourceType): number => {
      if (!data) return 0;
      const limitKey = RESOURCE_LIMIT_MAP[resource];
      const limit = data.limits[limitKey];
      const usage = data.usage[resource];
      if (limit === 0) return 100;
      return Math.min(100, Math.round((usage / limit) * 100));
    },
    [data]
  );

  const isNearLimit = useCallback(
    (resource: ResourceType, threshold = 80): boolean => {
      return getUsagePercentage(resource) >= threshold;
    },
    [getUsagePercentage]
  );

  const hasFeature = useCallback(
    (feature: string): boolean => {
      if (!data) return true; // Allow if no data yet
      // If all_features is true, allow everything
      if (data.features.all_features) return true;
      return data.features[feature] === true;
    },
    [data]
  );

  return (
    <PlanLimitsContext.Provider
      value={{
        data,
        loading: loading || userLoading,
        error,
        refetch: fetchLimits,
        canCreate,
        getRemainingQuota,
        getUsagePercentage,
        isNearLimit,
        hasFeature,
      }}
    >
      {children}
    </PlanLimitsContext.Provider>
  );
}

export function usePlanLimits() {
  const context = useContext(PlanLimitsContext);
  if (context === undefined) {
    throw new Error("usePlanLimits must be used within a PlanLimitsProvider");
  }
  return context;
}
