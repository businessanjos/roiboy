import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSector } from "@/contexts/SectorContext";
import { sectors, SectorId } from "@/config/sectors";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Bem-vindo à{" "}
            <span className="text-primary">{accountName}</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Gerencie sua empresa através das áreas fundamentais do negócio
          </p>
        </div>

        {/* Main Sectors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {sectors.filter(s => s.id !== "royzapp").map((sector) => (
            <Card
              key={sector.id}
              onClick={() => handleSectorClick(sector.id, sector.defaultRoute, sector.comingSoon)}
              className={cn(
                "relative overflow-hidden transition-all duration-300 border-2",
                sector.comingSoon
                  ? "cursor-not-allowed opacity-60 border-muted"
                  : "cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-primary/50 border-transparent"
              )}
            >
              <CardContent className="p-6 flex flex-col items-center text-center min-h-[200px] justify-center">
                {/* Icon */}
                <div className={cn(
                  "w-16 h-16 rounded-xl flex items-center justify-center mb-4",
                  sector.bgColor
                )}>
                  <sector.icon className={cn("h-8 w-8", sector.color)} />
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {sector.name}
                </h3>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {sector.description}
                </p>

                {/* Coming Soon Badge */}
                {sector.comingSoon && (
                  <Badge variant="secondary" className="absolute top-3 right-3">
                    Em breve
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ROY zAPP - Featured Tool */}
        {sectors.filter(s => s.id === "royzapp").map((sector) => (
          <Card
            key={sector.id}
            onClick={() => handleSectorClick(sector.id, sector.defaultRoute, sector.comingSoon)}
            className={cn(
              "relative overflow-hidden transition-all duration-300 border-2 cursor-pointer",
              "hover:shadow-lg hover:scale-[1.01] hover:border-amber-500/50 border-amber-500/20",
              "bg-gradient-to-r from-amber-500/5 to-orange-500/5"
            )}
          >
            <CardContent className="p-6 flex items-center gap-6">
              {/* Icon */}
              <div className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0",
                "bg-gradient-to-br from-amber-500/20 to-orange-500/20"
              )}>
                <sector.icon className="h-10 w-10 text-amber-600" />
              </div>

              {/* Content */}
              <div className="flex-1">
                <Badge variant="outline" className="mb-2 text-amber-600 border-amber-500/30">
                  Ferramenta
                </Badge>
                <h3 className="text-2xl font-bold text-foreground mb-1">
                  {sector.name}
                </h3>
                <p className="text-muted-foreground">
                  {sector.description}
                </p>
              </div>

              {/* Arrow indicator */}
              <div className="flex-shrink-0 text-amber-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
