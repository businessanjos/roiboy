import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSector } from "@/contexts/SectorContext";
import { sectors, SectorId } from "@/config/sectors";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export default function Sectors() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { setCurrentSector } = useSector();
  const [accountName, setAccountName] = useState("Sua Empresa");

  useEffect(() => {
    if (currentUser?.account_id) {
      supabase
        .from("accounts")
        .select("name")
        .eq("id", currentUser.account_id)
        .single()
        .then(({ data }) => {
          if (data?.name) setAccountName(data.name);
        });
    }
  }, [currentUser?.account_id]);

  const handleSectorClick = (sectorId: SectorId, defaultRoute: string, comingSoon?: boolean) => {
    if (comingSoon) return;
    
    setCurrentSector(sectorId);
    navigate(defaultRoute);
  };

  const mainSectors = sectors.filter(s => s.id !== "royzapp");
  const royzappSector = sectors.find(s => s.id === "royzapp");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-16 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-3xl md:text-4xl font-light text-foreground mb-2 tracking-tight">
            Bem-vindo à{" "}
            <span className="text-primary font-medium">{accountName}</span>
          </h1>
          <p className="text-muted-foreground">
            Gerencie sua empresa através das áreas fundamentais do negócio
          </p>
        </div>

        {/* Main Sectors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {mainSectors.map((sector) => (
            <div
              key={sector.id}
              onClick={() => handleSectorClick(sector.id, sector.defaultRoute, sector.comingSoon)}
              className={cn(
                "group relative p-6 rounded-lg border bg-card transition-all duration-200",
                sector.comingSoon
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:border-primary/40 hover:shadow-sm"
              )}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                  sector.bgColor
                )}>
                  <sector.icon className={cn("h-6 w-6", sector.color)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-medium text-foreground">
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

        {/* ROY zAPP - Featured Tool */}
        {royzappSector && (
          <div
            onClick={() => handleSectorClick(royzappSector.id, royzappSector.defaultRoute)}
            className="group relative p-6 rounded-lg border border-primary/20 bg-primary/5 cursor-pointer transition-all duration-200 hover:border-primary/40 hover:bg-primary/10"
          >
            <div className="flex items-center gap-5">
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10">
                <royzappSector.icon className="h-7 w-7 text-primary" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-primary uppercase tracking-wider">
                  Ferramenta
                </span>
                <h3 className="text-xl font-medium text-foreground">
                  {royzappSector.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {royzappSector.description}
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
        )}
      </div>
    </div>
  );
}
