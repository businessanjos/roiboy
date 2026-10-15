import { memo, useEffect, useMemo, useState } from "react";
import { Check, Search, Users2, Building2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getDepartmentColor } from "@/lib/zappDepartmentColor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { prioritizeTransferFavorites, readTransferFavorites, transferFavoritesKey } from "@/lib/zappTransferFavorites";
import { Agent, Department, getInitials } from "../types";

interface ZappTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transferTarget: { type: "agent" | "department"; id: string };
  onTransferTargetChange: (target: { type: "agent" | "department"; id: string }) => void;
  agents: Agent[];
  departments: Department[];
  currentAgentId?: string | null;
  onTransfer: () => void;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

type Option = { id: string; name: string; color?: string; hint?: string; online?: boolean; avatarUrl?: string | null };

export const ZappTransferDialog = memo(function ZappTransferDialog({
  open,
  onOpenChange,
  transferTarget,
  onTransferTargetChange,
  agents,
  departments,
  currentAgentId,
  onTransfer,
}: ZappTransferDialogProps) {
  const [search, setSearch] = useState("");
  const { currentUser } = useCurrentUser();
  const favoritesKey = currentUser ? transferFavoritesKey(currentUser.account_id, currentUser.id) : null;
  const [favoriteState, setFavoriteState] = useState<{ key: string | null; ids: string[] }>({ key: null, ids: [] });
  const favorites = favoriteState.key === favoritesKey ? favoriteState.ids : [];

  useEffect(() => {
    setFavoriteState({ key: favoritesKey, ids: readTransferFavorites(favoritesKey) });
  }, [favoritesKey]);

  const toggleFavorite = (id: string) => {
    if (!favoritesKey) return;
    const ids = favorites.includes(id) ? favorites.filter((value) => value !== id) : [...favorites, id];
    setFavoriteState({ key: favoritesKey, ids });
    try { localStorage.setItem(favoritesKey, JSON.stringify(ids)); } catch { /* Preference remains available for this session. */ }
  };

  // Limpa a busca ao fechar/reabrir para a lista começar organizada.
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const options = useMemo<Option[]>(() => {
    if (transferTarget.type === "department") {
      return departments
        .map((d) => ({ id: d.id, name: d.name, color: d.color }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }
    return agents
      .filter((a) => a.is_active !== false && a.id !== currentAgentId)
      .map((a) => ({
        id: a.id,
        name: a.user?.name || "Sem nome",
        avatarUrl: a.user?.avatar_url,
        online: !!a.is_online,
        hint: a.department?.name,
      }))
      .sort((a, b) => {
        if (!!a.online !== !!b.online) return a.online ? -1 : 1;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }, [transferTarget.type, agents, departments, currentAgentId]);

  const filtered = useMemo(() => {
    const q = norm(search);
    const sorted = transferTarget.type === "agent" ? prioritizeTransferFavorites(options, favorites) : options;
    if (!q) return sorted;
    return sorted.filter(
      (o) => norm(o.name).includes(q) || norm(o.hint || "").includes(q)
    );
  }, [options, search, favorites, transferTarget.type]);

  const isAgent = transferTarget.type === "agent";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zapp-bg border-zapp-border text-zapp-text">
        <DialogHeader>
          <DialogTitle className="text-zapp-text">Transferir Conversa</DialogTitle>
          <DialogDescription className="text-zapp-text-muted">
            Busque e escolha para quem transferir
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Tabs
            value={transferTarget.type}
            onValueChange={(v) => {
              setSearch("");
              onTransferTargetChange({ type: v as "agent" | "department", id: "" });
            }}
          >
            <TabsList className="w-full bg-zapp-bg-dark">
              <TabsTrigger
                value="agent"
                className="flex-1 data-[state=active]:bg-zapp-accent data-[state=active]:text-zapp-bg-dark ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                Atendente
              </TabsTrigger>
              <TabsTrigger
                value="department"
                className="flex-1 data-[state=active]:bg-zapp-accent data-[state=active]:text-zapp-bg-dark ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                Departamento
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zapp-text-muted" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAgent ? "Buscar atendente..." : "Buscar departamento..."}
              className="rounded-xl border-zapp-border bg-zapp-bg-dark pl-9 text-zapp-text placeholder:text-zapp-text-muted/70"
            />
          </div>

          <div
            role="listbox"
            aria-label={isAgent ? "Atendentes" : "Departamentos"}
            className="max-h-[46vh] min-h-[8rem] space-y-1 overflow-y-auto rounded-xl border border-zapp-border bg-zapp-bg-dark/60 p-2"
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                {isAgent ? (
                  <Users2 className="h-7 w-7 text-zapp-text-muted/50" />
                ) : (
                  <Building2 className="h-7 w-7 text-zapp-text-muted/50" />
                )}
                <p className="text-sm text-zapp-text-muted">
                  {search
                    ? `Nenhum ${isAgent ? "atendente" : "departamento"} encontrado.`
                    : `Nenhum ${isAgent ? "atendente disponível" : "departamento cadastrado"}.`}
                </p>
              </div>
            ) : (
              filtered.map((opt) => {
                const selected = opt.id === transferTarget.id;
                return (
                  <div key={opt.id} className="group relative">
                  <Button
                    key={opt.id}
                    variant="ghost"
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onTransferTargetChange({ ...transferTarget, id: opt.id })}
                    className={cn(
                      "flex h-auto w-full items-center justify-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      isAgent && "pr-12",
                      selected
                        ? "bg-zapp-accent/15 text-zapp-text ring-1 ring-zapp-accent/40"
                        : "text-zapp-text hover:bg-zapp-hover"
                    )}
                  >
                    {isAgent ? (
                      <Avatar className="h-7 w-7 flex-shrink-0">
                        <AvatarImage src={opt.avatarUrl || undefined} alt={opt.name} className="object-cover" />
                        <AvatarFallback className="bg-zapp-panel text-[11px] font-semibold text-zapp-text-muted">
                          {getInitials(opt.name)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: getDepartmentColor(opt.color) }}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{opt.name}</span>
                      {(opt.hint || !opt.online) && isAgent && (
                        <span className="block truncate text-[11px] text-zapp-text-muted">
                          {opt.online ? "Online" : "Offline"}
                          {opt.hint ? ` · ${opt.hint}` : ""}
                        </span>
                      )}
                    </span>
                    {selected && <Check className="h-4 w-4 flex-shrink-0 text-zapp-accent" />}
                  </Button>
                  {isAgent && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`${favorites.includes(opt.id) ? "Desfavoritar" : "Favoritar"} ${opt.name}`}
                      title={favorites.includes(opt.id) ? "Remover dos favoritos" : "Favoritar atendente"}
                      aria-pressed={favorites.includes(opt.id)}
                      disabled={!favoritesKey}
                      onClick={() => toggleFavorite(opt.id)}
                      className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-zapp-text-muted opacity-0 transition-opacity hover:bg-zapp-hover hover:text-zapp-accent group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      <Star className={cn("h-4 w-4", favorites.includes(opt.id) && "fill-current text-zapp-accent")} />
                    </Button>
                  )}
                  </div>
                );
              })
            )}
          </div>

          <p className="text-[11px] text-zapp-text-muted">
            {filtered.length} {filtered.length === 1
              ? (isAgent ? "atendente" : "departamento")
              : (isAgent ? "atendentes" : "departamentos")}
            {transferTarget.id ? " · seleção pronta para transferir" : " · escolha um para continuar"}
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-zapp-border text-zapp-text-muted hover:bg-zapp-hover"
          >
            Cancelar
          </Button>
          <Button
            onClick={onTransfer}
            className="bg-zapp-accent hover:bg-zapp-accent-hover text-zapp-bg-dark border-0 ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={!transferTarget.id}
          >
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
