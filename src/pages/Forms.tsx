import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Eye,
  Link2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  options: any;
  is_required: boolean;
}

interface Form {
  id: string;
  title: string;
  description: string | null;
  fields: any; // JSON field from database
  is_active: boolean;
  require_client_info: boolean;
  created_at: string;
  _count?: number;
}

export default function Forms() {
  const { currentUser } = useCurrentUser();
  const [forms, setForms] = useState<Form[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [responsesDialogOpen, setResponsesDialogOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [requireClientInfo, setRequireClientInfo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);

  useEffect(() => {
    if (currentUser?.account_id) {
      fetchForms();
      fetchCustomFields();
    }
  }, [currentUser?.account_id]);

  const fetchForms = async () => {
    try {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch response counts
      const formsWithCounts = await Promise.all(
        (data || []).map(async (form) => {
          const { count } = await supabase
            .from("form_responses")
            .select("*", { count: "exact", head: true })
            .eq("form_id", form.id);
          return { ...form, _count: count || 0 };
        })
      );

      setForms(formsWithCounts);
    } catch (error: any) {
      console.error("Error fetching forms:", error);
      toast.error("Erro ao carregar formulários");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomFields = async () => {
    try {
      const { data, error } = await supabase
        .from("custom_fields")
        .select("id, name, field_type, options, is_required")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setCustomFields(data || []);
    } catch (error: any) {
      console.error("Error fetching custom fields:", error);
    }
  };

  const openCreateDialog = () => {
    setEditingForm(null);
    setFormTitle("");
    setFormDescription("");
    setSelectedFields([]);
    setRequireClientInfo(false);
    setDialogOpen(true);
  };

  const openEditDialog = (form: Form) => {
    setEditingForm(form);
    setFormTitle(form.title);
    setFormDescription(form.description || "");
    setSelectedFields(form.fields || []);
    setRequireClientInfo(form.require_client_info);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    if (selectedFields.length === 0) {
      toast.error("Selecione pelo menos um campo");
      return;
    }

    setSaving(true);
    try {
      if (editingForm) {
        const { error } = await supabase
          .from("forms")
          .update({
            title: formTitle.trim(),
            description: formDescription.trim() || null,
            fields: selectedFields,
            require_client_info: requireClientInfo,
          })
          .eq("id", editingForm.id);

        if (error) throw error;
        toast.success("Formulário atualizado!");
      } else {
        const { error } = await supabase.from("forms").insert({
          account_id: currentUser!.account_id,
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          fields: selectedFields,
          require_client_info: requireClientInfo,
        });

        if (error) throw error;
        toast.success("Formulário criado!");
      }

      setDialogOpen(false);
      fetchForms();
    } catch (error: any) {
      console.error("Error saving form:", error);
      toast.error(error.message || "Erro ao salvar formulário");
    } finally {
      setSaving(false);
    }
  };

  const toggleFormActive = async (form: Form) => {
    try {
      const { error } = await supabase
        .from("forms")
        .update({ is_active: !form.is_active })
        .eq("id", form.id);

      if (error) throw error;
      toast.success(form.is_active ? "Formulário desativado" : "Formulário ativado");
      fetchForms();
    } catch (error: any) {
      console.error("Error toggling form:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const deleteForm = async (form: Form) => {
    if (!confirm("Tem certeza que deseja excluir este formulário?")) return;

    try {
      const { error } = await supabase.from("forms").delete().eq("id", form.id);
      if (error) throw error;
      toast.success("Formulário excluído");
      fetchForms();
    } catch (error: any) {
      console.error("Error deleting form:", error);
      toast.error("Erro ao excluir formulário");
    }
  };

  const copyFormLink = (form: Form, withClient = false) => {
    const baseUrl = window.location.origin;
    const link = withClient
      ? `${baseUrl}/f/${form.id}?client=CLIENT_ID`
      : `${baseUrl}/f/${form.id}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const viewResponses = async (form: Form) => {
    setSelectedForm(form);
    setLoadingResponses(true);
    setResponsesDialogOpen(true);

    try {
      const { data, error } = await supabase
        .from("form_responses")
        .select(`
          *,
          clients:client_id (full_name, phone_e164)
        `)
        .eq("form_id", form.id)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setResponses(data || []);
    } catch (error: any) {
      console.error("Error fetching responses:", error);
      toast.error("Erro ao carregar respostas");
    } finally {
      setLoadingResponses(false);
    }
  };

  const toggleField = (fieldId: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldId)
        ? prev.filter((id) => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const getFieldTypeBadge = (type: string) => {
    const types: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      select: { label: "Seleção", variant: "default" },
      multi_select: { label: "Múltipla", variant: "default" },
      boolean: { label: "Sim/Não", variant: "secondary" },
      number: { label: "Número", variant: "secondary" },
      currency: { label: "Moeda", variant: "secondary" },
      date: { label: "Data", variant: "outline" },
      text: { label: "Texto", variant: "outline" },
      user: { label: "Usuário", variant: "outline" },
    };
    const t = types[type] || { label: type, variant: "outline" as const };
    return <Badge variant={t.variant}>{t.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Formulários</h1>
          <p className="text-muted-foreground">
            Crie formulários personalizados e colete respostas dos clientes
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Formulário
        </Button>
      </div>

      {/* Forms List */}
      {forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum formulário criado
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie seu primeiro formulário para coletar informações dos clientes
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Formulário
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Campos</TableHead>
                <TableHead>Respostas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map((form) => (
                <TableRow key={form.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{form.title}</p>
                      {form.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {form.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{form.fields?.length || 0} campos</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{form._count || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={form.is_active ? "default" : "secondary"}>
                      {form.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(form.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => viewResponses(form)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Respostas
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyFormLink(form)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar Link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyFormLink(form, true)}>
                          <Link2 className="h-4 w-4 mr-2" />
                          Link com Cliente
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => window.open(`/f/${form.id}`, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Abrir Formulário
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(form)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleFormActive(form)}>
                          {form.is_active ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteForm(form)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingForm ? "Editar Formulário" : "Novo Formulário"}
            </DialogTitle>
            <DialogDescription>
              Configure os campos que aparecerão no formulário público
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex: Formulário de Diagnóstico"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Instruções ou informações adicionais..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label>Solicitar dados do cliente</Label>
                <p className="text-sm text-muted-foreground">
                  Pede nome e telefone quando não há cliente vinculado
                </p>
              </div>
              <Switch
                checked={requireClientInfo}
                onCheckedChange={setRequireClientInfo}
              />
            </div>

            <div className="space-y-2">
              <Label>Campos do Formulário *</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Selecione os campos personalizados que aparecerão no formulário
              </p>

              {customFields.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center text-muted-foreground">
                    Nenhum campo personalizado criado.
                    <br />
                    Crie campos em Configurações → Campos Personalizados
                  </CardContent>
                </Card>
              ) : (
                <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                  {customFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleField(field.id)}
                    >
                      <Checkbox
                        checked={selectedFields.includes(field.id)}
                        onCheckedChange={() => toggleField(field.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{field.name}</p>
                        {field.is_required && (
                          <span className="text-xs text-muted-foreground">
                            Obrigatório
                          </span>
                        )}
                      </div>
                      {getFieldTypeBadge(field.field_type)}
                    </div>
                  ))}
                </div>
              )}

              {selectedFields.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedFields.length} campo(s) selecionado(s)
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingForm ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Responses Dialog */}
      <Dialog open={responsesDialogOpen} onOpenChange={setResponsesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Respostas - {selectedForm?.title}</DialogTitle>
            <DialogDescription>
              {responses.length} resposta(s) recebida(s)
            </DialogDescription>
          </DialogHeader>

          {loadingResponses ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : responses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma resposta recebida ainda
            </div>
          ) : (
            <div className="space-y-4">
              {responses.map((response) => (
                <Card key={response.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {response.clients?.full_name ||
                          response.client_name ||
                          "Cliente não identificado"}
                      </CardTitle>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(response.submitted_at), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    {(response.clients?.phone_e164 || response.client_phone) && (
                      <CardDescription>
                        {response.clients?.phone_e164 || response.client_phone}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2">
                      {Object.entries(response.responses || {}).map(
                        ([fieldId, value]) => {
                          const field = customFields.find((f) => f.id === fieldId);
                          return (
                            <div
                              key={fieldId}
                              className="flex items-start gap-2 text-sm"
                            >
                              <span className="font-medium text-muted-foreground min-w-[120px]">
                                {field?.name || fieldId}:
                              </span>
                              <span className="text-foreground">
                                {Array.isArray(value)
                                  ? value.join(", ")
                                  : value === true
                                  ? "Sim"
                                  : value === false
                                  ? "Não"
                                  : String(value)}
                              </span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
