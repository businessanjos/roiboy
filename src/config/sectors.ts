import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardList,
  UserCircle,
  FileText,
  BellRing,
  UsersRound,
  MessageSquare,
  Bot,
  Package,
  CreditCard,
  TrendingUp,
  Megaphone,
  Settings,
  FileSignature,
  type LucideIcon,
} from "lucide-react";
import { Permission, PERMISSIONS } from "@/hooks/usePermissions";

export type SectorId = "operacoes" | "financeiro" | "vendas" | "marketing" | "royzapp";

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
      { to: "/team", icon: UserCircle, label: "Equipe", permission: PERMISSIONS.TEAM_VIEW },
      { to: "/tasks", icon: ClipboardList, label: "Tarefas" },
      { to: "/products", icon: Package, label: "Produtos", permission: PERMISSIONS.PRODUCTS_VIEW },
      { to: "/events", icon: CalendarDays, label: "Eventos", permission: PERMISSIONS.EVENTS_VIEW },
      { to: "/forms", icon: FileText, label: "Formulários", permission: PERMISSIONS.FORMS_VIEW },
      { to: "/reminders", icon: BellRing, label: "Lembretes", permission: PERMISSIONS.SETTINGS_VIEW },
      { to: "/whatsapp-groups", icon: UsersRound, label: "Grupos WhatsApp", permission: PERMISSIONS.SETTINGS_VIEW },
      { to: "/roy-zapp", icon: MessageSquare, label: "ROY zAPP", permission: PERMISSIONS.SETTINGS_VIEW },
      { to: "/ai-agent", icon: Bot, label: "Agente ROY", permission: PERMISSIONS.SETTINGS_VIEW },
      { to: "/settings", icon: Settings, label: "Configurações", permission: PERMISSIONS.SETTINGS_VIEW },
    ],
  },
  {
    id: "financeiro",
    name: "Finanças",
    description: "Contratos e cobrança de clientes",
    icon: CreditCard,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    defaultRoute: "/contracts",
    navItems: [
      { to: "/contracts", icon: FileSignature, label: "Contratos", permission: PERMISSIONS.CLIENTS_VIEW },
      { to: "/billing", icon: CreditCard, label: "Cobrança", permission: PERMISSIONS.SETTINGS_VIEW },
      { to: "/settings", icon: Settings, label: "Configurações", permission: PERMISSIONS.SETTINGS_VIEW },
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
    ],
  },
  {
    id: "vendas",
    name: "Vendas",
    description: "Pipeline de vendas e conversões",
    icon: TrendingUp,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    defaultRoute: "/vendas",
    navItems: [],
    comingSoon: true,
  },
  {
    id: "marketing",
    name: "Marketing",
    description: "Campanhas e resultados de marketing",
    icon: Megaphone,
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
    defaultRoute: "/marketing",
    navItems: [],
    comingSoon: true,
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
