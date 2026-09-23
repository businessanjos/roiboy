import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface CallProduct {
  id: string;
  name: string;
  color: string | null;
}

export function useCallProducts() {
  const [products, setProducts] = useState<CallProduct[]>([]);
  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, color")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setProducts((data as CallProduct[]) ?? []));
  }, []);
  return products;
}

const NONE = "__none__";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  products: CallProduct[];
  allLabel?: string;
  counts?: Map<string, number>;
  className?: string;
}

export function ProductSelector({ value, onChange, products, allLabel, counts, className }: Props) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Selecionar produto" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{allLabel ?? "Sem produto"}</SelectItem>
        {products.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color || "#6b7280" }} />
              {p.name}
              {counts && ` (${counts.get(p.id) ?? 0})`}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
