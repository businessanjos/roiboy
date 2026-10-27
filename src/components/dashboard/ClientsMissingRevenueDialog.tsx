import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Search } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientIds: string[];
}

/** Lista os clientes do filtro atual que ainda não têm faturamento informado. */
export function ClientsMissingRevenueDialog({ open, onOpenChange, clientIds }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-clients-missing-revenue", clientIds],
    enabled: open && clientIds.length > 0,
    queryFn: async () => {
      const rows: { id: string; full_name: string | null; phone_e164: string | null }[] = [];
      for (let i = 0; i < clientIds.length; i += 200) {
        const { data, error } = await supabase
          .from("clients")
          .select("id, full_name, phone_e164")
          .in("id", clientIds.slice(i, i + 200));
        if (error) throw error;
        rows.push(...(data ?? []));
      }
      return rows.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "pt-BR"));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((c) => !q || (c.full_name || "").toLowerCase().includes(q) || (c.phone_e164 || "").includes(q));
  }, [data, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Clientes sem faturamento informado</DialogTitle>
          <DialogDescription>{clientIds.length} cliente(s) ainda sem nenhum faturamento preenchido.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-8" />
        </div>
        <div className="max-h-[55vh] overflow-y-auto divide-y rounded-md border">
          {isLoading ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-center text-muted-foreground">Nenhum cliente encontrado.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/clients/${c.id}`)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.full_name || "Sem nome"}</p>
                  {c.phone_e164 && <p className="text-xs text-muted-foreground">{c.phone_e164}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
