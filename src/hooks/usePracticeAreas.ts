import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PracticeArea {
  id: string;
  label: string;
  slug: string;
  sort_order: number;
  active: boolean;
}

export function usePracticeAreas() {
  return useQuery({
    queryKey: ["practice-areas"],
    queryFn: async (): Promise<PracticeArea[]> => {
      const { data, error } = await supabase
        .from("practice_areas")
        .select("id,label,slug,sort_order,active")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PracticeArea[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
