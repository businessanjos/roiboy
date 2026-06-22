import { useSearchParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Shield, Book, Plug, Users, UserCircle, Target, User,
  CreditCard, Video, Key, ArrowLeft, Activity,
} from "lucide-react";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { PERMISSIONS, usePermissions } from "@/hooks/usePermissions";
import { useMemo } from "react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function SettingsSidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { hasVendasAccess } = useSectorAccess();
  const { isAdmin, hasPermission } = usePermissions();
  const canViewSettings = isAdmin || hasPermission(PERMISSIONS.SETTINGS_VIEW);
  const canEditSettings = isAdmin || hasPermission(PERMISSIONS.SETTINGS_EDIT);

  const activeTab = searchParams.get("tab") || "profile";

  const navGroups: NavGroup[] = useMemo(() => {
    const groups: NavGroup[] = [
      {
        title: "Pessoal",
        items: [
          { id: "profile", label: "Meu Perfil", icon: User },
          { id: "meetings", label: "Reuniões", icon: Video },
        ],
      },
    ];

    if (canViewSettings) {
      groups.push({
        title: "Plano & Cobrança",
        items: [
          { id: "plan", label: "Uso & Assinatura", icon: CreditCard },
        ],
      });
    }

    const canManageTeam = isAdmin || hasPermission(PERMISSIONS.TEAM_EDIT_CX);
    if (canManageTeam) {
      const adminItems: NavItem[] = [
        { id: "team", label: "Equipe", icon: UserCircle },
      ];
      if (isAdmin) {
        adminItems.push({ id: "sectors", label: "Setores", icon: Users });
      }
      if (hasVendasAccess && canEditSettings) {
        adminItems.push({ id: "sales", label: "Vendas", icon: Target });
      }
      groups.push({ title: "Gestão", items: adminItems });
    }

    const systemItems: NavItem[] = [];
    if (canEditSettings) {
      systemItems.push({ id: "integrations", label: "Integrações", icon: Plug });
    }
    if (canViewSettings) {
      systemItems.push(
        { id: "security", label: "Segurança", icon: Shield },
        { id: "members-book", label: "Members Book", icon: Book },
      );
    }
    if (isAdmin) {
      systemItems.push({ id: "api-key", label: "API Key", icon: Key });
      systemItems.push({ id: "tech-tokens", label: "Tokens Gestão Tech", icon: Activity });
    }
    if (systemItems.length > 0) {
      groups.push({ title: "Sistema", items: systemItems });
    }

    return groups;
  }, [hasVendasAccess, isAdmin, canViewSettings, canEditSettings, hasPermission]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
    onNavigate?.();
  };

  return (
    <>
      {/* Back button */}
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
              <span className="font-semibold text-foreground">Configurações</span>
            </div>
          )}
        </button>
      </div>

      {/* Navigation */}
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
