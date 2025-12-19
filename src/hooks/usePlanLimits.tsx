import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

export type ResourceType = "clients" | "users" | "events" | "products" | "forms" | "ai_analyses";

interface PlanLimits {
  max_clients: number;
  max_users: number;
  max_events: number;
  max_products: number;
  max_forms: number;
  max_ai_analyses: number;
  max_storage_mb: number;
}

interface PlanUsage {
  clients: number;
  users: number;
  events: number;
  products: number;
  forms: number;
  ai_analyses: number;
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
};

const RESOURCE_LIMIT_MAP: Record<ResourceType, keyof PlanLimits> = {
  clients: "max_clients",
  users: "max_users",
  events: "max_events",
  products: "max_products",
  forms: "max_forms",
  ai_analyses: "max_ai_analyses",
};

export function PlanLimitsProvider({ children }: { children: ReactNode }) {
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [data, setData] = useState<PlanLimitsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLimits = useCallback(async () => {
    if (!currentUser) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);

      // Get account info with plan
      const { data: accountData, error: accountError } = await supabase
        .from("accounts")
        .select("id, plan_id, subscription_status")
        .eq("id", currentUser.account_id)
        .single();

      if (accountError) throw accountError;

      let planLimits = DEFAULT_LIMITS;
      let planName = "Trial";
      let planFeatures: PlanFeatures = {};

      // If has a plan, get the plan limits
      if (accountData.plan_id) {
        const { data: planData, error: planError } = await supabase
          .from("subscription_plans")
          .select("*")
          .eq("id", accountData.plan_id)
          .single();

        if (!planError && planData) {
          planName = planData.name;
          planLimits = {
            max_clients: planData.max_clients ?? DEFAULT_LIMITS.max_clients,
            max_users: planData.max_users ?? DEFAULT_LIMITS.max_users,
            max_events: planData.max_events ?? DEFAULT_LIMITS.max_events,
            max_products: planData.max_products ?? DEFAULT_LIMITS.max_products,
            max_forms: planData.max_forms ?? DEFAULT_LIMITS.max_forms,
            max_ai_analyses: planData.max_ai_analyses ?? DEFAULT_LIMITS.max_ai_analyses,
            max_storage_mb: planData.max_storage_mb ?? DEFAULT_LIMITS.max_storage_mb,
          };
          planFeatures = (planData.features as PlanFeatures) || {};
        }
      }

      // Count current usage
      const [clientsRes, usersRes, eventsRes, productsRes, formsRes, aiRes] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("account_id", currentUser.account_id),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("account_id", currentUser.account_id),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("account_id", currentUser.account_id),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("account_id", currentUser.account_id),
        supabase.from("forms").select("id", { count: "exact", head: true }).eq("account_id", currentUser.account_id),
        supabase
          .from("ai_usage_logs")
          .select("id", { count: "exact", head: true })
          .eq("account_id", currentUser.account_id)
          .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ]);

      const usage: PlanUsage = {
        clients: clientsRes.count || 0,
        users: usersRes.count || 0,
        events: eventsRes.count || 0,
        products: productsRes.count || 0,
        forms: formsRes.count || 0,
        ai_analyses: aiRes.count || 0,
      };

      setData({
        account_id: currentUser.account_id,
        plan_id: accountData.plan_id,
        plan_name: planName,
        limits: planLimits,
        usage,
        features: planFeatures,
      });
    } catch (err) {
      console.error("Error fetching plan limits:", err);
      setError(err instanceof Error ? err.message : "Error fetching plan limits");
    } finally {
      setLoading(false);
    }
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
