import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  GitMerge, 
  ArrowRight, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Tag, 
  FileText, 
  Instagram, 
  Briefcase, 
  Building2, 
  MapPin, 
  MessageCircle,
  ClipboardList,
  CalendarCheck,
  CheckSquare,
  Heart,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MergedClientData } from "@/hooks/useClientMerge";

interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
  email: string | null;
  emails: string[] | null;
  additional_phones: string[] | null;
  cpf: string | null;
  cnpj: string | null;
  instagram: string | null;
  instagrams: string[] | null;
  company_name: string | null;
  birth_date: string | null;
  notes: string | null;
  tags: string[];
  status: string;
  responsible_user_id: string | null;
  avatar_url: string | null;
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

interface MergeClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceClient: Client;
  clients: Client[];
  onMerge: (sourceClientId: string, targetClientId: string, mergedData: MergedClientData, sourceClientName: string) => Promise<boolean>;
}

type MergeChoice = "source" | "target";

interface FieldChoice {
  full_name: MergeChoice;
  phone_e164: MergeChoice;
  email: MergeChoice;
  cpf: MergeChoice;
  cnpj: MergeChoice;
  instagram: MergeChoice;
  company_name: MergeChoice;
  birth_date: MergeChoice;
  responsible_user_id: MergeChoice;
  status: MergeChoice;
  address: MergeChoice;
}

const getInitials = (name: string) => {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
};

export function MergeClientDialog({
  open,
  onOpenChange,
  sourceClient,
  clients,
  onMerge,
}: MergeClientDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [targetClient, setTargetClient] = useState<Client | null>(null);
  const [merging, setMerging] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [counts, setCounts] = useState({
    followups: 0,
    lifeEvents: 0,
    contracts: 0,
    deals: 0,
    conversations: 0,
    tasks: 0,
    events: 0,
  });
  const [choices, setChoices] = useState<FieldChoice>({
    full_name: "target",
    phone_e164: "target",
    email: "target",
    cpf: "target",
    cnpj: "target",
    instagram: "target",
    company_name: "target",
    birth_date: "target",
    responsible_user_id: "target",
    status: "target",
    address: "target",
  });

  const fetchMergeCounts = async (sourceId: string) => {
    setLoadingCounts(true);
    try {
      const [
        followupsResult,
        lifeEventsResult,
        contractsResult,
        dealsResult,
        conversationsResult,
        tasksResult,
        eventsResult,
      ] = await Promise.all([
        supabase.from("client_followups").select("*", { count: "exact", head: true }).eq("client_id", sourceId),
        supabase.from("client_life_events").select("*", { count: "exact", head: true }).eq("client_id", sourceId),
        supabase.from("client_contracts").select("*", { count: "exact", head: true }).eq("client_id", sourceId),
        supabase.from("deals").select("*", { count: "exact", head: true }).eq("client_id", sourceId),
        supabase.from("zapp_conversations").select("*", { count: "exact", head: true }).eq("client_id", sourceId),
        supabase.from("internal_tasks").select("*", { count: "exact", head: true }).eq("client_id", sourceId),
        supabase.from("event_participants").select("*", { count: "exact", head: true }).eq("client_id", sourceId),
      ]);

      setCounts({
        followups: followupsResult.count || 0,
        lifeEvents: lifeEventsResult.count || 0,
        contracts: contractsResult.count || 0,
        deals: dealsResult.count || 0,
        conversations: conversationsResult.count || 0,
        tasks: tasksResult.count || 0,
        events: eventsResult.count || 0,
      });
    } catch (error) {
      console.error("Error fetching merge counts:", error);
    } finally {
      setLoadingCounts(false);
    }
  };

  // Filter clients for search (exclude source client)
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return clients
      .filter(c => c.id !== sourceClient.id)
      .filter(c =>
        c.full_name.toLowerCase().includes(query) ||
        c.phone_e164?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.cpf?.toLowerCase().includes(query) ||
        c.cnpj?.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [clients, searchQuery, sourceClient.id]);

  const handleSelectTarget = (client: Client) => {
    setTargetClient(client);
    setSearchQuery("");
    fetchMergeCounts(sourceClient.id);
  };

  const handleChoiceChange = (field: keyof FieldChoice, value: MergeChoice) => {
    setChoices(prev => ({ ...prev, [field]: value }));
  };

  const handleMerge = async () => {
    if (!targetClient) return;

    setMerging(true);
    try {
      const sourceAddress = choices.address === "source";
      
      // Build merged data based on choices
      const mergedData: MergedClientData = {
        full_name: choices.full_name === "source" ? sourceClient.full_name : targetClient.full_name,
        phone_e164: choices.phone_e164 === "source" ? sourceClient.phone_e164 : targetClient.phone_e164,
        email: choices.email === "source" ? sourceClient.email : targetClient.email,
        cpf: choices.cpf === "source" ? sourceClient.cpf : targetClient.cpf,
        cnpj: choices.cnpj === "source" ? sourceClient.cnpj : targetClient.cnpj,
        instagram: choices.instagram === "source" ? sourceClient.instagram : targetClient.instagram,
        company_name: choices.company_name === "source" ? sourceClient.company_name : targetClient.company_name,
        birth_date: choices.birth_date === "source" ? sourceClient.birth_date : targetClient.birth_date,
        responsible_user_id: choices.responsible_user_id === "source" ? sourceClient.responsible_user_id : targetClient.responsible_user_id,
        status: choices.status === "source" ? sourceClient.status : targetClient.status,
        // Address
        zip_code: sourceAddress ? sourceClient.zip_code : targetClient.zip_code,
        street: sourceAddress ? sourceClient.street : targetClient.street,
        street_number: sourceAddress ? sourceClient.street_number : targetClient.street_number,
        complement: sourceAddress ? sourceClient.complement : targetClient.complement,
        neighborhood: sourceAddress ? sourceClient.neighborhood : targetClient.neighborhood,
        city: sourceAddress ? sourceClient.city : targetClient.city,
        state: sourceAddress ? sourceClient.state : targetClient.state,
        // Merge arrays
        emails: mergeArrays(sourceClient.emails, targetClient.emails),
        additional_phones: mergeArrays(sourceClient.additional_phones, targetClient.additional_phones),
        instagrams: mergeArrays(sourceClient.instagrams, targetClient.instagrams),
        // Merge tags
        tags: [...new Set([...(sourceClient.tags || []), ...(targetClient.tags || [])])],
        // Concatenate notes
        notes: mergeNotes(sourceClient.notes, targetClient.notes),
      };

      const success = await onMerge(sourceClient.id, targetClient.id, mergedData, sourceClient.full_name);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setMerging(false);
    }
  };

  const mergeArrays = (arr1: string[] | null, arr2: string[] | null): string[] | null => {
    const combined = [...(arr1 || []), ...(arr2 || [])];
    const unique = [...new Set(combined)];
    return unique.length > 0 ? unique : null;
  };

  const mergeNotes = (notes1: string | null, notes2: string | null): string | null => {
    if (!notes1 && !notes2) return null;
    if (!notes1) return notes2;
    if (!notes2) return notes1;
    return `${notes1}\n\n---\n\n${notes2}`;
  };

  const resetDialog = () => {
    setSearchQuery("");
    setTargetClient(null);
    setCounts({ followups: 0, lifeEvents: 0, contracts: 0, deals: 0, conversations: 0, tasks: 0, events: 0 });
    setChoices({
      full_name: "target",
      phone_e164: "target",
      email: "target",
      cpf: "target",
      cnpj: "target",
      instagram: "target",
      company_name: "target",
      birth_date: "target",
      responsible_user_id: "target",
      status: "target",
      address: "target",
    });
  };

  const getAddressDisplay = (client: Client): string => {
    const parts = [
      client.street,
      client.street_number,
      client.neighborhood,
      client.city,
      client.state,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "-";
  };

  const totalTransfers = counts.followups + counts.lifeEvents + counts.contracts + counts.deals + counts.conversations + counts.tasks + counts.events;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetDialog();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Mesclar Clientes
          </DialogTitle>
        </DialogHeader>

        {/* Search bar for target client */}
        {!targetClient && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar cliente para mesclar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {/* Source client preview */}
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-2">Cliente a ser mesclado (será excluído):</p>
              <div className="flex items-center gap-3">
                <Avatar>
                  {sourceClient.avatar_url ? (
                    <AvatarImage src={sourceClient.avatar_url} alt={sourceClient.full_name} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(sourceClient.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{sourceClient.full_name}</p>
                  <p className="text-sm text-muted-foreground">{sourceClient.phone_e164 || sourceClient.email}</p>
                </div>
              </div>
            </div>

            {/* Search results */}
            {filteredClients.length > 0 && (
              <div className="border rounded-lg divide-y max-h-[300px] overflow-auto">
                {filteredClients.map(client => (
                  <div
                    key={client.id}
                    className="p-3 hover:bg-muted cursor-pointer flex items-center gap-3"
                    onClick={() => handleSelectTarget(client)}
                  >
                    <Avatar className="h-8 w-8">
                      {client.avatar_url ? (
                        <AvatarImage src={client.avatar_url} alt={client.full_name} />
                      ) : null}
                      <AvatarFallback className="text-xs bg-secondary">
                        {getInitials(client.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{client.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {client.phone_e164 || client.email || "Sem contato"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}

            {searchQuery && filteredClients.length === 0 && (
              <p className="text-center text-muted-foreground py-4">Nenhum cliente encontrado</p>
            )}
          </div>
        )}

        {/* Comparison view */}
        {targetClient && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {/* Client headers */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                <div className="p-3 border rounded-lg bg-destructive/5">
                  <p className="text-xs text-muted-foreground mb-1">Será excluído</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      {sourceClient.avatar_url ? (
                        <AvatarImage src={sourceClient.avatar_url} />
                      ) : null}
                      <AvatarFallback className="text-xs bg-destructive/10 text-destructive">
                        {getInitials(sourceClient.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm truncate">{sourceClient.full_name}</span>
                  </div>
                </div>

                <GitMerge className="h-5 w-5 text-muted-foreground" />

                <div className="p-3 border rounded-lg bg-primary/5">
                  <p className="text-xs text-muted-foreground mb-1">Será mantido</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      {targetClient.avatar_url ? (
                        <AvatarImage src={targetClient.avatar_url} />
                      ) : null}
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(targetClient.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm truncate">{targetClient.full_name}</span>
                  </div>
                </div>
              </div>

              {/* Field comparisons */}
              <div className="space-y-3">
                <FieldComparison
                  icon={<User className="h-4 w-4" />}
                  label="Nome"
                  sourceValue={sourceClient.full_name}
                  targetValue={targetClient.full_name}
                  choice={choices.full_name}
                  onChoiceChange={(v) => handleChoiceChange("full_name", v)}
                />

                <FieldComparison
                  icon={<Phone className="h-4 w-4" />}
                  label="Telefone"
                  sourceValue={sourceClient.phone_e164}
                  targetValue={targetClient.phone_e164}
                  choice={choices.phone_e164}
                  onChoiceChange={(v) => handleChoiceChange("phone_e164", v)}
                />

                <FieldComparison
                  icon={<Mail className="h-4 w-4" />}
                  label="Email"
                  sourceValue={sourceClient.email}
                  targetValue={targetClient.email}
                  choice={choices.email}
                  onChoiceChange={(v) => handleChoiceChange("email", v)}
                />

                <FieldComparison
                  icon={<FileText className="h-4 w-4" />}
                  label="CPF"
                  sourceValue={sourceClient.cpf}
                  targetValue={targetClient.cpf}
                  choice={choices.cpf}
                  onChoiceChange={(v) => handleChoiceChange("cpf", v)}
                />

                <FieldComparison
                  icon={<Building2 className="h-4 w-4" />}
                  label="CNPJ"
                  sourceValue={sourceClient.cnpj}
                  targetValue={targetClient.cnpj}
                  choice={choices.cnpj}
                  onChoiceChange={(v) => handleChoiceChange("cnpj", v)}
                />

                <FieldComparison
                  icon={<Instagram className="h-4 w-4" />}
                  label="Instagram"
                  sourceValue={sourceClient.instagram}
                  targetValue={targetClient.instagram}
                  choice={choices.instagram}
                  onChoiceChange={(v) => handleChoiceChange("instagram", v)}
                />

                <FieldComparison
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Empresa"
                  sourceValue={sourceClient.company_name}
                  targetValue={targetClient.company_name}
                  choice={choices.company_name}
                  onChoiceChange={(v) => handleChoiceChange("company_name", v)}
                />

                <FieldComparison
                  icon={<Calendar className="h-4 w-4" />}
                  label="Data de Nascimento"
                  sourceValue={sourceClient.birth_date ? format(new Date(sourceClient.birth_date), "dd/MM/yyyy", { locale: ptBR }) : null}
                  targetValue={targetClient.birth_date ? format(new Date(targetClient.birth_date), "dd/MM/yyyy", { locale: ptBR }) : null}
                  choice={choices.birth_date}
                  onChoiceChange={(v) => handleChoiceChange("birth_date", v)}
                />

                <FieldComparison
                  icon={<MapPin className="h-4 w-4" />}
                  label="Endereço"
                  sourceValue={getAddressDisplay(sourceClient)}
                  targetValue={getAddressDisplay(targetClient)}
                  choice={choices.address}
                  onChoiceChange={(v) => handleChoiceChange("address", v)}
                />

                {/* Auto-merged fields info */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Mesclagem automática:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <Tag className="h-3 w-3" />
                      <strong>Tags:</strong> Serão unificadas ({[...new Set([...(sourceClient.tags || []), ...(targetClient.tags || [])])].length} tags)
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="h-3 w-3" />
                      <strong>Notas:</strong> Serão concatenadas
                    </li>
                    <li className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      <strong>Telefones adicionais:</strong> Serão mesclados
                    </li>
                    <li className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      <strong>Emails adicionais:</strong> Serão mesclados
                    </li>
                  </ul>

                  {/* Transfer counts */}
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm font-medium mb-2">Será transferido para o cliente destino:</p>
                    {loadingCounts ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Carregando...
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {counts.followups > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                            <Badge variant="secondary">{counts.followups}</Badge>
                            <span className="text-muted-foreground">Anotações</span>
                          </div>
                        )}
                        {counts.deals > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                            <Badge variant="secondary">{counts.deals}</Badge>
                            <span className="text-muted-foreground">Negócios</span>
                          </div>
                        )}
                        {counts.conversations > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            <Badge variant="secondary">{counts.conversations}</Badge>
                            <span className="text-muted-foreground">Conversas</span>
                          </div>
                        )}
                        {counts.contracts > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            <Badge variant="secondary">{counts.contracts}</Badge>
                            <span className="text-muted-foreground">Contratos</span>
                          </div>
                        )}
                        {counts.tasks > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                            <Badge variant="secondary">{counts.tasks}</Badge>
                            <span className="text-muted-foreground">Tarefas</span>
                          </div>
                        )}
                        {counts.events > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />
                            <Badge variant="secondary">{counts.events}</Badge>
                            <span className="text-muted-foreground">Eventos</span>
                          </div>
                        )}
                        {counts.lifeEvents > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                            <Badge variant="secondary">{counts.lifeEvents}</Badge>
                            <span className="text-muted-foreground">Momentos CX</span>
                          </div>
                        )}
                        {totalTransfers === 0 && (
                          <p className="text-xs text-muted-foreground col-span-full">Nenhum registro para transferir</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Button
                variant="link"
                size="sm"
                onClick={() => setTargetClient(null)}
                className="text-muted-foreground"
              >
                ← Escolher outro cliente
              </Button>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!targetClient || merging}
            className="bg-primary"
          >
            {merging ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Mesclando...
              </>
            ) : (
              "Mesclar Clientes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FieldComparisonProps {
  icon: React.ReactNode;
  label: string;
  sourceValue: string | null | undefined;
  targetValue: string | null | undefined;
  choice: MergeChoice;
  onChoiceChange: (value: MergeChoice) => void;
}

function FieldComparison({
  icon,
  label,
  sourceValue,
  targetValue,
  choice,
  onChoiceChange,
}: FieldComparisonProps) {
  const sourceDisplay = sourceValue || "-";
  const targetDisplay = targetValue || "-";

  // If both are the same or one is empty, auto-select
  const isSame = sourceValue === targetValue;
  const onlySource = sourceValue && !targetValue;
  const onlyTarget = !sourceValue && targetValue;

  if (isSame || onlySource || onlyTarget) {
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center p-2 rounded-lg bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm truncate">{sourceDisplay}</span>
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="flex items-center gap-2 justify-end">
          <span className="text-sm truncate">{targetDisplay}</span>
          {(isSame || onlyTarget) && <Badge variant="outline" className="text-xs">Auto</Badge>}
          {onlySource && <Badge variant="secondary" className="text-xs">Manter</Badge>}
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </div>
      <RadioGroup
        value={choice}
        onValueChange={(v) => onChoiceChange(v as MergeChoice)}
        className="grid grid-cols-2 gap-2"
      >
        <Label
          htmlFor={`${label}-source`}
          className={cn(
            "flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors",
            choice === "source" ? "border-primary bg-primary/5" : "hover:bg-muted"
          )}
        >
          <RadioGroupItem value="source" id={`${label}-source`} />
          <span className="text-sm truncate">{sourceDisplay}</span>
        </Label>
        <Label
          htmlFor={`${label}-target`}
          className={cn(
            "flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors",
            choice === "target" ? "border-primary bg-primary/5" : "hover:bg-muted"
          )}
        >
          <RadioGroupItem value="target" id={`${label}-target`} />
          <span className="text-sm truncate">{targetDisplay}</span>
        </Label>
      </RadioGroup>
    </div>
  );
}
