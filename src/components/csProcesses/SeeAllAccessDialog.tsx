import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export const SEE_ALL = { module: "cs", sub_item: "processos_ver_todas" } as const;

export function SeeAllAccessDialog({ accountId, users }: { accountId: string; users: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const qk = ["cs-see-all-overrides", accountId];
  const { data: granted = new Set<string>() } = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const { data } = await (supabase as any).from("user_permission_overrides").select("user_id")
        .eq("account_id", accountId).eq("module", SEE_ALL.module).eq("sub_item", SEE_ALL.sub_item).neq("access_level", "none");
      return new Set<string>((data ?? []).map((r: any) => r.user_id));
    },
  });
  const toggle = async (userId: string, on: boolean) => {
    const db = supabase as any;
    const { error } = on
      ? await db.from("user_permission_overrides").upsert({ user_id: userId, account_id: accountId, ...SEE_ALL, access_level: "view", scope: "all" }, { onConflict: "user_id,module,sub_item" })
      : await db.from("user_permission_overrides").delete().eq("user_id", userId).eq("module", SEE_ALL.module).eq("sub_item", SEE_ALL.sub_item);
    if (error) return toast.error("Não foi possível salvar.");
    qc.invalidateQueries({ queryKey: qk });
    qc.invalidateQueries({ queryKey: ["user-profile-permissions"] });
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-9 gap-1 text-muted-foreground"><Users className="h-4 w-4" />Quem vê todas</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Quem vê todas as clientes</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Gestores e administradores já veem todas. Ligue para liberar outra pessoa.</p>
        <div className="max-h-[60vh] divide-y overflow-y-auto">
          {users.map((u) => (
            <label key={u.id} className="flex items-center justify-between py-2 text-sm">
              {u.name}
              <Switch checked={granted.has(u.id)} onCheckedChange={(v) => toggle(u.id, v)} />
            </label>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
