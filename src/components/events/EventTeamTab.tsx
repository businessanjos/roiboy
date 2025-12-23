import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Users2, 
  Trash2,
  Star,
  Mic,
  Camera,
  UserCog,
  Headphones,
  User,
  Building2,
  Home,
  GraduationCap
} from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type EventTeamRole = Database["public"]["Enums"]["event_team_role"];

interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface TeamMember {
  id: string;
  user_id: string;
  role: EventTeamRole;
  role_description: string | null;
  responsibilities: string | null;
  is_primary: boolean;
  is_external: boolean;
  users?: User;
}

interface EventTeamTabProps {
  eventId: string;
  accountId: string | null;
}

const roleConfig: Record<EventTeamRole, { label: string; icon: React.ElementType; color: string }> = {
  organizer: { label: "Organizador", icon: Star, color: "bg-yellow-500/10 text-yellow-600" },
  coordinator: { label: "Coordenador", icon: UserCog, color: "bg-blue-500/10 text-blue-600" },
  support: { label: "Apoio", icon: Headphones, color: "bg-green-500/10 text-green-600" },
  speaker: { label: "Palestrante", icon: Mic, color: "bg-purple-500/10 text-purple-600" },
  mentor: { label: "Mentor", icon: GraduationCap, color: "bg-indigo-500/10 text-indigo-600" },
  host: { label: "Anfitrião", icon: User, color: "bg-pink-500/10 text-pink-600" },
  photographer: { label: "Fotógrafo", icon: Camera, color: "bg-orange-500/10 text-orange-600" },
  other: { label: "Outro", icon: User, color: "bg-gray-500/10 text-gray-600" },
};

export default function EventTeamTab({ eventId, accountId }: EventTeamTabProps) {
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [role, setRole] = useState<EventTeamRole>("support");
  const [roleDescription, setRoleDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [isExternal, setIsExternal] = useState(false);

  useEffect(() => {
    if (eventId && accountId) {
      fetchTeamMembers();
      fetchUsers();
    }
  }, [eventId, accountId]);

  const fetchTeamMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_team")
      .select(`
        *,
        users (id, name, email, avatar_url)
      `)
      .eq("event_id", eventId)
      .order("is_primary", { ascending: false });

    if (error) {
      console.error("Error fetching team:", error);
    } else {
      setTeamMembers(data || []);
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, avatar_url")
      .order("name");

    if (!error && data) {
      setUsers(data);
    }
  };

  const resetForm = () => {
    setSelectedUserId("");
    setRole("support");
    setRoleDescription("");
    setResponsibilities("");
    setIsPrimary(false);
    setIsExternal(false);
  };

  const handleAddMember = async () => {
    if (!accountId || !selectedUserId) {
      toast({ title: "Erro", description: "Selecione um membro da equipe", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("event_team")
      .insert({
        account_id: accountId,
        event_id: eventId,
        user_id: selectedUserId,
        role,
        role_description: roleDescription || null,
        responsibilities: responsibilities || null,
        is_primary: isPrimary,
        is_external: isExternal,
      });

    if (error) {
      if (error.code === '23505') {
        toast({ title: "Erro", description: "Este membro já faz parte da equipe", variant: "destructive" });
      } else {
        console.error("Error adding team member:", error);
        toast({ title: "Erro", description: "Não foi possível adicionar o membro", variant: "destructive" });
      }
    } else {
      toast({ title: "Membro adicionado" });
      setDialogOpen(false);
      resetForm();
      fetchTeamMembers();
    }
  };

  const deleteMember = async (memberId: string) => {
    const { error } = await supabase
      .from("event_team")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível remover o membro", variant: "destructive" });
    } else {
      toast({ title: "Membro removido" });
      fetchTeamMembers();
    }
  };

  const availableUsers = users.filter(u => !teamMembers.some(m => m.user_id === u.id));

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-between items-center">
        <Button onClick={() => setDialogOpen(true)} disabled={availableUsers.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar à Equipe
        </Button>
      </div>

      {/* Team Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : teamMembers.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="Nenhum membro na equipe"
          description="Adicione membros da sua equipe para organizar o evento."
          action={{
            label: "Adicionar Membro",
            onClick: () => setDialogOpen(true)
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map((member) => {
            const RoleIcon = roleConfig[member.role].icon;
            return (
              <Card key={member.id} className={member.is_primary ? 'ring-2 ring-primary' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.users?.avatar_url || undefined} />
                        <AvatarFallback>
                          {member.users?.name?.substring(0, 2).toUpperCase() || "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{member.users?.name}</p>
                          {member.is_primary && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{member.users?.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteMember(member.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={roleConfig[member.role].color}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {roleConfig[member.role].label}
                      </Badge>
                      <Badge variant="outline" className={member.is_external ? "border-orange-500 text-orange-600" : "border-blue-500 text-blue-600"}>
                        {member.is_external ? (
                          <>
                            <Building2 className="h-3 w-3 mr-1" />
                            Externo
                          </>
                        ) : (
                          <>
                            <Home className="h-3 w-3 mr-1" />
                            Interno
                          </>
                        )}
                      </Badge>
                    </div>
                    
                    {member.role_description && (
                      <p className="text-sm font-medium">{member.role_description}</p>
                    )}
                    
                    {member.responsibilities && (
                      <p className="text-sm text-muted-foreground">{member.responsibilities}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Member Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar à Equipe</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Membro</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um membro..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>{user.name?.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        {user.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={role} onValueChange={(v: EventTeamRole) => setRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição da Função</Label>
              <Textarea
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="Ex: Responsável pela recepção dos convidados"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Responsabilidades</Label>
              <Textarea
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
                placeholder="Liste as responsabilidades deste membro..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Classificação</Label>
              <Select value={isExternal ? "external" : "internal"} onValueChange={(v) => setIsExternal(v === "external")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Interno (da equipe)
                    </div>
                  </SelectItem>
                  <SelectItem value="external">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Externo (contratado/convidado)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Responsável Principal</Label>
                <p className="text-xs text-muted-foreground">
                  Marcar como organizador principal
                </p>
              </div>
              <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddMember}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}