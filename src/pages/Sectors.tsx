import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSector } from "@/contexts/SectorContext";
import { sectors, SectorId } from "@/config/sectors";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { RoyLogo } from "@/components/ui/roy-logo";
import { ArrowRight } from "lucide-react";

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
    return !!role && SALES_REP_ROLES.includes(role);
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
      <div className="container mx-auto px-6 py-12 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col items-center mb-14">
          <RoyLogo size="xl" className="mb-5 opacity-80" />
          <h1 className="text-2xl md:text-3xl font-light text-foreground tracking-tight">
            {accountName || (userLoading ? "..." : "Sua Empresa")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione uma área para continuar
          </p>
        </div>

        {/* Core 4 Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {coreSectors.map((sector, i) => (
            <div
              key={sector.id}
              onClick={() => handleSectorClick(sector.id, sector.defaultRoute, sector.comingSoon)}
              className={cn(
                "group relative p-5 rounded-xl border bg-card transition-all duration-300",
                sector.comingSoon
                  ? "cursor-not-allowed opacity-40"
                  : "cursor-pointer hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 hover:-translate-y-0.5"
              )}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-4">
                {/* Monochrome icon */}
                <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors duration-300">
                  <sector.icon className="h-6 w-6 text-foreground/70 group-hover:text-primary transition-colors duration-300" />
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
                <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 group-hover:translate-x-0.5 transition-all duration-300 flex-shrink-0" />
              </div>
            </div>
          ))}
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
            {[...otherSectors, ...toolSectors].map((sector, i) => (
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
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors duration-300">
                    <sector.icon className="h-4.5 w-4.5 text-foreground/60 group-hover:text-primary transition-colors duration-300" />
                  </div>

                  {/* Content */}
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
