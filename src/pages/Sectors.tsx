import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSector } from "@/contexts/SectorContext";
import { sectors, SectorId } from "@/config/sectors";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { usePermissions } from "@/hooks/usePermissions";
import { SectorsHealthBanner } from "@/components/sectors/SectorsHealthBanner";
import { BarChart3, Wallet, Target, Palette, Zap, Bot, Briefcase } from "lucide-react";
import eternumSimbolo from "@/assets/simbolo-eternum.png";

// Visual identity for each core sector — accent color + geometric pattern
const SECTOR_IDENTITY: Record<string, {
  accent: string;
  hoverBorder: string;
  hoverIconBg: string;
  hoverIconColor: string;
  patternClass: string;
  overrideIcon: React.ElementType;
}> = {
  operacoes: {
    accent: "border-l-yellow-800",
    hoverBorder: "hover:border-yellow-800/30",
    hoverIconBg: "group-hover:bg-yellow-800/10",
    hoverIconColor: "group-hover:text-yellow-800",
    patternClass: "sector-pattern-ops",
    overrideIcon: BarChart3,
  },
  financeiro: {
    accent: "border-l-emerald-500",
    hoverBorder: "hover:border-emerald-500/30",
    hoverIconBg: "group-hover:bg-emerald-500/10",
    hoverIconColor: "group-hover:text-emerald-600",
    patternClass: "sector-pattern-fin",
    overrideIcon: Wallet,
  },
  vendas: {
    accent: "border-l-blue-500",
    hoverBorder: "hover:border-blue-500/30",
    hoverIconBg: "group-hover:bg-blue-500/10",
    hoverIconColor: "group-hover:text-blue-600",
    patternClass: "sector-pattern-sales",
    overrideIcon: Target,
  },
  marketing: {
    accent: "border-l-purple-500",
    hoverBorder: "hover:border-purple-500/30",
    hoverIconBg: "group-hover:bg-purple-500/10",
    hoverIconColor: "group-hover:text-purple-600",
    patternClass: "sector-pattern-mkt",
    overrideIcon: Palette,
  },
  royzapp: {
    accent: "border-l-yellow-500",
    hoverBorder: "hover:border-yellow-500/30",
    hoverIconBg: "group-hover:bg-yellow-500/10",
    hoverIconColor: "group-hover:text-yellow-600",
    patternClass: "sector-pattern-zapp",
    overrideIcon: Zap,
  },
  everia: {
    accent: "border-l-violet-500",
    hoverBorder: "hover:border-violet-500/30",
    hoverIconBg: "group-hover:bg-violet-500/10",
    hoverIconColor: "group-hover:text-violet-600",
    patternClass: "sector-pattern-everia",
    overrideIcon: Bot,
  },
  rh: {
    accent: "border-l-rose-500",
    hoverBorder: "hover:border-rose-500/30",
    hoverIconBg: "group-hover:bg-rose-500/10",
    hoverIconColor: "group-hover:text-rose-600",
    patternClass: "sector-pattern-rh",
    overrideIcon: Briefcase,
  },
};

function SectorPattern({ sectorId }: { sectorId: string }) {
  const patterns: Record<string, React.ReactNode> = {
    operacoes: (
      <svg className="absolute right-3 bottom-3 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500" width="80" height="80" viewBox="0 0 80 80">
        <rect x="5" y="45" width="12" height="30" rx="2" fill="currentColor" />
        <rect x="22" y="30" width="12" height="45" rx="2" fill="currentColor" />
        <rect x="39" y="15" width="12" height="60" rx="2" fill="currentColor" />
        <rect x="56" y="5" width="12" height="70" rx="2" fill="currentColor" />
      </svg>
    ),
    financeiro: (
      <svg className="absolute right-3 bottom-3 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500" width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="28" stroke="currentColor" strokeWidth="2" fill="none" />
        <text x="40" y="47" textAnchor="middle" fontSize="24" fontWeight="600" fill="currentColor">$</text>
      </svg>
    ),
    vendas: (
      <svg className="absolute right-3 bottom-3 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500" width="80" height="80" viewBox="0 0 80 80">
        <polyline points="10,65 30,40 50,50 70,15" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="70" cy="15" r="5" fill="currentColor" />
      </svg>
    ),
    marketing: (
      <svg className="absolute right-3 bottom-3 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500" width="80" height="80" viewBox="0 0 80 80">
        <circle cx="30" cy="30" r="18" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="50" cy="30" r="18" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="40" cy="48" r="18" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
    royzapp: (
      <svg className="absolute right-3 bottom-3 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500" width="80" height="80" viewBox="0 0 80 80">
        <polygon points="40,8 50,30 74,30 55,46 62,70 40,56 18,70 25,46 6,30 30,30" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
    everia: (
      <svg className="absolute right-3 bottom-3 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500" width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="32" r="16" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M20 58 Q30 48 40 48 Q50 48 60 58" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="34" cy="30" r="2" fill="currentColor" />
        <circle cx="46" cy="30" r="2" fill="currentColor" />
      </svg>
    ),
    rh: (
      <svg className="absolute right-3 bottom-3 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500" width="80" height="80" viewBox="0 0 80 80">
        <circle cx="30" cy="25" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="50" cy="25" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M15 55 Q15 40 30 40 Q40 40 40 45 Q40 40 50 40 Q65 40 65 55" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  };
  return <>{patterns[sectorId] || null}</>;
}

export default function Sectors() {
  const navigate = useNavigate();
  const { currentUser, loading: userLoading } = useCurrentUser();
  const { setCurrentSector } = useSector();
  const {
    hasSectorAccess,
    sectorAccess,
    isLoading: sectorAccessLoading,
    sectorAccessError,
    sectorSettingsError,
  } = useSectorAccess();
  const { isSuperAdmin } = useSuperAdmin();
  const { permissions, loading: permissionsLoading, isAdmin } = usePermissions();
  const [accountName, setAccountName] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccountName = async () => {
      if (!currentUser?.account_id) return;
      const { data } = await supabase
        .from("accounts")
        .select("name")
        .eq("id", currentUser.account_id)
        .single();
      if (data?.name) setAccountName(data.name);
    };
    fetchAccountName();
  }, [currentUser?.account_id]);

  const handleSectorClick = (sectorId: SectorId, defaultRoute: string, comingSoon?: boolean) => {
    if (comingSoon) return;
    setCurrentSector(sectorId);
    navigate(defaultRoute);
  };

  const RH_ALLOWED_EMAIL = "m.quintana@me.com";

  const availableSectors = useMemo(() => {
    // While the access list is still loading, render nothing instead of
    // falling back to "show everything". This prevents non-admin users from
    // briefly seeing all sectors before the RLS data finishes loading.
    if (sectorAccessLoading) return [];

    let filtered = sectors.filter((s) => hasSectorAccess(s.id));
    // RH is only visible to the allowed email
    if (currentUser?.email !== RH_ALLOWED_EMAIL) {
      filtered = filtered.filter(s => s.id !== "rh");
    }

    // Diagnostic log — helps identify cases where a user sees more sectors
    // than expected (e.g. stale production build, unexpected admin flag).
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.info("[Sectors] access decision", {
        userId: currentUser?.id,
        email: currentUser?.email,
        role: currentUser?.role,
        is_also_admin: currentUser?.is_also_admin,
        isSuperAdmin,
        activeSectorIds: (sectorAccess || []).map((a) => a.sector_id),
        visibleSectorIds: filtered.map((s) => s.id),
      });
    }

    return filtered;
  }, [hasSectorAccess, sectorAccessLoading, sectorAccess, currentUser, isSuperAdmin]);

  const coreAreas: SectorId[] = ["marketing", "vendas", "operacoes", "financeiro", "royzapp", "everia", "rh"];
  const coreSectors = coreAreas.map(id => availableSectors.find(s => s.id === id)!).filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-12 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col items-center mb-14">
          <img 
            src={eternumSimbolo} 
            alt="Eternum" 
            className="h-20 w-auto mb-3" 
          />
          <h1 className="text-2xl md:text-3xl font-light text-foreground tracking-tight">
            {accountName || (userLoading ? "..." : "Sua Empresa")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione uma área para continuar
          </p>
        </div>

        <SectorsHealthBanner
          userLoading={userLoading}
          permissionsLoading={permissionsLoading}
          permissionsCount={permissions.length}
          sectorAccessLoading={sectorAccessLoading}
          sectorAccessError={sectorAccessError}
          sectorSettingsError={sectorSettingsError}
          visibleSectorCount={availableSectors.length}
          isAdmin={isAdmin || isSuperAdmin}
        />

        {/* All 6 Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coreSectors.map((sector) => {
            const identity = SECTOR_IDENTITY[sector.id];
            const IconComponent = identity?.overrideIcon || sector.icon;

            return (
              <div
                key={sector.id}
                onClick={() => handleSectorClick(sector.id, sector.defaultRoute, sector.comingSoon)}
                className={cn(
                  "group relative p-5 rounded-xl border border-l-[3px] bg-card overflow-hidden transition-all duration-300",
                  identity?.accent || "border-l-primary",
                  sector.comingSoon
                    ? "cursor-not-allowed opacity-40"
                    : cn(
                        "cursor-pointer hover:shadow-xl hover:shadow-black/5 hover:-translate-y-0.5",
                        identity?.hoverBorder || "hover:border-primary/30"
                      )
                )}
              >
                {/* Background pattern */}
                <SectorPattern sectorId={sector.id} />

                <div className="relative z-10 flex items-center gap-4">
                  {/* Icon */}
                  <div className={cn(
                    "w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center flex-shrink-0 transition-colors duration-300",
                    identity?.hoverIconBg || "group-hover:bg-primary/10"
                  )}>
                    <IconComponent className={cn(
                      "h-6 w-6 text-foreground/70 transition-colors duration-300",
                      identity?.hoverIconColor || "group-hover:text-primary"
                    )} strokeWidth={1.5} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground tracking-tight">
                        {sector.name}
                      </h3>
                      {sector.comingSoon && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase tracking-wider font-medium">
                          Em breve
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {sector.description}
                    </p>
                  </div>

                  {/* Arrow */}
                  
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
