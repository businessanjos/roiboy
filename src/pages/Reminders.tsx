import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Bell, 
  Plus, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Calendar, 
  FileCheck, 
  FileText, 
  Gift,
  Send,
  Mail,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  History
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";

interface Reminder {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  reminder_type: "event" | "checkin" | "contract" | "life_event" | "custom";
  is_active: boolean;
  days_before: number;
  time_of_day: string;
  send_whatsapp: boolean;
  send_email: boolean;
  send_notification: boolean;
  whatsapp_template: string | null;
  email_subject: string | null;
  email_template: string | null;
  created_at: string;
  updated_at: string;
}

interface ReminderLog {
  id: string;
  reminder_id: string;
  client_id: string | null;
  channel: "whatsapp" | "email" | "notification";
  status: "pending" | "sent" | "failed" | "cancelled";
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  reminders?: { name: string };
  clients?: { full_name: string };
}

const reminderTypeLabels: Record<string, { label: string; icon: typeof Calendar; color: string }> = {
  event: { label: "Eventos", icon: Calendar, color: "bg-blue-500" },
  checkin: { label: "Check-in", icon: FileCheck, color: "bg-green-500" },
  contract: { label: "Contratos", icon: FileText, color: "bg-orange-500" },
  life_event: { label: "Datas Especiais", icon: Gift, color: "bg-pink-500" },
  custom: { label: "Personalizado", icon: Bell, color: "bg-purple-500" },
};

const channelIcons = {
  whatsapp: MessageSquare,
  email: Mail,
  notification: Bell,
};

const statusIcons = {
  pending: Clock,
  sent: CheckCircle2,
  failed: XCircle,
  cancelled: AlertCircle,
};

const statusColors = {
  pending: "text-yellow-500",
  sent: "text-green-500",
  failed: "text-red-500",
  cancelled: "text-muted-foreground",
};

export default function Reminders() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [activeTab, setActiveTab] = useState("reminders");

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<string>("event");
  const [formDaysBefore, setFormDaysBefore] = useState(1);
  const [formTimeOfDay, setFormTimeOfDay] = useState("09:00");
  const [formSendWhatsapp, setFormSendWhatsapp] = useState(true);
  const [formSendEmail, setFormSendEmail] = useState(true);
  const [formSendNotification, setFormSendNotification] = useState(true);
  const [formWhatsappTemplate, setFormWhatsappTemplate] = useState("");
  const [formEmailSubject, setFormEmailSubject] = useState("");
  const [formEmailTemplate, setFormEmailTemplate] = useState("");

  // Fetch reminders
  const { data: reminders = [], isLoading: loadingReminders } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Reminder[];
    },
  });

  // Fetch reminder logs
  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["reminder-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminder_logs")
        .select(`
          *,
          reminders:reminder_id(name),
          clients:client_id(full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as ReminderLog[];
    },
  });

  // Create/Update reminder
  const saveMutation = useMutation({
    mutationFn: async (isEdit: boolean) => {
      if (!currentUser?.account_id) throw new Error("Usuário não encontrado");

      const reminderData = {
        account_id: currentUser.account_id,
        name: formName,
        description: formDescription || null,
        reminder_type: formType,
        days_before: formDaysBefore,
        time_of_day: formTimeOfDay,
        send_whatsapp: formSendWhatsapp,
        send_email: formSendEmail,
        send_notification: formSendNotification,
        whatsapp_template: formWhatsappTemplate || null,
        email_subject: formEmailSubject || null,
        email_template: formEmailTemplate || null,
      };

      if (isEdit && editingReminder) {
        const { error } = await supabase
          .from("reminders")
          .update(reminderData)
          .eq("id", editingReminder.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("reminders")
          .insert(reminderData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success(editingReminder ? "Lembrete atualizado!" : "Lembrete criado!");
      closeDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar lembrete");
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("reminders")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar status");
    },
  });

  // Delete reminder
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reminders")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Lembrete excluído!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao excluir lembrete");
    },
  });

  const openCreateDialog = () => {
    setEditingReminder(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setFormName(reminder.name);
    setFormDescription(reminder.description || "");
    setFormType(reminder.reminder_type);
    setFormDaysBefore(reminder.days_before);
    setFormTimeOfDay(reminder.time_of_day.slice(0, 5));
    setFormSendWhatsapp(reminder.send_whatsapp);
    setFormSendEmail(reminder.send_email);
    setFormSendNotification(reminder.send_notification);
    setFormWhatsappTemplate(reminder.whatsapp_template || "");
    setFormEmailSubject(reminder.email_subject || "");
    setFormEmailTemplate(reminder.email_template || "");
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormType("event");
    setFormDaysBefore(1);
    setFormTimeOfDay("09:00");
    setFormSendWhatsapp(true);
    setFormSendEmail(true);
    setFormSendNotification(true);
    setFormWhatsappTemplate("");
    setFormEmailSubject("");
    setFormEmailTemplate("");
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingReminder(null);
    resetForm();
  };

  const handleSave = () => {
    if (!formName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    saveMutation.mutate(!!editingReminder);
  };

  const getDefaultTemplate = (type: string) => {
    switch (type) {
      case "event":
        return "Olá {nome}! Lembrando que o evento {evento} acontece em {dias} dia(s). Confirme sua presença!";
      case "checkin":
        return "Olá {nome}! Não esqueça de fazer o check-in no evento {evento}. Te esperamos!";
      case "contract":
        return "Olá {nome}! Seu contrato vence em {dias} dia(s). Entre em contato para renovação.";
      case "life_event":
        return "Olá {nome}! Parabéns pelo(a) {evento}! Desejamos tudo de bom.";
      default:
        return "";
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Lembretes
          </h1>
          <p className="text-muted-foreground">
            Configure lembretes automáticos para eventos, check-ins, contratos e datas especiais
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lembrete
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reminders" className="mt-6">
          {loadingReminders ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : reminders.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Nenhum lembrete configurado</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Crie lembretes automáticos para manter seus clientes informados
                </p>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Lembrete
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {reminders.map((reminder) => {
                const typeInfo = reminderTypeLabels[reminder.reminder_type];
                const TypeIcon = typeInfo.icon;
                return (
                  <Card key={reminder.id} className={!reminder.is_active ? "opacity-60" : ""}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                          <TypeIcon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground">{reminder.name}</h3>
                            <Badge variant="outline">{typeInfo.label}</Badge>
                            {!reminder.is_active && (
                              <Badge variant="secondary">Inativo</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {reminder.days_before} dia(s) antes às {reminder.time_of_day.slice(0, 5)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {reminder.send_whatsapp && (
                              <Badge variant="outline" className="text-xs">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                WhatsApp
                              </Badge>
                            )}
                            {reminder.send_email && (
                              <Badge variant="outline" className="text-xs">
                                <Mail className="h-3 w-3 mr-1" />
                                Email
                              </Badge>
                            )}
                            {reminder.send_notification && (
                              <Badge variant="outline" className="text-xs">
                                <Bell className="h-3 w-3 mr-1" />
                                App
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={reminder.is_active}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: reminder.id, isActive: checked })
                          }
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(reminder)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(reminder.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          {loadingLogs ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : logs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <History className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Nenhum envio registrado</h3>
                <p className="text-muted-foreground text-sm">
                  O histórico de envios aparecerá aqui
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lembrete</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const ChannelIcon = channelIcons[log.channel];
                    const StatusIcon = statusIcons[log.status];
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {log.reminders?.name || "-"}
                        </TableCell>
                        <TableCell>{log.clients?.full_name || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <ChannelIcon className="h-4 w-4" />
                            <span className="capitalize">{log.channel}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-1 ${statusColors[log.status]}`}>
                            <StatusIcon className="h-4 w-4" />
                            <span className="capitalize">{log.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReminder ? "Editar Lembrete" : "Novo Lembrete"}
            </DialogTitle>
            <DialogDescription>
              Configure quando e como os lembretes serão enviados
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid gap-4">
              <div>
                <Label htmlFor="name">Nome do Lembrete *</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Lembrete de evento 1 dia antes"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Descrição opcional do lembrete"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Type and Timing */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Lembrete</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(reminderTypeLabels).map(([key, { label, icon: Icon }]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="days_before">Dias Antes</Label>
                <Input
                  id="days_before"
                  type="number"
                  min={0}
                  value={formDaysBefore}
                  onChange={(e) => setFormDaysBefore(parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="time_of_day">Horário de Envio</Label>
              <Input
                id="time_of_day"
                type="time"
                value={formTimeOfDay}
                onChange={(e) => setFormTimeOfDay(e.target.value)}
                className="mt-1 w-32"
              />
            </div>

            {/* Channels */}
            <div>
              <Label className="mb-3 block">Canais de Envio</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="send_whatsapp"
                    checked={formSendWhatsapp}
                    onCheckedChange={(checked) => setFormSendWhatsapp(checked === true)}
                  />
                  <label htmlFor="send_whatsapp" className="text-sm flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    WhatsApp
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="send_email"
                    checked={formSendEmail}
                    onCheckedChange={(checked) => setFormSendEmail(checked === true)}
                  />
                  <label htmlFor="send_email" className="text-sm flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    Email
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="send_notification"
                    checked={formSendNotification}
                    onCheckedChange={(checked) => setFormSendNotification(checked === true)}
                  />
                  <label htmlFor="send_notification" className="text-sm flex items-center gap-1">
                    <Bell className="h-4 w-4" />
                    Notificação no App
                  </label>
                </div>
              </div>
            </div>

            {/* Templates */}
            {formSendWhatsapp && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="whatsapp_template">Mensagem WhatsApp</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormWhatsappTemplate(getDefaultTemplate(formType))}
                  >
                    Usar modelo
                  </Button>
                </div>
                <Textarea
                  id="whatsapp_template"
                  value={formWhatsappTemplate}
                  onChange={(e) => setFormWhatsappTemplate(e.target.value)}
                  placeholder="Use {nome}, {evento}, {dias} para variáveis"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variáveis: {"{nome}"}, {"{evento}"}, {"{dias}"}, {"{data}"}
                </p>
              </div>
            )}

            {formSendEmail && (
              <>
                <div>
                  <Label htmlFor="email_subject">Assunto do Email</Label>
                  <Input
                    id="email_subject"
                    value={formEmailSubject}
                    onChange={(e) => setFormEmailSubject(e.target.value)}
                    placeholder="Ex: Lembrete: {evento} em {dias} dia(s)"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="email_template">Corpo do Email</Label>
                  <Textarea
                    id="email_template"
                    value={formEmailTemplate}
                    onChange={(e) => setFormEmailTemplate(e.target.value)}
                    placeholder="Conteúdo do email..."
                    rows={4}
                    className="mt-1"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
