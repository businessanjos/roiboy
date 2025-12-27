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
  Receipt,
  ChevronDown,
  Settings2,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const mainNavItems: NavItem[] = [
  { title: "Lançamentos", href: "/financial/entries", icon: Receipt },
  { title: "Fluxo de Caixa", href: "/financial/cash-flow", icon: TrendingUp },
  { title: "Contas Bancárias", href: "/financial/bank-accounts", icon: Building2 },
];

const managementNavItems: NavItem[] = [
  { title: "Categorias", href: "/financial/categories", icon: Filter },
  { title: "Centros de Custo", href: "/financial/cost-centers", icon: PiggyBank },
  { title: "Fornecedores", href: "/financial/suppliers", icon: User },
  { title: "Recorrências", href: "/financial/recurring", icon: Repeat },
  { title: "Orçamentos", href: "/financial/budget", icon: FileText },
];

const operationsNavItems: NavItem[] = [
  { title: "Conciliação", href: "/financial/reconciliation", icon: Landmark },
  { title: "Comissões", href: "/financial/commissions", icon: Percent },
  { title: "Alertas", href: "/financial/alerts", icon: Bell },
];

const reportsNavItems: NavItem[] = [
  { title: "Aging", href: "/financial/aging", icon: BarChart3 },
  { title: "Rentabilidade", href: "/financial/profitability", icon: DollarSign },
];

function NavTab({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
          "hover:bg-accent hover:text-accent-foreground",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground"
        )
      }
    >
      <item.icon className="h-4 w-4" />
      <span>{item.title}</span>
    </NavLink>
  );
}

function NavDropdown({ 
  title, 
  items, 
  icon: Icon 
}: { 
  title: string; 
  items: NavItem[]; 
  icon: React.ComponentType<{ className?: string }>;
}) {
  const location = useLocation();
  const isActive = items.some(item => location.pathname === item.href);
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-2 whitespace-nowrap",
            isActive && "bg-accent text-accent-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
          {title}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {items.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <NavLink
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 w-full",
                  isActive && "bg-accent"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </NavLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FinancialLayout() {
  return (
    <div className="flex flex-col h-full">
      {/* Header Navigation */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 py-3">
          <ScrollArea className="w-full">
            <div className="flex items-center gap-1">
              {/* Main tabs */}
              {mainNavItems.map((item) => (
                <NavTab key={item.href} item={item} />
              ))}
              
              <div className="w-px h-6 bg-border mx-2" />
              
              {/* Dropdown menus for secondary items */}
              <NavDropdown 
                title="Gestão" 
                items={managementNavItems} 
                icon={Settings2} 
              />
              
              <NavDropdown 
                title="Operações" 
                items={operationsNavItems} 
                icon={Landmark} 
              />
              
              <NavDropdown 
                title="Relatórios" 
                items={reportsNavItems} 
                icon={BarChart3} 
              />
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
