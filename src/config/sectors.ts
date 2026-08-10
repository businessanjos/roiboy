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
  Activity,
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
  BookOpenCheck,
  Boxes,
  
  type LucideIcon,
  Stethoscope,
  Telescope,
} from "lucide-react";
import { Permission, PERMISSIONS } from "@/lib/access/permissions";
import { buildRoyZappUrl } from "@/lib/royZappRoutes";

export type SectorId = "operacoes" | "financeiro" | "vendas" | "marketing" | "royzapp" | "everia" | "gestao-tech" | "rh" | "eventos" | "reuniao-lideres" | "configuracoes";

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  permission?: Permission | Permission[];
  group?: string;
  comingSoon?: boolean;
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
    name: "Customer Success",
    description: "Dashboard, clientes, tarefas e atendimento",
    icon: LayoutDashboard,
    color: "text-primary",
    bgColor: "bg-primary/10",
    defaultRoute: "/dashboard",
    navItems: [
      { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", permission: PERMISSIONS.REPORTS_VIEW },
      { to: "/clients", icon: Users, label: "Clientes", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/operations/onboarding", icon: Rocket, label: "Onboarding", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/clients/medicos", icon: Stethoscope, label: "Área da saúde", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/operations/clinica-ryka", icon: Heart, label: "Clínica Ryka", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/vips", icon: Crown, label: "VIPs", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/contracts", icon: FileSignature, label: "Contratos", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/renewals", icon: Repeat, label: "Renovações", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/operations/mentoria-ec", icon: GraduationCap, label: "Mentoria Ao Vivo", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/operations/practice-areas", icon: Tags, label: "Áreas de Atuação" },
      { to: "/operations/presenca-eventos", icon: UserCheck, label: "Presença em Eventos", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/operations/consultant-bonus", icon: Trophy, label: "Premiação & Bônus" },
      { to: "/operations/scripts", icon: MessageSquare, label: "Scripts" },
      { to: "/operations/instagram-ranking", icon: Instagram, label: "Ranking Instagram" },
      { to: "/tasks", icon: ClipboardList, label: "Tarefas" },
      { to: "/products", icon: Package, label: "Produtos", permission: PERMISSIONS.PRODUCTS_VIEW },

      
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
      { to: "/financial/dashboard", icon: LayoutDashboard, label: "Dashboard", permission: PERMISSIONS.CLIENTS_VIEW, group: "Principal" },
      { to: "/financial/cash-flow", icon: TrendingUp, label: "Fluxo de Caixa", permission: PERMISSIONS.CLIENTS_VIEW, group: "Principal" },
      { to: "/financial/entries", icon: Receipt, label: "Lançamentos", permission: PERMISSIONS.CLIENTS_VIEW, group: "Principal" },
      { to: "/financial/bank-accounts", icon: Building2, label: "Contas Bancárias", permission: PERMISSIONS.CLIENTS_VIEW, group: "Principal" },
      // Recebimentos & Cobrança
      { to: "/financial/recebiveis", icon: CreditCard, label: "Recebíveis", permission: PERMISSIONS.CLIENTS_VIEW, group: "Recebimentos & Cobrança" },
      { to: "/financial/cobranca", icon: LayoutGrid, label: "Cobrança", permission: PERMISSIONS.CLIENTS_VIEW, group: "Recebimentos & Cobrança" },
      { to: "/financial/notas-fiscais", icon: Receipt, label: "Notas Fiscais", permission: PERMISSIONS.CLIENTS_VIEW, group: "Recebimentos & Cobrança" },
      // Operações
      { to: "/financial/conciliacao", icon: Landmark, label: "Conciliação", permission: PERMISSIONS.CLIENTS_VIEW, group: "Operações" },
      { to: "/financial/commissions", icon: Percent, label: "Comissões", permission: PERMISSIONS.CLIENTS_VIEW, group: "Operações" },
      { to: "/contracts", icon: FileSignature, label: "Contratos", permission: PERMISSIONS.CLIENTS_VIEW, group: "Operações" },
      // Cadastros
      { to: "/financial/pessoas", icon: UsersRound, label: "Pessoas", permission: PERMISSIONS.CLIENTS_VIEW, group: "Cadastros" },
      { to: "/financial/categories", icon: Filter, label: "Categorias", permission: PERMISSIONS.CLIENTS_VIEW, group: "Cadastros" },
      { to: "/financial/cost-centers", icon: PiggyBank, label: "Centros de Custo", permission: PERMISSIONS.CLIENTS_VIEW, group: "Cadastros" },
      { to: "/financial/budget", icon: FileText, label: "Orçamentos", permission: PERMISSIONS.CLIENTS_VIEW, group: "Cadastros" },
      { to: "/financial/payment-methods", icon: CreditCard, label: "Formas de Pagamento", permission: PERMISSIONS.CLIENTS_VIEW, group: "Cadastros" },
      // Relatórios
      { to: "/financial/relatorios", icon: BarChart3, label: "Relatórios", permission: PERMISSIONS.CLIENTS_VIEW, group: "Relatórios" },
      // Integrações
      { to: "/financial/integracoes/pluggy", icon: Landmark, label: "Pluggy", permission: PERMISSIONS.CLIENTS_VIEW, group: "Integrações" },
      // Em Breve
      { to: "/financial/ajuda", icon: CircleHelp, label: "Central de Ajuda", permission: PERMISSIONS.CLIENTS_VIEW, group: "Principal" },
      { to: "/financial/prestadores", icon: UsersRound, label: "Portal Prestadores", permission: PERMISSIONS.CLIENTS_VIEW, group: "Em Breve", comingSoon: true },

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
    defaultRoute: buildRoyZappUrl(),
    // Navegação principal do RoyZapp no sidebar (espelha as views internas).
    navItems: [
      { to: buildRoyZappUrl({ view: "inbox" }), icon: MessageSquare, label: "Conversas" },
      { to: buildRoyZappUrl({ view: "team" }), icon: Users, label: "Equipe" },
      { to: buildRoyZappUrl({ view: "departments" }), icon: Building2, label: "Departamentos" },
      { to: buildRoyZappUrl({ view: "tags" }), icon: Tags, label: "Tags" },
      { to: buildRoyZappUrl({ view: "settings" }), icon: Settings, label: "Configurações" },
      { to: buildRoyZappUrl({ view: "playbook" }), icon: BookOpen, label: "Playbook" },
      { to: buildRoyZappUrl({ view: "marketing" }), icon: Megaphone, label: "Eventos" },
      { to: "/notifications", icon: Bell, label: "Notificações" },
    ],

  },
  {
    id: "gestao-tech",
    name: "Gestão Tech",
    description: "Painel centralizado de faturamento, custos e métricas dos projetos",
    icon: Activity,
    color: "text-violet-600",
    bgColor: "bg-violet-500/10",
    defaultRoute: "/gestao-tech",
    navItems: [
      { to: "/gestao-tech", icon: Activity, label: "Visão geral" },
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
      { to: "/marketing/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/marketing", icon: CalendarDays, label: "Calendário Anual" },
      { to: "/marketing/content-hq", icon: Crown, label: "Conteúdo" },
      { to: "/marketing/projetos", icon: FolderKanban, label: "Projetos" },
      
      { to: "/social-media", icon: Instagram, label: "Social Media" },
      { to: "/marketing/trafego-pago", icon: TrendingUp, label: "Tráfego Pago" },
      { to: "/marketing/agencias", icon: Megaphone, label: "Agências" },
      { to: "/marketing-tasks", icon: ClipboardList, label: "Tarefas" },
      { to: "/marketing/rebranding", icon: Sparkles, label: "Rebranding" },
      { to: "/marketing-insights", icon: BarChart3, label: "Insights" },
      { to: "/marketing/market-intelligence", icon: Telescope, label: "Market Intelligence" },
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
      { to: "/rh/benefits", icon: Gift, label: "Benefícios" },
      { to: "/rh/vacancies", icon: UserPlus, label: "Vagas" },
      { to: "/rh/offers", icon: Sparkles, label: "Cartas-Proposta" },
      { to: "/rh/admissions", icon: UserCheck, label: "Admissões" },
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
    id: "eventos",
    name: "Eventos",
    description: "Gestão de eventos, RSVPs e check-ins",
    icon: CalendarDays,
    color: "text-pink-600",
    bgColor: "bg-pink-500/10",
    defaultRoute: "/events",
    navItems: [
      { to: "/events", icon: CalendarDays, label: "Eventos", permission: PERMISSIONS.EVENTS_VIEW },
      { to: "/events/calendar", icon: CalendarDays, label: "Calendário Anual", permission: PERMISSIONS.EVENTS_VIEW },
      { to: "/events/kpis", icon: TrendingUp, label: "KPIs Anuais", permission: PERMISSIONS.EVENTS_VIEW },
      { to: "/events/playbooks", icon: BookOpenCheck, label: "Playbooks", permission: PERMISSIONS.EVENTS_VIEW },
      { to: "/events/inventory", icon: Boxes, label: "Inventário", permission: PERMISSIONS.EVENTS_VIEW },
      { to: "/events/suppliers", icon: Briefcase, label: "Fornecedores", permission: PERMISSIONS.EVENTS_VIEW },
      { to: "/notifications", icon: Bell, label: "Notificações" },
    ],
  },
  {
    id: "reuniao-lideres",
    name: "Reunião de Líderes",
    description: "Rituais de liderança, atas e KPIs por área",
    icon: UsersRound,
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    defaultRoute: "/reuniao-lideres",
    navItems: [
      { to: "/reuniao-lideres", icon: UsersRound, label: "Reunião de Líderes" },
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
