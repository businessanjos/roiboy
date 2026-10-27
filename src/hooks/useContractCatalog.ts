import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { mergeCatalog, type CatalogListKey, type CatalogRow } from "@/lib/contracts/contractCatalog";

export function useContractCatalogRows() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  return useQuery({
    queryKey: ["contract-catalog", accountId],
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_catalog_options")
        .select("id, list_key, value, label, description, color, metric_bucket, is_builtin, is_active, display_order")
        .eq("account_id", accountId!);
      if (error) throw error;
      return (data || []) as CatalogRow[];
    },
  });
}

/** Lista final (padrão + personalizados). `options` = só ativos; `labels` inclui inativos para registros antigos. */
export function useContractCatalog(list: CatalogListKey) {
  const { data: rows = [], isLoading } = useContractCatalogRows();
  const items = mergeCatalog(list, rows);
  const labels: Record<string, string> = {};
  items.forEach((i) => (labels[i.value] = i.label));
  return { items, options: items.filter((i) => i.is_active), labels, isLoading };
}
