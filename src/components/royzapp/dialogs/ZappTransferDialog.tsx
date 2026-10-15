import { memo, useEffect, useMemo, useState } from "react";
import { Check, Search, Users2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Option = { id: string; name: string; color?: string; hint?: string; online?: boolean };

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
    if (!q) return options;
    return options.filter(
      (o) => norm(o.name).includes(q) || norm(o.hint || "").includes(q)
    );
  }, [options, search]);

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
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onTransferTargetChange({ ...transferTarget, id: opt.id })}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      selected
                        ? "bg-zapp-accent/15 text-zapp-text ring-1 ring-zapp-accent/40"
                        : "text-zapp-text hover:bg-zapp-hover"
                    )}
                  >
                    {isAgent ? (
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-zapp-panel text-[11px] font-semibold text-zapp-text-muted">
                        {getInitials(opt.name)}
                      </span>
                    ) : (
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: opt.color }}
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
                  </button>
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
