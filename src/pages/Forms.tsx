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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
  Download,
  ChevronLeft,
  CalendarIcon,
  User,
  Phone,
  LayoutTemplate,
  Star,
  ThumbsUp,
  MessageSquare,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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

// Form Templates
interface FormTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  title: string;
  formDescription: string;
  requireClientInfo: boolean;
  fields: Array<{
    name: string;
    field_type: string;
    is_required: boolean;
    options?: any[];
  }>;
}

const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "cx_completo",
    name: "CX Completo",
    description: "Formulário completo de Customer Experience com dados pessoais, preferências e redes sociais",
    icon: <User className="h-5 w-5" />,
    title: "Formulário CX - Conhecendo Você",
    formDescription: "Queremos conhecer você melhor! Preencha as informações abaixo para personalizarmos sua experiência.",
    requireClientInfo: true,
    fields: [
      // Pessoal
      { name: "Data de Nascimento", field_type: "date", is_required: true },
      { 
        name: "Estado Civil", 
        field_type: "select", 
        is_required: false,
        options: [
          { value: "solteiro", label: "Solteiro(a)", color: "#3b82f6" },
          { value: "casado", label: "Casado(a)", color: "#22c55e" },
          { value: "divorciado", label: "Divorciado(a)", color: "#f97316" },
          { value: "viuvo", label: "Viúvo(a)", color: "#6b7280" },
          { value: "uniao_estavel", label: "União Estável", color: "#8b5cf6" },
        ],
      },
      { name: "Data de Casamento", field_type: "date", is_required: false },
      { name: "Quantidade de Filhos", field_type: "number", is_required: false },
      { name: "Nome dos Filhos", field_type: "text", is_required: false },
      { name: "Idade dos Filhos", field_type: "text", is_required: false },
      { name: "Profissão", field_type: "text", is_required: false },
      { name: "Empresa onde trabalha", field_type: "text", is_required: false },
      // Endereço
      { name: "CEP", field_type: "text", is_required: false },
      { name: "Rua", field_type: "text", is_required: false },
      { name: "Número", field_type: "text", is_required: false },
      { name: "Complemento", field_type: "text", is_required: false },
      { name: "Bairro", field_type: "text", is_required: false },
      { name: "Cidade", field_type: "text", is_required: false },
      { 
        name: "Estado", 
        field_type: "select", 
        is_required: false,
        options: [
          { value: "AC", label: "AC", color: "#6b7280" },
          { value: "AL", label: "AL", color: "#6b7280" },
          { value: "AM", label: "AM", color: "#6b7280" },
          { value: "AP", label: "AP", color: "#6b7280" },
          { value: "BA", label: "BA", color: "#6b7280" },
          { value: "CE", label: "CE", color: "#6b7280" },
          { value: "DF", label: "DF", color: "#6b7280" },
          { value: "ES", label: "ES", color: "#6b7280" },
          { value: "GO", label: "GO", color: "#6b7280" },
          { value: "MA", label: "MA", color: "#6b7280" },
          { value: "MG", label: "MG", color: "#6b7280" },
          { value: "MS", label: "MS", color: "#6b7280" },
          { value: "MT", label: "MT", color: "#6b7280" },
          { value: "PA", label: "PA", color: "#6b7280" },
          { value: "PB", label: "PB", color: "#6b7280" },
          { value: "PE", label: "PE", color: "#6b7280" },
          { value: "PI", label: "PI", color: "#6b7280" },
          { value: "PR", label: "PR", color: "#6b7280" },
          { value: "RJ", label: "RJ", color: "#6b7280" },
          { value: "RN", label: "RN", color: "#6b7280" },
          { value: "RO", label: "RO", color: "#6b7280" },
          { value: "RR", label: "RR", color: "#6b7280" },
          { value: "RS", label: "RS", color: "#6b7280" },
          { value: "SC", label: "SC", color: "#6b7280" },
          { value: "SE", label: "SE", color: "#6b7280" },
          { value: "SP", label: "SP", color: "#6b7280" },
          { value: "TO", label: "TO", color: "#6b7280" },
        ],
      },
      // Preferências
      { name: "Comida Preferida", field_type: "text", is_required: false },
      { 
        name: "Restrições Alimentares", 
        field_type: "multi_select", 
        is_required: false,
        options: [
          { value: "vegetariano", label: "Vegetariano", color: "#22c55e" },
          { value: "vegano", label: "Vegano", color: "#16a34a" },
          { value: "sem_gluten", label: "Sem Glúten", color: "#f59e0b" },
          { value: "sem_lactose", label: "Sem Lactose", color: "#3b82f6" },
          { value: "nenhuma", label: "Nenhuma", color: "#6b7280" },
        ],
      },
      { name: "Bebida Preferida", field_type: "text", is_required: false },
      { 
        name: "Tamanho de Roupa", 
        field_type: "select", 
        is_required: false,
        options: [
          { value: "pp", label: "PP", color: "#6b7280" },
          { value: "p", label: "P", color: "#6b7280" },
          { value: "m", label: "M", color: "#6b7280" },
          { value: "g", label: "G", color: "#6b7280" },
          { value: "gg", label: "GG", color: "#6b7280" },
          { value: "xg", label: "XG", color: "#6b7280" },
          { value: "xxg", label: "XXG", color: "#6b7280" },
        ],
      },
      { name: "Tamanho de Calçado", field_type: "number", is_required: false },
      { name: "Time de Futebol", field_type: "text", is_required: false },
      { name: "Hobbies", field_type: "text", is_required: false },
      { name: "Destino de Viagem dos Sonhos", field_type: "text", is_required: false },
      { name: "Animal de Estimação", field_type: "text", is_required: false },
      // Redes Sociais
      { name: "Instagram", field_type: "text", is_required: false },
      { name: "LinkedIn", field_type: "text", is_required: false },
      { name: "Facebook", field_type: "text", is_required: false },
      { name: "TikTok", field_type: "text", is_required: false },
      { name: "YouTube", field_type: "text", is_required: false },
      { name: "Twitter/X", field_type: "text", is_required: false },
    ],
  },
  {
    id: "cadastro_empresarial",
    name: "Cadastro Empresarial",
    description: "Formulário de cadastro para clientes B2B com dados da empresa, faturamento e estrutura",
    icon: <FileText className="h-5 w-5" />,
    title: "Cadastro Empresarial",
    formDescription: "Preencha os dados da sua empresa para conhecermos melhor o seu negócio.",
    requireClientInfo: true,
    fields: [
      // Dados da Empresa
      { name: "CNPJ", field_type: "text", is_required: true },
      { name: "Razão Social", field_type: "text", is_required: true },
      { name: "Nome Fantasia", field_type: "text", is_required: false },
      { name: "Inscrição Estadual", field_type: "text", is_required: false },
      { name: "Data de Fundação", field_type: "date", is_required: false },
      { 
        name: "Segmento de Atuação", 
        field_type: "select", 
        is_required: false,
        options: [
          { value: "comercio", label: "Comércio", color: "#3b82f6" },
          { value: "industria", label: "Indústria", color: "#8b5cf6" },
          { value: "servicos", label: "Serviços", color: "#22c55e" },
          { value: "tecnologia", label: "Tecnologia", color: "#06b6d4" },
          { value: "saude", label: "Saúde", color: "#ef4444" },
          { value: "educacao", label: "Educação", color: "#f59e0b" },
          { value: "financeiro", label: "Financeiro", color: "#10b981" },
          { value: "agronegocio", label: "Agronegócio", color: "#84cc16" },
          { value: "construcao", label: "Construção Civil", color: "#6b7280" },
          { value: "varejo", label: "Varejo", color: "#ec4899" },
          { value: "outro", label: "Outro", color: "#6b7280" },
        ],
      },
      { name: "Descrição do Negócio", field_type: "text", is_required: false },
      { name: "Website", field_type: "text", is_required: false },
      // Estrutura e Faturamento
      { 
        name: "Porte da Empresa", 
        field_type: "select", 
        is_required: false,
        options: [
          { value: "mei", label: "MEI", color: "#6b7280" },
          { value: "me", label: "Microempresa (ME)", color: "#3b82f6" },
          { value: "epp", label: "Empresa de Pequeno Porte (EPP)", color: "#22c55e" },
          { value: "medio", label: "Média Empresa", color: "#f59e0b" },
          { value: "grande", label: "Grande Empresa", color: "#8b5cf6" },
        ],
      },
      { 
        name: "Faturamento Mensal", 
        field_type: "select", 
        is_required: false,
        options: [
          { value: "ate_10k", label: "Até R$ 10.000", color: "#6b7280" },
          { value: "10k_50k", label: "R$ 10.000 - R$ 50.000", color: "#3b82f6" },
          { value: "50k_100k", label: "R$ 50.000 - R$ 100.000", color: "#22c55e" },
          { value: "100k_500k", label: "R$ 100.000 - R$ 500.000", color: "#f59e0b" },
          { value: "500k_1m", label: "R$ 500.000 - R$ 1 milhão", color: "#8b5cf6" },
          { value: "acima_1m", label: "Acima de R$ 1 milhão", color: "#ef4444" },
        ],
      },
      { name: "Número de Funcionários", field_type: "number", is_required: false },
      { name: "Número de Sócios", field_type: "number", is_required: false },
      { 
        name: "Tempo de Mercado", 
        field_type: "select", 
        is_required: false,
        options: [
          { value: "menos_1", label: "Menos de 1 ano", color: "#ef4444" },
          { value: "1_3", label: "1 a 3 anos", color: "#f59e0b" },
          { value: "3_5", label: "3 a 5 anos", color: "#22c55e" },
          { value: "5_10", label: "5 a 10 anos", color: "#3b82f6" },
          { value: "mais_10", label: "Mais de 10 anos", color: "#8b5cf6" },
        ],
      },
      // Contato Comercial
      { name: "Nome do Responsável", field_type: "text", is_required: false },
      { name: "Cargo do Responsável", field_type: "text", is_required: false },
      { name: "E-mail Comercial", field_type: "text", is_required: false },
      { name: "Telefone Comercial", field_type: "text", is_required: false },
      { name: "WhatsApp Comercial", field_type: "text", is_required: false },
      // Endereço Comercial
      { name: "CEP Comercial", field_type: "text", is_required: false },
      { name: "Endereço Comercial", field_type: "text", is_required: false },
      { name: "Cidade", field_type: "text", is_required: false },
      { 
        name: "Estado", 
        field_type: "select", 
        is_required: false,
        options: [
          { value: "AC", label: "AC", color: "#6b7280" },
          { value: "AL", label: "AL", color: "#6b7280" },
          { value: "AM", label: "AM", color: "#6b7280" },
          { value: "AP", label: "AP", color: "#6b7280" },
          { value: "BA", label: "BA", color: "#6b7280" },
          { value: "CE", label: "CE", color: "#6b7280" },
          { value: "DF", label: "DF", color: "#6b7280" },
          { value: "ES", label: "ES", color: "#6b7280" },
          { value: "GO", label: "GO", color: "#6b7280" },
          { value: "MA", label: "MA", color: "#6b7280" },
          { value: "MG", label: "MG", color: "#6b7280" },
          { value: "MS", label: "MS", color: "#6b7280" },
          { value: "MT", label: "MT", color: "#6b7280" },
          { value: "PA", label: "PA", color: "#6b7280" },
          { value: "PB", label: "PB", color: "#6b7280" },
          { value: "PE", label: "PE", color: "#6b7280" },
          { value: "PI", label: "PI", color: "#6b7280" },
          { value: "PR", label: "PR", color: "#6b7280" },
          { value: "RJ", label: "RJ", color: "#6b7280" },
          { value: "RN", label: "RN", color: "#6b7280" },
          { value: "RO", label: "RO", color: "#6b7280" },
          { value: "RR", label: "RR", color: "#6b7280" },
          { value: "RS", label: "RS", color: "#6b7280" },
          { value: "SC", label: "SC", color: "#6b7280" },
          { value: "SE", label: "SE", color: "#6b7280" },
          { value: "SP", label: "SP", color: "#6b7280" },
          { value: "TO", label: "TO", color: "#6b7280" },
        ],
      },
      // Redes Sociais da Empresa
      { name: "Instagram da Empresa", field_type: "text", is_required: false },
      { name: "LinkedIn da Empresa", field_type: "text", is_required: false },
      { name: "Facebook da Empresa", field_type: "text", is_required: false },
    ],
  },
  {
    id: "nps",
    name: "NPS",
    description: "Net Promoter Score - Pergunta de 0-10 sobre recomendação",
    icon: <Star className="h-5 w-5" />,
    title: "Pesquisa NPS",
    formDescription: "Em uma escala de 0 a 10, o quanto você recomendaria nossos serviços?",
    requireClientInfo: true,
    fields: [
      {
        name: "Nota NPS (0-10)",
        field_type: "select",
        is_required: true,
        options: [
          { value: "0", label: "0 - Não recomendaria", color: "#ef4444" },
          { value: "1", label: "1", color: "#ef4444" },
          { value: "2", label: "2", color: "#ef4444" },
          { value: "3", label: "3", color: "#f97316" },
          { value: "4", label: "4", color: "#f97316" },
          { value: "5", label: "5", color: "#f97316" },
          { value: "6", label: "6", color: "#f97316" },
          { value: "7", label: "7 - Neutro", color: "#eab308" },
          { value: "8", label: "8 - Neutro", color: "#eab308" },
          { value: "9", label: "9 - Promotor", color: "#22c55e" },
          { value: "10", label: "10 - Promotor", color: "#22c55e" },
        ],
      },
      {
        name: "Comentário (opcional)",
        field_type: "text",
        is_required: false,
      },
    ],
  },
  {
    id: "csat",
    name: "CSAT",
    description: "Satisfação - Escala de Muito Insatisfeito a Muito Satisfeito",
    icon: <ThumbsUp className="h-5 w-5" />,
    title: "Pesquisa de Satisfação",
    formDescription: "Como você avalia sua experiência conosco?",
    requireClientInfo: true,
    fields: [
      {
        name: "Nível de Satisfação",
        field_type: "select",
        is_required: true,
        options: [
          { value: "muito_insatisfeito", label: "Muito Insatisfeito", color: "#ef4444" },
          { value: "insatisfeito", label: "Insatisfeito", color: "#f97316" },
          { value: "neutro", label: "Neutro", color: "#eab308" },
          { value: "satisfeito", label: "Satisfeito", color: "#84cc16" },
          { value: "muito_satisfeito", label: "Muito Satisfeito", color: "#22c55e" },
        ],
      },
      {
        name: "O que podemos melhorar?",
        field_type: "text",
        is_required: false,
      },
    ],
  },
  {
    id: "feedback",
    name: "Feedback Geral",
    description: "Campos abertos para sugestões e comentários",
    icon: <MessageSquare className="h-5 w-5" />,
    title: "Formulário de Feedback",
    formDescription: "Compartilhe sua opinião conosco!",
    requireClientInfo: true,
    fields: [
      {
        name: "Sugestões",
        field_type: "text",
        is_required: false,
      },
      {
        name: "Comentários Gerais",
        field_type: "text",
        is_required: false,
      },
      {
        name: "O que você mais gosta?",
        field_type: "text",
        is_required: false,
      },
    ],
  },
];

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
  const [showTemplates, setShowTemplates] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // Preview state (interactive testing)
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});
  const [previewClientName, setPreviewClientName] = useState("");
  const [previewClientPhone, setPreviewClientPhone] = useState("");

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
    setShowTemplates(true);
    setDialogOpen(true);
  };

  const openEditDialog = (form: Form) => {
    setEditingForm(form);
    setFormTitle(form.title);
    setFormDescription(form.description || "");
    setSelectedFields(form.fields || []);
    setRequireClientInfo(form.require_client_info);
    setShowTemplates(false);
    setDialogOpen(true);
  };

  const applyTemplate = async (template: FormTemplate) => {
    setApplyingTemplate(true);
    try {
      // Create custom fields if they don't exist and collect their IDs
      const fieldIds: string[] = [];
      
      for (const fieldDef of template.fields) {
        // Check if field with same name exists
        const existingField = customFields.find(f => f.name === fieldDef.name);
        
        if (existingField) {
          fieldIds.push(existingField.id);
        } else {
          // Create the field
          const { data, error } = await supabase
            .from("custom_fields")
            .insert({
              account_id: currentUser!.account_id,
              name: fieldDef.name,
              field_type: fieldDef.field_type,
              is_required: fieldDef.is_required,
              options: fieldDef.options || [],
              is_active: true,
              show_in_clients: false, // Template fields are form-only by default
            })
            .select("id")
            .single();
          
          if (error) throw error;
          if (data) fieldIds.push(data.id);
        }
      }

      // Refresh custom fields list
      await fetchCustomFields();

      // Pre-fill form with template data
      setFormTitle(template.title);
      setFormDescription(template.formDescription);
      setRequireClientInfo(template.requireClientInfo);
      setSelectedFields(fieldIds);
      setShowTemplates(false);
      
      toast.success(`Modelo "${template.name}" aplicado!`);
    } catch (error: any) {
      console.error("Error applying template:", error);
      toast.error("Erro ao aplicar modelo");
    } finally {
      setApplyingTemplate(false);
    }
  };

  const startFromScratch = () => {
    setShowTemplates(false);
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
    resetPreview(); // Clear preview state when opening a new form

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

  const resetPreview = () => {
    setPreviewValues({});
    setPreviewClientName("");
    setPreviewClientPhone("");
  };

  const updatePreviewValue = (fieldId: string, value: any) => {
    setPreviewValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const renderInteractiveField = (field: CustomField) => {
    const value = previewValues[field.id];

    switch (field.field_type) {
      case "boolean":
        return (
          <div className="flex items-center gap-3 p-3 rounded-md border bg-card">
            <Switch 
              checked={value === true}
              onCheckedChange={(checked) => updatePreviewValue(field.id, checked)}
            />
            <span className="text-sm">{value === true ? "Sim" : value === false ? "Não" : "Não informado"}</span>
          </div>
        );

      case "select":
        const selectOptions = field.options || [];
        return (
          <RadioGroup 
            className="p-3 rounded-md border bg-card" 
            value={value || ""}
            onValueChange={(v) => updatePreviewValue(field.id, v)}
          >
            {selectOptions.map((opt: any) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value} id={`preview-${field.id}-${opt.value}`} />
                <Label
                  htmlFor={`preview-${field.id}-${opt.value}`}
                  className="font-normal cursor-pointer"
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "multi_select":
        const multiOptions = field.options || [];
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2 p-3 rounded-md border bg-card">
            {multiOptions.map((opt: any) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <Checkbox 
                  id={`preview-${field.id}-${opt.value}`}
                  checked={selectedValues.includes(opt.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updatePreviewValue(field.id, [...selectedValues, opt.value]);
                    } else {
                      updatePreviewValue(field.id, selectedValues.filter((v: string) => v !== opt.value));
                    }
                  }}
                />
                <Label
                  htmlFor={`preview-${field.id}-${opt.value}`}
                  className="font-normal cursor-pointer"
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
        );

      case "number":
      case "currency":
        return (
          <Input
            type="number"
            placeholder={field.field_type === "currency" ? "0.00" : "0"}
            value={value || ""}
            onChange={(e) => updatePreviewValue(field.id, e.target.value ? Number(e.target.value) : null)}
          />
        );

      case "date":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value), "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) => updatePreviewValue(field.id, date ? format(date, "yyyy-MM-dd") : null)}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        );

      case "text":
      default:
        return (
          <Textarea
            placeholder="Digite sua resposta..."
            rows={3}
            value={value || ""}
            onChange={(e) => updatePreviewValue(field.id, e.target.value)}
          />
        );
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
        <div className="border rounded-lg bg-card">
          {/* Table Header */}
          <div className="hidden md:grid md:grid-cols-[1fr,100px,100px,120px,50px] gap-4 px-4 py-3 border-b text-sm text-muted-foreground">
            <div></div>
            <div className="text-right">Respostas</div>
            <div className="text-right">Campos</div>
            <div className="text-right">Atualizado</div>
            <div></div>
          </div>

          {/* Form Rows */}
          <div className="divide-y">
            {forms.map((form, index) => {
              // Generate a consistent color based on form index
              const colors = [
                "bg-slate-700",
                "bg-blue-600",
                "bg-emerald-600",
                "bg-amber-600",
                "bg-purple-600",
                "bg-rose-600",
                "bg-cyan-600",
                "bg-indigo-600",
              ];
              const colorClass = colors[index % colors.length];

              return (
                <div
                  key={form.id}
                  className="group flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => viewResponses(form)}
                >
                  {/* Icon */}
                  <div
                    className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${colorClass} ${
                      !form.is_active ? "opacity-50" : ""
                    }`}
                  >
                    <FileText className="h-4 w-4 text-white" />
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-foreground truncate ${!form.is_active ? "opacity-60" : ""}`}>
                      {form.title}
                    </p>
                    {form.description && (
                      <p className="text-sm text-muted-foreground truncate hidden sm:block">
                        {form.description}
                      </p>
                    )}
                  </div>

                  {/* Stats - Desktop */}
                  <div className="hidden md:flex items-center gap-4">
                    <div className="w-[100px] text-right text-sm text-muted-foreground">
                      {form._count || "-"}
                    </div>
                    <div className="w-[100px] text-right text-sm text-muted-foreground">
                      {form.fields?.length || 0}
                    </div>
                    <div className="w-[120px] text-right text-sm text-muted-foreground">
                      {format(new Date(form.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </div>
                  </div>

                  {/* Stats - Mobile */}
                  <div className="flex md:hidden items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {form._count || 0}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); window.open(`/f/${form.id}`, "_blank"); }}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir Formulário
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); viewResponses(form); }}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Respostas
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); copyFormLink(form); }}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); copyFormLink(form, true); }}>
                        <Link2 className="h-4 w-4 mr-2" />
                        Link com Cliente
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openEditDialog(form); }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); duplicateForm(form); }}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleFormActive(form); }}>
                        {form.is_active ? "Desativar" : "Ativar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(e) => { e.preventDefault(); deleteForm(form); }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingForm ? "Editar Formulário" : showTemplates ? "Novo Formulário" : "Configurar Formulário"}
            </DialogTitle>
            <DialogDescription>
              {showTemplates 
                ? "Escolha um modelo para começar rapidamente ou crie do zero" 
                : "Configure os campos que aparecerão no formulário público"}
            </DialogDescription>
          </DialogHeader>

          {/* Template Selection */}
          {showTemplates && !editingForm ? (
            <div className="space-y-4 py-4">
              <div className="grid gap-3">
                {FORM_TEMPLATES.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    onClick={() => !applyingTemplate && applyTemplate(template)}
                  >
                    <CardContent className="flex items-start gap-4 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {template.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium">{template.name}</h4>
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      </div>
                      {applyingTemplate && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={startFromScratch}
                disabled={applyingTemplate}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar do zero
              </Button>
            </div>
          ) : (
            <>
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
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Responses Dialog */}
      <Dialog open={responsesDialogOpen} onOpenChange={setResponsesDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col p-0">
          {/* Header with breadcrumb */}
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setResponsesDialogOpen(false)}
            >
              <ChevronLeft className="h-4 w-4" />
              Formulários
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium truncate">{selectedForm?.title}</span>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="preview" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 border-b">
              <TabsList className="h-auto p-0 bg-transparent gap-4">
                <TabsTrigger
                  value="preview"
                  className="pb-3 pt-2 px-0 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent"
                >
                  Preview
                </TabsTrigger>
                <TabsTrigger
                  value="insights"
                  className="pb-3 pt-2 px-0 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent"
                >
                  Insights
                </TabsTrigger>
                <TabsTrigger
                  value="responses"
                  className="pb-3 pt-2 px-0 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent"
                >
                  Respostas [{responses.length}]
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Preview Tab - Interactive */}
            <TabsContent value="preview" className="flex-1 overflow-auto m-0">
              <div className="flex justify-center p-6">
                <div className="w-full max-w-xl">
                  {/* Info banner */}
                  <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-dashed text-sm text-muted-foreground text-center">
                    Teste o formulário abaixo. Os dados não serão salvos.
                  </div>

                  <Card className="shadow-lg">
                    <CardHeader className="space-y-2">
                      <CardTitle className="text-2xl">{selectedForm?.title}</CardTitle>
                      {selectedForm?.description && (
                        <CardDescription className="text-base">
                          {selectedForm.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Client Info - Interactive */}
                      {selectedForm?.require_client_info && (
                        <div className="space-y-4 pb-4 border-b">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Seu nome *
                            </Label>
                            <Input 
                              placeholder="Digite seu nome completo" 
                              value={previewClientName}
                              onChange={(e) => setPreviewClientName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              Seu telefone *
                            </Label>
                            <Input 
                              placeholder="+55 11 99999-9999" 
                              value={previewClientPhone}
                              onChange={(e) => setPreviewClientPhone(e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Form Fields - Interactive */}
                      {selectedForm?.fields?.map((fieldId: string) => {
                        const field = customFields.find((f) => f.id === fieldId);
                        if (!field) return null;

                        return (
                          <div key={field.id} className="space-y-2">
                            <Label>
                              {field.name}
                              {field.is_required && <span className="text-destructive ml-1">*</span>}
                            </Label>
                            {renderInteractiveField(field)}
                          </div>
                        );
                      })}

                      {/* Submit Button - Shows feedback */}
                      <Button 
                        className="w-full" 
                        onClick={() => toast.success("Formulário válido! (dados de teste não salvos)")}
                      >
                        Enviar
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Action Buttons */}
                  <div className="mt-4 flex justify-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetPreview}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Limpar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/f/${selectedForm?.id}`, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir formulário
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="flex-1 overflow-auto p-6 m-0">
              <div className="space-y-6">
                {/* Stats Cards */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">Visão geral</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Respostas</p>
                      <p className="text-3xl font-bold">{responses.length}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Campos</p>
                      <p className="text-3xl font-bold">{selectedForm?.fields?.length || 0}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Taxa de preenchimento</p>
                      <p className="text-3xl font-bold">
                        {responses.length > 0
                          ? (() => {
                              const totalFields = (selectedForm?.fields?.length || 0) * responses.length;
                              if (totalFields === 0) return "—";
                              const filledFields = responses.reduce((acc, r) => {
                                return acc + Object.values(r.responses || {}).filter(
                                  (v) => v !== undefined && v !== null && v !== "" && (!Array.isArray(v) || v.length > 0)
                                ).length;
                              }, 0);
                              return `${Math.round((filledFields / totalFields) * 100)}%`;
                            })()
                          : "—"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Última resposta</p>
                      <p className="text-3xl font-bold">
                        {responses.length > 0
                          ? format(new Date(responses[0].submitted_at), "dd MMM", { locale: ptBR })
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Empty State */}
                {responses.length === 0 && (
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
                )}
              </div>
            </TabsContent>

            {/* Responses Tab - Table Style */}
            <TabsContent value="responses" className="flex-1 flex flex-col overflow-hidden m-0">
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
                <>
                  {/* Toolbar */}
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
                    <div className="text-sm text-muted-foreground">
                      {responses.length} resposta(s)
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const orderedFields = selectedForm?.fields
                          ?.map((fId: string) => customFields.find((f) => f.id === fId))
                          .filter(Boolean) as CustomField[] || [];
                        const headers = ["Cliente", "Telefone", "Data", ...orderedFields.map(f => f.name)];
                        const rows = responses.map(r => {
                          const clientName = r.clients?.full_name || r.client_name || "Não identificado";
                          const phone = r.clients?.phone_e164 || r.client_phone || "";
                          const date = format(new Date(r.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR });
                          const fieldValues = orderedFields.map(field => {
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
                      <Download className="h-4 w-4 mr-2" />
                      Exportar
                    </Button>
                  </div>

                  {/* Table with horizontal scroll */}
                  <ScrollArea className="flex-1">
                    <div className="min-w-max">
                      {/* Table Header */}
                      <div className="flex border-b bg-muted/30 sticky top-0">
                        <div className="w-10 flex-shrink-0 px-2 py-3"></div>
                        <div className="w-[180px] flex-shrink-0 px-3 py-3 text-xs font-medium text-muted-foreground">
                          Cliente
                        </div>
                        <div className="w-[100px] flex-shrink-0 px-3 py-3 text-xs font-medium text-muted-foreground">
                          Data
                        </div>
                        {(selectedForm?.fields || []).map((fieldId: string) => {
                          const field = customFields.find(f => f.id === fieldId);
                          return (
                            <div
                              key={fieldId}
                              className="w-[160px] flex-shrink-0 px-3 py-3 text-xs font-medium text-muted-foreground truncate"
                              title={field?.name}
                            >
                              {field?.name || "Campo"}
                            </div>
                          );
                        })}
                      </div>

                      {/* Table Body */}
                      <div className="divide-y">
                        {responses.map((response) => {
                          const orderedFields = selectedForm?.fields
                            ?.map((fId: string) => customFields.find((f) => f.id === fId))
                            .filter(Boolean) as CustomField[] || [];

                          return (
                            <div key={response.id} className="flex hover:bg-muted/50 transition-colors">
                              <div className="w-10 flex-shrink-0 px-2 py-3 flex items-center justify-center">
                                <Checkbox className="h-4 w-4" />
                              </div>
                              <div className="w-[180px] flex-shrink-0 px-3 py-3">
                                <p className="text-sm font-medium truncate">
                                  {response.clients?.full_name || response.client_name || "—"}
                                </p>
                                {(response.clients?.phone_e164 || response.client_phone) && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {response.clients?.phone_e164 || response.client_phone}
                                  </p>
                                )}
                              </div>
                              <div className="w-[100px] flex-shrink-0 px-3 py-3">
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(response.submitted_at), "dd MMM yyyy", { locale: ptBR })}
                                </p>
                                <p className="text-xs text-muted-foreground/70">
                                  {format(new Date(response.submitted_at), "HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                              {orderedFields.map((field) => {
                                const value = response.responses?.[field.id];
                                const isEmpty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

                                return (
                                  <div
                                    key={field.id}
                                    className="w-[160px] flex-shrink-0 px-3 py-3 text-sm"
                                  >
                                    {isEmpty ? (
                                      <span className="text-muted-foreground/50">—</span>
                                    ) : (
                                      <div className="truncate" title={String(value)}>
                                        {renderResponseValue(field, value)}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </>
              )}
            </TabsContent>
          </Tabs>
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
