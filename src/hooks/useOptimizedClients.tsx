import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface EnrichedClient {
  id: string;
  full_name: string;
  phone_e164: string;
  status: string;
  created_at: string;
  company_name: string | null;
  tags: any;
  avatar_url: string | null;
  responsible_user_id: string | null;
  products: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
  vnps: {
    vnps_score: number;
    vnps_class: string;
    trend: string;
    computed_at: string;
  } | null;
  score: {
    escore: number;
    roizometer: number;
    quadrant: string;
    trend: string;
    computed_at: string;
  } | null;
  contract: {
    id: string;
    status: string;
    start_date: string;
    end_date: string | null;
    product_id: string | null;
  } | null;
  has_conversation: boolean;
  message_count: number;
  pending_forms: Array<{
    form_title: string;
    sent_at: string;
  }>;
  responsible_user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface TeamUser {
  id: string;
  name: string;
  email: string;
}

interface ListClientsResponse {
  clients: EnrichedClient[];
  total: number;
  limit: number;
  offset: number;
  team_users: TeamUser[];
}

interface UseOptimizedClientsOptions {
  search?: string;
  limit?: number;
  page?: number;
  status?: string;
  responsibleUserId?: string;
  productId?: string;
  vnpsClass?: string;
  contractFilter?: string;
  clientStatus?: string;
}

export function useOptimizedClients(options: UseOptimizedClientsOptions = {}) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(options.page || 1);
  const limit = options.limit || 50;
  const offset = (page - 1) * limit;

  const queryKey = ["clients-optimized", currentUser?.account_id, options.search, page, limit, options.status, options.responsibleUserId, options.productId, options.vnpsClass, options.contractFilter, options.clientStatus];

  const fetchClients = useCallback(async (): Promise<ListClientsResponse> => {
    if (!currentUser?.account_id || !currentUser?.id) {
      return { clients: [], total: 0, limit, offset: 0, team_users: [] };
    }

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (options.search) {
      params.set("search", options.search);
    }

    if (options.status) {
      params.set("status", options.status);
    }

    // Add server-side filter parameters
    if (options.responsibleUserId && options.responsibleUserId !== "all") {
      params.set("responsible_user_id", options.responsibleUserId);
    }
    if (options.productId && options.productId !== "all") {
      params.set("product_id", options.productId);
    }
    if (options.vnpsClass && options.vnpsClass !== "all") {
      params.set("vnps_class", options.vnpsClass);
    }
    if (options.contractFilter && options.contractFilter !== "all") {
      params.set("contract_filter", options.contractFilter);
    }
    if (options.clientStatus && options.clientStatus !== "all") {
      params.set("client_status", options.clientStatus);
    }

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/list-clients?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-account-id": currentUser.account_id,
          "x-session-token": currentUser.id,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch clients");
    }

    return response.json();
  }, [currentUser?.account_id, currentUser?.id, limit, offset, options.search, options.status, options.responsibleUserId, options.productId, options.vnpsClass, options.contractFilter, options.clientStatus]);

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: fetchClients,
    enabled: !!currentUser?.account_id && !!currentUser?.id,
    staleTime: 60000, // 60 seconds - reduce API calls significantly
    gcTime: 300000, // 5 minutes cache
    refetchOnWindowFocus: false, // Don't refetch on tab focus
  });

  const totalPages = Math.ceil((data?.total || 0) / limit);

  const goToPage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(page + 1);
  }, [page, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(page - 1);
  }, [page, goToPage]);

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setPage(1);
  }, [options.search, options.status, options.responsibleUserId, options.productId, options.vnpsClass, options.contractFilter, options.clientStatus]);

  // Prefetch next page
  useEffect(() => {
    if (page < totalPages && currentUser?.account_id) {
      const nextOffset = page * limit;
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: nextOffset.toString(),
      });
      if (options.search) params.set("search", options.search);
      if (options.status) params.set("status", options.status);

      queryClient.prefetchQuery({
        queryKey: ["clients-optimized", currentUser.account_id, options.search, page + 1, limit, options.status],
        queryFn: async () => {
          const response = await fetch(
            `${SUPABASE_URL}/functions/v1/list-clients?${params.toString()}`,
            {
              headers: {
                "Content-Type": "application/json",
                "x-account-id": currentUser.account_id,
                "x-session-token": currentUser.id,
              },
            }
          );
          return response.json();
        },
        staleTime: 30000,
      });
    }
  }, [page, totalPages, currentUser, limit, options.search, options.status, queryClient]);

  return {
    clients: data?.clients || [],
    teamUsers: data?.team_users || [],
    total: data?.total || 0,
    isLoading,
    isFetching,
    error,
    refetch,
    // Pagination
    page,
    totalPages,
    limit,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
