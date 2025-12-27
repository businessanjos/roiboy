import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  FileText,
  Building2,
  User,
  Repeat,
  Filter,
  Landmark,
  Percent,
  Bell,
  BarChart3,
  TrendingUp,
  PiggyBank,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

const mainNavItems: NavItem[] = [
  {
    title: "Lançamentos",
    href: "/financial/entries",
    icon: Receipt,
    description: "Contas a pagar e receber",
  },
  {
    title: "Fluxo de Caixa",
    href: "/financial/cash-flow",
    icon: TrendingUp,
    description: "Visão geral do fluxo",
  },
  {
    title: "Contas Bancárias",
    href: "/financial/bank-accounts",
    icon: Building2,
    description: "Gerenciar contas",
  },
];

const managementNavItems: NavItem[] = [
  {
    title: "Categorias",
    href: "/financial/categories",
    icon: Filter,
    description: "Categorias financeiras",
  },
  {
    title: "Centros de Custo",
    href: "/financial/cost-centers",
    icon: PiggyBank,
    description: "Gerenciar centros",
  },
  {
    title: "Fornecedores",
    href: "/financial/suppliers",
    icon: User,
    description: "Cadastro de fornecedores",
  },
  {
    title: "Recorrências",
    href: "/financial/recurring",
    icon: Repeat,
    description: "Lançamentos automáticos",
  },
  {
    title: "Orçamentos",
    href: "/financial/budget",
    icon: FileText,
    description: "Planejamento financeiro",
  },
];

const operationsNavItems: NavItem[] = [
  {
    title: "Conciliação",
    href: "/financial/reconciliation",
    icon: Landmark,
    description: "Conciliação bancária",
  },
  {
    title: "Comissões",
    href: "/financial/commissions",
    icon: Percent,
    description: "Gestão de comissões",
  },
  {
    title: "Alertas",
    href: "/financial/alerts",
    icon: Bell,
    description: "Alertas de vencimento",
  },
];

const reportsNavItems: NavItem[] = [
  {
    title: "Aging",
    href: "/financial/aging",
    icon: BarChart3,
    description: "Relatório de aging",
  },
  {
    title: "Rentabilidade",
    href: "/financial/profitability",
    icon: DollarSign,
    description: "Análise de lucro",
  },
];

interface NavSectionProps {
  title: string;
  items: NavItem[];
  isCollapsed: boolean;
}

function NavSection({ title, items, isCollapsed }: NavSectionProps) {
  return (
    <div className="space-y-1">
      {!isCollapsed && (
        <h4 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h4>
      )}
      {items.map((item) => (
        <Tooltip key={item.href} delayDuration={0}>
          <TooltipTrigger asChild>
            <NavLink
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                  isCollapsed && "justify-center px-2"
                )
              }
            >
              <item.icon className={cn("h-4 w-4 shrink-0", isCollapsed && "h-5 w-5")} />
              {!isCollapsed && <span>{item.title}</span>}
            </NavLink>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="flex flex-col gap-1">
              <span className="font-medium">{item.title}</span>
              {item.description && (
                <span className="text-xs text-muted-foreground">{item.description}</span>
              )}
            </TooltipContent>
          )}
        </Tooltip>
      ))}
    </div>
  );
}

export function FinancialLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r bg-background transition-all duration-300",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <span className="font-semibold">Financeiro</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", isCollapsed && "mx-auto")}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <ScrollArea className="flex-1 py-4">
          <div className="space-y-4 px-2">
            <NavSection title="Principal" items={mainNavItems} isCollapsed={isCollapsed} />
            
            {!isCollapsed && <Separator className="mx-2" />}
            
            <NavSection title="Gestão" items={managementNavItems} isCollapsed={isCollapsed} />
            
            {!isCollapsed && <Separator className="mx-2" />}
            
            <NavSection title="Operações" items={operationsNavItems} isCollapsed={isCollapsed} />
            
            {!isCollapsed && <Separator className="mx-2" />}
            
            <NavSection title="Relatórios" items={reportsNavItems} isCollapsed={isCollapsed} />
          </div>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
