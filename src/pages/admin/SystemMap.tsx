import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  MessageSquare,
  Calendar,
  DollarSign,
  Settings,
  BarChart3,
  FileText,
  Bell,
  Shield,
  Zap,
  Target,
  Package,
  Building2,
  UserCheck,
  Briefcase,
  Bot,
  Headphones,
  CreditCard,
  PieChart,
  Receipt,
  Wallet,
  TrendingUp,
  ClipboardList,
  FolderOpen,
  Mail,
  Phone,
  Globe,
  Database,
  Lock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  LayoutDashboard,
  Layers,
} from "lucide-react";

interface SystemNode {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: "active" | "development" | "planned";
  children?: SystemNode[];
}

const systemMap: SystemNode[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Visão geral do sistema com métricas e indicadores",
    icon: <LayoutDashboard className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "dash-metrics", name: "Métricas de Clientes", description: "ROI, E-Score, vNPS", icon: <BarChart3 className="h-4 w-4" />, status: "active" },
      { id: "dash-churn", name: "Relatório de Churn", description: "Análise de cancelamentos", icon: <AlertTriangle className="h-4 w-4" />, status: "active" },
      { id: "dash-engagement", name: "Engajamento de Grupos", description: "Participação em grupos WhatsApp", icon: <Users className="h-4 w-4" />, status: "active" },
      { id: "dash-ai-usage", name: "Uso de IA", description: "Estatísticas de análise por IA", icon: <Bot className="h-4 w-4" />, status: "active" },
      { id: "dash-roi-feed", name: "Feed de ROI", description: "Eventos de retorno recentes", icon: <TrendingUp className="h-4 w-4" />, status: "active" },
      { id: "dash-requests", name: "Solicitações de Clientes", description: "Pedidos identificados por IA", icon: <ClipboardList className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "clients",
    name: "Clientes",
    description: "Gestão completa de clientes",
    icon: <Users className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "clients-list", name: "Lista de Clientes", description: "Visualização em tabela e Kanban", icon: <Users className="h-4 w-4" />, status: "active" },
      { id: "clients-detail", name: "Ficha do Cliente", description: "Informações completas do cliente", icon: <UserCheck className="h-4 w-4" />, status: "active" },
      { id: "clients-timeline", name: "Timeline", description: "Histórico de interações", icon: <Clock className="h-4 w-4" />, status: "active" },
      { id: "clients-contracts", name: "Contratos", description: "Gestão de contratos", icon: <FileText className="h-4 w-4" />, status: "active" },
      { id: "clients-financial", name: "Financeiro do Cliente", description: "Pagamentos e inadimplência", icon: <DollarSign className="h-4 w-4" />, status: "active" },
      { id: "clients-followup", name: "Follow-up", description: "Acompanhamento e anotações", icon: <ClipboardList className="h-4 w-4" />, status: "active" },
      { id: "clients-agenda", name: "Agenda", description: "Compromissos do cliente", icon: <Calendar className="h-4 w-4" />, status: "active" },
      { id: "clients-tasks", name: "Tarefas", description: "Tasks vinculadas ao cliente", icon: <CheckCircle2 className="h-4 w-4" />, status: "active" },
      { id: "clients-deals", name: "Negociações", description: "Deals do cliente", icon: <Target className="h-4 w-4" />, status: "active" },
      { id: "clients-life-events", name: "Eventos de Vida", description: "Datas especiais detectadas por IA", icon: <Calendar className="h-4 w-4" />, status: "active" },
      { id: "clients-diagnostic", name: "Diagnóstico", description: "Análise inicial do cliente", icon: <ClipboardList className="h-4 w-4" />, status: "active" },
      { id: "clients-forms", name: "Formulários", description: "Respostas de formulários", icon: <FileText className="h-4 w-4" />, status: "active" },
      { id: "clients-relationships", name: "Relacionamentos", description: "Vínculos entre clientes", icon: <Users className="h-4 w-4" />, status: "active" },
      { id: "clients-custom-fields", name: "Campos Personalizados", description: "Campos extras configuráveis", icon: <Layers className="h-4 w-4" />, status: "active" },
      { id: "clients-stages", name: "Etapas/Jornada", description: "Kanban de etapas com checklist", icon: <Layers className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "leads",
    name: "Leads",
    description: "Gestão de leads e prospecção",
    icon: <Target className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "leads-list", name: "Lista de Leads", description: "Visualização de leads", icon: <Users className="h-4 w-4" />, status: "active" },
      { id: "leads-timeline", name: "Timeline do Lead", description: "Histórico de interações", icon: <Clock className="h-4 w-4" />, status: "active" },
      { id: "leads-custom-fields", name: "Campos Personalizados", description: "Campos extras para leads", icon: <Layers className="h-4 w-4" />, status: "active" },
      { id: "leads-zapp", name: "Registro via Roy Zapp", description: "Criar lead direto do chat", icon: <MessageSquare className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "royzapp",
    name: "Roy Zapp",
    description: "Central de atendimento WhatsApp",
    icon: <MessageSquare className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "zapp-conversations", name: "Conversas", description: "Lista de conversas por setor", icon: <MessageSquare className="h-4 w-4" />, status: "active" },
      { id: "zapp-messages", name: "Chat", description: "Visualização e envio de mensagens", icon: <MessageSquare className="h-4 w-4" />, status: "active" },
      { id: "zapp-departments", name: "Departamentos", description: "Setores de atendimento", icon: <Building2 className="h-4 w-4" />, status: "active" },
      { id: "zapp-tags", name: "Tags", description: "Marcadores de conversa", icon: <Layers className="h-4 w-4" />, status: "active" },
      { id: "zapp-quick-replies", name: "Respostas Rápidas", description: "Templates de mensagem", icon: <Zap className="h-4 w-4" />, status: "active" },
      { id: "zapp-transfer", name: "Transferência", description: "Transferir conversa entre atendentes", icon: <Users className="h-4 w-4" />, status: "active" },
      { id: "zapp-add-client", name: "Adicionar Cliente", description: "Criar cliente a partir do chat", icon: <UserCheck className="h-4 w-4" />, status: "active" },
      { id: "zapp-add-lead", name: "Adicionar Lead", description: "Criar lead a partir do chat (vendas)", icon: <Target className="h-4 w-4" />, status: "active" },
      { id: "zapp-roi", name: "Registrar ROI", description: "Marcar evento de retorno", icon: <TrendingUp className="h-4 w-4" />, status: "active" },
      { id: "zapp-risk", name: "Registrar Risco", description: "Marcar risco de churn", icon: <AlertTriangle className="h-4 w-4" />, status: "active" },
      { id: "zapp-audio", name: "Áudio", description: "Gravação e transcrição de áudio", icon: <Phone className="h-4 w-4" />, status: "active" },
      { id: "zapp-agents", name: "Agentes IA", description: "Configuração de agentes virtuais", icon: <Bot className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "sales",
    name: "Vendas",
    description: "Pipeline de vendas e negociações",
    icon: <Briefcase className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "sales-pipeline", name: "Pipeline", description: "Kanban de negociações", icon: <Target className="h-4 w-4" />, status: "active" },
      { id: "sales-deals", name: "Deals", description: "Detalhes das negociações", icon: <Briefcase className="h-4 w-4" />, status: "active" },
      { id: "sales-stages", name: "Etapas", description: "Configuração de etapas do funil", icon: <Layers className="h-4 w-4" />, status: "active" },
      { id: "sales-performance", name: "Performance", description: "Métricas de vendas", icon: <BarChart3 className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "events",
    name: "Eventos",
    description: "Gestão de eventos e encontros",
    icon: <Calendar className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "events-list", name: "Lista de Eventos", description: "Calendário e lista de eventos", icon: <Calendar className="h-4 w-4" />, status: "active" },
      { id: "events-detail", name: "Detalhes do Evento", description: "Informações completas", icon: <FileText className="h-4 w-4" />, status: "active" },
      { id: "events-checkin", name: "Check-in", description: "Registro de presença", icon: <CheckCircle2 className="h-4 w-4" />, status: "active" },
      { id: "events-participants", name: "Participantes", description: "Lista de inscritos", icon: <Users className="h-4 w-4" />, status: "active" },
      { id: "events-feedback", name: "Feedback", description: "Pesquisa de satisfação", icon: <MessageSquare className="h-4 w-4" />, status: "active" },
      { id: "events-costs", name: "Custos", description: "Controle de despesas", icon: <DollarSign className="h-4 w-4" />, status: "active" },
      { id: "events-gifts", name: "Brindes", description: "Gestão de brindes", icon: <Package className="h-4 w-4" />, status: "active" },
      { id: "events-media", name: "Mídia", description: "Fotos e vídeos", icon: <FolderOpen className="h-4 w-4" />, status: "active" },
      { id: "events-schedule", name: "Programação", description: "Agenda do evento", icon: <Clock className="h-4 w-4" />, status: "active" },
      { id: "events-team", name: "Equipe", description: "Time do evento", icon: <Users className="h-4 w-4" />, status: "active" },
      { id: "events-rsvp", name: "RSVP Público", description: "Página de confirmação", icon: <Globe className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "tasks",
    name: "Tarefas",
    description: "Gestão de tarefas da equipe",
    icon: <CheckCircle2 className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "tasks-kanban", name: "Kanban", description: "Visualização em quadro", icon: <Layers className="h-4 w-4" />, status: "active" },
      { id: "tasks-list", name: "Lista", description: "Visualização em lista", icon: <ClipboardList className="h-4 w-4" />, status: "active" },
      { id: "tasks-statuses", name: "Status", description: "Configuração de status", icon: <Settings className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "financial",
    name: "Financeiro",
    description: "Gestão financeira completa",
    icon: <DollarSign className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "fin-entries", name: "Lançamentos", description: "Receitas e despesas", icon: <Receipt className="h-4 w-4" />, status: "active" },
      { id: "fin-cashflow", name: "Fluxo de Caixa", description: "Projeção de caixa", icon: <TrendingUp className="h-4 w-4" />, status: "active" },
      { id: "fin-bank-accounts", name: "Contas Bancárias", description: "Gestão de contas", icon: <Wallet className="h-4 w-4" />, status: "active" },
      { id: "fin-categories", name: "Categorias", description: "Categorias financeiras", icon: <Layers className="h-4 w-4" />, status: "active" },
      { id: "fin-cost-centers", name: "Centros de Custo", description: "Alocação de custos", icon: <PieChart className="h-4 w-4" />, status: "active" },
      { id: "fin-suppliers", name: "Fornecedores", description: "Cadastro de fornecedores", icon: <Building2 className="h-4 w-4" />, status: "active" },
      { id: "fin-recurring", name: "Recorrências", description: "Lançamentos recorrentes", icon: <Clock className="h-4 w-4" />, status: "active" },
      { id: "fin-budget", name: "Orçamento", description: "Planejamento orçamentário", icon: <Target className="h-4 w-4" />, status: "active" },
      { id: "fin-reconciliation", name: "Conciliação", description: "Conciliação bancária", icon: <CheckCircle2 className="h-4 w-4" />, status: "active" },
      { id: "fin-commissions", name: "Comissões", description: "Gestão de comissões", icon: <DollarSign className="h-4 w-4" />, status: "active" },
      { id: "fin-alerts", name: "Alertas", description: "Alertas de vencimento", icon: <Bell className="h-4 w-4" />, status: "active" },
      { id: "fin-aging", name: "Aging", description: "Relatório de aging", icon: <Clock className="h-4 w-4" />, status: "active" },
      { id: "fin-profitability", name: "Lucratividade", description: "Análise de lucro", icon: <BarChart3 className="h-4 w-4" />, status: "active" },
      { id: "fin-dre", name: "DRE", description: "Demonstração de resultado", icon: <FileText className="h-4 w-4" />, status: "active" },
      { id: "fin-drf", name: "DRF", description: "Demonstração de fluxo", icon: <FileText className="h-4 w-4" />, status: "active" },
      { id: "fin-balance", name: "Balanço", description: "Balanço patrimonial", icon: <FileText className="h-4 w-4" />, status: "active" },
      { id: "fin-boletos", name: "Boletos", description: "Gestão de boletos", icon: <CreditCard className="h-4 w-4" />, status: "active" },
      { id: "fin-nf", name: "Notas Fiscais", description: "Gestão de NFs", icon: <Receipt className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "products",
    name: "Produtos",
    description: "Catálogo de produtos e serviços",
    icon: <Package className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "products-list", name: "Lista de Produtos", description: "Catálogo completo", icon: <Package className="h-4 w-4" />, status: "active" },
      { id: "products-contracts", name: "Templates de Contrato", description: "Modelos para produtos", icon: <FileText className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "forms",
    name: "Formulários",
    description: "Criação de formulários públicos",
    icon: <FileText className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "forms-list", name: "Lista de Formulários", description: "Formulários criados", icon: <FileText className="h-4 w-4" />, status: "active" },
      { id: "forms-builder", name: "Construtor", description: "Criar/editar formulários", icon: <Settings className="h-4 w-4" />, status: "active" },
      { id: "forms-responses", name: "Respostas", description: "Visualizar respostas", icon: <ClipboardList className="h-4 w-4" />, status: "active" },
      { id: "forms-public", name: "Página Pública", description: "Link de acesso público", icon: <Globe className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "reminders",
    name: "Campanhas/Lembretes",
    description: "Envio de mensagens em massa",
    icon: <Bell className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "reminders-forms", name: "Campanha de Formulários", description: "Envio de formulários", icon: <FileText className="h-4 w-4" />, status: "active" },
      { id: "reminders-cx", name: "Momentos CX", description: "Mensagens de relacionamento", icon: <MessageSquare className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "team",
    name: "Equipe",
    description: "Gestão de usuários do sistema",
    icon: <Users className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "team-members", name: "Membros", description: "Lista de usuários", icon: <Users className="h-4 w-4" />, status: "active" },
      { id: "team-roles", name: "Funções", description: "Papéis e permissões", icon: <Shield className="h-4 w-4" />, status: "active" },
      { id: "team-invite", name: "Convites", description: "Convidar novos membros", icon: <Mail className="h-4 w-4" />, status: "active" },
    ],
  },


  {
    id: "whatsapp-groups",
    name: "Grupos WhatsApp",
    description: "Gestão de grupos de clientes",
    icon: <Users className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "groups-list", name: "Lista de Grupos", description: "Grupos monitorados", icon: <Users className="h-4 w-4" />, status: "active" },
      { id: "groups-engagement", name: "Engajamento", description: "Métricas de participação", icon: <BarChart3 className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "ai-agent",
    name: "Agente IA",
    description: "Configuração do agente virtual",
    icon: <Bot className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "ai-functions", name: "Funções", description: "Habilitar/desabilitar funções", icon: <Settings className="h-4 w-4" />, status: "active" },
      { id: "ai-prompts", name: "Prompts", description: "Configurar prompts de IA", icon: <FileText className="h-4 w-4" />, status: "active" },
      { id: "ai-analysis", name: "Análise de Mensagens", description: "IA analisa conversas", icon: <MessageSquare className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "settings",
    name: "Configurações",
    description: "Configurações gerais do sistema",
    icon: <Settings className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "settings-account", name: "Conta", description: "Dados da empresa", icon: <Building2 className="h-4 w-4" />, status: "active" },
      { id: "settings-billing", name: "Cobrança", description: "Plano e pagamentos", icon: <CreditCard className="h-4 w-4" />, status: "active" },
      { id: "settings-integrations", name: "Integrações", description: "APIs e conexões", icon: <Zap className="h-4 w-4" />, status: "active" },
      { id: "settings-whatsapp", name: "WhatsApp", description: "Configuração UAZAPI", icon: <MessageSquare className="h-4 w-4" />, status: "active" },
      { id: "settings-sectors", name: "Setores", description: "Gestão de setores", icon: <Building2 className="h-4 w-4" />, status: "active" },
      { id: "settings-custom-fields", name: "Campos Personalizados", description: "Campos de clientes/leads", icon: <Layers className="h-4 w-4" />, status: "active" },
      { id: "settings-score", name: "Score", description: "Configuração de pontuação", icon: <Target className="h-4 w-4" />, status: "active" },
      { id: "settings-security", name: "Segurança", description: "Auditoria e sessões", icon: <Shield className="h-4 w-4" />, status: "active" },
      { id: "settings-members-book", name: "Livro de Membros", description: "Página pública de membros", icon: <Users className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "admin",
    name: "Administração",
    description: "Painel administrativo (superadmin)",
    icon: <Shield className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "admin-accounts", name: "Contas", description: "Gerenciar todas as contas", icon: <Building2 className="h-4 w-4" />, status: "active" },
      { id: "admin-users", name: "Usuários", description: "Todos os usuários", icon: <Users className="h-4 w-4" />, status: "active" },
      { id: "admin-plans", name: "Planos", description: "Gestão de planos", icon: <CreditCard className="h-4 w-4" />, status: "active" },
      { id: "admin-coupons", name: "Cupons", description: "Cupons de desconto", icon: <Receipt className="h-4 w-4" />, status: "active" },
      { id: "admin-payments", name: "Pagamentos", description: "Asaas e cobranças", icon: <DollarSign className="h-4 w-4" />, status: "active" },
      { id: "admin-support", name: "Suporte", description: "Tickets de suporte", icon: <Headphones className="h-4 w-4" />, status: "active" },
      { id: "admin-kb", name: "Base de Conhecimento", description: "Artigos de ajuda", icon: <FileText className="h-4 w-4" />, status: "active" },
      { id: "admin-audit", name: "Auditoria", description: "Logs do sistema", icon: <Database className="h-4 w-4" />, status: "active" },
      { id: "admin-cloud", name: "Cloud Monitor", description: "Uso de recursos", icon: <BarChart3 className="h-4 w-4" />, status: "active" },
      { id: "admin-system", name: "Status do Sistema", description: "Health check", icon: <CheckCircle2 className="h-4 w-4" />, status: "active" },
      { id: "admin-map", name: "Mapa do Sistema", description: "Visualização de funcionalidades", icon: <Layers className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "integrations",
    name: "Integrações",
    description: "Conexões com sistemas externos",
    icon: <Zap className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "int-whatsapp", name: "WhatsApp (UAZAPI)", description: "API de WhatsApp", icon: <MessageSquare className="h-4 w-4" />, status: "active" },
      { id: "int-asaas", name: "Asaas", description: "Gateway de pagamento", icon: <CreditCard className="h-4 w-4" />, status: "active" },
      { id: "int-zapsign", name: "ZapSign", description: "Assinatura digital", icon: <FileText className="h-4 w-4" />, status: "active" },
      { id: "int-google-meet", name: "Google Meet", description: "Integração de videochamadas", icon: <Phone className="h-4 w-4" />, status: "active" },
      { id: "int-zoom", name: "Zoom", description: "Integração de videochamadas", icon: <Phone className="h-4 w-4" />, status: "active" },
      { id: "int-google-sheets", name: "Google Sheets", description: "Sincronização de dados", icon: <FileText className="h-4 w-4" />, status: "active" },
      { id: "int-pipedrive", name: "Pipedrive", description: "CRM externo", icon: <Target className="h-4 w-4" />, status: "active" },
      { id: "int-omie", name: "Omie", description: "ERP financeiro", icon: <DollarSign className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "public-pages",
    name: "Páginas Públicas",
    description: "Páginas acessíveis sem login",
    icon: <Globe className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "pub-form", name: "Formulário Público", description: "Preenchimento de formulários", icon: <FileText className="h-4 w-4" />, status: "active" },
      { id: "pub-rsvp", name: "RSVP de Evento", description: "Confirmação de presença", icon: <Calendar className="h-4 w-4" />, status: "active" },
      { id: "pub-feedback", name: "Feedback de Evento", description: "Pesquisa de satisfação", icon: <MessageSquare className="h-4 w-4" />, status: "active" },
      { id: "pub-checkin", name: "Check-in de Evento", description: "Registro de presença", icon: <CheckCircle2 className="h-4 w-4" />, status: "active" },
      { id: "pub-members", name: "Livro de Membros", description: "Lista pública de membros", icon: <Users className="h-4 w-4" />, status: "active" },
    ],
  },
  {
    id: "security",
    name: "Segurança",
    description: "Recursos de segurança do sistema",
    icon: <Lock className="h-5 w-5" />,
    status: "active",
    children: [
      { id: "sec-rls", name: "Row Level Security", description: "Isolamento de dados por conta", icon: <Lock className="h-4 w-4" />, status: "active" },
      { id: "sec-permissions", name: "Permissões", description: "Controle por função", icon: <Shield className="h-4 w-4" />, status: "active" },
      { id: "sec-sectors", name: "Acesso por Setor", description: "Restrição por setor", icon: <Building2 className="h-4 w-4" />, status: "active" },
      { id: "sec-audit", name: "Logs de Auditoria", description: "Rastreamento de ações", icon: <Database className="h-4 w-4" />, status: "active" },
      { id: "sec-sessions", name: "Sessões", description: "Gerenciamento de sessões", icon: <Clock className="h-4 w-4" />, status: "active" },
      { id: "sec-2fa", name: "2FA", description: "Autenticação em dois fatores", icon: <Lock className="h-4 w-4" />, status: "planned" },
    ],
  },
];

const statusColors = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  development: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  planned: "bg-muted text-muted-foreground border-border",
};

const statusLabels = {
  active: "Ativo",
  development: "Em desenvolvimento",
  planned: "Planejado",
};

function SystemNodeCard({ node, level = 0 }: { node: SystemNode; level?: number }) {
  return (
    <div className={`${level > 0 ? "ml-6 border-l-2 border-border pl-4" : ""}`}>
      <div className="flex items-start gap-3 py-2">
        <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10 text-primary">
          {node.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-foreground">{node.name}</h4>
            <Badge variant="outline" className={statusColors[node.status]}>
              {statusLabels[node.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{node.description}</p>
        </div>
      </div>
      {node.children && node.children.length > 0 && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <SystemNodeCard key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SystemMap() {
  const totalFunctions = systemMap.reduce((acc, node) => {
    return acc + 1 + (node.children?.length || 0);
  }, 0);

  const activeFunctions = systemMap.reduce((acc, node) => {
    const nodeCount = node.status === "active" ? 1 : 0;
    const childrenCount = node.children?.filter((c) => c.status === "active").length || 0;
    return acc + nodeCount + childrenCount;
  }, 0);

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Mapa do Sistema</h1>
        <p className="text-muted-foreground mt-1">
          Visualização completa de todas as funcionalidades do ROY CX
        </p>
        <div className="flex gap-4 mt-4">
          <Badge variant="outline" className="text-sm">
            {totalFunctions} funcionalidades totais
          </Badge>
          <Badge variant="outline" className={statusColors.active}>
            {activeFunctions} ativas
          </Badge>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="grid gap-4">
          {systemMap.map((node) => (
            <Card key={node.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {node.icon}
                  </div>
                  {node.name}
                  <Badge variant="outline" className={statusColors[node.status]}>
                    {statusLabels[node.status]}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{node.description}</p>
              </CardHeader>
              <CardContent>
                {node.children && node.children.length > 0 && (
                  <div className="space-y-1 border-l-2 border-border pl-4">
                    {node.children.map((child) => (
                      <div key={child.id} className="flex items-center gap-3 py-1.5">
                        <div className="flex-shrink-0 p-1.5 rounded bg-muted text-muted-foreground">
                          {child.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{child.name}</span>
                            <Badge variant="outline" className={`text-xs ${statusColors[child.status]}`}>
                              {statusLabels[child.status]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{child.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
