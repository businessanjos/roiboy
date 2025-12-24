import { useState, useRef } from "react";
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
  Image,
  Mic,
  X,
  Download,
} from "lucide-react";
import { toast } from "sonner";

// Format phone number for display
const formatPhoneDisplay = (phone?: string): string => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  
  // Brazilian format: +55 (11) 99999-9999
  if (cleaned.length === 13 && cleaned.startsWith("55")) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith("55")) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  }
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
};

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

interface GroupParticipant {
  id: string;
  phone?: string;
  admin?: string;
  name?: string;
  isClient?: boolean;
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
  
  // Media upload state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Manage participants state
  const [managingGroup, setManagingGroup] = useState<WhatsAppGroup | null>(null);
  const [groupParticipants, setGroupParticipants] = useState<GroupParticipant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [addingParticipants, setAddingParticipants] = useState(false);
  const [removingParticipant, setRemovingParticipant] = useState<string | null>(null);
  const [clientsToAdd, setClientsToAdd] = useState<string[]>([]);
  const [isSyncingGroups, setIsSyncingGroups] = useState(false);
  
  // Sync groups selection state
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<Array<{jid: string; name: string; size: number}>>([]);
  const [selectedGroupsToSync, setSelectedGroupsToSync] = useState<string[]>([]);
  const [isFetchingGroups, setIsFetchingGroups] = useState(false);
  const [isSavingGroups, setIsSavingGroups] = useState(false);

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

  // Send to group mutation (text only)
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
      clearMedia();
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar mensagem: " + error.message);
    },
  });

  // Send media to group mutation
  const sendMediaToGroupMutation = useMutation({
    mutationFn: async ({ groupId, mediaUrl, mediaType, caption }: { 
      groupId: string; 
      mediaUrl: string; 
      mediaType: "image" | "audio";
      caption?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "send_media_to_group",
          group_id: groupId,
          media_url: mediaUrl,
          media_type: mediaType,
          caption,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Mídia enviada com sucesso!");
      setSelectedGroupId(null);
      setMessage("");
      clearMedia();
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar mídia: " + error.message);
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
      // Refresh participants list
      if (managingGroup) {
        fetchGroupParticipants(managingGroup);
      }
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
      // Refresh participants list
      if (managingGroup) {
        fetchGroupParticipants(managingGroup);
      }
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

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    
    if (!isImage && !isAudio) {
      toast.error("Apenas imagens e áudios são suportados");
      return;
    }

    // Check file size (max 16MB)
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 16MB");
      return;
    }

    setMediaFile(file);
    
    // Create preview for images
    if (isImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setMediaPreview(null);
    }
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadMediaToStorage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath = `whatsapp-media/${fileName}`;

    const { data, error } = await supabase.storage
      .from("event-media")
      .upload(filePath, file, { 
        contentType: file.type,
        upsert: false 
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from("event-media")
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSendMessage = async () => {
    if (!selectedGroupId) {
      toast.error("Selecione um grupo");
      return;
    }

    // If has media, send media
    if (mediaFile) {
      setIsUploadingMedia(true);
      try {
        const mediaUrl = await uploadMediaToStorage(mediaFile);
        const mediaType = mediaFile.type.startsWith("image/") ? "image" : "audio";
        
        sendMediaToGroupMutation.mutate({ 
          groupId: selectedGroupId, 
          mediaUrl, 
          mediaType, 
          caption: message.trim() || undefined 
        });
      } catch (error) {
        toast.error("Erro ao fazer upload da mídia");
        console.error(error);
      } finally {
        setIsUploadingMedia(false);
      }
      return;
    }

    // Otherwise, send text
    if (!message.trim()) {
      toast.error("Digite uma mensagem ou selecione uma mídia");
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

  // Fetch group participants when managing
  const fetchGroupParticipants = async (group: WhatsAppGroup) => {
    setLoadingParticipants(true);
    setGroupParticipants([]);
    
    try {
      const groupId = group.group_jid || group.id;
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "group_participants",
          group_id: groupId,
        },
      });
      
      if (error) throw error;
      
      console.log("Participants response:", data);
      
      // Parse different response formats - UAZAPI returns { data: { participants: [...] } } or { participants: [...] }
      let participants: GroupParticipant[] = [];
      
      // Get the actual participants array from different possible locations
      const rawParticipants = 
        data?.data?.participants || 
        data?.participants || 
        data?.data?.Participants || 
        data?.Participants ||
        (Array.isArray(data?.data) ? data.data : null) ||
        (Array.isArray(data) ? data : null) ||
        [];
      
      if (Array.isArray(rawParticipants)) {
        participants = rawParticipants.map((p: { 
          id?: string; 
          Id?: string; 
          JID?: string;
          phone?: string; 
          PhoneNumber?: string;
          admin?: string; 
          Admin?: string; 
          IsAdmin?: boolean;
          IsSuperAdmin?: boolean;
          name?: string; 
          pushName?: string;
          DisplayName?: string;
        }) => {
          // Extract phone from JID or PhoneNumber (format: "5511999999999@s.whatsapp.net" or "123456@lid")
          const jid = p.JID || p.id || p.Id || "";
          const phoneNumber = p.PhoneNumber || p.phone || "";
          
          // Try to get clean phone number
          let phone = "";
          if (phoneNumber && phoneNumber.includes("@")) {
            phone = phoneNumber.split("@")[0];
          } else if (jid && jid.includes("@")) {
            phone = jid.split("@")[0];
          } else {
            phone = phoneNumber || jid;
          }
          
          // Determine admin status
          const isAdmin = p.IsAdmin || p.IsSuperAdmin || p.admin === "admin" || p.Admin === "admin" || p.admin === "superadmin";
          
          return {
            id: jid,
            phone: phone,
            admin: isAdmin ? (p.IsSuperAdmin ? "superadmin" : "admin") : undefined,
            name: p.DisplayName || p.name || p.pushName,
          };
        });
      }
      
      // Enrich participants with client names from database
      if (participants.length > 0 && clients.length > 0) {
        participants = participants.map(p => {
          // Try to find matching client by phone
          const phone = p.phone || "";
          const matchingClient = clients.find(c => {
            const clientPhone = c.phone_e164.replace(/\D/g, "");
            const participantPhone = phone.replace(/\D/g, "");
            
            // Match exact or with/without country code
            return clientPhone === participantPhone || 
                   clientPhone.endsWith(participantPhone) || 
                   participantPhone.endsWith(clientPhone) ||
                   // Also try with "55" prefix for Brazilian numbers
                   clientPhone === `55${participantPhone}` ||
                   participantPhone === `55${clientPhone}`;
          });
          
          if (matchingClient) {
            return {
              ...p,
              name: p.name || matchingClient.full_name,
              isClient: true,
            };
          }
          
          return p;
        });
      }
      
      setGroupParticipants(participants);
    } catch (error) {
      console.error("Error fetching participants:", error);
      toast.error("Erro ao carregar participantes");
    } finally {
      setLoadingParticipants(false);
    }
  };

  // Open manage dialog
  const handleOpenManageDialog = (group: WhatsAppGroup) => {
    setManagingGroup(group);
    fetchGroupParticipants(group);
  };

  // Close manage dialog
  const handleCloseManageDialog = () => {
    setManagingGroup(null);
    setGroupParticipants([]);
    setAddingParticipants(false);
    setClientsToAdd([]);
  };

  const isSendingAny = sendToGroupMutation.isPending || sendMediaToGroupMutation.isPending || isUploadingMedia;

  // Fetch groups from WhatsApp (without saving)
  const handleFetchGroupsForSync = async () => {
    setIsFetchingGroups(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "list_groups" },
      });
      
      if (error) throw error;
      
      const fetchedGroups = (data?.groups || []).map((g: {
        JID?: string; jid?: string; id?: string;
        Name?: string; name?: string; Subject?: string; subject?: string;
        Size?: number; size?: number; Participants?: unknown[];
      }) => ({
        jid: g.JID || g.jid || g.id || "",
        name: g.Name || g.name || g.Subject || g.subject || "Sem nome",
        size: g.Size || g.size || g.Participants?.length || 0,
      })).filter((g: {jid: string}) => g.jid.includes("@g.us"));
      
      // Filter out groups that are already synced
      const existingJids = groups.map(g => g.group_jid);
      const newGroups = fetchedGroups.filter((g: {jid: string}) => !existingJids.includes(g.jid));
      
      if (newGroups.length === 0) {
        toast.info("Todos os grupos já estão sincronizados!");
        return;
      }
      
      setAvailableGroups(newGroups);
      setSelectedGroupsToSync(newGroups.map((g: {jid: string}) => g.jid)); // Select all by default
      setSyncDialogOpen(true);
    } catch (error) {
      toast.error("Erro ao buscar grupos: " + (error as Error).message);
    } finally {
      setIsFetchingGroups(false);
    }
  };

  // Save selected groups to database
  const handleSaveSelectedGroups = async () => {
    if (selectedGroupsToSync.length === 0) {
      toast.error("Selecione pelo menos um grupo");
      return;
    }
    
    setIsSavingGroups(true);
    try {
      const groupsToSave = availableGroups
        .filter(g => selectedGroupsToSync.includes(g.jid))
        .map(g => ({
          group_jid: g.jid,
          name: g.name,
          participant_count: g.size,
        }));
      
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "save_selected_groups",
          groups: groupsToSave,
        },
      });
      
      if (error) throw error;
      
      toast.success(`${groupsToSave.length} grupo(s) sincronizado(s)!`);
      setSyncDialogOpen(false);
      setAvailableGroups([]);
      setSelectedGroupsToSync([]);
      refetchGroups();
    } catch (error) {
      toast.error("Erro ao salvar grupos: " + (error as Error).message);
    } finally {
      setIsSavingGroups(false);
    }
  };

  // Toggle group selection
  const toggleGroupSelection = (jid: string) => {
    setSelectedGroupsToSync(prev => 
      prev.includes(jid) 
        ? prev.filter(id => id !== jid)
        : [...prev, jid]
    );
  };

  // Select/deselect all groups
  const toggleSelectAll = () => {
    if (selectedGroupsToSync.length === availableGroups.length) {
      setSelectedGroupsToSync([]);
    } else {
      setSelectedGroupsToSync(availableGroups.map(g => g.jid));
    }
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
                    variant="default"
                    size="sm"
                    onClick={handleFetchGroupsForSync}
                    disabled={isFetchingGroups}
                  >
                    <Download className={`h-4 w-4 mr-2 ${isFetchingGroups ? "animate-spin" : ""}`} />
                    {isFetchingGroups ? "Buscando..." : "Sincronizar do WhatsApp"}
                  </Button>
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
                              onClick={() => handleOpenManageDialog(group)}
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

              {/* Media attachment */}
              <div>
                <Label className="mb-2 block">Anexar Mídia (opcional)</Label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,audio/*"
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSendingAny}
                  >
                    <Image className="h-4 w-4 mr-2" />
                    Imagem
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = "audio/*";
                        fileInputRef.current.click();
                        fileInputRef.current.accept = "image/*,audio/*";
                      }
                    }}
                    disabled={isSendingAny}
                  >
                    <Mic className="h-4 w-4 mr-2" />
                    Áudio
                  </Button>
                </div>
                
                {/* Media preview */}
                {mediaFile && (
                  <div className="mt-3 p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {mediaFile.type.startsWith("image/") ? (
                          <Image className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Mic className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium truncate max-w-[200px]">
                          {mediaFile.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({(mediaFile.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearMedia}
                        disabled={isSendingAny}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {mediaPreview && (
                      <img 
                        src={mediaPreview} 
                        alt="Preview" 
                        className="mt-2 max-h-32 rounded object-contain"
                      />
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="message">
                  {mediaFile ? "Legenda (opcional)" : "Mensagem"}
                </Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={mediaFile ? "Digite uma legenda..." : "Digite sua mensagem..."}
                  rows={4}
                  className="mt-1"
                />
              </div>

              <Button
                onClick={handleSendMessage}
                disabled={isSendingAny || !selectedGroupId || (!message.trim() && !mediaFile)}
                className="w-full"
              >
                {isSendingAny ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isUploadingMedia ? "Enviando mídia..." : "Enviando..."}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {mediaFile ? "Enviar Mídia" : "Enviar Mensagem"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manage Participants Dialog */}
      <Dialog open={!!managingGroup} onOpenChange={(open) => !open && handleCloseManageDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gerenciar Membros
            </DialogTitle>
            <DialogDescription>
              {managingGroup?.subject || managingGroup?.name} 
              {!loadingParticipants && ` • ${groupParticipants.length} membros`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current participants */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="block">Membros do Grupo</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => managingGroup && fetchGroupParticipants(managingGroup)}
                  disabled={loadingParticipants}
                >
                  <RefreshCw className={`h-4 w-4 ${loadingParticipants ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {loadingParticipants ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Carregando membros...
                  </div>
                ) : groupParticipants.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhum membro encontrado
                  </p>
                ) : (
                  groupParticipants.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${p.isClient ? "bg-primary/10" : "bg-muted"}`}>
                          <Users className={`h-4 w-4 ${p.isClient ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <p className="font-medium">
                            {p.name || formatPhoneDisplay(p.phone) || p.id.split("@")[0]}
                          </p>
                          {p.name && (
                            <p className="text-xs text-muted-foreground">
                              {formatPhoneDisplay(p.phone) || p.id.split("@")[0]}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {p.isClient && (
                            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                              Cliente
                            </Badge>
                          )}
                          {p.admin && (
                            <Badge variant="secondary" className="text-xs">
                              {p.admin === "superadmin" ? "Dono" : "Admin"}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {!p.admin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRemovingParticipant(p.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Remover do grupo"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))
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

      {/* Sync Groups Selection Dialog */}
      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Sincronizar Grupos do WhatsApp
            </DialogTitle>
            <DialogDescription>
              Selecione os grupos que deseja adicionar ao sistema. Grupos já sincronizados não aparecem na lista.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Select all toggle */}
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-sm text-muted-foreground">
                {selectedGroupsToSync.length} de {availableGroups.length} selecionado(s)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
              >
                {selectedGroupsToSync.length === availableGroups.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>

            {/* Groups list */}
            <div className="border rounded-lg max-h-80 overflow-y-auto">
              {availableGroups.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhum grupo novo encontrado
                </p>
              ) : (
                availableGroups.map((group) => (
                  <div
                    key={group.jid}
                    className={`flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors ${
                      selectedGroupsToSync.includes(group.jid) ? "bg-primary/5" : ""
                    }`}
                    onClick={() => toggleGroupSelection(group.jid)}
                  >
                    <Checkbox
                      checked={selectedGroupsToSync.includes(group.jid)}
                      onCheckedChange={() => toggleGroupSelection(group.jid)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.size} membros • {group.jid.split("@")[0]}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSyncDialogOpen(false)}
              disabled={isSavingGroups}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveSelectedGroups}
              disabled={isSavingGroups || selectedGroupsToSync.length === 0}
            >
              {isSavingGroups ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Sincronizar ({selectedGroupsToSync.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
