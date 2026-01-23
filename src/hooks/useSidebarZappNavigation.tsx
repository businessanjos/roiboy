import { useCallback, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { ZappPinDialog } from "@/components/royzapp/dialogs/ZappPinDialog";
import { ZappInstanceSelectorDialog } from "@/components/royzapp/dialogs/ZappInstanceSelectorDialog";

interface IntegrationInfo {
  id: string;
  displayName: string;
  hasPinHash: boolean;
  useSectorPin?: boolean; // NEW: Indicates if this uses sector-level PIN
}

interface PendingNavigation {
  sectorId: string;
  integrationId: string;
  displayName: string;
  useSectorPin?: boolean; // NEW: Flag to use sector PIN verification
}

export function useSidebarZappNavigation() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  
  // PIN dialog state
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);

  // Instance selector state
  const [showInstanceSelector, setShowInstanceSelector] = useState(false);
  const [availableInstances, setAvailableInstances] = useState<IntegrationInfo[]>([]);
  const [pendingSectorId, setPendingSectorId] = useState<string | null>(null);

  const completeNavigation = useCallback((sectorId: string, integrationId?: string) => {
    const url = integrationId 
      ? `/roy-zapp?sector=${sectorId}&integrationId=${integrationId}`
      : `/roy-zapp?sector=${sectorId}`;
    navigate(url);
    toast.info("Abrindo RoyZapp...");
  }, [navigate]);

  const openZappForSector = useCallback(async (sectorId: string) => {
    if (!currentUser?.account_id) {
      toast.error("Usuário não autenticado");
      return;
    }

    setLoading(true);

    try {
      // Fetch connected WhatsApp integrations for this sector
      const { data: integrations } = await supabase
        .from("integrations")
        .select("id, pin_hash, display_name, config, status")
        .eq("account_id", currentUser.account_id)
        .eq("sector_id", sectorId)
        .eq("status", "connected")
        .order("created_at", { ascending: true });

      // NEW: Fetch sector-level PIN settings
      const { data: sectorSettings } = await supabase
        .from("sector_settings")
        .select("pin_hash")
        .eq("account_id", currentUser.account_id)
        .eq("sector_id", sectorId)
        .maybeSingle();
      
      const sectorHasPin = !!sectorSettings?.pin_hash;

      // No integrations - navigate directly
      if (!integrations || integrations.length === 0) {
        completeNavigation(sectorId);
        setLoading(false);
        return;
      }

      // Single integration - check PIN (instance or sector) and navigate
      if (integrations.length === 1) {
        const integration = integrations[0];
        const displayName = integration.display_name || (integration.config as any)?.instance_name || "Instância";
        const instanceHasPin = !!integration.pin_hash;
        
        // Check if protected by instance PIN OR sector PIN
        if (instanceHasPin || sectorHasPin) {
          setPendingNavigation({
            sectorId,
            integrationId: integration.id,
            displayName,
            useSectorPin: !instanceHasPin && sectorHasPin, // Use sector PIN if instance doesn't have one
          });
          setShowPinDialog(true);
          setLoading(false);
          return;
        }
        
        completeNavigation(sectorId, integration.id);
        setLoading(false);
        return;
      }

      // Multiple integrations - show selector with PIN info
      const instances: IntegrationInfo[] = integrations.map((int) => {
        const instanceHasPin = !!int.pin_hash;
        return {
          id: int.id,
          displayName: int.display_name || (int.config as any)?.instance_name || "Instância",
          hasPinHash: instanceHasPin || sectorHasPin, // Effective PIN protection
          useSectorPin: !instanceHasPin && sectorHasPin,
        };
      });

      setAvailableInstances(instances);
      setPendingSectorId(sectorId);
      setShowInstanceSelector(true);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      toast.error("Erro ao buscar instâncias");
      setLoading(false);
    }
  }, [currentUser?.account_id, completeNavigation]);

  const handleInstanceSelect = useCallback((integrationId: string) => {
    if (!pendingSectorId) return;
    
    // PIN was already validated in ZappInstanceSelectorDialog if needed
    completeNavigation(pendingSectorId, integrationId);
    
    setShowInstanceSelector(false);
    setAvailableInstances([]);
    setPendingSectorId(null);
  }, [pendingSectorId, completeNavigation]);

  const handlePinSuccess = useCallback(() => {
    if (pendingNavigation) {
      completeNavigation(pendingNavigation.sectorId, pendingNavigation.integrationId);
    }
    setShowPinDialog(false);
    setPendingNavigation(null);
  }, [pendingNavigation, completeNavigation]);

  const handlePinDialogClose = useCallback((open: boolean) => {
    if (!open) {
      setShowPinDialog(false);
      setPendingNavigation(null);
    }
  }, []);

  const handleInstanceSelectorClose = useCallback((open: boolean) => {
    if (!open) {
      setShowInstanceSelector(false);
      setAvailableInstances([]);
      setPendingSectorId(null);
    }
  }, []);

  // Render the PIN dialog component
  const PinDialog: ReactNode = showPinDialog && pendingNavigation ? (
    <ZappPinDialog
      open={showPinDialog}
      onOpenChange={handlePinDialogClose}
      sectorId={pendingNavigation.sectorId}
      integrationId={pendingNavigation.useSectorPin ? undefined : pendingNavigation.integrationId}
      instanceName={pendingNavigation.displayName}
      useSectorPin={pendingNavigation.useSectorPin}
      onSuccess={handlePinSuccess}
    />
  ) : null;

  // Render the Instance Selector dialog component
  const InstanceSelectorDialog: ReactNode = showInstanceSelector ? (
    <ZappInstanceSelectorDialog
      open={showInstanceSelector}
      onOpenChange={handleInstanceSelectorClose}
      instances={availableInstances}
      onSelect={handleInstanceSelect}
    />
  ) : null;

  return { openZappForSector, loading, PinDialog, InstanceSelectorDialog };
}
