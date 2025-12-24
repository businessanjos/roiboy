import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users,
  MessageSquare,
  Plus,
  Send,
  Loader2,
  RefreshCw,
  UserPlus,
  UserMinus,
  Search,
  UsersRound,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface WhatsAppGroup {
  id: string;
  group_jid: string;
  name: string;
  description?: string;
  owner_phone?: string;
  participant_count: number;
  created_at: string;
  // Legacy fields from API
  subject?: string;
  participants?: Array<{ id: string; admin?: string }>;
  size?: number;
}

interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
}

export default function WhatsAppGroups() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("list");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Create group state
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  
  // Send message state
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // Manage participants state
  const [managingGroup, setManagingGroup] = useState<WhatsAppGroup | null>(null);
  const [addingParticipants, setAddingParticipants] = useState(false);
  const [removingParticipant, setRemovingParticipant] = useState<string | null>(null);
  const [clientsToAdd, setClientsToAdd] = useState<string[]>([]);

  // Fetch groups from database
  const { data: groups = [], isLoading: loadingGroups, refetch: refetchGroups } = useQuery({
    queryKey: ["whatsapp-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_groups")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return data as WhatsAppGroup[];
    },
    refetchOnWindowFocus: false,
  });

  // Fetch clients for adding to groups
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, phone_e164")
        .not("phone_e164", "is", null)
        .order("full_name");
      if (error) throw error;
      return data as Client[];
    },
  });

  // Filter groups by search
  const filteredGroups = groups.filter(g => {
    const name = g.name || g.subject || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async ({ name, participants }: { name: string; participants: string[] }) => {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "create_group",
          group_name: name,
          participants,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Grupo criado com sucesso!");
      setNewGroupName("");
      setSelectedClients([]);
      setActiveTab("list");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-groups"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar grupo: " + error.message);
    },
  });

  // Send to group mutation
  const sendToGroupMutation = useMutation({
    mutationFn: async ({ groupId, message }: { groupId: string; message: string }) => {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "send_to_group",
          group_id: groupId,
          message,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Mensagem enviada com sucesso!");
      setSelectedGroupId(null);
      setMessage("");
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar mensagem: " + error.message);
    },
  });

  // Add participant mutation
  const addParticipantMutation = useMutation({
    mutationFn: async ({ groupId, participants }: { groupId: string; participants: string[] }) => {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "add_participant",
          group_id: groupId,
          participants,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Participante(s) adicionado(s) com sucesso!");
      setAddingParticipants(false);
      setClientsToAdd([]);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-groups"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao adicionar participante: " + error.message);
    },
  });

  // Remove participant mutation
  const removeParticipantMutation = useMutation({
    mutationFn: async ({ groupId, participants }: { groupId: string; participants: string[] }) => {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "remove_participant",
          group_id: groupId,
          participants,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Participante removido com sucesso!");
      setRemovingParticipant(null);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-groups"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover participante: " + error.message);
    },
  });

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      toast.error("Nome do grupo é obrigatório");
      return;
    }
    if (selectedClients.length === 0) {
      toast.error("Selecione pelo menos um cliente");
      return;
    }

    const phones = clients
      .filter(c => selectedClients.includes(c.id))
      .map(c => c.phone_e164);

    createGroupMutation.mutate({ name: newGroupName, participants: phones });
  };

  const handleSendMessage = () => {
    if (!selectedGroupId || !message.trim()) {
      toast.error("Selecione um grupo e digite uma mensagem");
      return;
    }
    sendToGroupMutation.mutate({ groupId: selectedGroupId, message });
  };

  const handleAddParticipants = () => {
    if (!managingGroup || clientsToAdd.length === 0) return;
    
    const phones = clients
      .filter(c => clientsToAdd.includes(c.id))
      .map(c => c.phone_e164);
    
    addParticipantMutation.mutate({ groupId: managingGroup.group_jid || managingGroup.id, participants: phones });
  };

  const handleRemoveParticipant = () => {
    if (!managingGroup || !removingParticipant) return;
    removeParticipantMutation.mutate({ 
      groupId: managingGroup.group_jid || managingGroup.id, 
      participants: [removingParticipant] 
    });
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const toggleClientToAdd = (clientId: string) => {
    setClientsToAdd(prev => 
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <UsersRound className="h-6 w-6" />
          Grupos WhatsApp
        </h1>
        <p className="text-muted-foreground">
          Gerencie seus grupos de WhatsApp e envie mensagens
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Meus Grupos
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Criar Grupo
          </TabsTrigger>
          <TabsTrigger value="send" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Enviar Mensagem
          </TabsTrigger>
        </TabsList>

        {/* List Groups Tab */}
        <TabsContent value="list" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Meus Grupos</CardTitle>
                  <CardDescription>
                    {groups.length} grupo(s) encontrado(s)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar grupo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchGroups()}
                    disabled={loadingGroups}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingGroups ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingGroups ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  Carregando grupos...
                </div>
              ) : groups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum grupo encontrado</p>
                  <p className="text-sm mt-1">
                    Verifique se o WhatsApp está conectado ou crie um novo grupo.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome do Grupo</TableHead>
                      <TableHead>Participantes</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{group.name || group.subject || "Sem nome"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {group.participant_count || group.size || group.participants?.length || 0} membros
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {(group.group_jid || group.id).split("@")[0]}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setManagingGroup(group)}
                              title="Gerenciar participantes"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedGroupId(group.group_jid || group.id);
                                setActiveTab("send");
                              }}
                              title="Enviar mensagem"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create Group Tab */}
        <TabsContent value="create" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Criar Novo Grupo
              </CardTitle>
              <CardDescription>
                Crie um grupo e adicione clientes automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="group-name">Nome do Grupo</Label>
                <Input
                  id="group-name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Ex: Grupo VIP Clientes"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="mb-3 block">
                  Selecione os Clientes ({selectedClients.length} selecionados)
                </Label>
                <div className="border rounded-lg max-h-72 overflow-y-auto">
                  {clients.map((client) => (
                    <div
                      key={client.id}
                      className={`flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer transition-colors ${
                        selectedClients.includes(client.id) ? "bg-accent" : "hover:bg-muted/50"
                      }`}
                      onClick={() => toggleClientSelection(client.id)}
                    >
                      <Checkbox checked={selectedClients.includes(client.id)} />
                      <div className="flex-1">
                        <p className="font-medium">{client.full_name}</p>
                        <p className="text-sm text-muted-foreground">{client.phone_e164}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleCreateGroup}
                disabled={createGroupMutation.isPending || !newGroupName.trim() || selectedClients.length === 0}
                className="w-full"
              >
                {createGroupMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando grupo...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Grupo
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Send Message Tab */}
        <TabsContent value="send" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Enviar Mensagem para Grupo
              </CardTitle>
              <CardDescription>
                Selecione um grupo e envie uma mensagem
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Selecione o Grupo</Label>
                <div className="grid gap-2 mt-2 max-h-48 overflow-y-auto">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedGroupId === group.id 
                          ? "border-primary bg-primary/5" 
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedGroupId(group.id)}
                    >
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{group.subject || group.name || "Sem nome"}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {group.size || group.participants?.length || 0} membros
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  rows={6}
                  className="mt-1"
                />
              </div>

              <Button
                onClick={handleSendMessage}
                disabled={sendToGroupMutation.isPending || !selectedGroupId || !message.trim()}
                className="w-full"
              >
                {sendToGroupMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Mensagem
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manage Participants Dialog */}
      <Dialog open={!!managingGroup} onOpenChange={(open) => !open && setManagingGroup(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Participantes</DialogTitle>
            <DialogDescription>
              {managingGroup?.subject || managingGroup?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current participants */}
            <div>
              <Label className="mb-2 block">Participantes Atuais</Label>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {managingGroup?.participants?.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{p.id.split("@")[0]}</span>
                      {p.admin && (
                        <Badge variant="secondary" className="text-xs">
                          {p.admin === "superadmin" ? "Dono" : "Admin"}
                        </Badge>
                      )}
                    </div>
                    {!p.admin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemovingParticipant(p.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )) || (
                  <p className="text-center py-4 text-muted-foreground">
                    Carregando participantes...
                  </p>
                )}
              </div>
            </div>

            {/* Add participants */}
            {addingParticipants ? (
              <div>
                <Label className="mb-2 block">
                  Adicionar Clientes ({clientsToAdd.length} selecionados)
                </Label>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {clients.map((client) => (
                    <div
                      key={client.id}
                      className={`flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer ${
                        clientsToAdd.includes(client.id) ? "bg-accent" : "hover:bg-muted/50"
                      }`}
                      onClick={() => toggleClientToAdd(client.id)}
                    >
                      <Checkbox checked={clientsToAdd.includes(client.id)} />
                      <div>
                        <p className="font-medium">{client.full_name}</p>
                        <p className="text-xs text-muted-foreground">{client.phone_e164}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={handleAddParticipants}
                    disabled={addParticipantMutation.isPending || clientsToAdd.length === 0}
                  >
                    {addParticipantMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    Adicionar
                  </Button>
                  <Button variant="outline" onClick={() => setAddingParticipants(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setAddingParticipants(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Participantes
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Participant Confirmation */}
      <AlertDialog open={!!removingParticipant} onOpenChange={(open) => !open && setRemovingParticipant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Participante</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este participante do grupo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveParticipant}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeParticipantMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserMinus className="h-4 w-4 mr-2" />
              )}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
