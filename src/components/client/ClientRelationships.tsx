import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Users, 
  Plus, 
  Heart, 
  Briefcase, 
  UserPlus, 
  Link2, 
  Trash2,
  ExternalLink,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type RelationshipType = "spouse" | "partner" | "dependent" | "associate" | "other";

interface ClientRelationship {
  id: string;
  primary_client_id: string;
  related_client_id: string;
  relationship_type: RelationshipType;
  relationship_label: string | null;
  notes: string | null;
  is_active: boolean;
  primary_client?: {
    id: string;
    full_name: string;
    phone_e164: string;
    avatar_url: string | null;
  };
  related_client?: {
    id: string;
    full_name: string;
    phone_e164: string;
    avatar_url: string | null;
  };
}

interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
  avatar_url: string | null;
}

interface ClientRelationshipsProps {
  clientId: string;
  accountId: string;
}

const relationshipTypeLabels: Record<RelationshipType, { label: string; icon: React.ReactNode; color: string }> = {
  spouse: { label: "Cônjuge", icon: <Heart className="h-3 w-3" />, color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  partner: { label: "Parceiro(a)", icon: <Heart className="h-3 w-3" />, color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  dependent: { label: "Dependente", icon: <UserPlus className="h-3 w-3" />, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  associate: { label: "Sócio", icon: <Briefcase className="h-3 w-3" />, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  other: { label: "Outro", icon: <Link2 className="h-3 w-3" />, color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

export function ClientRelationships({ clientId, accountId }: ClientRelationshipsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("spouse");
  const [relationshipLabel, setRelationshipLabel] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch relationships where this client is primary or related
  const { data: relationships, isLoading } = useQuery({
    queryKey: ["client-relationships", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_relationships")
        .select(`
          *,
          primary_client:clients!client_relationships_primary_client_id_fkey(id, full_name, phone_e164, avatar_url),
          related_client:clients!client_relationships_related_client_id_fkey(id, full_name, phone_e164, avatar_url)
        `)
        .or(`primary_client_id.eq.${clientId},related_client_id.eq.${clientId}`)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ClientRelationship[];
    },
  });

  // Fetch available clients for linking
  const { data: availableClients } = useQuery({
    queryKey: ["available-clients", accountId, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("clients")
        .select("id, full_name, phone_e164, avatar_url")
        .eq("account_id", accountId)
        .neq("id", clientId)
        .order("full_name");

      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,phone_e164.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data as Client[];
    },
    enabled: isOpen,
  });

  // Filter out already linked clients
  const linkedClientIds = relationships?.flatMap(r => [r.primary_client_id, r.related_client_id]) || [];
  const filteredClients = availableClients?.filter(c => !linkedClientIds.includes(c.id)) || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClientId) throw new Error("Selecione um cliente");
      
      const { error } = await supabase
        .from("client_relationships")
        .insert({
          account_id: accountId,
          primary_client_id: clientId,
          related_client_id: selectedClientId,
          relationship_type: relationshipType,
          relationship_label: relationshipLabel || null,
          notes: notes || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-relationships", clientId] });
      toast.success("Vínculo criado com sucesso!");
      resetForm();
      setIsOpen(false);
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.error("Este vínculo já existe");
      } else {
        toast.error("Erro ao criar vínculo");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_relationships")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-relationships", clientId] });
      toast.success("Vínculo removido");
      setDeleteId(null);
    },
    onError: () => {
      toast.error("Erro ao remover vínculo");
    },
  });

  const resetForm = () => {
    setSelectedClientId("");
    setRelationshipType("spouse");
    setRelationshipLabel("");
    setNotes("");
    setSearchTerm("");
  };

  const getLinkedClient = (relationship: ClientRelationship): Client => {
    if (relationship.primary_client_id === clientId) {
      return relationship.related_client!;
    }
    return relationship.primary_client!;
  };

  const getRelationshipDirection = (relationship: ClientRelationship): string => {
    if (relationship.primary_client_id === clientId) {
      return "→"; // This client is the primary
    }
    return "←"; // This client is the related
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Vínculos Familiares/Societários
        </CardTitle>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Vínculo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Vínculo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Buscar Cliente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {filteredClients && filteredClients.length > 0 && (
                <div className="space-y-2">
                  <Label>Selecionar Cliente</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredClients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.full_name} ({client.phone_e164})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {searchTerm && filteredClients?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Nenhum cliente encontrado
                </p>
              )}

              <div className="space-y-2">
                <Label>Tipo de Vínculo</Label>
                <Select value={relationshipType} onValueChange={(v) => setRelationshipType(v as RelationshipType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(relationshipTypeLabels).map(([key, { label, icon }]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          {icon}
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Rótulo Personalizado (opcional)</Label>
                <Input
                  placeholder="Ex: Esposa, Sócio Majoritário..."
                  value={relationshipLabel}
                  onChange={(e) => setRelationshipLabel(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea
                  placeholder="Notas sobre o vínculo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <Button 
                className="w-full" 
                onClick={() => createMutation.mutate()}
                disabled={!selectedClientId || createMutation.isPending}
              >
                {createMutation.isPending ? "Criando..." : "Criar Vínculo"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : relationships && relationships.length > 0 ? (
          <div className="space-y-3">
            {relationships.map((relationship) => {
              const linkedClient = getLinkedClient(relationship);
              const typeInfo = relationshipTypeLabels[relationship.relationship_type];
              const isPrimary = relationship.primary_client_id === clientId;
              
              return (
                <div
                  key={relationship.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {linkedClient.avatar_url ? (
                        <img src={linkedClient.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{linkedClient.full_name}</span>
                        <Badge variant="outline" className={`text-xs ${typeInfo.color}`}>
                          {typeInfo.icon}
                          <span className="ml-1">
                            {relationship.relationship_label || typeInfo.label}
                          </span>
                        </Badge>
                        {!isPrimary && (
                          <Badge variant="secondary" className="text-xs">
                            Principal
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{linkedClient.phone_e164}</p>
                      {relationship.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{relationship.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => navigate(`/clients/${linkedClient.id}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(relationship.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum vínculo cadastrado</p>
            <p className="text-sm">Adicione cônjuges, sócios ou dependentes</p>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O vínculo será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}