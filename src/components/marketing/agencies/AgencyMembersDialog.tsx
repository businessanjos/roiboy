import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agencyId: string;
}

export function AgencyMembersDialog({ open, onOpenChange, agencyId }: Props) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string>("");

  const usersQuery = useQuery({
    queryKey: ["account-users-for-agency", accountId],
    enabled: open && !!accountId,
    queryFn: async () => {
      const sb: any = supabase;
      const { data } = await sb
        .from("users")
        .select("id, name, email, avatar_url")
        .eq("account_id", accountId)
        .order("name");
      return (data || []) as any[];
    },
  });

  const membersQuery = useQuery({
    queryKey: ["agency-members", agencyId],
    enabled: open && !!agencyId,
    queryFn: async () => {
      const sb: any = supabase;
      const { data } = await sb
        .from("traffic_agency_members")
        .select("id, user_id, user:users(name,email,avatar_url)")
        .eq("agency_id", agencyId);
      return (data || []) as any[];
    },
  });

  async function handleAdd() {
    if (!selectedUser) return;
    const sb: any = supabase;
    const { error } = await sb.from("traffic_agency_members").insert({
      agency_id: agencyId,
      user_id: selectedUser,
      account_id: accountId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Usuário vinculado");
    setSelectedUser("");
    qc.invalidateQueries({ queryKey: ["agency-members", agencyId] });
    qc.invalidateQueries({ queryKey: ["traffic-agencies"] });
  }

  async function handleRemove(id: string) {
    const sb: any = supabase;
    const { error } = await sb.from("traffic_agency_members").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["agency-members", agencyId] });
    qc.invalidateQueries({ queryKey: ["traffic-agencies"] });
  }

  const memberIds = new Set((membersQuery.data || []).map((m: any) => m.user_id));
  const availableUsers = (usersQuery.data || []).filter((u: any) => !memberIds.has(u.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Usuários da agência</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">
              Vincule usuários internos. Eles ganham o portal restrito da agência.
            </Label>
          </div>
          <div className="flex gap-2">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger><SelectValue placeholder="Selecionar usuário..." /></SelectTrigger>
              <SelectContent>
                {availableUsers.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={!selectedUser}>Vincular</Button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(membersQuery.data || []).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded-md border">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={m.user?.avatar_url} />
                    <AvatarFallback>{(m.user?.name ?? "?").slice(0,1)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">{m.user?.name}</div>
                    <div className="text-xs text-muted-foreground">{m.user?.email}</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemove(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {!membersQuery.data?.length && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum usuário vinculado</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
