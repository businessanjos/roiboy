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
  Settings2,
  GripVertical,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CustomFieldsManager } from "@/components/custom-fields/CustomFieldsManager";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

interface SortableFieldItemProps {
  field: CustomField;
  onRemove: (id: string) => void;
  getFieldTypeBadge: (type: string) => React.ReactNode;
}

function SortableFieldItem({ field, onRemove, getFieldTypeBadge }: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 bg-background border rounded-md ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{field.name}</span>
      </div>
      {getFieldTypeBadge(field.field_type)}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => onRemove(field.id)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
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
  const [customFieldsDialogOpen, setCustomFieldsDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedFields((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const getSelectedFieldsData = () => {
    return selectedFields
      .map((id) => customFields.find((f) => f.id === id))
      .filter(Boolean) as CustomField[];
  };

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

  const duplicateForm = (form: Form) => {
    setEditingForm(null);
    setFormTitle(`Cópia de ${form.title}`);
    setFormDescription(form.description || "");
    setSelectedFields(form.fields || []);
    setRequireClientInfo(form.require_client_info);
    setDialogOpen(true);
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

  const getOptionLabel = (field: CustomField, value: string): string => {
    if (!field.options || !Array.isArray(field.options)) return value;
    const opt = field.options.find((o: any) => o.value === value);
    return opt?.label || value;
  };

  const renderResponseValue = (field: CustomField, value: any) => {
    switch (field.field_type) {
      case "boolean":
        return (
          <Badge variant={value ? "default" : "secondary"}>
            {value ? "Sim" : "Não"}
          </Badge>
        );
      case "select":
        const label = getOptionLabel(field, value);
        const opt = field.options?.find((o: any) => o.value === value);
        return (
          <Badge
            variant="outline"
            style={opt?.color ? { borderColor: opt.color, color: opt.color } : undefined}
          >
            {label}
          </Badge>
        );
      case "multi_select":
        if (!Array.isArray(value)) return String(value);
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((v: string) => {
              const opt = field.options?.find((o: any) => o.value === v);
              return (
                <Badge
                  key={v}
                  variant="outline"
                  style={opt?.color ? { borderColor: opt.color, color: opt.color } : undefined}
                >
                  {getOptionLabel(field, v)}
                </Badge>
              );
            })}
          </div>
        );
      case "date":
        try {
          return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
        } catch {
          return String(value);
        }
      case "currency":
        return `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
      case "number":
        return Number(value).toLocaleString("pt-BR");
      default:
        return String(value);
    }
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
                        <DropdownMenuItem onClick={() => duplicateForm(form)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
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
              <div className="flex items-center justify-between">
                <div>
                  <Label>Campos do Formulário *</Label>
                  <p className="text-sm text-muted-foreground">
                    Selecione os campos personalizados que aparecerão no formulário
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomFieldsDialogOpen(true)}
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  Gerenciar Campos
                </Button>
              </div>

              {customFields.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center">
                    <p className="text-muted-foreground mb-3">
                      Nenhum campo personalizado criado.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomFieldsDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Campos
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {/* Available fields to select */}
                  <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
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

                  {/* Sortable selected fields */}
                  {selectedFields.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        Ordem dos campos (arraste para reordenar)
                      </Label>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={selectedFields}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {getSelectedFieldsData().map((field) => (
                              <SortableFieldItem
                                key={field.id}
                                field={field}
                                onRemove={toggleField}
                                getFieldTypeBadge={getFieldTypeBadge}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}
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
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Respostas - {selectedForm?.title}
            </DialogTitle>
            <DialogDescription className="flex items-center justify-between">
              <span>{responses.length} resposta(s) recebida(s)</span>
              {responses.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const headers = ["Cliente", "Telefone", "Data", ...customFields.filter(f => selectedForm?.fields?.includes(f.id)).map(f => f.name)];
                    const rows = responses.map(r => {
                      const clientName = r.clients?.full_name || r.client_name || "Não identificado";
                      const phone = r.clients?.phone_e164 || r.client_phone || "";
                      const date = format(new Date(r.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR });
                      const fieldValues = customFields.filter(f => selectedForm?.fields?.includes(f.id)).map(field => {
                        const value = r.responses?.[field.id];
                        if (value === undefined || value === null) return "";
                        if (Array.isArray(value)) return value.map(v => getOptionLabel(field, v)).join("; ");
                        if (field.field_type === "boolean") return value ? "Sim" : "Não";
                        if (field.field_type === "select") return getOptionLabel(field, value);
                        if (field.field_type === "date") return format(new Date(value), "dd/MM/yyyy");
                        if (field.field_type === "currency") return `R$ ${Number(value).toFixed(2)}`;
                        return String(value);
                      });
                      return [clientName, phone, date, ...fieldValues];
                    });
                    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `respostas-${selectedForm?.title || "formulario"}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("CSV exportado!");
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-4">
            {loadingResponses ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : responses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Nenhuma resposta recebida
                </h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Compartilhe o link do formulário com seus clientes para começar a coletar respostas.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    if (selectedForm) copyFormLink(selectedForm);
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Link
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {responses.map((response, index) => {
                  const orderedFields = selectedForm?.fields
                    ?.map((fId: string) => customFields.find((f) => f.id === fId))
                    .filter(Boolean) as CustomField[] || [];

                  return (
                    <Card key={response.id} className="overflow-hidden">
                      <CardHeader className="bg-muted/30 py-3 px-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                              {index + 1}
                            </div>
                            <div>
                              <CardTitle className="text-base">
                                {response.clients?.full_name ||
                                  response.client_name ||
                                  "Cliente não identificado"}
                              </CardTitle>
                              {(response.clients?.phone_e164 || response.client_phone) && (
                                <CardDescription className="text-xs">
                                  {response.clients?.phone_e164 || response.client_phone}
                                </CardDescription>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {format(new Date(response.submitted_at), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {orderedFields.map((field) => {
                            const value = response.responses?.[field.id];
                            const isEmpty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

                            return (
                              <div
                                key={field.id}
                                className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30"
                              >
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  {field.name}
                                </span>
                                <div className="text-sm text-foreground">
                                  {isEmpty ? (
                                    <span className="text-muted-foreground/60 italic">
                                      Não preenchido
                                    </span>
                                  ) : (
                                    renderResponseValue(field, value)
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Fields Manager */}
      <CustomFieldsManager
        open={customFieldsDialogOpen}
        onOpenChange={(open) => {
          setCustomFieldsDialogOpen(open);
          if (!open) {
            fetchCustomFields();
          }
        }}
      />
    </div>
  );
}
