import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Plus, 
  Calendar, 
  Video, 
  FileText, 
  Pencil, 
  Trash2, 
  Clock,
  Link as LinkIcon,
  Package,
  Monitor,
  MapPin
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: "live" | "material";
  modality: "online" | "presencial";
  address: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_url: string | null;
  material_url: string | null;
  is_recurring: boolean;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
}

interface EventProduct {
  product_id: string;
  products: Product;
}

interface EventWithProducts extends Event {
  event_products: EventProduct[];
}

export default function Events() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<EventWithProducts[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithProducts | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<"live" | "material">("live");
  const [modality, setModality] = useState<"online" | "presencial">("online");
  const [address, setAddress] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchAccountId();
      fetchProducts();
      fetchEvents();
    }
  }, [user]);

  const fetchAccountId = async () => {
    const { data } = await supabase
      .from("users")
      .select("account_id")
      .eq("auth_user_id", user?.id)
      .single();
    
    if (data) {
      setAccountId(data.account_id);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setProducts(data);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select(`
        *,
        event_products (
          product_id,
          products (id, name)
        )
      `)
      .order("scheduled_at", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Error fetching events:", error);
    } else {
      setEvents((data as EventWithProducts[]) || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setEventType("live");
    setModality("online");
    setAddress("");
    setScheduledAt("");
    setDurationMinutes("");
    setMeetingUrl("");
    setMaterialUrl("");
    setIsRecurring(false);
    setSelectedProducts([]);
    setEditingEvent(null);
  };

  const openEditDialog = (event: EventWithProducts) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description || "");
    setEventType(event.event_type);
    setModality(event.modality || "online");
    setAddress(event.address || "");
    setScheduledAt(event.scheduled_at ? event.scheduled_at.slice(0, 16) : "");
    setDurationMinutes(event.duration_minutes?.toString() || "");
    setMeetingUrl(event.meeting_url || "");
    setMaterialUrl(event.material_url || "");
    setIsRecurring(event.is_recurring);
    setSelectedProducts(event.event_products.map(ep => ep.product_id));
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: "Erro",
        description: "Título é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!accountId) {
      toast({
        title: "Erro",
        description: "Conta não encontrada",
        variant: "destructive",
      });
      return;
    }

    const eventData = {
      title: title.trim(),
      description: description.trim() || null,
      event_type: eventType,
      modality: modality,
      address: modality === "presencial" ? address.trim() || null : null,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
      meeting_url: meetingUrl.trim() || null,
      material_url: materialUrl.trim() || null,
      is_recurring: isRecurring,
      account_id: accountId,
    };

    let eventId: string;

    if (editingEvent) {
      const { error } = await supabase
        .from("events")
        .update(eventData)
        .eq("id", editingEvent.id);

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível atualizar o evento",
          variant: "destructive",
        });
        return;
      }
      eventId = editingEvent.id;

      // Remove existing product links
      await supabase
        .from("event_products")
        .delete()
        .eq("event_id", editingEvent.id);
    } else {
      const { data, error } = await supabase
        .from("events")
        .insert(eventData)
        .select("id")
        .single();

      if (error || !data) {
        toast({
          title: "Erro",
          description: "Não foi possível criar o evento",
          variant: "destructive",
        });
        return;
      }
      eventId = data.id;
    }

    // Add product links
    if (selectedProducts.length > 0) {
      const productLinks = selectedProducts.map(productId => ({
        event_id: eventId,
        product_id: productId,
        account_id: accountId,
      }));

      await supabase.from("event_products").insert(productLinks);
    }

    toast({
      title: editingEvent ? "Evento atualizado" : "Evento criado",
      description: `${title} foi ${editingEvent ? "atualizado" : "criado"} com sucesso.`,
    });

    setDialogOpen(false);
    resetForm();
    fetchEvents();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o evento",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Evento excluído",
        description: "O evento foi removido com sucesso.",
      });
      fetchEvents();
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Eventos</h1>
          <p className="text-muted-foreground">
            Gerencie entregáveis, lives e materiais dos seus produtos.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? "Editar Evento" : "Novo Evento"}
              </DialogTitle>
              <DialogDescription>
                {editingEvent
                  ? "Atualize as informações do evento."
                  : "Cadastre um novo entregável ou evento."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Mentoria ao Vivo - Módulo 1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o evento..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Evento</Label>
                  <Select value={eventType} onValueChange={(v: "live" | "material") => setEventType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="live">
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4" />
                          Live / Encontro
                        </div>
                      </SelectItem>
                      <SelectItem value="material">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Material / Download
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Modalidade</Label>
                  <Select value={modality} onValueChange={(v: "online" | "presencial") => setModality(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          Online
                        </div>
                      </SelectItem>
                      <SelectItem value="presencial">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Presencial
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {modality === "presencial" && (
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Rua, número, bairro, cidade..."
                  />
                </div>
              )}

              {eventType === "live" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scheduled_at">Data e Hora</Label>
                      <Input
                        id="scheduled_at"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duração (min)</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        placeholder="60"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="meeting_url">Link da Reunião</Label>
                    <Input
                      id="meeting_url"
                      value={meetingUrl}
                      onChange={(e) => setMeetingUrl(e.target.value)}
                      placeholder="https://zoom.us/j/..."
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="recurring"
                      checked={isRecurring}
                      onCheckedChange={(checked) => setIsRecurring(!!checked)}
                    />
                    <Label htmlFor="recurring" className="text-sm font-normal">
                      Evento recorrente (semanal)
                    </Label>
                  </div>
                </>
              )}

              {eventType === "material" && (
                <div className="space-y-2">
                  <Label htmlFor="material_url">Link do Material</Label>
                  <Input
                    id="material_url"
                    value={materialUrl}
                    onChange={(e) => setMaterialUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Produtos que incluem este evento</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                  {products.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum produto cadastrado
                    </p>
                  ) : (
                    products.map((product) => (
                      <div key={product.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`product-${product.id}`}
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                        />
                        <Label
                          htmlFor={`product-${product.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {product.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit}>
                {editingEvent ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Lista de Eventos
          </CardTitle>
          <CardDescription>
            Todos os eventos e entregáveis cadastrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando eventos...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum evento cadastrado ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Produtos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="font-medium">{event.title}</div>
                        {event.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {event.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={event.event_type === "live" ? "default" : "secondary"}>
                          {event.event_type === "live" ? (
                            <><Video className="h-3 w-3 mr-1" /> Live</>
                          ) : (
                            <><FileText className="h-3 w-3 mr-1" /> Material</>
                          )}
                        </Badge>
                        {event.is_recurring && (
                          <Badge variant="outline" className="ml-1">
                            Recorrente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline">
                            {event.modality === "online" ? (
                              <><Monitor className="h-3 w-3 mr-1" /> Online</>
                            ) : (
                              <><MapPin className="h-3 w-3 mr-1" /> Presencial</>
                            )}
                          </Badge>
                          {event.modality === "presencial" && event.address && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {event.address}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {event.scheduled_at ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {format(new Date(event.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {event.event_products.length === 0 ? (
                            <span className="text-muted-foreground text-sm">Nenhum</span>
                          ) : (
                            event.event_products.map((ep) => (
                              <Badge key={ep.product_id} variant="outline" className="text-xs">
                                <Package className="h-3 w-3 mr-1" />
                                {ep.products?.name || "Produto"}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(event.meeting_url || event.material_url) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                            >
                              <a
                                href={event.meeting_url || event.material_url || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <LinkIcon className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(event)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(event.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
