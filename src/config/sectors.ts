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
  UsersRound,
  MessageSquare,
  
  Package,
  CreditCard,
  BarChart3,
  TrendingUp,
  Megaphone,
  Settings,
  FileSignature,
  UserPlus,
  MessageCircle,
  Crown,
  UserCheck,
  Instagram,
  LayoutGrid,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Permission, PERMISSIONS } from "@/hooks/usePermissions";

export type SectorId = "operacoes" | "financeiro" | "vendas" | "marketing" | "royzapp" | "configuracoes";

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  permission?: Permission | Permission[];
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
      { to: "/contracts", icon: FileSignature, label: "Contratos", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/tasks", icon: ClipboardList, label: "Tarefas" },
      { to: "/products", icon: Package, label: "Produtos", permission: PERMISSIONS.PRODUCTS_VIEW },
      { to: "/events", icon: CalendarDays, label: "Eventos", permission: PERMISSIONS.EVENTS_VIEW },
      { to: "/mentor-agenda", icon: Crown, label: "Agenda Mentor", permission: PERMISSIONS.EVENTS_VIEW },
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
    defaultRoute: "/financial/entries",
    navItems: [
      { to: "/contracts", icon: FileSignature, label: "Contratos", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/financial", icon: CreditCard, label: "Financeiro", permission: PERMISSIONS.CLIENTS_VIEW },
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
      { to: "/roy-zapp", icon: MessageSquare, label: "ROY zAPP", permission: PERMISSIONS.SETTINGS_VIEW },
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
      { to: "/pipeline", icon: TrendingUp, label: "Pipeline", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/insights", icon: BarChart3, label: "Insights", permission: PERMISSIONS.REPORTS_VIEW },
      { to: "/leads", icon: UserPlus, label: "Leads", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/tasks", icon: ClipboardList, label: "Tarefas" },
      { to: "/sales-meetings", icon: Video, label: "Reuniões" },
      { to: "/clients", icon: Users, label: "Clientes", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/products", icon: Package, label: "Produtos", permission: PERMISSIONS.PRODUCTS_VIEW },
      { to: "/sales-scripts", icon: ScrollText, label: "Scripts de Vendas" },
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
      { to: "/content-calendar", icon: LayoutGrid, label: "Conteúdo" },
      { to: "/social-media", icon: Instagram, label: "Social Media" },
      { to: "/marketing-tasks", icon: ClipboardList, label: "Tarefas" },
      { to: "/marketing-insights", icon: BarChart3, label: "Insights" },
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
      { to: "/settings", icon: Settings, label: "Configurações" },
      { to: "/notifications", icon: Bell, label: "Notificações" },
    ],
  },
];

export function getSectorById(id: SectorId): Sector | undefined {
  return sectors.find((s) => s.id === id);
}

export function getSectorByRoute(route: string): Sector | undefined {
  return sectors.find((sector) =>
    sector.navItems.some((item) => route.startsWith(item.to))
  );
}

// Check if a route belongs to a specific sector
export function routeBelongsToSector(route: string, sectorId: SectorId): boolean {
  const sector = getSectorById(sectorId);
  if (!sector) return false;
  return sector.navItems.some((item) => route.startsWith(item.to));
}
