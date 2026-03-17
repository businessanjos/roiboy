import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Shield, Book, Plug, Users, UserCircle, Target, User,
  CreditCard, Video, Key, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionsManager } from "@/components/settings/SessionsManager";
import { SecurityAuditViewer } from "@/components/settings/SecurityAuditViewer";
import { MembersBookSettings } from "@/components/settings/MembersBookSettings";
import { IntegrationsContent } from "@/components/integrations/IntegrationsContent";
import { UserSectorAccessManager } from "@/components/settings/UserSectorAccessManager";
import { TeamManager } from "@/components/settings/TeamManager";
import { ActivityTypesManager } from "@/components/sales";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { SectorPinSettings } from "@/components/settings/SectorPinSettings";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { useMemo } from "react";
import { ProfileContent } from "@/components/profile/ProfileContent";
import { SubscriptionManager } from "@/components/settings/SubscriptionManager";
import { MeetingPreferencesCard } from "@/components/settings/MeetingPreferencesCard";
import { PlanUsageCard } from "@/components/plan";
import { BillingContent } from "@/components/billing/BillingContent";
import { ApiKeyTab } from "@/components/profile/ApiKeyTab";
import { useIsMobile } from "@/hooks/use-mobile";

const RESTRICTED_ROLES = ["SDR", "Closer", "Vendas", "Vendedor"];

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  condition?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasVendasAccess } = useSectorAccess();
  const { currentUser } = useCurrentUser();
  const { isAdmin } = usePermissions();
  const isMobile = useIsMobile();

  const isSalesRep = useMemo(() => {
    const role = currentUser?.team_role_name;
    const isAdminUser = currentUser?.role === "admin" || currentUser?.is_also_admin;
    return !!role && RESTRICTED_ROLES.includes(role) && !isAdminUser;
  }, [currentUser?.team_role_name, currentUser?.role, currentUser?.is_also_admin]);

  const defaultTab = searchParams.get("tab") || "profile";
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const navGroups: NavGroup[] = useMemo(() => {
    const groups: NavGroup[] = [
      {
        title: "Pessoal",
        items: [
          { id: "profile", label: "Meu Perfil", icon: User },
          { id: "meetings", label: "Reuniões", icon: Video },
        ],
      },
      {
        title: "Plano & Cobrança",
        items: [
          { id: "plan", label: "Uso & Assinatura", icon: CreditCard },
        ],
      },
    ];

    // Admin/Manager section
    if (!isSalesRep) {
      const adminItems: NavItem[] = [
        { id: "team", label: "Equipe", icon: UserCircle },
        { id: "sectors", label: "Setores", icon: Users },
      ];
      if (hasVendasAccess) {
        adminItems.push({ id: "sales", label: "Vendas", icon: Target });
      }
      groups.push({ title: "Gestão", items: adminItems });
    }

    const systemItems: NavItem[] = [
      { id: "integrations", label: "Integrações", icon: Plug },
      { id: "security", label: "Segurança", icon: Shield },
      { id: "members-book", label: "Members Book", icon: Book },
    ];
    if (isAdmin) {
      systemItems.push({ id: "api-key", label: "API Key", icon: Key });
    }
    groups.push({ title: "Sistema", items: systemItems });

    return groups;
  }, [isSalesRep, hasVendasAccess, isAdmin]);

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileContent />;
      case "meetings":
        return <MeetingPreferencesCard />;
      case "plan":
        return (
          <div className="space-y-6">
            <PlanUsageCard />
            <SubscriptionManager />
            <BillingContent />
          </div>
        );
      case "team":
        return !isSalesRep ? <TeamManager /> : null;
      case "sectors":
        return !isSalesRep ? (
          <div className="space-y-4">
            <UserSectorAccessManager />
            <SectorPinSettings />
          </div>
        ) : null;
      case "sales":
        return hasVendasAccess ? <ActivityTypesManager /> : null;
      case "integrations":
        return <IntegrationsContent />;
      case "security":
        return (
          <div className="space-y-4">
            <SessionsManager />
            <SecurityAuditViewer />
          </div>
        );
      case "members-book":
        return <MembersBookSettings />;
      case "api-key":
        return isAdmin && currentUser ? (
          <ApiKeyTab userId={currentUser.id} accountId={currentUser.account_id} />
        ) : null;
      default:
        return <ProfileContent />;
    }
  };

  // Mobile: show nav list or content
  const [mobileShowContent, setMobileShowContent] = useState(!!searchParams.get("tab"));

  const handleMobileNav = (tab: string) => {
    handleTabChange(tab);
    setMobileShowContent(true);
  };

  const NavSidebar = () => (
    <nav className="space-y-6">
      {navGroups.map((group) => (
        <div key={group.title}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
            {group.title}
          </h3>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => isMobile ? handleMobileNav(item.id) : handleTabChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {isMobile && (
                    <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground/50" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  // Mobile layout
  if (isMobile) {
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        {!mobileShowContent ? (
          <>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie seu perfil, equipe e sistema.
              </p>
            </div>
            <NavSidebar />
          </>
        ) : (
          <>
            <button
              onClick={() => setMobileShowContent(false)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              Voltar
            </button>
            <div className="min-h-0">{renderContent()}</div>
          </>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex h-full animate-fade-in">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r bg-muted/30 p-4 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-lg font-bold tracking-tight">Configurações</h1>
          <p className="text-xs text-muted-foreground">
            Perfil, equipe e sistema
          </p>
        </div>
        <NavSidebar />
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {renderContent()}
      </main>
    </div>
  );
}
