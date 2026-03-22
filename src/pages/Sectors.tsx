import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSector } from "@/contexts/SectorContext";
import { sectors, SectorId } from "@/config/sectors";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { RoyLogo } from "@/components/ui/roy-logo";
import { ArrowRight, BarChart3, Wallet, Target, Palette } from "lucide-react";
import eternumSimbolo from "@/assets/simbolo-eternum.png";

// Sectors accessible by sales rep roles
const SALES_REP_ALLOWED_SECTORS: SectorId[] = ["vendas", "royzapp", "roychat", "configuracoes"];
const SALES_REP_ROLES = ["SDR", "Closer", "Vendas", "Vendedor"];

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
    accent: "border-l-amber-500",
    hoverBorder: "hover:border-amber-500/30",
    hoverIconBg: "group-hover:bg-amber-500/10",
    hoverIconColor: "group-hover:text-amber-600",
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
  };
  return <>{patterns[sectorId] || null}</>;
}

export default function Sectors() {
  const navigate = useNavigate();
  const { currentUser, loading: userLoading } = useCurrentUser();
  const { setCurrentSector } = useSector();
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

  const isSalesRep = useMemo(() => {
    const role = currentUser?.team_role_name;
    return !!role && SALES_REP_ROLES.includes(role);
  }, [currentUser?.team_role_name]);

  const isManager = useMemo(() => {
    const role = currentUser?.role;
    const teamRole = currentUser?.team_role_name;
    return role === "admin" || currentUser?.is_also_admin || 
           teamRole === "Gestor" || teamRole === "Admin";
  }, [currentUser?.role, currentUser?.is_also_admin, currentUser?.team_role_name]);

  const availableSectors = useMemo(() => {
    if (isSalesRep && !isManager) {
      return sectors.filter(s => SALES_REP_ALLOWED_SECTORS.includes(s.id));
    }
    return sectors;
  }, [isSalesRep, isManager]);

  const coreAreas: SectorId[] = ["marketing", "vendas", "operacoes", "financeiro"];
  const coreSectors = coreAreas.map(id => availableSectors.find(s => s.id === id)!).filter(Boolean);
  const otherSectors = availableSectors.filter(s => !coreAreas.includes(s.id) && s.id !== "royzapp" && s.id !== "roychat");
  const toolSectors = availableSectors.filter(s => s.id === "royzapp" || s.id === "roychat");

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

        {/* Core 4 Areas — with accent border, pattern, and distinct icons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {coreSectors.map((sector) => {
            const identity = SECTOR_IDENTITY[sector.id];
            const IconComponent = identity?.overrideIcon || sector.icon;

            return (
              <div
                key={sector.id}
                onClick={() => handleSectorClick(sector.id, sector.defaultRoute, sector.comingSoon)}
                className={cn(
                  "group relative p-5 rounded-xl border border-l-[3px] bg-card overflow-hidden transition-all duration-300",
                  identity?.accent,
                  sector.comingSoon
                    ? "cursor-not-allowed opacity-40"
                    : cn(
                        "cursor-pointer hover:shadow-xl hover:shadow-black/5 hover:-translate-y-0.5",
                        identity?.hoverBorder
                      )
                )}
              >
                {/* Background pattern */}
                <SectorPattern sectorId={sector.id} />

                <div className="relative z-10 flex items-center gap-4">
                  {/* Icon */}
                  <div className={cn(
                    "w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center flex-shrink-0 transition-colors duration-300",
                    identity?.hoverIconBg
                  )}>
                    <IconComponent className={cn(
                      "h-6 w-6 text-foreground/70 transition-colors duration-300",
                      identity?.hoverIconColor
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
                  <ArrowRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-foreground/40 group-hover:translate-x-0.5 transition-all duration-300 flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        {(otherSectors.length > 0 || toolSectors.length > 0) && (
          <div className="flex items-center gap-3 my-8">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
              Mais áreas
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {/* Other Sectors + Tools - Unified grid */}
        {[...otherSectors, ...toolSectors].length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[...otherSectors, ...toolSectors].map((sector) => (
              <div
                key={sector.id}
                onClick={() => handleSectorClick(sector.id, sector.defaultRoute, sector.comingSoon)}
                className={cn(
                  "group relative p-4 rounded-lg border bg-card/50 transition-all duration-300",
                  sector.comingSoon
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer hover:bg-card hover:border-primary/20 hover:shadow-md hover:shadow-primary/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors duration-300">
                    <sector.icon className="h-[18px] w-[18px] text-foreground/60 group-hover:text-primary transition-colors duration-300" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground">
                      {sector.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {sector.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
