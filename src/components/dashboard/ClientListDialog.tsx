import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  clients: Array<{ id: string; full_name: string }>;
  /** Rótulo secundário exibido à direita de cada cliente (ex.: produto ou formação). */
  metaById?: Map<string, string | null>;
  /** Texto quando o rótulo secundário está vazio. */
  metaFallback?: string;
  /** Ícone do cabeçalho (ex.: GraduationCap, Target). */
  icon?: ComponentType<{ className?: string }>;
  emptyLabel?: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("");
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
  icon: Icon,
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

  // Quando toda a lista tem o mesmo rótulo (ex.: mesma formação), ele repete sem agregar nada.
  const metaLabels = useMemo(() => {
    if (!metaById) return new Set<string>();
    return new Set(people.map((c) => metaById.get(c.id) || metaFallback));
  }, [people, metaById, metaFallback]);
  const showMeta = !!metaById && metaLabels.size > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-start gap-3 border-b bg-muted/30 px-5 py-4">
          {Icon && (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Icon className="h-4.5 w-4.5 text-primary" />
            </div>
          )}
          <div className="min-w-0 flex-1 pr-8">
            <DialogTitle className="truncate text-lg leading-tight">{title}</DialogTitle>
            <DialogDescription className="mt-1 text-xs">{description}</DialogDescription>
          </div>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 rounded-full bg-muted/40 pl-9 pr-9"
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {search && (
            <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
              {people.length} de {clients.length} cliente(s)
            </p>
          )}
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {people.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            <ul className="space-y-0.5">
              {people.map((c, i) => {
                const meta = metaById?.get(c.id) || metaFallback;
                return (
                  <li key={c.id}>
                    <Link
                      to={`/clients/${c.id}`}
                      className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="w-5 shrink-0 text-right text-[11px] font-medium tabular-nums text-muted-foreground/70">
                        {i + 1}
                      </span>
                      <Avatar className="h-8 w-8 border bg-primary/10">
                        <AvatarFallback className="bg-transparent text-[11px] font-semibold text-primary">
                          {initials(c.full_name || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.full_name}</span>
                      {showMeta && (
                        <Badge
                          variant="outline"
                          className={cn("max-w-[45%] shrink-0 truncate border-border/60 text-[11px] font-normal text-muted-foreground")}
                        >
                          {meta}
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
