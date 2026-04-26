import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Gift, Package, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

interface ProductBonus {
  id: string;
  label: string;
  description: string | null;
  color: string;
}

interface Props {
  dealId: string;
  /** Selected bonus labels (array of strings) */
  value: string[];
  onChange: (labels: string[]) => void;
}

const COLOR_CLASS: Record<string, string> = {
  green: "bg-emerald-500",
  blue: "bg-blue-500",
  purple: "bg-violet-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
  gray: "bg-gray-500",
};

const ITEM_VENDA_FIELD_ID = "033b91fb-3add-4c96-aec9-567fefbd0fb2";

export function BonusSelector({ dealId, value, onChange }: Props) {
  const [bonuses, setBonuses] = useState<ProductBonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [productName, setProductName] = useState<string | null>(null);
  const [productMissing, setProductMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchBonuses = async () => {
      setLoading(true);
      setProductMissing(false);
      try {
        // 1) Read the deal's Item da Venda value
        const { data: itemRow } = await supabase
          .from("deal_field_values")
          .select("value_text")
          .eq("deal_id", dealId)
          .eq("field_id", ITEM_VENDA_FIELD_ID)
          .maybeSingle();

        const itemValue = itemRow?.value_text;
        if (!itemValue) {
          if (!cancelled) {
            setProductMissing(true);
            setBonuses([]);
          }
          return;
        }

        // 2) Resolve to product_id. Item da Venda may be a UUID or a label.
        let productId: string | null = null;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemValue);

        if (isUuid) {
          productId = itemValue;
          const { data: p } = await supabase
            .from("products")
            .select("id, name")
            .eq("id", itemValue)
            .maybeSingle();
          if (p && !cancelled) setProductName(p.name);
        } else {
          // Lookup by name (case-insensitive)
          const { data: p } = await supabase
            .from("products")
            .select("id, name")
            .ilike("name", itemValue)
            .maybeSingle();
          if (p) {
            productId = p.id;
            if (!cancelled) setProductName(p.name);
          }
        }

        if (!productId) {
          if (!cancelled) {
            setProductMissing(true);
            setBonuses([]);
          }
          return;
        }

        // 3) Fetch bonuses for that product
        const { data: bonusRows } = await supabase
          .from("product_bonuses")
          .select("id, label, description, color")
          .eq("product_id", productId)
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (!cancelled) setBonuses((bonusRows || []) as ProductBonus[]);
      } catch (err) {
        console.error("[BonusSelector] error", err);
        if (!cancelled) setBonuses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchBonuses();
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const toggle = (label: string) => {
    if (value.includes(label)) {
      onChange(value.filter((v) => v !== label));
    } else {
      onChange([...value, label]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Buscando bônus do produto...
      </div>
    );
  }

  if (productMissing) {
    return (
      <div className="rounded-md border border-dashed p-3 flex items-start gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
        <span>
          Selecione o <strong>Item da Venda</strong> antes para que os bônus do produto apareçam aqui.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {productName && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Package className="h-3 w-3" />
          Bônus disponíveis para <strong className="text-foreground">{productName}</strong>
        </div>
      )}

      {bonuses.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 flex items-start gap-2 text-sm text-muted-foreground">
          <Gift className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Este produto não possui bônus cadastrados. Cadastre em{" "}
            <strong>Produtos → Editar → aba Bônus</strong>.
          </span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {bonuses.map((b) => {
            const checked = value.includes(b.label);
            return (
              <label
                key={b.id}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-2.5 cursor-pointer transition-colors",
                  checked
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(b.label)}
                  className="mt-0.5"
                />
                <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", COLOR_CLASS[b.color] ?? COLOR_CLASS.gray)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">{b.label}</p>
                  {b.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{b.description}</p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
