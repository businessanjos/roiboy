import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Replica exatamente as permissões e o acesso por funil de uma pessoa para outras. */
export function CopyPermissionsButton({ userId, accountId }: { userId: string; accountId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["copy-perm-users", accountId],
    enabled: open && !!accountId,
    queryFn: async () => {
      const { data } = await supabase
        .from("users").select("id, name, email").eq("account_id", accountId).eq("is_active", true).order("name");
      return (data ?? []) as { id: string; name: string | null; email: string | null }[];
    },
  });

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => u.id !== userId && (!q || `${u.name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q)));
  }, [users, search, userId]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const apply = async () => {
    const targets = [...selected];
    if (!targets.length) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("replicate_user_access", { _source: userId, _targets: targets });
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["user-permission-overrides"] });
      qc.invalidateQueries({ queryKey: ["user-pipeline-access"] });
      qc.invalidateQueries({ queryKey: ["user-profile-permissions"] });
      qc.invalidateQueries({ queryKey: ["my-pipeline-access"] });
      qc.invalidateQueries();
      toast.success(`Acessos replicados para ${targets.length} pessoa${targets.length > 1 ? "s" : ""}.`);
      setOpen(false);
      setSelected(new Set());
    } catch {
      toast.error("Não foi possível replicar os acessos.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <Copy className="h-3 w-3" /> Replicar acessos
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[260px] text-xs leading-relaxed">
            Aplica em outras pessoas exatamente os mesmos acessos desta: setores e função em cada setor, cargos, permissões e funis. Evita configurar uma por uma.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setSelected(new Set()); setSearch(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Replicar acessos</DialogTitle>
            <DialogDescription>
              As pessoas marcadas ficam com exatamente os mesmos setores, funções, cargos, permissões e funis desta pessoa. O que elas tinham antes é substituído.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pessoa..." className="pl-8" />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
            {list.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Ninguém encontrado</p>}
            {list.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                <Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggle(u.id)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.name || u.email}</p>
                  {u.name && u.email && <p className="truncate text-xs text-muted-foreground">{u.email}</p>}
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={apply} disabled={saving || selected.size === 0}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Replicar para {selected.size || ""} {selected.size === 1 ? "pessoa" : "pessoas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
