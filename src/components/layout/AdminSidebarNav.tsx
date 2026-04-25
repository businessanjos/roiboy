import { useSearchParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Activity, Building2, Users,
  FileText, Cpu, ArrowLeft, Shield, KeyRound, ScanSearch,
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
    title: "Geral",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "status", label: "Status", icon: Activity },
    ],
  },
  {
    title: "Gestão",
    items: [
      { id: "accounts", label: "Contas", icon: Building2 },
      { id: "users", label: "Usuários", icon: Users },
      { id: "permissions", label: "Permissões", icon: KeyRound },
      { id: "access-audit", label: "Auditoria de Acesso", icon: ScanSearch },
    ],
  },
  {
    title: "Infraestrutura",
    items: [
      { id: "costs", label: "Custos IA", icon: Cpu },
      { id: "audit", label: "Auditoria", icon: FileText },
    ],
  },
];

export function AdminSidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = searchParams.get("tab") || "dashboard";

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
    onNavigate?.();
  };

  return (
    <>
      <div className="p-3 border-b border-border">
        <button
          onClick={() => { navigate("/"); onNavigate?.(); }}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
            "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <ArrowLeft className="h-5 w-5 flex-shrink-0" />
          {!collapsed && (
            <div className="flex flex-col items-start">
              <span className="text-xs text-muted-foreground">Voltar</span>
              <span className="font-semibold text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Administração
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
