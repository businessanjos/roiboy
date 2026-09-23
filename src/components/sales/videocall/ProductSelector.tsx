import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

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

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  products: CallProduct[];
  allLabel?: string;
  counts?: Map<string, number>;
  className?: string;
}

const Dot = ({ color }: { color: string | null }) => (
  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color || "#6b7280" }} />
);

export function ProductSelector({ value, onChange, products, allLabel, counts, className }: Props) {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value) ?? null;
  const emptyLabel = allLabel ?? "Sem produto";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn("justify-between font-normal", className)}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {selected ? (
              <>
                <Dot color={selected.color} />
                <span className="truncate">{selected.name}</span>
              </>
            ) : (
              <>
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{emptyLabel}</span>
              </>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar produto..." />
          <CommandList className="max-h-64">
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={`__none__ ${emptyLabel}`}
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">{emptyLabel}</span>
              </CommandItem>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.id}`}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  <Dot color={p.color} />
                  <span className="ml-2 flex-1 truncate">{p.name}</span>
                  {counts && (
                    <span className="ml-2 text-xs text-muted-foreground">{counts.get(p.id) ?? 0}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
