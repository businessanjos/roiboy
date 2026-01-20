import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Users, 
  UserPlus, 
  Check, 
  X, 
  Clock, 
  UserCheck,
  Mail,
  Phone,
  MoreHorizontal,
  Download,
  Link,
  Copy,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Database } from "@/integrations/supabase/types";

type EventRsvpStatus = Database["public"]["Enums"]["event_rsvp_status"];

interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
  avatar_url: string | null;
  emails: any;
}

interface Participant {
  id: string;
  client_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  rsvp_status: EventRsvpStatus;
  rsvp_responded_at: string | null;
  invited_at: string | null;
  waitlist_position: number | null;
  notes: string | null;
  rsvp_token: string | null;
  clients?: Client;
}

interface ImportRow {
  nome: string;
  email?: string;
  telefone?: string;
  rg?: string;
  notas?: string;
  valid: boolean;
  error?: string;
}

interface EventParticipantsTabProps {
  eventId: string;
  accountId: string | null;
  maxCapacity?: number | null;
  onUpdate?: () => void;
}

const rsvpStatusConfig: Record<EventRsvpStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600", icon: Clock },
  confirmed: { label: "Confirmado", color: "bg-green-500/10 text-green-600", icon: Check },
  declined: { label: "Recusado", color: "bg-red-500/10 text-red-600", icon: X },
  waitlist: { label: "Lista de Espera", color: "bg-blue-500/10 text-blue-600", icon: Clock },
  attended: { label: "Presente", color: "bg-emerald-500/10 text-emerald-600", icon: UserCheck },
  no_show: { label: "Não Compareceu", color: "bg-gray-500/10 text-gray-600", icon: X },
};

export default function EventParticipantsTab({ 
  eventId, 
  accountId, 
  maxCapacity,
  onUpdate 
}: EventParticipantsTabProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchClients, setSearchClients] = useState("");
  const [searchingClients, setSearchingClients] = useState(false);

  // Form state
  const [inviteType, setInviteType] = useState<"client" | "guest">("client");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (eventId && accountId) {
      fetchParticipants();
    }
  }, [eventId, accountId]);

  // Debounced search for clients
  useEffect(() => {
    if (!accountId) return;
    
    const timer = setTimeout(() => {
      searchClientsFromServer(searchClients);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchClients, accountId]);

  const fetchParticipants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_participants")
      .select(`
        *,
        clients (id, full_name, phone_e164, avatar_url, emails)
      `)
      .eq("event_id", eventId)
      .order("invited_at", { ascending: false });

    if (error) {
      console.error("Error fetching participants:", error);
    } else {
      setParticipants(data || []);
    }
    setLoading(false);
  };

  const searchClientsFromServer = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      // Load first 50 clients if no search term
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, phone_e164, avatar_url, emails")
        .order("full_name")
        .limit(50);
      
      setClients((data || []) as Client[]);
      return;
    }
    
    setSearchingClients(true);
    const { data } = await supabase
      .from("clients")
      .select("id, full_name, phone_e164, avatar_url, emails")
      .or(`full_name.ilike.%${searchTerm}%,phone_e164.ilike.%${searchTerm}%`)
      .order("full_name")
      .limit(50);
    
    setClients((data || []) as Client[]);
    setSearchingClients(false);
  };

  const resetForm = () => {
    setInviteType("client");
    setSelectedClientId("");
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    setNotes("");
  };

  const handleAddParticipant = async () => {
    if (!accountId) return;

    // Check capacity
    const confirmedCount = participants.filter(p => p.rsvp_status === 'confirmed').length;
    const shouldWaitlist = maxCapacity && confirmedCount >= maxCapacity;

    const participantData: any = {
      account_id: accountId,
      event_id: eventId,
      rsvp_status: shouldWaitlist ? 'waitlist' : 'pending',
      waitlist_position: shouldWaitlist ? participants.filter(p => p.rsvp_status === 'waitlist').length + 1 : null,
      notes: notes || null,
    };

    if (inviteType === "client") {
      if (!selectedClientId) {
        toast({ title: "Erro", description: "Selecione um cliente", variant: "destructive" });
        return;
      }
      participantData.client_id = selectedClientId;
    } else {
      if (!guestName) {
        toast({ title: "Erro", description: "Nome do convidado é obrigatório", variant: "destructive" });
        return;
      }
      participantData.guest_name = guestName;
      participantData.guest_email = guestEmail || null;
      participantData.guest_phone = guestPhone || null;
    }

    const { error } = await supabase
      .from("event_participants")
      .insert(participantData);

    if (error) {
      console.error("Error adding participant:", error);
      toast({ title: "Erro", description: "Não foi possível adicionar o participante", variant: "destructive" });
    } else {
      toast({ 
        title: shouldWaitlist ? "Adicionado à lista de espera" : "Convidado adicionado", 
        description: shouldWaitlist 
          ? "Evento lotado. Participante foi para a lista de espera."
          : "Convite enviado com sucesso." 
      });
      setDialogOpen(false);
      resetForm();
      fetchParticipants();
      onUpdate?.();
    }
  };

  const updateRsvpStatus = async (participantId: string, newStatus: EventRsvpStatus) => {
    const { error } = await supabase
      .from("event_participants")
      .update({ 
        rsvp_status: newStatus, 
        rsvp_responded_at: new Date().toISOString() 
      })
      .eq("id", participantId);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível atualizar o status", variant: "destructive" });
    } else {
      toast({ title: "Status atualizado" });
      fetchParticipants();
      onUpdate?.();
    }
  };

  const deleteParticipant = async (participantId: string) => {
    const { error } = await supabase
      .from("event_participants")
      .delete()
      .eq("id", participantId);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível remover o participante", variant: "destructive" });
    } else {
      toast({ title: "Participante removido" });
      fetchParticipants();
      onUpdate?.();
    }
  };

  const exportCSV = () => {
    const headers = ["Nome", "Email", "Telefone", "Status", "Data Convite", "Notas"];
    const rows = participants.map(p => {
      const clientEmails = p.clients?.emails;
      const emailValue = Array.isArray(clientEmails) && clientEmails.length > 0 && typeof clientEmails[0] === 'object'
        ? clientEmails[0]?.email
        : p.guest_email || "";
      return [
        p.clients?.full_name || p.guest_name || "",
        emailValue,
        p.clients?.phone_e164 || p.guest_phone || "",
        rsvpStatusConfig[p.rsvp_status].label,
        p.invited_at ? format(new Date(p.invited_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
        p.notes || ""
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `participantes-evento.csv`;
    link.click();
  };

  // CSV Import functions
  const parseCSV = (text: string): ImportRow[] => {
    // Clean content
    const cleanContent = text
      .replace(/^\uFEFF/, '')
      .replace(/\0/g, '')
      .trim();

    // Detect separator
    const separator = cleanContent.includes(';') ? ';' : ',';

    const lines = cleanContent.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(separator).map(h => h.replace(/"/g, '').trim());

    return lines.slice(1).map(line => {
      // Parse CSV line properly handling quoted values
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ''));

      const row: ImportRow = { nome: '', valid: false };

      headers.forEach((h, i) => {
        const value = values[i] || '';
        if (h === 'nome' || h === 'name') row.nome = value;
        if (h === 'email' || h === 'e-mail') row.email = value;
        if (h === 'telefone' || h === 'phone' || h === 'tel') row.telefone = value;
        if (h === 'rg') row.rg = value;
        if (h === 'notas' || h === 'notes' || h === 'observacoes' || h === 'observações') row.notas = value;
      });

      row.valid = !!row.nome;
      row.error = !row.nome ? 'Nome obrigatório' : undefined;

      return row;
    }).filter(row => row.nome || row.email || row.telefone); // Filter empty rows
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      if (rows.length === 0) {
        toast({ 
          title: "Arquivo vazio", 
          description: "Nenhum dado encontrado no arquivo CSV", 
          variant: "destructive" 
        });
        return;
      }

      setImportPreview(rows);
      setImportDialogOpen(true);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      toast({ 
        title: "Erro ao ler arquivo", 
        description: "Verifique se o arquivo é um CSV válido", 
        variant: "destructive" 
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportConfirm = async () => {
    if (!accountId) return;
    setImporting(true);

    const validRows = importPreview.filter(r => r.valid);
    const toInsert = validRows.map(row => ({
      account_id: accountId,
      event_id: eventId,
      guest_name: row.nome,
      guest_email: row.email || null,
      guest_phone: row.telefone || null,
      guest_rg: row.rg || null,
      notes: row.notas || null,
      rsvp_status: 'pending' as const,
    }));

    const { error } = await supabase
      .from('event_participants')
      .insert(toInsert);

    if (error) {
      console.error("Error importing participants:", error);
      toast({ 
        title: "Erro na importação", 
        description: "Não foi possível importar os participantes", 
        variant: "destructive" 
      });
    } else {
      toast({ 
        title: "Importação concluída", 
        description: `${validRows.length} convidado(s) importado(s) com sucesso` 
      });
      setImportDialogOpen(false);
      setImportPreview([]);
      fetchParticipants();
      onUpdate?.();
    }

    setImporting(false);
  };

  const getParticipantName = (p: Participant) => p.clients?.full_name || p.guest_name || "—";
  const getParticipantEmail = (p: Participant) => {
    const emails = p.clients?.emails;
    if (Array.isArray(emails) && emails.length > 0 && typeof emails[0] === 'object') {
      return emails[0]?.email;
    }
    return p.guest_email;
  };
  const getParticipantPhone = (p: Participant) => p.clients?.phone_e164 || p.guest_phone;

  const stats = {
    total: participants.length,
    confirmed: participants.filter(p => p.rsvp_status === 'confirmed').length,
    pending: participants.filter(p => p.rsvp_status === 'pending').length,
    waitlist: participants.filter(p => p.rsvp_status === 'waitlist').length,
    declined: participants.filter(p => p.rsvp_status === 'declined').length,
    attended: participants.filter(p => p.rsvp_status === 'attended').length,
    noShow: participants.filter(p => p.rsvp_status === 'no_show').length,
  };

  const filteredClients = clients.filter(c => 
    c.full_name.toLowerCase().includes(searchClients.toLowerCase()) &&
    !participants.some(p => p.client_id === c.id)
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="p-3">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
          <p className="text-xs text-muted-foreground">Confirmados</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-bold text-emerald-600">{stats.attended}</p>
          <p className="text-xs text-muted-foreground">Presentes</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-bold text-blue-600">{stats.waitlist}</p>
          <p className="text-xs text-muted-foreground">Lista de Espera</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-bold text-red-600">{stats.declined}</p>
          <p className="text-xs text-muted-foreground">Recusados</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-bold text-gray-500">{stats.noShow}</p>
          <p className="text-xs text-muted-foreground">Faltaram</p>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Convidar
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileUpload}
          />
          {participants.length > 0 && (
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          )}
        </div>
        {maxCapacity && (
          <Badge variant={stats.confirmed >= maxCapacity ? "destructive" : "outline"}>
            {stats.confirmed >= maxCapacity ? "Esgotado" : "Capacidade"}: {stats.confirmed}/{maxCapacity}
          </Badge>
        )}
      </div>

      {/* Participants List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Participantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : participants.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum participante"
              description="Comece convidando clientes ou adicione convidados externos."
              action={{
                label: "Convidar",
                onClick: () => setDialogOpen(true)
              }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participante</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((p) => {
                  const StatusIcon = rsvpStatusConfig[p.rsvp_status].icon;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div 
                          className={`flex items-center gap-3 ${p.client_id ? 'cursor-pointer hover:opacity-80' : ''}`}
                          onClick={(e) => {
                            if (p.client_id) {
                              e.stopPropagation();
                              navigate(`/clients/${p.client_id}`);
                            }
                          }}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={p.clients?.avatar_url || undefined} />
                            <AvatarFallback>
                              {getParticipantName(p).substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className={`font-medium ${p.client_id ? 'text-foreground hover:text-primary hover:underline' : ''}`}>
                              {getParticipantName(p)}
                            </p>
                            {!p.client_id && (
                              <Badge variant="outline" className="text-xs">Externo</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getParticipantEmail(p) && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {getParticipantEmail(p)}
                            </div>
                          )}
                          {getParticipantPhone(p) && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {getParticipantPhone(p)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={rsvpStatusConfig[p.rsvp_status].color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {rsvpStatusConfig[p.rsvp_status].label}
                          {p.waitlist_position && ` #${p.waitlist_position}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.invited_at && format(new Date(p.invited_at), "dd/MM/yy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {p.rsvp_token && (
                              <DropdownMenuItem onClick={() => {
                                const link = `${window.location.origin}/rsvp/${p.rsvp_token}`;
                                navigator.clipboard.writeText(link);
                                toast({ title: "Link copiado!", description: "Envie para o convidado confirmar presença." });
                              }}>
                                <Link className="h-4 w-4 mr-2 text-primary" /> Copiar Link RSVP
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => updateRsvpStatus(p.id, 'confirmed')}>
                              <Check className="h-4 w-4 mr-2 text-green-600" /> Confirmar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateRsvpStatus(p.id, 'attended')}>
                              <UserCheck className="h-4 w-4 mr-2 text-emerald-600" /> Marcar Presente
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateRsvpStatus(p.id, 'declined')}>
                              <X className="h-4 w-4 mr-2 text-red-600" /> Recusar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateRsvpStatus(p.id, 'no_show')}>
                              <X className="h-4 w-4 mr-2 text-gray-600" /> Não Compareceu
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => deleteParticipant(p.id)}
                              className="text-destructive"
                            >
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Participant Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Participante</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Convite</Label>
              <Select value={inviteType} onValueChange={(v: "client" | "guest") => setInviteType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Cliente Existente</SelectItem>
                  <SelectItem value="guest">Convidado Externo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {inviteType === "client" ? (
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input
                  placeholder="Buscar cliente pelo nome ou telefone..."
                  value={searchClients}
                  onChange={(e) => setSearchClients(e.target.value)}
                />
                <div className="max-h-40 overflow-y-auto border rounded-md">
                  {searchingClients ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-muted-foreground">Buscando...</span>
                    </div>
                  ) : filteredClients.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      {searchClients.length < 2 
                        ? "Digite ao menos 2 caracteres para buscar" 
                        : "Nenhum cliente encontrado"}
                    </div>
                  ) : (
                    filteredClients.slice(0, 10).map(client => (
                      <div
                        key={client.id}
                        className={`p-2 cursor-pointer hover:bg-muted flex items-center gap-2 ${
                          selectedClientId === client.id ? 'bg-muted' : ''
                        }`}
                        onClick={() => setSelectedClientId(client.id)}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={client.avatar_url || undefined} />
                          <AvatarFallback>{client.full_name.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{client.full_name}</span>
                        {selectedClientId === client.id && (
                          <Check className="h-4 w-4 ml-auto text-primary" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Nome do convidado"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações sobre o participante..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddParticipant}>
              <UserPlus className="h-4 w-4 mr-2" />
              Convidar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Lista de Convidados
            </DialogTitle>
            <DialogDescription>
              Revise os dados antes de confirmar a importação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  {importPreview.filter(r => r.valid).length} válidos
                </Badge>
              </div>
              {importPreview.filter(r => !r.valid).length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-500/10 text-red-600">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {importPreview.filter(r => !r.valid).length} inválidos
                  </Badge>
                </div>
              )}
            </div>

            {/* Preview Table */}
            <ScrollArea className="h-[300px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>RG</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importPreview.map((row, idx) => (
                    <TableRow key={idx} className={!row.valid ? 'bg-red-500/5' : ''}>
                      <TableCell>
                        {row.valid ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.nome || <span className="text-red-600 text-sm">{row.error}</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.email || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{row.telefone || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{row.rg || '—'}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[150px] truncate">
                        {row.notas || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
              Formato esperado: CSV com colunas nome, email, telefone, rg, notas (separador: vírgula ou ponto-e-vírgula)
            </p>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setImportDialogOpen(false);
                setImportPreview([]);
              }}
              disabled={importing}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleImportConfirm}
              disabled={importing || importPreview.filter(r => r.valid).length === 0}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar {importPreview.filter(r => r.valid).length} convidado(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}