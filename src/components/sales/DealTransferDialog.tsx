import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, ArrowRightLeft, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
}

interface DealTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  dealTitle: string;
  currentOwnerId: string | null;
  currentOwnerName: string | null;
  accountId: string;
  sectorId?: string;
  onTransferred: () => void;
}

export function DealTransferDialog({
  open,
  onOpenChange,
  dealId,
  dealTitle,
  currentOwnerId,
  currentOwnerName,
  accountId,
  sectorId,
  onTransferred,
}: DealTransferDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [transferReason, setTransferReason] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Fetch team members with access to vendas sector + admins
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!open || !accountId) return;
      
      setLoading(true);
      try {
        // Get users with access to vendas sector AND admins
        const [accessRes, adminsRes] = await Promise.all([
          supabase
            .from("user_sector_access")
            .select(`
              user_id,
              is_active,
              user:users!user_sector_access_user_id_fkey(
                id, name, email, avatar_url, role
              )
            `)
            .eq("account_id", accountId)
            .eq("sector_id", sectorId || "vendas")
            .eq("is_active", true),
          supabase
            .from("users")
            .select("id, name, email, avatar_url, role")
            .eq("account_id", accountId)
            .eq("role", "admin")
        ]);

        if (accessRes.error) throw accessRes.error;

        // Use a Map to dedupe users
        const membersMap = new Map<string, TeamMember>();
        
        // Add admins first (excluding current owner)
        (adminsRes.data || []).forEach((user: any) => {
          if (user.id !== currentOwnerId) {
            membersMap.set(user.id, {
              id: user.id,
              name: user.name,
              email: user.email,
              avatar_url: user.avatar_url,
              role: user.role,
            });
          }
        });

        // Add sector users
        (accessRes.data || []).forEach((a: any) => {
          if (a.user && a.user.id !== currentOwnerId && !membersMap.has(a.user.id)) {
            membersMap.set(a.user.id, {
              id: a.user.id,
              name: a.user.name,
              email: a.user.email,
              avatar_url: a.user.avatar_url,
              role: a.user.role,
            });
          }
        });

        // Sort by name
        const members = Array.from(membersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        setTeamMembers(members);
      } catch (error) {
        console.error("Error fetching team members:", error);
        setTeamMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamMembers();
  }, [open, accountId, sectorId, currentOwnerId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedMember(null);
      setTransferReason("");
    }
  }, [open]);

  const handleTransfer = async () => {
    if (!selectedMember) return;

    setTransferring(true);
    try {
      // Get current user for activity log
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Usuário não autenticado");

      const { data: userData } = await supabase
        .from("users")
        .select("id, name")
        .eq("auth_user_id", authUser.id)
        .single();

      // Update deal responsible
      const { error: updateError } = await supabase
        .from("deals")
        .update({ 
          responsible_user_id: selectedMember.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dealId);

      if (updateError) throw updateError;

      // Log the transfer as an activity
      await supabase.from("deal_activities").insert({
        account_id: accountId,
        deal_id: dealId,
        type: "stage_change", // Using stage_change type for now
        title: "Transferência de responsável",
        content: transferReason || `Negócio transferido de ${currentOwnerName || "Sem responsável"} para ${selectedMember.name}`,
        old_value: currentOwnerName || null,
        new_value: selectedMember.name,
        user_id: userData?.id || null,
      });

      toast.success(`Negócio transferido para ${selectedMember.name}`);
      
      // Invalidar queries relacionadas para atualizar UI imediatamente
      queryClient.invalidateQueries({ queryKey: ["deal-detail-zapp"] });
      queryClient.invalidateQueries({ queryKey: ["contact-deals-zapp"] });
      queryClient.invalidateQueries({ queryKey: ["lead-info-zapp"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      
      onTransferred();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error transferring deal:", error);
      toast.error("Erro ao transferir negócio: " + error.message);
    } finally {
      setTransferring(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const filteredMembers = teamMembers.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transferir Negócio
          </DialogTitle>
          <DialogDescription>
            Transferir <strong>"{dealTitle}"</strong> para outro vendedor
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Owner */}
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="text-xs text-muted-foreground">De:</div>
            {currentOwnerName ? (
              <Badge variant="secondary" className="flex items-center gap-1.5">
                <User className="h-3 w-3" />
                {currentOwnerName}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground italic">Sem responsável</span>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar vendedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Team Members List */}
          <ScrollArea className="h-[200px]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {teamMembers.length === 0 
                  ? "Nenhum vendedor disponível" 
                  : "Nenhum resultado encontrado"}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors",
                      selectedMember?.id === member.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted border border-transparent"
                    )}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    {selectedMember?.id === member.id && (
                      <Badge className="bg-primary text-primary-foreground text-[10px]">
                        Selecionado
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Transfer Reason */}
          {selectedMember && (
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm">Motivo (opcional)</Label>
              <Textarea
                id="reason"
                placeholder="Ex: Vendedor mais próximo da região do cliente..."
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={transferring}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedMember || transferring}
          >
            {transferring ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Transferindo...
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4 mr-1.5" />
                Transferir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}