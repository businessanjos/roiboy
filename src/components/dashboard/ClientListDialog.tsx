import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  clients: Array<{ id: string; full_name: string }>;
  /** Rótulo secundário exibido à direita de cada cliente (ex.: formação). */
  metaById?: Map<string, string | null>;
  /** Texto quando o rótulo secundário está vazio. */
  metaFallback?: string;
  emptyLabel?: string;
}

/** Lista de clientes com busca, usada pelos cartões clicáveis do dashboard. */
export function ClientListDialog({
  open,
  onOpenChange,
  title,
  description,
  clients,
  metaById,
  metaFallback = "—",
  emptyLabel = "Nenhum cliente encontrado.",
}: Props) {
  const [search, setSearch] = useState("");

  // Cada nova abertura começa com a busca limpa.
  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  const people = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => !q || c.full_name?.toLowerCase().includes(q))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR"));
  }, [clients, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y rounded-md border">
          {people.map((c) => (
            <Link
              key={c.id}
              to={`/clients/${c.id}`}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/50"
            >
              <span className="font-medium truncate">{c.full_name}</span>
              {metaById && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {metaById.get(c.id) || metaFallback}
                </span>
              )}
            </Link>
          ))}
          {people.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">{emptyLabel}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
