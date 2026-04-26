import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Clock, MessageSquare, TrendingUp, FileText,
  Grid3X3, Calendar, Heart, Link2, FileSignature, CreditCard,
  Target, AlertTriangle, Lightbulb, User,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "Principal",
    items: [
      { id: "timeline", label: "Timeline", icon: Clock },
      
      { id: "agenda", label: "Agenda", icon: Calendar },
    ],
  },
  {
    title: "Comercial",
    items: [
      { id: "deals", label: "Negócios", icon: TrendingUp },
      { id: "contracts", label: "Contratos", icon: FileSignature },
      { id: "subscriptions", label: "Financeiro", icon: CreditCard },
      { id: "sales", label: "Metas & Vendas", icon: Target },
    ],
  },
  {
    title: "Dados",
    items: [
      { id: "fichas", label: "Fichas", icon: FileText },
      { id: "campos", label: "Campos", icon: Grid3X3 },
      { id: "cx", label: "Momentos CX", icon: Heart },
      { id: "vinculos", label: "Vínculos", icon: Link2 },
    ],
  },
];

export function ClientDetailSidebarNav({
  collapsed,
  onNavigate,
  clientName,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  clientName?: string;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "timeline";

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
    onNavigate?.();
  };

  return (
    <>
      <div className="p-3 border-b border-border">
        <button
          onClick={() => { navigate("/clients"); onNavigate?.(); }}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
            "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <ArrowLeft className="h-5 w-5 flex-shrink-0" />
          {!collapsed && (
            <div className="flex flex-col items-start overflow-hidden">
              <span className="text-xs text-muted-foreground">Voltar</span>
              <span className="font-semibold text-foreground truncate max-w-[160px] flex items-center gap-2">
                <User className="h-4 w-4 shrink-0" />
                {clientName || "Cliente"}
              </span>
            </div>
          )}
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}
