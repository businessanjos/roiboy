import { useCallback, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { ZappPinDialog } from "@/components/royzapp/dialogs/ZappPinDialog";
import { ZappInstanceSelectorDialog } from "@/components/royzapp/dialogs/ZappInstanceSelectorDialog";

interface ZappNavigationOptions {
  phone?: string | null;
  leadId?: string;
  clientId?: string;
  name?: string;
  openInNewTab?: boolean;
}

interface IntegrationInfo {
  id: string;
  displayName: string;
  hasPinHash: boolean;
  useSectorPin?: boolean; // NEW: Indicates if this uses sector-level PIN
}

export function useZappNavigation() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  
  // PIN dialog state
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pendingIntegration, setPendingIntegration] = useState<IntegrationInfo | null>(null);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);
  const [pendingSectorId, setPendingSectorIdForPin] = useState<string | null>(null); // NEW: Track sector for PIN

  // Instance selector state
  const [showInstanceSelector, setShowInstanceSelector] = useState(false);
  const [availableInstances, setAvailableInstances] = useState<IntegrationInfo[]>([]);
  const [pendingOptions, setPendingOptions] = useState<ZappNavigationOptions | null>(null);

  const completeNavigation = useCallback((url: string, openInNewTab?: boolean) => {
    if (openInNewTab) {
      const fullUrl = `${window.location.origin}${url}`;
      window.open(fullUrl, '_blank');
    } else {
      navigate(url);
    }
    toast.info("Abrindo RoyZapp...");
  }, [navigate]);

  const buildNavigationUrl = useCallback((integrationId: string, options: ZappNavigationOptions) => {
    const { phone, leadId, clientId, name } = options;
    const normalizedPhone = phone?.replace(/\D/g, "") || "";
    const encodedName = encodeURIComponent(name || "");
    return `/roy-zapp?sector=vendas&integrationId=${integrationId}&newPhone=${normalizedPhone}&newName=${encodedName}${leadId ? `&leadId=${leadId}` : ""}${clientId ? `&clientId=${clientId}` : ""}`;
  }, []);

  const navigateToInstance = useCallback(async (integrationId: string, options: ZappNavigationOptions, sectorHasPin: boolean = false) => {
    // Fetch integration to check for PIN
    const { data: integration } = await supabase
      .from("integrations")
      .select("id, pin_hash, display_name, config, sector_id")
      .eq("id", integrationId)
      .single();

    if (!integration) {
      toast.error("Instância não encontrada");
      return;
    }

    const navigationUrl = buildNavigationUrl(integrationId, options);
    const instanceHasPin = !!integration.pin_hash;

    // Check if integration has PIN protection (instance OR sector level)
    if (instanceHasPin || sectorHasPin) {
      const useSectorPin = !instanceHasPin && sectorHasPin;
      setPendingIntegration({
        id: integration.id,
        displayName: integration.display_name || (integration.config as any)?.instance_name || "Instância",
        hasPinHash: true,
        useSectorPin,
      });
      setPendingNavigationUrl(navigationUrl);
      setPendingSectorIdForPin(integration.sector_id);
      setPendingOptions(options); // Store options for openInNewTab
      setShowPinDialog(true);
      return;
    }

    // No PIN required, navigate directly
    completeNavigation(navigationUrl, options.openInNewTab);
  }, [buildNavigationUrl, completeNavigation]);

  const openZappConversation = useCallback(async (options: ZappNavigationOptions) => {
    const { phone, leadId, clientId, name } = options;

    if (!phone && !leadId && !clientId) {
      toast.error("Nenhum telefone disponível para iniciar conversa");
      return;
    }

    if (!currentUser?.account_id || !currentUser?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    if (!phone) {
      toast.error("Nenhum telefone cadastrado para este contato");
      return;
    }

    setLoading(true);

    try {
      // Fetch ALL connected integrations for vendas sector
      const { data: allIntegrations } = await supabase
        .from("integrations")
        .select("id, pin_hash, display_name, config, status, sector_id")
        .eq("account_id", currentUser.account_id)
        .eq("sector_id", "vendas")
        .eq("status", "connected")
        .order("created_at", { ascending: true });

      // NEW: Fetch sector-level PIN settings for vendas
      const { data: sectorSettings } = await supabase
        .from("sector_settings")
        .select("pin_hash")
        .eq("account_id", currentUser.account_id)
        .eq("sector_id", "vendas")
        .maybeSingle();
      
      const sectorHasPin = !!sectorSettings?.pin_hash;

      if (!allIntegrations || allIntegrations.length === 0) {
        // No integrations, navigate without integrationId (fallback)
        const normalizedPhone = phone.replace(/\D/g, "");
        const encodedName = encodeURIComponent(name || "");
        const navigationUrl = `/roy-zapp?sector=vendas&newPhone=${normalizedPhone}&newName=${encodedName}${leadId ? `&leadId=${leadId}` : ""}${clientId ? `&clientId=${clientId}` : ""}`;
        completeNavigation(navigationUrl, options.openInNewTab);
        setLoading(false);
        return;
      }

      // If only ONE integration, use it directly
      if (allIntegrations.length === 1) {
        const integration = allIntegrations[0];
        await navigateToInstance(integration.id, options, sectorHasPin);
        setLoading(false);
        return;
      }

      // MULTIPLE integrations - show selector dialog
      const instances: IntegrationInfo[] = allIntegrations.map((int) => {
        const instanceHasPin = !!int.pin_hash;
        return {
          id: int.id,
          displayName: int.display_name || (int.config as any)?.instance_name || "Instância",
          hasPinHash: instanceHasPin || sectorHasPin, // Effective PIN protection
          useSectorPin: !instanceHasPin && sectorHasPin,
        };
      });

      setAvailableInstances(instances);
      setPendingOptions(options);
      setShowInstanceSelector(true);
      setLoading(false);
    } catch (error) {
      console.error("Error navigating to Zapp:", error);
      toast.error("Erro ao abrir conversa");
      setLoading(false);
    }
  }, [navigate, currentUser?.account_id, currentUser?.id, completeNavigation, navigateToInstance]);

  const handleInstanceSelect = useCallback(async (integrationId: string) => {
    if (!pendingOptions) return;
    
    setLoading(true);
    setShowInstanceSelector(false);
    
    // PIN já foi validado no ZappInstanceSelectorDialog (se necessário)
    // Navegar diretamente sem verificar PIN novamente
    const navigationUrl = buildNavigationUrl(integrationId, pendingOptions);
    completeNavigation(navigationUrl, pendingOptions.openInNewTab);
    
    setPendingOptions(null);
    setLoading(false);
  }, [pendingOptions, buildNavigationUrl, completeNavigation]);

  const handlePinSuccess = useCallback(() => {
    if (pendingNavigationUrl) {
      completeNavigation(pendingNavigationUrl, pendingOptions?.openInNewTab);
    }
    setShowPinDialog(false);
    setPendingIntegration(null);
    setPendingNavigationUrl(null);
    setPendingOptions(null);
  }, [pendingNavigationUrl, pendingOptions, completeNavigation]);

  const handlePinDialogClose = useCallback((open: boolean) => {
    if (!open) {
      setShowPinDialog(false);
      setPendingIntegration(null);
      setPendingNavigationUrl(null);
      setPendingSectorIdForPin(null);
    }
  }, []);

  const handleInstanceSelectorClose = useCallback((open: boolean) => {
    if (!open) {
      setShowInstanceSelector(false);
      setAvailableInstances([]);
      setPendingOptions(null);
    }
  }, []);

  // Render the PIN dialog component
  const PinDialog: ReactNode = showPinDialog && pendingIntegration ? (
    <ZappPinDialog
      open={showPinDialog}
      onOpenChange={handlePinDialogClose}
      sectorId={pendingSectorId || undefined}
      integrationId={pendingIntegration.useSectorPin ? undefined : pendingIntegration.id}
      instanceName={pendingIntegration.displayName}
      useSectorPin={pendingIntegration.useSectorPin}
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
      contactName={pendingOptions?.name}
    />
  ) : null;

  return { openZappConversation, loading, PinDialog, InstanceSelectorDialog };
}
