import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface SellerOption {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Vendedores/closers que conduzem videochamadas. */
export const SELLER_IDS = [
  "1232ec15-5f66-4b5f-9e74-f40d436f9d0f", // Jonathan Marcato
  "1d090543-1853-4cd0-bdb4-02e17a5df4d8", // Darlan Ferreira
  "a19843c8-3790-41b3-9b3d-4490b385316d", // Kleberson Alves
];

/** Lista apenas os vendedores comerciais para atribuir a call. */
export function useAccountSellers() {
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("id, name, email, avatar_url")
        .in("id", SELLER_IDS)
        .order("name");
      if (!cancelled) {
        setSellers((data as SellerOption[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { sellers, loading };
}


interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  sellers: SellerOption[];
  loading?: boolean;
  placeholder?: string;
  allowAll?: boolean;
  allLabel?: string;
  className?: string;
}

export function SellerSelector({
  value,
  onChange,
  sellers,
  loading,
  placeholder = "Selecionar vendedor",
  allowAll,
  allLabel = "Todos os vendedores",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const selected = sellers.find((s) => s.id === value) ?? null;
  const filtered = term.trim()
    ? sellers.filter((s) =>
        (s.name ?? s.email ?? "").toLowerCase().includes(term.trim().toLowerCase())
      )
    : sellers;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn("justify-between font-normal", className)}
        >
          <span className="flex items-center gap-2 truncate">
            {selected ? (
              <>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={selected.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {initials(selected.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{selected.name ?? selected.email}</span>
              </>
            ) : (
              <span className="truncate text-muted-foreground">
                {allowAll ? allLabel : placeholder}
              </span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[240px] p-0" align="start">
        <div className="relative border-b">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar vendedor"
            className="pl-8 border-0 focus-visible:ring-0"
          />
        </div>
        <ScrollArea className="h-60">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : (
            <div className="p-1">
              {allowAll && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full rounded-md px-2 py-2 text-left text-sm hover:bg-accent flex items-center gap-2",
                    !value && "bg-accent"
                  )}
                >
                  <Check className={cn("h-4 w-4", value ? "opacity-0" : "opacity-100")} />
                  {allLabel}
                </button>
              )}
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum vendedor encontrado
                </div>
              ) : (
                filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onChange(s.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full rounded-md px-2 py-2 text-left text-sm hover:bg-accent flex items-center gap-2",
                      value === s.id && "bg-accent"
                    )}
                  >
                    <Check
                      className={cn("h-4 w-4 shrink-0", value === s.id ? "opacity-100" : "opacity-0")}
                    />
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={s.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px]">{initials(s.name)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{s.name ?? s.email}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
