import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductLiteRow {
  id: string;
  name: string;
  color: string | null;
}

/**
 * Lista enxuta de produtos (id, nome, cor) usada como fallback para resolver
 * valores gravados como UUID em campos que guardam produtos.
 */
export function useProductsLite(enabled = true) {
  return useQuery({
    queryKey: ["products-lite"],
    queryFn: async (): Promise<ProductLiteRow[]> => {
      const { data, error } = await supabase.from("products").select("id, name, color");
      if (error) throw error;
      return (data as ProductLiteRow[]) || [];
    },
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}
