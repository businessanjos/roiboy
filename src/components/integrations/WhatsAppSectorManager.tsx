import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, MessageSquare, RefreshCw, ShieldAlert, Smartphone, Headphones, DollarSign, ShoppingCart, Crown, UserSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { SectorInstancesAccordion } from "./whatsapp/SectorInstancesAccordion";
import type { SectorInstance } from "./whatsapp/SectorInstanceCard";
import type { LucideIcon } from "lucide-react";

import type { Tables } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;

export interface SectorConfig {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

const WHATSAPP_SECTORS: SectorConfig[] = [
  { id: "operacoes", name: "Operações", description: "Atendimento CX/CS e suporte geral", icon: Headphones, color: "bg-primary/10 text-primary" },
  { id: "financeiro", name: "Finanças", description: "Cobranças, boletos e pagamentos", icon: DollarSign, color: "bg-emerald-500/10 text-emerald-600" },
  { id: "vendas", name: "Vendas", description: "Pipeline comercial e leads", icon: ShoppingCart, color: "bg-blue-500/10 text-blue-600" },
  { id: "sdr", name: "SDR", description: "Prospecção e qualificação de leads", icon: UserSearch, color: "bg-violet-500/10 text-violet-600" },
];

interface WhatsAppSectorManagerProps {
  integrations: Integration[];
  accountId: string | null;
  onRefresh: () => void;
}

export function WhatsAppSectorManager({ integrations, accountId, onRefresh }: WhatsAppSectorManagerProps) {
  const { isAdmin } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [sectorInstances, setSectorInstances] = useState<Record<string, SectorInstance[]>>({});

  // Fetch instances on mount
  useEffect(() => {
    fetchSectorInstances();
  }, []);

  const fetchSectorInstances = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "list_sector_instances" },
      });

      if (error) throw error;
      
      const instancesList = (data?.data?.instances || data?.instances || []) as SectorInstance[];
      console.log("Loaded sector instances:", instancesList);
      
      // Group instances by sector_id
      const grouped: Record<string, SectorInstance[]> = {};
      for (const instance of instancesList) {
        const sectorId = instance.sector_id || "unassigned";
        if (!grouped[sectorId]) {
          grouped[sectorId] = [];
        }
        grouped[sectorId].push(instance);
      }
      
      setSectorInstances(grouped);
    } catch (error) {
      console.error("Error fetching sector instances:", error);
      toast.error("Erro ao buscar instâncias por setor");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchSectorInstances();
    onRefresh();
  };

  const getConnectedCount = (sectorId: string) => {
    const instances = sectorInstances[sectorId] || [];
    const connected = instances.filter(i => i.status === "connected").length;
    return { connected, total: instances.length };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>WhatsApp por Setor</CardTitle>
              <CardDescription>
                Gerencie as instâncias WhatsApp de cada setor do ROY APP
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Admin-only notice */}
        {!isAdmin && (
          <Alert className="mb-4">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              Apenas administradores podem gerenciar conexões WhatsApp por setor.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando instâncias...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {WHATSAPP_SECTORS.map((sector) => {
              const instances = sectorInstances[sector.id] || [];
              const { connected, total } = getConnectedCount(sector.id);
              
              return (
                <SectorInstancesAccordion
                  key={sector.id}
                  sector={sector}
                  instances={instances}
                  isAdmin={isAdmin}
                  onRefresh={handleRefresh}
                />
              );
            })}
          </div>
        )}

        {/* Info text */}
        <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-muted">
          <p className="text-xs text-muted-foreground">
            💡 Cada setor pode ter múltiplas instâncias WhatsApp. 
            Use o PIN para proteger instâncias sensíveis - apenas quem conhecer o PIN poderá acessar as conversas.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
