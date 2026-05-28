import {
  ScrollText,
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardList,
  UserCircle,
  FileText,
  BellRing,
  Bell,
  
  MessageSquare,
  Tags,
  
  Package,
  CreditCard,
  BarChart3,
  TrendingUp,
  Megaphone,
  Sparkles,
  FolderKanban,
  Settings,
  FileSignature,
  UserPlus,
  MessageCircle,
  
  UserCheck,
  Instagram,
  LayoutGrid,
  Receipt,
  Building2,
  Filter,
  PiggyBank,
  Repeat,
  Landmark,
  Scale,
  Percent,
  DollarSign,
  Bot,
  Briefcase,
  UsersRound,
  GraduationCap,
  Brain,
  Star,
  FileCheck,
  BookOpen,
  Network,
  Building,
  CircleDot,
  UserMinus,
  Palmtree,
  Heart,
  Clock,
  ScanFace,
  ArrowLeftRight,
  Target,
  Trophy,
  Gauge,
  Handshake,
  Crown,
  Gift,
  Plug,
  Rocket,
  
  type LucideIcon,
} from "lucide-react";
import { Permission, PERMISSIONS } from "@/lib/access/permissions";

export type SectorId = "operacoes" | "financeiro" | "vendas" | "marketing" | "royzapp" | "everia" | "rh" | "configuracoes";

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  permission?: Permission | Permission[];
  group?: string;
}

export interface Sector {
  id: SectorId;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  defaultRoute: string;
  navItems: NavItem[];
  comingSoon?: boolean;
}

export const sectors: Sector[] = [
  {
    id: "operacoes",
    name: "Operações",
    description: "Dashboard, clientes, eventos, tarefas e atendimento",
    icon: LayoutDashboard,
    color: "text-primary",
    bgColor: "bg-primary/10",
    defaultRoute: "/dashboard",
    navItems: [
      { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", permission: PERMISSIONS.REPORTS_VIEW },
      { to: "/clients", icon: Users, label: "Clientes", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/operations/onboarding", icon: Rocket, label: "Onboarding", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/operations/clinica-ryka", icon: Heart, label: "Clínica Ryka", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/vips", icon: Crown, label: "VIPs", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/contracts", icon: FileSignature, label: "Contratos", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/renewals", icon: Repeat, label: "Renovações", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/operations/consultant-bonus", icon: Trophy, label: "Premiação & Bônus" },
      { to: "/operations/scripts", icon: MessageSquare, label: "Scripts" },
      { to: "/operations/instagram-ranking", icon: Instagram, label: "Ranking Instagram" },
      { to: "/tasks", icon: ClipboardList, label: "Tarefas" },
      { to: "/products", icon: Package, label: "Produtos", permission: PERMISSIONS.PRODUCTS_VIEW },
      { to: "/events", icon: CalendarDays, label: "Eventos", permission: PERMISSIONS.EVENTS_VIEW },
      
      { to: "/forms", icon: FileText, label: "Formulários", permission: PERMISSIONS.FORMS_VIEW },
      { to: "/reminders", icon: BellRing, label: "Lembretes", permission: PERMISSIONS.SETTINGS_VIEW },
      
      { to: "/notifications", icon: Bell, label: "Notificações" },
    ],
  },
  {
    id: "financeiro",
    name: "Finanças",
    description: "Lançamentos, fluxo de caixa e gestão financeira",
    icon: CreditCard,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    defaultRoute: "/financial/dashboard",
    navItems: [
      // Principal
      { to: "/financial/dashboard", icon: LayoutDashboard, label: "Dashboard", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/cash-flow", icon: TrendingUp, label: "Fluxo de Caixa", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/entries", icon: Receipt, label: "Lançamentos", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/bank-accounts", icon: Building2, label: "Contas Bancárias", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/invoices", icon: CreditCard, label: "Faturas", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/parcelas", icon: Receipt, label: "Parcelas", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/pagadores", icon: UsersRound, label: "Pagadores", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/boletos", icon: FileText, label: "Boletos", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/notas-fiscais", icon: Receipt, label: "Notas Fiscais", permission: PERMISSIONS.CLIENTS_VIEW },
      // Gestão
      { to: "/financial/categories", icon: Filter, label: "Categorias", permission: PERMISSIONS.CLIENTS_VIEW, group: "Gestão" },
      { to: "/financial/cost-centers", icon: PiggyBank, label: "Centros de Custo", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/suppliers", icon: Users, label: "Fornecedores", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/recurring", icon: Repeat, label: "Recorrências", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/budget", icon: FileText, label: "Orçamentos", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/payment-methods", icon: CreditCard, label: "Formas de Pagamento", permission: PERMISSIONS.CLIENTS_VIEW },
      // Operações
      { to: "/financial/reconciliation", icon: Landmark, label: "Conciliação", permission: PERMISSIONS.CLIENTS_VIEW, group: "Operações" },
      { to: "/financial/sales-reconciliation", icon: FileSignature, label: "Conc. Vendas", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/commissions", icon: Percent, label: "Comissões", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/alerts", icon: Bell, label: "Alertas", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/importar", icon: ArrowLeftRight, label: "Importar (Cielo/Cheque)", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/cobranca", icon: LayoutGrid, label: "CRM de Cobrança", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/tributario", icon: Scale, label: "Tributário", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/prestadores", icon: UsersRound, label: "Portal Prestadores", permission: PERMISSIONS.CLIENTS_VIEW },
      // Relatórios
      { to: "/financial/dre", icon: FileText, label: "DRE", permission: PERMISSIONS.CLIENTS_VIEW, group: "Relatórios" },
      { to: "/financial/drf", icon: Receipt, label: "DRF", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/balance-sheet", icon: Building2, label: "Balanço", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/aging", icon: BarChart3, label: "Aging", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/profitability", icon: DollarSign, label: "Rentabilidade", permission: PERMISSIONS.CLIENTS_VIEW },
      // Integrações
      { to: "/financial/integracoes/omie", icon: ArrowLeftRight, label: "Omie", permission: PERMISSIONS.CLIENTS_VIEW, group: "Integrações" },
      { to: "/financial/integracoes/pluggy", icon: Landmark, label: "Pluggy", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial/configuracoes/fiscal", icon: Receipt, label: "Config. Fiscal (NFS-e)", permission: PERMISSIONS.CLIENTS_VIEW, group: "Integrações" },
      // Outros
      { to: "/contracts", icon: FileSignature, label: "Contratos", permission: PERMISSIONS.CLIENTS_VIEW, group: "Outros" },
      { to: "/clients", icon: Users, label: "Clientes Ativos", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/notifications", icon: Bell, label: "Notificações" },
    ],
  },
  {
    id: "royzapp",
    name: "ROY zAPP",
    description: "Atendimento e comunicação via WhatsApp",
    icon: MessageSquare,
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    defaultRoute: "/roy-zapp",
    navItems: [
      { to: "/roy-zapp", icon: MessageSquare, label: "Conversas" },
      { to: "/roy-zapp?view=team", icon: Users, label: "Equipe" },
      { to: "/roy-zapp?view=departments", icon: Building2, label: "Departamentos" },
      { to: "/roy-zapp?view=tags", icon: Tags, label: "Tags" },
      { to: "/roy-zapp?view=settings", icon: Settings, label: "Configurações" },
      { to: "/roy-zapp?view=whatsapp-admin", icon: Plug, label: "Conexões WhatsApp" },
      { to: "/roy-zapp?view=playbook", icon: BookOpen, label: "Playbook" },
      { to: "/roy-zapp?view=marketing", icon: Megaphone, label: "Eventos" },
      { to: "/notifications", icon: Bell, label: "Notificações" },
    ],
  },
  {
    id: "everia",
    name: "Ever IA",
    description: "Inteligência artificial para atendimento automatizado",
    icon: Bot,
    color: "text-violet-600",
    bgColor: "bg-violet-500/10",
    defaultRoute: "/ever-ia",
    navItems: [
      { to: "/ever-ia", icon: Bot, label: "Ever IA" },
      { to: "/notifications", icon: Bell, label: "Notificações" },
    ],
  },
  {
    id: "vendas",
    name: "Vendas",
    description: "Pipeline de vendas e conversões",
    icon: TrendingUp,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    defaultRoute: "/pipeline",
    navItems: [
      { to: "/sales-team", icon: UserCheck, label: "Gestão", permission: PERMISSIONS.TEAM_VIEW },
      { to: "/sales-dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/pipeline", icon: TrendingUp, label: "Pipeline", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/leads", icon: UserPlus, label: "Leads", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/tasks", icon: ClipboardList, label: "Tarefas" },
      { to: "/sales-calendar", icon: CalendarDays, label: "Calendário" },
      { to: "/sales-scripts", icon: ScrollText, label: "Script de Vendas" },
      { to: "/products", icon: Package, label: "Produtos", permission: PERMISSIONS.PRODUCTS_VIEW },
      { to: "/clients", icon: Users, label: "Clientes", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/sales/contracts", icon: FileSignature, label: "Contratos", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/sales-team/incentive-presentation", icon: Gauge, label: "Acelerômetro" },
      { to: "/sales-team/spiffs", icon: Gift, label: "SPIFFs", permission: PERMISSIONS.TEAM_VIEW },
      { to: "/insights", icon: BarChart3, label: "Insights", permission: PERMISSIONS.REPORTS_VIEW },
      { to: "/notifications", icon: Bell, label: "Notificações" },
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    description: "Calendário anual e campanhas de marketing",
    icon: Megaphone,
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
    defaultRoute: "/marketing",
    navItems: [
      { to: "/marketing", icon: CalendarDays, label: "Calendário Anual" },
      { to: "/marketing/content-hq", icon: Crown, label: "Conteúdo" },
      { to: "/content-calendar", icon: LayoutGrid, label: "Conteúdo" },
      { to: "/social-media", icon: Instagram, label: "Social Media" },
      { to: "/marketing/trafego-pago", icon: TrendingUp, label: "Tráfego Pago" },
      { to: "/marketing-tasks", icon: ClipboardList, label: "Tarefas" },
      { to: "/marketing/rebranding", icon: Sparkles, label: "Rebranding" },
      { to: "/marketing-insights", icon: BarChart3, label: "Insights" },
      { to: "/notifications", icon: Bell, label: "Notificações" },
    ],
  },
  {
    id: "rh",
    name: "RH",
    description: "Gestão de pessoas, testes comportamentais e desenvolvimento",
    icon: Briefcase,
    color: "text-rose-600",
    bgColor: "bg-rose-500/10",
    defaultRoute: "/rh",
    navItems: [
      // Meu Espaço
      { to: "/rh/my-profile", icon: UserCircle, label: "Meu Perfil", group: "Meu Espaço" },
      { to: "/rh/profiler", icon: ScanFace, label: "Profiler" },
      { to: "/rh/my-pdi", icon: Target, label: "Meu PDI" },
      { to: "/rh/my-evaluations", icon: CircleDot, label: "Minhas Avaliações" },
      // Gestão de Pessoas
      { to: "/rh", icon: LayoutDashboard, label: "Dashboard", group: "Gestão de Pessoas" },
      { to: "/rh/partners", icon: Crown, label: "Quadro Societário" },
      { to: "/rh/collaborators", icon: UsersRound, label: "Colaboradores" },
      { to: "/rh/service-providers", icon: Handshake, label: "Prestadores de Serviço" },
      { to: "/rh/org-chart", icon: Network, label: "Organograma" },
      { to: "/rh/departments", icon: Building, label: "Departamentos" },
      { to: "/rh/job-descriptions", icon: FileText, label: "Cargos" },
      { to: "/rh/vacancies", icon: UserPlus, label: "Vagas" },
      { to: "/rh/resumes", icon: BookOpen, label: "Banco de Talentos" },
      { to: "/rh/offboarding", icon: UserMinus, label: "Desligamentos" },
      // Desenvolvimento
      { to: "/rh/performance", icon: Star, label: "Avaliação de Desempenho", group: "Desenvolvimento" },
      { to: "/rh/feedback", icon: MessageCircle, label: "Feedbacks" },
      { to: "/rh/vacation", icon: Palmtree, label: "Gestão de Férias" },
      { to: "/rh/culture", icon: Heart, label: "Cultura" },
      { to: "/rh/time-tracking", icon: Clock, label: "Gestão de Ponto" },
      // Extras
      { to: "/rh/tests", icon: Brain, label: "Testes Comportamentais", group: "Extras" },
      { to: "/rh/development", icon: GraduationCap, label: "Desenvolvimento" },
      { to: "/rh/procedures", icon: ClipboardList, label: "Procedimentos" },
      { to: "/rh/interview-scripts", icon: ScrollText, label: "Entrevistas" },
      { to: "/notifications", icon: Bell, label: "Notificações" },
    ],
  },
  {
    id: "configuracoes",
    name: "Configurações",
    description: "Configurações gerais do sistema",
    icon: Settings,
    color: "text-slate-600",
    bgColor: "bg-slate-500/10",
    defaultRoute: "/settings",
    navItems: [
      { to: "/settings", icon: Settings, label: "Configurações", permission: PERMISSIONS.SETTINGS_VIEW },
      { to: "/notifications", icon: Bell, label: "Notificações" },
    ],
  },
];

export function getSectorById(id: SectorId): Sector | undefined {
  return sectors.find((s) => s.id === id);
}

export function getSectorByRoute(route: string): Sector | undefined {
  const matches = sectors.filter((sector) =>
    sector.navItems.some((item) => route.startsWith(item.to))
  );
  return matches.sort((a, b) => {
    const aLength = Math.max(...a.navItems.filter((item) => route.startsWith(item.to)).map((item) => item.to.length));
    const bLength = Math.max(...b.navItems.filter((item) => route.startsWith(item.to)).map((item) => item.to.length));
    return bLength - aLength;
  })[0];
}

// Check if a route belongs to a specific sector
export function routeBelongsToSector(route: string, sectorId: SectorId): boolean {
  const sector = getSectorById(sectorId);
  if (!sector) return false;
  return sector.navItems.some((item) => route.startsWith(item.to));
}
