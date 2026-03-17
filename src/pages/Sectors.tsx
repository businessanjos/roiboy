import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSector } from "@/contexts/SectorContext";
import { sectors, SectorId } from "@/config/sectors";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Sectors accessible by sales rep roles (SDR, Closer, Vendas, Vendedor)
const SALES_REP_ALLOWED_SECTORS: SectorId[] = ["vendas", "royzapp", "roychat", "configuracoes"];
const SALES_REP_ROLES = ["SDR", "Closer", "Vendas", "Vendedor"];

export default function Sectors() {
  const navigate = useNavigate();
  const { currentUser, loading: userLoading } = useCurrentUser();
  const { setCurrentSector } = useSector();
  const [accountName, setAccountName] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccountName = async () => {
      if (!currentUser?.account_id) return;
      
      const { data, error } = await supabase
        .from("accounts")
        .select("name")
        .eq("id", currentUser.account_id)
        .single();
      
      if (data?.name) {
        setAccountName(data.name);
      }
    };
    
    fetchAccountName();
  }, [currentUser?.account_id]);

  const handleSectorClick = (sectorId: SectorId, defaultRoute: string, comingSoon?: boolean) => {
    if (comingSoon) return;
    
    setCurrentSector(sectorId);
    navigate(defaultRoute);
  };

  // Check if user is SDR or Closer (restricted view)
  const isSalesRep = useMemo(() => {
    const role = currentUser?.team_role_name;
    return role === "SDR" || role === "Closer";
  }, [currentUser?.team_role_name]);

  // Check if user is admin/manager (full view)
  const isManager = useMemo(() => {
    const role = currentUser?.role;
    const teamRole = currentUser?.team_role_name;
    return role === "admin" || currentUser?.is_also_admin || 
           teamRole === "Gestor" || teamRole === "Admin";
  }, [currentUser?.role, currentUser?.is_also_admin, currentUser?.team_role_name]);

  // Filter sectors based on role
  const availableSectors = useMemo(() => {
    if (isSalesRep && !isManager) {
      return sectors.filter(s => SALES_REP_ALLOWED_SECTORS.includes(s.id));
    }
    return sectors;
  }, [isSalesRep, isManager]);

  // Core 4 areas (Marketing, Vendas, Operações, Finanças)
  const coreAreas: SectorId[] = ["marketing", "vendas", "operacoes", "financeiro"];
  const coreSectors = coreAreas.map(id => availableSectors.find(s => s.id === id)!).filter(Boolean);
  const otherSectors = availableSectors.filter(s => !coreAreas.includes(s.id) && s.id !== "royzapp" && s.id !== "roychat");
  const toolSectors = availableSectors.filter(s => s.id === "royzapp" || s.id === "roychat");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-16 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-3xl md:text-4xl font-light text-foreground mb-2 tracking-tight">
            Bem-vindo à{" "}
            <span className="text-primary font-medium">
              {accountName || (userLoading ? "..." : "Sua Empresa")}
            </span>
          </h1>
          <p className="text-muted-foreground">
            Gerencie sua empresa através das áreas fundamentais do negócio
          </p>
        </div>

        {/* Core 4 Areas - Larger Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {coreSectors.map((sector) => (
            <div
              key={sector.id}
              onClick={() => handleSectorClick(sector.id, sector.defaultRoute, sector.comingSoon)}
              className={cn(
                "group relative p-6 rounded-xl border-2 bg-card transition-all duration-200",
                sector.comingSoon
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:shadow-lg hover:scale-[1.02]",
                // Dynamic border color based on sector
                sector.id === "operacoes" && "border-amber-500/30 hover:border-amber-500/60",
                sector.id === "financeiro" && "border-emerald-500/30 hover:border-emerald-500/60",
                sector.id === "vendas" && "border-blue-500/30 hover:border-blue-500/60",
                sector.id === "marketing" && "border-purple-500/30 hover:border-purple-500/60"
              )}
            >
              <div className="flex items-start gap-4">
                {/* Icon - Larger for core areas */}
                <div className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0",
                  sector.bgColor
                )}>
                  <sector.icon className={cn("h-7 w-7", sector.color)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-semibold text-foreground">
                      {sector.name}
                    </h3>
                    {sector.comingSoon && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        Em breve
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {sector.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Other Sectors - Smaller Cards */}
        {otherSectors.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {otherSectors.map((sector) => (
              <div
                key={sector.id}
                onClick={() => handleSectorClick(sector.id, sector.defaultRoute, sector.comingSoon)}
                className={cn(
                  "group relative p-5 rounded-lg border bg-card/50 transition-all duration-200",
                  sector.comingSoon
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:border-muted-foreground/30 hover:bg-card"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    sector.bgColor
                  )}>
                    <sector.icon className={cn("h-5 w-5", sector.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-base font-medium text-foreground">
                        {sector.name}
                      </h3>
                      {sector.comingSoon && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          Em breve
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {sector.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tools - ROY zAPP & ROY Chat */}
        {toolSectors.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {toolSectors.map((tool) => (
              <div
                key={tool.id}
                onClick={() => handleSectorClick(tool.id, tool.defaultRoute)}
                className="group relative p-5 rounded-lg border border-primary/20 bg-primary/5 cursor-pointer transition-all duration-200 hover:border-primary/40 hover:bg-primary/10"
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", tool.bgColor)}>
                    <tool.icon className={cn("h-6 w-6", tool.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-primary uppercase tracking-wider">
                      Ferramenta
                    </span>
                    <h3 className="text-lg font-medium text-foreground">
                      {tool.name}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {tool.description}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="text-primary/60 group-hover:text-primary transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
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
