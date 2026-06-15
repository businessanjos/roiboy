import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Deal, DealStage } from "@/hooks/useDeals";
import { supabase } from "@/integrations/supabase/client";
import { DEAL_FIELD_IDS, mapItemVendaToProductId } from "@/utils/dealToClientContractMapping";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Checkbox } from "@/components/ui/checkbox";
import { MarkAsLostDialog } from "@/components/sales/MarkAsLostDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Trash2, 
  Trophy, 
  XCircle, 
  RotateCcw,
  User,
  Building2,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Tag,
  FileText,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { clearLocalAutosaveDraft, readLocalAutosaveDraft, writeLocalAutosaveDraft } from "@/hooks/useLocalAutosaveDraft";

const dealSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  client_id: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string()
    .refine(
      (val) => !val || val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      { message: "Email inválido" }
    )
    .optional(),
  stage_id: z.string().optional(),
  value: z.number().min(0).default(0),
  expected_close_date: z.string().optional(),
  probability: z.number().min(0).max(100).default(0),
  source: z.string().optional(),
  responsible_user_id: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  product_id: z.string().optional(), // Item da Venda
});

type DealFormValues = z.infer<typeof dealSchema>;

interface DealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  stages: DealStage[];
  onSave: (data: DealFormValues, sendNotification?: boolean) => Promise<void>;
  onDelete?: (dealId: string) => Promise<void>;
  onMarkAsWon?: (dealId: string) => Promise<void>;
  onMarkAsLost?: (dealId: string, reason?: string) => Promise<void>;
  onReopen?: (dealId: string) => Promise<void>;
}

interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
  avatar_url: string | null;
}

interface TeamMember {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

type DealDialogDraft = {
  values: Partial<DealFormValues>;
  selectedProductId?: string;
  sendNotification?: boolean;
};

export function DealDialog({
  open,
  onOpenChange,
  deal,
  stages,
  onSave,
  onDelete,
  onMarkAsWon,
  onMarkAsLost,
  onReopen,
}: DealDialogProps) {
  const { currentUser } = useCurrentUser();
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [newTag, setNewTag] = useState("");
  const [sendNotification, setSendNotification] = useState(false);
  const initializedKeyRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);
  const skipAutosaveRef = useRef(false);

  const isEditing = !!deal;
  // Quando criando um novo deal, `deal` é undefined — não deve ser tratado como "fechado"
  const isClosed = isEditing && deal?.status !== 'open';

  // Users who can always change the responsible, regardless of deal status
  const RESPONSIBLE_OVERRIDE_USER_IDS = [
    "d20201f6-a9bd-4934-ae50-07ce7a47574b", // Maikol Parnow
    "de43a643-0109-4afb-ac35-be768dbf4090", // Everton Pieri
    "1232ec15-5f66-4b5f-9e74-f40d436f9d0f", // Jonathan Marcato
  ];
  const canAlwaysChangeResponsible = RESPONSIBLE_OVERRIDE_USER_IDS.includes(currentUser?.id || "")
    || currentUser?.role === "admin"
    || currentUser?.is_also_admin === true;

  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: "",
      client_id: "",
      contact_name: "",
      contact_phone: "",
      contact_email: "",
      stage_id: stages[0]?.id || "",
      value: 0,
      expected_close_date: "",
      probability: stages[0]?.probability || 0,
      source: "",
      responsible_user_id: currentUser?.id || "",
      notes: "",
      tags: [],
    },
  });

  const draftKey = open && currentUser?.account_id
    ? `roy:sales:deal-dialog-draft:${currentUser.account_id}:${deal?.id ?? `new:${currentUser?.id ?? "unknown"}`}`
    : null;

  // Load clients, team members, and products with sector access
  useEffect(() => {
    if (!currentUser?.account_id) return;

    const loadData = async () => {
      // Fetch clients, products, sector users, and admins in parallel
      const [clientsRes, productsRes, sectorUsersRes, adminsRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, full_name, phone_e164, avatar_url")
          .eq("account_id", currentUser.account_id)
          .eq("status", "active")
          .order("full_name")
          .limit(100),
        supabase
          .from("products")
          .select("id, name, price")
          .eq("account_id", currentUser.account_id)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("user_sector_access")
          .select(`
            user:users!user_sector_access_user_id_fkey(id, name, avatar_url)
          `)
          .eq("account_id", currentUser.account_id)
          .eq("sector_id", "vendas"),
        supabase
          .from("users")
          .select("id, name, avatar_url")
          .eq("account_id", currentUser.account_id)
          .eq("role", "admin")
      ]);

      let clientList = clientsRes.data || [];
      
      // If deal has a client that's not in the list, fetch it separately
      if (deal?.client_id && !clientList.find(c => c.id === deal.client_id)) {
        const { data: dealClient } = await supabase
          .from("clients")
          .select("id, full_name, phone_e164, avatar_url")
          .eq("id", deal.client_id)
          .maybeSingle();
        
        if (dealClient) {
          clientList = [dealClient, ...clientList];
        }
      }

      setClients(clientList);
      setProducts(productsRes.data || []);
      
      // Extract unique users from sector access + admins
      const usersMap = new Map<string, TeamMember>();
      
      // Add admins first
      (adminsRes.data || []).forEach((user: TeamMember) => {
        usersMap.set(user.id, user);
      });
      
      // Add sector users
      (sectorUsersRes.data || []).forEach((access: any) => {
        if (access.user && !usersMap.has(access.user.id)) {
          usersMap.set(access.user.id, access.user);
        }
      });
      
      setTeamMembers(Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    };

    loadData();
  }, [currentUser?.account_id, deal?.client_id]);

  // Load Item da Venda (product) from deal_field_values when editing
  // Resolves both UUID (new format) and legacy option values to a product_id
  useEffect(() => {
    if (!deal?.id || !currentUser?.account_id) {
      setSelectedProductId("");
      return;
    }
    const loadDealProduct = async () => {
      const draft = readLocalAutosaveDraft<DealDialogDraft>(draftKey);
      if (draft?.selectedProductId !== undefined) {
        setSelectedProductId(draft.selectedProductId || "");
        return;
      }

      const { data } = await supabase
        .from('deal_field_values')
        .select('value_text')
        .eq('deal_id', deal.id)
        .eq('field_id', DEAL_FIELD_IDS.ITEM_VENDA)
        .maybeSingle();
      if (data?.value_text) {
        // Check if already a valid product UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(data.value_text)) {
          setSelectedProductId(data.value_text);
        } else {
          // Legacy value — resolve to product UUID
          const productId = await mapItemVendaToProductId(data.value_text);
          if (productId) {
            setSelectedProductId(productId);
          } else {
            setSelectedProductId("");
          }
        }
      } else {
        setSelectedProductId("");
      }
    };
    loadDealProduct();
  }, [deal?.id, currentUser?.account_id, draftKey]);

  // Reset form only when opening/changing deal. Do not wipe active typing on background refetches.
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      initializedKeyRef.current = null;
      return;
    }

    const initKey = deal?.id ?? `new:${currentUser?.id ?? "unknown"}`;
    if (wasOpenRef.current && initializedKeyRef.current === initKey) return;
    wasOpenRef.current = true;
    initializedKeyRef.current = initKey;

    const draft = readLocalAutosaveDraft<DealDialogDraft>(draftKey);
    skipAutosaveRef.current = true;

    if (deal) {
      form.reset({
        title: deal.title,
        client_id: deal.client_id || "",
        contact_name: deal.contact_name || "",
        contact_phone: deal.contact_phone || "",
        contact_email: deal.contact_email || "",
        stage_id: deal.stage_id || "",
        value: deal.value || 0,
        expected_close_date: deal.expected_close_date || "",
        probability: deal.probability || 0,
        source: deal.source || "",
        responsible_user_id: deal.responsible_user_id || "",
        notes: deal.notes || "",
        tags: deal.tags || [],
        ...(draft?.values || {}),
      });
    } else {
      form.reset({
        title: "",
        client_id: "",
        contact_name: "",
        contact_phone: "",
        contact_email: "",
        stage_id: stages[0]?.id || "",
        value: 0,
        expected_close_date: "",
        probability: stages[0]?.probability || 0,
        source: "",
        responsible_user_id: currentUser?.id || "",
        notes: "",
        tags: [],
        ...(draft?.values || {}),
      });
      setSendNotification(draft?.sendNotification ?? false);
      setSelectedProductId(draft?.selectedProductId || "");
    }

    window.setTimeout(() => {
      skipAutosaveRef.current = false;
    }, 0);
  }, [open, deal, stages, form, currentUser?.id, draftKey]);

  useEffect(() => {
    if (!open || !draftKey) return;

    const subscription = form.watch((values) => {
      if (skipAutosaveRef.current) return;
      writeLocalAutosaveDraft<DealDialogDraft>(draftKey, {
        values: values as Partial<DealFormValues>,
        selectedProductId,
        sendNotification,
      });
    });

    return () => subscription.unsubscribe();
  }, [open, draftKey, form, selectedProductId, sendNotification]);

  useEffect(() => {
    if (!open || !draftKey || skipAutosaveRef.current) return;
    writeLocalAutosaveDraft<DealDialogDraft>(draftKey, {
      values: form.getValues(),
      selectedProductId,
      sendNotification,
    });
  }, [open, draftKey, form, selectedProductId, sendNotification]);

  // Auto-assign current user as responsible when creating new deal
  useEffect(() => {
    // Only for new deals (not editing)
    if (!deal && currentUser?.id) {
      const currentValue = form.getValues("responsible_user_id");
      // Only set if not already set
      if (!currentValue) {
        form.setValue("responsible_user_id", currentUser.id);
      }
    }
  }, [deal, currentUser?.id, form]);

  const handleSubmit = async (data: DealFormValues) => {
    setSaving(true);
    try {
      // Auto-assign to creator if no responsible selected
      // Include product_id (Item da Venda) in the data
      const productId = selectedProductId && selectedProductId !== "__none__" ? selectedProductId : undefined;
      const finalData = {
        ...data,
        responsible_user_id: data.responsible_user_id || currentUser?.id || "",
        product_id: productId,
      };
      await onSave(finalData, !isEditing && sendNotification);
      clearLocalAutosaveDraft(draftKey);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deal && onDelete) {
      await onDelete(deal.id);
      setDeleteConfirmOpen(false);
    }
  };

  const handleMarkAsWon = async () => {
    if (deal && onMarkAsWon) {
      await onMarkAsWon(deal.id);
    }
  };

  const handleMarkAsLost = async (data: { lossReasonId: string; lossSubReasonId?: string; lossNotes: string; lostReason: string }) => {
    if (deal && onMarkAsLost) {
      await onMarkAsLost(deal.id, data.lostReason);
      setLostDialogOpen(false);
    }
  };

  const handleReopen = async () => {
    if (deal && onReopen) {
      await onReopen(deal.id);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      const currentTags = form.getValues("tags");
      if (!currentTags.includes(newTag.trim())) {
        form.setValue("tags", [...currentTags, newTag.trim()]);
      }
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = form.getValues("tags");
    form.setValue("tags", currentTags.filter(t => t !== tagToRemove));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? "Editar Negociação" : "Nova Negociação"}
              {deal?.status === 'won' && (
                <Badge className="bg-emerald-500">Ganha</Badge>
              )}
              {deal?.status === 'lost' && (
                <Badge variant="destructive">Perdida</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Atualize os detalhes da negociação"
                : "Adicione uma nova oportunidade ao pipeline"
              }
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <Tabs defaultValue="info">
                {(() => {
                  const errors = form.formState.errors;
                  const hasInfoErrors = !!errors.title || !!errors.stage_id || !!errors.value || !!errors.expected_close_date || !!errors.probability || !!errors.responsible_user_id;
                  const hasContactErrors = !!errors.client_id || !!errors.contact_name || !!errors.contact_phone || !!errors.contact_email;
                  const hasDetailsErrors = !!errors.source || !!errors.notes || !!errors.tags;
                  
                  return (
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="info" className="relative">
                        Informações
                        {hasInfoErrors && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full" />
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="contact" className="relative">
                        Contato
                        {hasContactErrors && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full" />
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="details" className="relative">
                        Detalhes
                        {hasDetailsErrors && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full" />
                        )}
                      </TabsTrigger>
                    </TabsList>
                  );
                })()}

                <TabsContent value="info" className="space-y-4 mt-4">
                  {/* Title */}
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título da Negociação *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: Consultoria para Empresa XYZ" 
                            {...field} 
                            disabled={isClosed}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Item da Venda + Valor */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Item da Venda - Select de Produtos */}
                    <FormItem>
                      <FormLabel>Item da Venda</FormLabel>
                      <Select 
                        value={selectedProductId}
                        onValueChange={(productId) => {
                          setSelectedProductId(productId);
                          // Auto-preencher valor com o preço do produto
                          if (productId && productId !== "__none__") {
                            const product = products.find(p => p.id === productId);
                            if (product) {
                              form.setValue("value", product.price);
                            }
                          }
                        }}
                        disabled={isClosed}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o produto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhum</SelectItem>
                          {products.map(product => (
                            <SelectItem key={product.id} value={product.id}>
                              <div className="flex items-center justify-between w-full gap-2">
                                <span>{product.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(product.price)}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>

                    {/* Value */}
                    <FormField
                      control={form.control}
                      name="value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor (R$)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                step="0.01"
                                className="pl-9"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                disabled={isClosed}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Stage */}
                    <FormField
                      control={form.control}
                      name="stage_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Etapa</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                            disabled={isClosed}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a etapa" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {stages.map(stage => (
                                <SelectItem key={stage.id} value={stage.id}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: stage.color }}
                                    />
                                    {stage.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Expected Close Date */}
                    <FormField
                      control={form.control}
                      name="expected_close_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Previsão de Fechamento</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="date"
                                className="pl-9"
                                {...field}
                                disabled={isClosed}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">

                    {/* Probability */}
                    <FormField
                      control={form.control}
                      name="probability"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Probabilidade (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              disabled={isClosed}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Responsible */}
                  <FormField
                    control={form.control}
                    name="responsible_user_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={isClosed && !canAlwaysChangeResponsible}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o responsável" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {teamMembers.map(member => (
                              <SelectItem key={member.id} value={member.id}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={member.avatar_url || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {getInitials(member.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  {member.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Send Notification Checkbox - Only for new deals */}
                  {!isEditing && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="send-notification"
                        checked={sendNotification}
                        onCheckedChange={(checked) => setSendNotification(checked === true)}
                        disabled={isClosed}
                      />
                      <label
                        htmlFor="send-notification"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Enviar notificação ao responsável
                      </label>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="contact" className="space-y-4 mt-4">
                  {/* Client Selection */}
                  <FormField
                    control={form.control}
                    name="client_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente Existente</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)} 
                          value={field.value || "__none__"}
                          disabled={isClosed}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Vincular a um cliente existente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">Nenhum</SelectItem>
                            {clients.map(client => (
                              <SelectItem key={client.id} value={client.id}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={client.avatar_url || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {getInitials(client.full_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  {client.full_name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Show client info if selected, otherwise show manual fields */}
                  {form.watch("client_id") && form.watch("client_id") !== "__none__" ? (
                    (() => {
                      const selectedClient = clients.find(c => c.id === form.watch("client_id"));
                      if (!selectedClient) return null;
                      return (
                        <div className="p-4 rounded-lg bg-muted/50 border">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={selectedClient.avatar_url || undefined} />
                              <AvatarFallback className="text-sm bg-primary/10 text-primary">
                                {getInitials(selectedClient.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold">{selectedClient.full_name}</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {selectedClient.phone_e164}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <>
                      <div className="text-center text-sm text-muted-foreground">
                        — ou preencha os dados do contato manualmente —
                      </div>

                      {/* Contact Name */}
                      <FormField
                        control={form.control}
                        name="contact_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome do Contato</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                  className="pl-9"
                                  placeholder="Nome completo" 
                                  {...field} 
                                  disabled={isClosed}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        {/* Contact Phone */}
                        <FormField
                          control={form.control}
                          name="contact_phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Telefone</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input 
                                    className="pl-9"
                                    placeholder="(11) 99999-9999" 
                                    {...field} 
                                    disabled={isClosed}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Contact Email */}
                        <FormField
                          control={form.control}
                          name="contact_email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input 
                                    type="email"
                                    className="pl-9"
                                    placeholder="email@exemplo.com" 
                                    {...field} 
                                    disabled={isClosed}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="details" className="space-y-4 mt-4">
                  {/* Source */}
                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Origem do Lead</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: Indicação, Site, LinkedIn" 
                            {...field} 
                            disabled={isClosed}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Tags */}
                  <div className="space-y-2">
                    <FormLabel>Tags</FormLabel>
                    <div className="flex gap-2">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Adicionar tag"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                        disabled={isClosed}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleAddTag}
                        disabled={isClosed}
                      >
                        <Tag className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {form.watch("tags").map((tag, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => !isClosed && handleRemoveTag(tag)}
                        >
                          {tag}
                          {!isClosed && <span className="ml-1">×</span>}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Notas sobre esta negociação..."
                            className="min-h-[100px]"
                            {...field} 
                            disabled={isClosed}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Lost Reason (if lost) */}
                  {deal?.status === 'lost' && deal.lost_reason && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">
                        Motivo da Perda
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-300">
                        {deal.lost_reason}
                      </p>
                    </div>
                  )}

                  {/* Timestamps */}
                  {deal && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Criado em: {format(new Date(deal.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                      {deal.won_at && (
                        <p className="text-emerald-600">
                          Ganho em: {format(new Date(deal.won_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      )}
                      {deal.lost_at && (
                        <p className="text-red-600">
                          Perdido em: {format(new Date(deal.lost_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                {/* Left side actions */}
                <div className="flex gap-2 flex-1">
                  {isEditing && onDelete && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}

                  {isEditing && deal?.status === 'open' && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleMarkAsWon}
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      >
                        <Trophy className="h-4 w-4 mr-1" />
                        Ganhar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLostDialogOpen(true)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Perder
                      </Button>
                    </>
                  )}

                  {isEditing && deal?.status !== 'open' && onReopen && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleReopen}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reabrir
                    </Button>
                  )}
                </div>

                {/* Right side actions */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  {(!isClosed || canAlwaysChangeResponsible) && (
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {isEditing ? "Salvar" : "Criar"}
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Negociação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta negociação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lost Reason Dialog */}
      <MarkAsLostDialog
        open={lostDialogOpen}
        onOpenChange={setLostDialogOpen}
        onConfirm={handleMarkAsLost}
      />
    </>
  );
}
