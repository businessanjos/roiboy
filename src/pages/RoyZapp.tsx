import { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions, PERMISSIONS } from "@/hooks/usePermissions";
import { useZappData, Message, TeamUser, InboundMessageData } from "@/hooks/useZappData";
import { useZappMessaging } from "@/hooks/useZappMessaging";
import { useZappNotifications } from "@/hooks/useZappNotifications";
import { useZappConversationActions } from "@/hooks/useZappConversationActions";
import { useZappCrudOperations } from "@/hooks/useZappCrudOperations";
import { useZappContactOperations } from "@/hooks/useZappContactOperations";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MeetingsPanel } from "@/components/sales/videocall/MeetingsPanel";
import { 
  ZappConversationPanel,
  ZappChatView,
  ZappCRMPanel,
  Agent,
  ZappTag,
  Department,
  ConversationAssignment,
} from "@/components/royzapp";
import { normalizeSearchText, normalizePhone, matchesSearchQuery } from "@/components/royzapp/types";
import { ZappSectorSelector } from "@/components/royzapp/ZappSectorSelector";
import { ZappWhatsAppAdminPanel } from "@/components/royzapp/ZappWhatsAppAdminPanel";
import { ZappMetaTemplatesDialog } from "@/components/royzapp/ZappMetaTemplatesDialog";

import {
  ZappDepartmentDialog,
  ZappAgentDialog,
  ZappTagDialog,
  
  
  ZappTransferDialog,
  ZappConversationTagDialog,
  ZappContactPickerDialog,
  ZappQuickRepliesDialog,
  ZappAddContactDialog,
  ZappNewConversationDialog,
  ZappCloseTicketDialog,
  ZappLinkClientDialog,
  ZappEditGroupDialog,
} from "@/components/royzapp/dialogs";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { SectorId, sectors } from "@/config/sectors";
import {
  MessageSquare,
  ArrowLeft,
  Loader2,
  X,
  Building2,
  RefreshCw,
  Briefcase,
} from "lucide-react";
import { useReloadPermissions } from "@/hooks/useReloadPermissions";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClientZappSheet } from "@/components/client/ClientZappSheet";
import { PlaybookDialog, MultiSendPayload } from "@/components/sales/PlaybookDialog";
import { usePlaybook, PlaybookItem } from "@/hooks/usePlaybook";
import { extractPlaybookVariables } from "@/lib/playbook-variables";
import { isManagementUser } from "@/lib/access/managementRoles";
import { resolveZappSectorRole, zappRoleCapabilities } from "@/lib/royZappRoles";
import { canPickSector, ZAPP_WHATSAPP_SECTORS } from "@/lib/royZappAccess";
import { useRoyZappViewAccess } from "@/hooks/useRoyZappViewAccess";
import { useZappConnectionAlerts } from "@/hooks/useZappConnectionAlerts";

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  triage: { label: "Triagem", color: "text-purple-600", bgColor: "bg-purple-500" },
  pending: { label: "Aguardando", color: "text-amber-600", bgColor: "bg-amber-500" },
  active: { label: "Em atendimento", color: "text-emerald-600", bgColor: "bg-emerald-500" },
  waiting: { label: "Aguardando cliente", color: "text-blue-600", bgColor: "bg-blue-500" },
  closed: { label: "Finalizado", color: "text-muted-foreground", bgColor: "bg-muted-foreground" },
};

import { ZAPP_VIEW_SET as ZAPP_VIEWS, type ZappView } from "@/lib/royZappRoutes";

export default function RoyZapp() {
  const { currentUser } = useCurrentUser();
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissions();
  const { hasVendasAccess, hasSectorAccess, sectorAccess, isLoading: sectorAccessLoading } = useSectorAccess();
  const {
    allowedViews,
    canSeeView,
    canOpenZappSector,
    loading: zappAccessLoading,
  } = useRoyZappViewAccess();

  const canChooseSector = canPickSector(currentUser?.email);
  const navigate = useNavigate();
  const { reload: reloadPermissions, reloading: reloadingPermissions } = useReloadPermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const replaceSearchParams = useCallback((update: (params: URLSearchParams) => void) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        update(next);
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);
  
  // Get sector and integrationId from URL if provided
  const sectorFromUrl = searchParams.get('sector') as SectorId | null;
  const integrationFromUrl = searchParams.get('integrationId');
  const viewFromUrl = searchParams.get('view');
  
  // Sector selection state - initialize from URL if provided
  const [selectedSectorId, setSelectedSectorId] = useState<SectorId | null>(sectorFromUrl);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | undefined>(integrationFromUrl || undefined);

  // Map of integration_id -> provider ('uazapi' | 'meta_official') for the account
  const [integrationProviders, setIntegrationProviders] = useState<Record<string, string>>({});
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);

  useEffect(() => {
    if (!currentUser?.account_id) return;
    (async () => {
      const { data } = await supabase
        .from("integrations")
        .select("id, config")
        .eq("account_id", currentUser.account_id)
        .eq("type", "whatsapp");
      const map: Record<string, string> = {};
      for (const row of data || []) {
        const cfg = (row as any).config || {};
        map[(row as any).id] = cfg.provider || "uazapi";
      }
      setIntegrationProviders(map);
    })();
  }, [currentUser?.account_id]);
  
  const [integrationResolving, setIntegrationResolving] = useState(() => Boolean(sectorFromUrl));
  const integrationResolutionRunRef = useRef(0);

  // Resolve and validate the WhatsApp instance in one atomic flow. This prevents
  // production flicker caused by loading data once without integrationId, then
  // immediately reloading after the preference/fallback instance is discovered.
  useEffect(() => {
    if (!selectedSectorId) {
      setIntegrationResolving(false);
      return;
    }

    if (!currentUser?.auth_user_id || !currentUser?.account_id) {
      setIntegrationResolving(true);
      return;
    }

    let cancelled = false;
    const runId = integrationResolutionRunRef.current + 1;
    integrationResolutionRunRef.current = runId;

    const resolveIntegration = async () => {
      setIntegrationResolving(true);
      try {
        if (selectedIntegrationId) {
          const { data: currentIntegration } = await supabase
            .from("integrations")
            .select("id, sector_id")
            .eq("id", selectedIntegrationId)
            .eq("account_id", currentUser.account_id)
            .maybeSingle();

          if (cancelled || integrationResolutionRunRef.current !== runId) return;

          if (currentIntegration?.sector_id === selectedSectorId) {
            replaceSearchParams((next) => {
              next.set("sector", selectedSectorId);
              next.set("integrationId", selectedIntegrationId);
            });
            setIntegrationResolving(false);
            return;
          }

          console.warn(
            `[RoyZapp] Ignoring integrationId ${selectedIntegrationId} — belongs to sector ${currentIntegration?.sector_id ?? "unknown"}, not ${selectedSectorId}.`
          );
        }

        const { data: preference } = await supabase
          .from("user_instance_preferences")
          .select("integration_id")
          .eq("user_id", currentUser.auth_user_id)
          .eq("sector_id", selectedSectorId)
          .maybeSingle();
        if (cancelled || integrationResolutionRunRef.current !== runId) return;

        let resolvedIntegrationId: string | undefined;

        if (preference?.integration_id) {
          const { data: prefIntegration } = await supabase
            .from("integrations")
            .select("id, sector_id")
            .eq("id", preference.integration_id)
            .eq("account_id", currentUser.account_id)
            .maybeSingle();

          if (cancelled || integrationResolutionRunRef.current !== runId) return;

          if (prefIntegration?.sector_id === selectedSectorId) {
            resolvedIntegrationId = preference.integration_id;
          } else {
            console.warn(
              `[RoyZapp] Ignoring stale preference ${preference.integration_id} ` +
              `(belongs to sector ${prefIntegration?.sector_id ?? "unknown"}, current sector is ${selectedSectorId}).`
            );
          }
        }

        if (!resolvedIntegrationId) {
          const { data: integrations } = await supabase
            .from("integrations")
            .select("id")
            .eq("account_id", currentUser.account_id)
            .eq("sector_id", selectedSectorId)
            .eq("status", "connected")
            .order("created_at", { ascending: true })
            .limit(1);

          if (cancelled || integrationResolutionRunRef.current !== runId) return;

          resolvedIntegrationId = integrations?.[0]?.id;
        }

        setSelectedIntegrationId((prev) => (prev === resolvedIntegrationId ? prev : resolvedIntegrationId));
        replaceSearchParams((next) => {
          next.set("sector", selectedSectorId);
          if (resolvedIntegrationId) next.set("integrationId", resolvedIntegrationId);
          else next.delete("integrationId");
        });

        if (!resolvedIntegrationId) {
          console.log(`[RoyZapp] No integrations found for sector ${selectedSectorId}`);
        }
      } catch (error) {
        console.error("[RoyZapp] Error fetching instance preference:", error);
      } finally {
        if (!cancelled && integrationResolutionRunRef.current === runId) {
          setIntegrationResolving(false);
        }
      }
    };

    resolveIntegration();

    return () => {
      cancelled = true;
    };
  }, [selectedSectorId, selectedIntegrationId, currentUser?.auth_user_id, currentUser?.account_id, replaceSearchParams]);

  const generalSectorIdsForLoad = useMemo(() => new Set(sectorAccess.map((a) => a.sector_id)), [sectorAccess]);
  const selectedSectorAllowed = selectedSectorId
    ? canChooseSector || canOpenZappSector(selectedSectorId, generalSectorIdsForLoad.has(selectedSectorId))
    : false;
  const canLoadZappData =
    !!selectedSectorId &&
    selectedSectorAllowed &&
    !sectorAccessLoading &&
    !zappAccessLoading &&
    !integrationResolving;
  
  // Use centralized data hook with sector filtering
  const {
    departments,
    tags,
    agents,
    teamUsers,
    allClients,
    assignments,
    setAssignments,
    noteConversationBump,
    messages,
    loading,
    initialDataLoaded,
    availableProducts,
    clientProducts,
    clientResponsibles,
    convToClientId,
    leadDealStages,
    currentAgent,
    hasGlobalVisibility,
    whatsappConnected,
    whatsappConnecting,
    whatsappInstanceName,
    toggleWhatsAppConnection,
    fetchData,
    fetchMessages,
    loadOlderMessages,
    hasMoreMessages,
    isLoadingOlderMessages,
    isLoadingMessages,

    setMessages,
  } = useZappData({
    sectorId: selectedSectorId || undefined,
    integrationId: selectedIntegrationId,
    enabled: canLoadZappData,
  });

  // Messaging hook is initialized below after state declarations

  // Get current sector info
  const currentSector = useMemo(() => {
    if (!selectedSectorId) return null;
    return sectors.find(s => s.id === selectedSectorId);
  }, [selectedSectorId]);

  // Papel efetivo do usuário DENTRO do WhatsApp deste setor (admin/manager/member/viewer)
  const zappRole = useMemo(
    () =>
      resolveZappSectorRole({
        isAccountAdmin: isAdmin || currentUser?.is_also_admin === true,
        isManagement: isManagementUser(currentUser),
        sectorId: selectedSectorId,
        sectorAccess,
      }),
    [isAdmin, currentUser, selectedSectorId, sectorAccess]
  );
  const zappCaps = useMemo(() => {
    const base = zappRoleCapabilities(zappRole);
    // O toggle "Acesso global" (zapp_agents.has_global_access) libera enxergar e
    // puxar QUALQUER conversa do setor, mesmo para quem é apenas "member".
    // Viewer continua somente leitura.
    if (hasGlobalVisibility && zappRole !== "viewer") {
      return { ...base, canSeeAllSectorConversations: true, canClaim: true };
    }
    return base;
  }, [zappRole, hasGlobalVisibility]);



  // Get the department for the current sector (for creating new assignments)
  // CRITICAL FIX: Must match by sector_id to prevent cross-sector leakage
  const currentSectorDepartmentId = useMemo(() => {
    if (!departments || departments.length === 0 || !selectedSectorId) return null;
    // Find the specific department that belongs to this sector
    const sectorDept = departments.find(d => d.sector_id === selectedSectorId);
    return sectorDept?.id || null;
  }, [departments, selectedSectorId]);

  // UI state
  const ZAPP_VIEW_STORAGE_KEY = "royzapp:activeView";
  const [activeView, setActiveView] = useState<ZappView>(() => {
    if (ZAPP_VIEWS.has(viewFromUrl as ZappView)) return viewFromUrl as ZappView;
    // No celular o app sempre abre nas Conversas: restaurar a última view
    // (ex.: Departamentos) fazia a tela "passar" por outra antes do inbox.
    const isNarrow = typeof window !== "undefined" && window.innerWidth < 1024;
    if (isNarrow) return "inbox";
    try {
      const stored = localStorage.getItem(ZAPP_VIEW_STORAGE_KEY);
      if (stored && ZAPP_VIEWS.has(stored as ZappView)) return stored as ZappView;
    } catch {
      /* storage unavailable */
    }
    return "inbox";
  });

  // Gate: se o admin não liberou a tela atual, volta para Conversas.
  // Só roda depois que as permissões carregaram — senão a tela oscila entre
  // Conversas e a view clicada enquanto a query resolve.
  useEffect(() => {
    if (zappAccessLoading) return;
    if (allowedViews.length === 0) return;
    if (!allowedViews.includes(activeView)) setActiveView("inbox");
  }, [activeView, allowedViews, zappAccessLoading]);


  // Alerta automático: linha de WhatsApp do setor fora do ar → toast com ação de reconectar.
  useZappConnectionAlerts({
    enabled: !zappAccessLoading && !sectorAccessLoading && !!currentUser?.account_id,
    onReconnect: (sectorId, integrationId) => {
      setSelectedSectorId(sectorId as SectorId);
      setSelectedIntegrationId(integrationId);
      setActiveView("inbox");
      replaceSearchParams((next) => {
        next.set("sector", sectorId);
        next.set("integrationId", integrationId);
        next.set("view", "inbox");
      });
    },
  });



  // Auto-entrada no setor liberado (todos, exceto quem pode escolher setor).
  useEffect(() => {
    if (canChooseSector || selectedSectorId || sectorAccessLoading || zappAccessLoading) return;
    const generalSectors = new Set(sectorAccess.map((a) => a.sector_id));
    const target = (ZAPP_WHATSAPP_SECTORS as readonly SectorId[]).find((id) =>
      canOpenZappSector(id, generalSectors.has(id))
    );
    if (target) setSelectedSectorId(target);
  }, [canChooseSector, selectedSectorId, sectorAccessLoading, zappAccessLoading, sectorAccess, canOpenZappSector]);

  // Guarda: o parâmetro ?sector= da URL (sidebar, atalhos, links salvos) NÃO é
  // confiável. Se o setor pedido não estiver liberado no ROY zAPP para o
  // usuário, trocamos pelo primeiro setor realmente permitido — evita, por
  // exemplo, alguém do Comercial cair no WhatsApp de Customer Success.
  useEffect(() => {
    if (canChooseSector || !selectedSectorId || sectorAccessLoading || zappAccessLoading) return;
    const generalSectors = new Set(sectorAccess.map((a) => a.sector_id));
    if (canOpenZappSector(selectedSectorId, generalSectors.has(selectedSectorId))) return;
    const fallback = (ZAPP_WHATSAPP_SECTORS as readonly SectorId[]).find((id) =>
      canOpenZappSector(id, generalSectors.has(id))
    );
    console.warn(
      `[RoyZapp] Setor "${selectedSectorId}" não liberado para este usuário — redirecionando para "${fallback ?? "nenhum"}".`
    );
    setSelectedSectorId(fallback ?? null);
    setSelectedIntegrationId(undefined);
    replaceSearchParams((next) => {
      next.delete("integrationId");
      if (fallback) next.set("sector", fallback);
      else next.delete("sector");
    });
  }, [
    canChooseSector,
    selectedSectorId,
    sectorAccessLoading,
    zappAccessLoading,
    sectorAccess,
    canOpenZappSector,
    replaceSearchParams,
  ]);



  // URL -> estado. Importante: só aceita uma mudança real do parâmetro na URL.
  // Ao clicar em uma aba, o estado muda antes da URL; sem esse guard, o efeito
  // lia o parâmetro antigo e jogava a tela de volta para Conversas, causando o
  // piscar/oscilação entre abas.
  const lastHandledViewParamRef = useRef<string | null>(null);
  useEffect(() => {
    if (viewFromUrl === lastHandledViewParamRef.current) return;
    lastHandledViewParamRef.current = viewFromUrl;
    if (!viewFromUrl) return;
    if (ZAPP_VIEWS.has(viewFromUrl as ZappView)) {
      setActiveView((prev) => (prev === viewFromUrl ? prev : (viewFromUrl as ZappView)));
    } else {
      // View desconhecida na URL — limpa o parâmetro.
      replaceSearchParams((next) => next.delete("view"));
    }
  }, [viewFromUrl, replaceSearchParams]);

  // Estado -> URL + localStorage, para sobreviver a refresh e navegação.
  useEffect(() => {
    try {
      localStorage.setItem(ZAPP_VIEW_STORAGE_KEY, activeView);
    } catch {
      /* storage unavailable */
    }
    if (viewFromUrl !== activeView) {
      lastHandledViewParamRef.current = activeView;
      replaceSearchParams((next) => next.set("view", activeView));
    }
  }, [activeView, viewFromUrl, replaceSearchParams]);

  // Troca de menu: estado e URL sempre juntos, na mesma ação do usuário.
  const changeView = useCallback((view: ZappView) => {
    lastHandledViewParamRef.current = view;
    setActiveView(view);
    replaceSearchParams((next) => next.set("view", view));
  }, [replaceSearchParams]);



  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterConversationType, setFilterConversationType] = useState<"all" | "individual" | "group">(() =>
    sectorFromUrl === "vendas" ? "individual" : "all"
  );
  const [filterArchived, setFilterArchived] = useState(false);
  const [filterProductId, setFilterProductId] = useState<string>("all");
  const [filterTagId, setFilterTagId] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    try {
      return localStorage.getItem("royzapp:filterTagId") || "all";
    } catch {
      return "all";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("royzapp:filterTagId", filterTagId);
    } catch {
      // ignore quota / privacy mode errors
    }
  }, [filterTagId]);
  const [filterAgentId, setFilterAgentId] = useState<string>("all");
  const [forceCrmView, setForceCrmView] = useState(false);
  const isCrmSectorView =
    activeView === "sector" &&
    (selectedSectorId === "vendas" || currentUser?.role === "mentor" || forceCrmView);
  const isMeetingsView = activeView === "meetings";
  const [crmCreateDealTick, setCrmCreateDealTick] = useState(0);
  // Confirmação exibida quando a conversa ainda não tem lead/cliente vinculado:
  // o lead será criado com o nome/telefone da conversa.
  const [confirmCreateDealOpen, setConfirmCreateDealOpen] = useState(false);

  useEffect(() => {
    if (activeView !== "sector") setForceCrmView(false);
  }, [activeView]);
  const keepsConversationSelection = activeView === "inbox" || isCrmSectorView || isMeetingsView;
  const [selectedConversation, setSelectedConversation] = useState<ConversationAssignment | null>(null);

  // Remember the last selected conversation so navigating away (and back) to CRM/Inbox restores it
  const lastSelectedAssignmentIdRef = useRef<string | null>(null);
  const selectionStorageKey = useMemo(
    () => `royzapp:lastConversation:${selectedSectorId || "default"}:${selectedIntegrationId || "all"}`,
    [selectedSectorId, selectedIntegrationId]
  );

  // Em telas estreitas (< lg) o chat ocupa a tela toda: restaurar a conversa
  // automaticamente prenderia o usuário dentro dela ao voltar.
  const isNarrowScreen = useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia("(max-width: 1023px)");
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(max-width: 1023px)").matches,
    () => false
  );

  // Quando o usuário fecha a conversa manualmente, não restaurar de novo.
  const suppressRestoreRef = useRef(false);

  const closeConversation = useCallback(() => {
    suppressRestoreRef.current = true;
    lastSelectedAssignmentIdRef.current = null;
    try {
      localStorage.removeItem(selectionStorageKey);
    } catch {
      // ignore
    }
    setSelectedConversation(null);
  }, [selectionStorageKey]);

  useEffect(() => {
    if (selectedConversation?.id) {
      suppressRestoreRef.current = false;
      lastSelectedAssignmentIdRef.current = selectedConversation.id;
      try {
        localStorage.setItem(selectionStorageKey, selectedConversation.id);
      } catch {
        // ignore quota / privacy mode errors
      }
    }
  }, [selectedConversation?.id, selectionStorageKey]);

  useEffect(() => {
    if (!keepsConversationSelection && selectedConversation) {
      setSelectedConversation(null);
    }
  }, [keepsConversationSelection, selectedConversation]);

  // Reapply the remembered conversation when returning to a view that shows the list
  useEffect(() => {
    if (isNarrowScreen || suppressRestoreRef.current) return;
    if (!keepsConversationSelection || selectedConversation) return;
    if (!assignments.length) return;

    let rememberedId = lastSelectedAssignmentIdRef.current;
    if (!rememberedId) {
      try {
        rememberedId = localStorage.getItem(selectionStorageKey);
      } catch {
        rememberedId = null;
      }
    }
    if (!rememberedId) return;

    const remembered = assignments.find((a) => a.id === rememberedId);
    if (remembered) {
      setSelectedConversation(remembered);
    }
  }, [isNarrowScreen, keepsConversationSelection, selectedConversation, assignments, selectionStorageKey]);

  // Keep the open chat synced with the latest assignment object from the list
  useEffect(() => {
    if (!selectedConversation) return;

    const updatedAssignment = assignments.find((a) => a.id === selectedConversation.id);
    if (!updatedAssignment) return;

    if (updatedAssignment !== selectedConversation) {
      setSelectedConversation(updatedAssignment);
    }
  }, [assignments, selectedConversation]);


  // Detect when selected conversation is not in current assignments list
  // For MULTI-INSTANCE architecture: each instance has its own conversation with the same contact
  // GROUPS: handled differently - they persist until user clicks "Dispensar"
  useEffect(() => {
    if (!selectedConversation || !currentUser?.account_id) return;
    
    // Check if conversation exists in current assignments list
    const existsInCurrentList = assignments.some(
      a => a.id === selectedConversation.id
    );
    
    if (existsInCurrentList) return; // Already in list, nothing to do
    
    // For groups, don't auto-clear (multi-sector support)
    const isGroup = selectedConversation.zapp_conversation?.is_group;
    if (isGroup) return;
    
    // For individual contacts, check if it belongs to the CURRENT INTEGRATION
    // Each instance can have its own conversation with the same contact
    const conversationIntegrationId = (selectedConversation.zapp_conversation as any)?.integration_id;
    
    if (conversationIntegrationId === selectedIntegrationId) {
      // Same integration - this is our conversation, allow it
      console.log("[RoyZapp] Individual conversation from current integration - allowing");
      return;
    }
    
    // Different integration - this shouldn't happen normally since we filter by integration
    // But if it does, just log it without blocking (createConversationWithContact will handle it)
    console.log("[RoyZapp] Individual conversation from different integration - allowing creation", {
      selectedId: selectedConversation.id,
      conversationIntegrationId,
      selectedIntegrationId,
    });
    // Don't clear selection - let createConversationWithContact create the correct one
  }, [selectedConversation, assignments, selectedIntegrationId, currentUser?.account_id]);
  // dismissGroupConversation is now in convActions hook

  // URL params processing is done below after contactOps hook is initialized
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);
  
  // Messaging state is now managed by useZappMessaging hook (messaging.*)
  const [inboxTab, setInboxTab] = useState<"mine" | "queue">("mine");
  
  // User signature state (persisted to database)
  const [userSignature, setUserSignature] = useState("");
  const [signatureEnabled, setSignatureEnabled] = useState(false);
  
  // Sync signature state from currentUser when it loads
  useEffect(() => {
    if (currentUser) {
      setUserSignature(currentUser.zapp_signature || "");
      setSignatureEnabled(currentUser.zapp_signature_enabled || false);
      
      // Migrate from localStorage if exists and database is empty
      const localSignature = localStorage.getItem("zapp_signature");
      const localEnabled = localStorage.getItem("zapp_signatureEnabled");
      
      if (localSignature && !currentUser.zapp_signature) {
        // Migrate to database
        supabase
          .from("users")
          .update({ 
            zapp_signature: localSignature, 
            zapp_signature_enabled: localEnabled === "true" 
          })
          .eq("id", currentUser.id)
          .then(() => {
            setUserSignature(localSignature);
            setSignatureEnabled(localEnabled === "true");
            // Clear localStorage after migration
            localStorage.removeItem("zapp_signature");
            localStorage.removeItem("zapp_signatureEnabled");
          });
      }
    }
  }, [currentUser]);
  // Distribution settings state (persisted to localStorage)
  const [roundRobinEnabled, setRoundRobinEnabled] = useState(() => {
    const saved = localStorage.getItem("zapp_roundRobin");
    return saved !== null ? saved === "true" : true;
  });
  const [respectLimitEnabled, setRespectLimitEnabled] = useState(() => {
    const saved = localStorage.getItem("zapp_respectLimit");
    return saved !== null ? saved === "true" : true;
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem("zapp_sound");
    return saved !== null ? saved === "true" : true;
  });
  
  // AI Assistant settings (persisted to localStorage)
  const [spellingEnabled, setSpellingEnabled] = useState(() => {
    const saved = localStorage.getItem("zapp_spelling_enabled");
    return saved !== null ? saved === "true" : true;
  });
  
  // Callback to update local assignment state when a message is sent
  const handleConversationUpdated = useCallback((conversationId: string, lastMessageAt: string, lastMessagePreview: string) => {
    // Registra no high-water mark + reordena a lista imediatamente (mensagem enviada
    // por nós conta como "mais recente" igual às recebidas).
    noteConversationBump(conversationId, lastMessageAt, lastMessagePreview);

    setAssignments(prev => prev.map(a => {
      if (a.zapp_conversation_id === conversationId || a.zapp_conversation?.id === conversationId) {
        return {
          ...a,
          zapp_conversation: a.zapp_conversation ? {
            ...a.zapp_conversation,
            last_message_at: lastMessageAt,
            last_message_preview: lastMessagePreview,
            unread_count: 0,
          } : a.zapp_conversation,
        };
      }
      return a;
    }));

    setSelectedConversation(prev => {
      if (!prev) return prev;

      const isSameConversation = prev.zapp_conversation_id === conversationId || prev.zapp_conversation?.id === conversationId;
      if (!isSameConversation) return prev;

      return {
        ...prev,
        zapp_conversation: prev.zapp_conversation ? {
          ...prev.zapp_conversation,
          last_message_at: lastMessageAt,
          last_message_preview: lastMessagePreview,
          unread_count: 0,
        } : prev.zapp_conversation,
      };
    });
  }, [setAssignments, noteConversationBump]);

  // Messaging hook - handles send, recording, media, quick replies, etc.
  const messaging = useZappMessaging({
    selectedConversation,
    currentUser,
    selectedSectorId,
    selectedIntegrationId,
    messages,
    setMessages,
    fetchMessages,
    userSignature,
    signatureEnabled,
    navigate,
    onConversationUpdated: handleConversationUpdated,
  });

  // CRUD operations hook (departments, agents, tags)
  const crud = useZappCrudOperations({
    userId: currentUser?.id,
    accountId: currentUser?.account_id,
    departments,
    tags,
    fetchData,
    canEditTags: zappCaps.canEditTags,
  });

  // Conversation actions hook (assign, release, transfer, delete, flags)
  const convActions = useZappConversationActions({
    currentAgent,
    assignments,
    selectedConversation,
    filterStatus,
    isAdmin,
    agents,
    setAssignments,
    setSelectedConversation,
    setInboxTab,
    setFilterStatus,
    fetchData,
    markAsRead: (conversationId: string) => {
      // Inline markAsRead for the hook - same logic
      supabase
        .from("zapp_conversations")
        .update({ unread_count: 0 })
        .eq("id", conversationId)
        .then();
      setAssignments(prev => prev.map(a => 
        a.zapp_conversation?.id === conversationId 
          ? { ...a, zapp_conversation: { ...a.zapp_conversation!, unread_count: 0 } }
          : a
      ));
    },
    getAgentName: (agentId: string | null) => {
      if (!agentId) return null;
      const agent = agents.find(a => a.id === agentId);
      return agent?.user?.name || null;
    },
  });

  const handleNotificationViewChat = useCallback((conversationId: string) => {
    const assignment = assignments.find(
      a => a.zapp_conversation_id === conversationId || a.zapp_conversation?.id === conversationId
    );
    if (assignment) {
      // Bloqueio: conversa atribuída a outro atendente
      if (assignment.agent_id && currentAgent?.id && assignment.agent_id !== currentAgent.id) {
        const agent = agents.find(a => a.id === assignment.agent_id);
        const name = agent?.user?.name || "outro atendente";
        toast.warning(`Esta conversa está atribuída a ${name}.`, {
          description: "Peça a transferência para conseguir abrir.",
        });
        return;
      }
      setSelectedConversation(assignment);
      setInboxTab(assignment.agent_id === currentAgent?.id ? "mine" : "queue");
      return;
    }
    // Não está na lista atual — deixa o efeito de URL processar (ele troca setor/instância)
    replaceSearchParams((next) => next.set("conversation", conversationId));
    setUrlParamsProcessed(false);
  }, [assignments, currentAgent?.id, agents, replaceSearchParams]);

  // Notification hook
  const { 
    notifyNewMessage, 
    notificationPermission, 
    requestNotificationPermission 
  } = useZappNotifications({
    soundEnabled,
    currentAgentId: currentAgent?.id,
    selectedConversationId: selectedConversation?.zapp_conversation_id || selectedConversation?.zapp_conversation?.id,
    onViewChat: handleNotificationViewChat,
  });

  // Realtime subscription for notifications (all inbound messages in sector)
  useEffect(() => {
    if (!currentUser?.account_id || !selectedSectorId) return;

    const notificationChannel = supabase
      .channel(`zapp-notifications-${selectedSectorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'zapp_messages',
          filter: `account_id=eq.${currentUser.account_id}`
        },
        (payload) => {
          const newMsg = payload.new as any;
          
          // Only notify for inbound messages
          if (newMsg?.direction !== 'inbound') return;
          
          // Find the conversation in assignments
          const conversationId = newMsg.zapp_conversation_id;
          const assignment = assignments.find(
            a => a.zapp_conversation_id === conversationId || a.zapp_conversation?.id === conversationId
          );
          
          if (assignment) {
            const contactName = assignment.zapp_conversation?.contact_name 
              || assignment.zapp_conversation?.client?.full_name 
              || assignment.zapp_conversation?.lead?.full_name 
              || assignment.zapp_conversation?.phone_e164 
              || "Contato";
            
            const messagePreview = newMsg.content 
              || (newMsg.message_type === 'audio' ? '🎤 Áudio' : '')
              || (newMsg.message_type === 'image' ? '📷 Imagem' : '')
              || (newMsg.message_type === 'video' ? '🎥 Vídeo' : '')
              || (newMsg.message_type === 'document' ? '📄 Documento' : '')
              || 'Nova mensagem';
            
            notifyNewMessage({
              conversationId,
              contactName,
              messagePreview,
              avatarUrl: assignment.zapp_conversation?.avatar_url,
              agentId: assignment.agent_id,
              isGroup: assignment.zapp_conversation?.is_group || false,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
    };
  }, [currentUser?.account_id, selectedSectorId, assignments, notifyNewMessage]);

  // Import conversations state
  const [importingConversations, setImportingConversations] = useState(false);
  const [importLimit, setImportLimit] = useState("50");
  
  // Refresh messages state
  const [isRefreshingMessages, setIsRefreshingMessages] = useState(false);

  // Transfer dialog
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<{ type: "agent" | "department"; id: string }>({ type: "agent", id: "" });
  
  // Client quick edit sheet
  const [clientEditSheetOpen, setClientEditSheetOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);


  // Contact picker and quick replies state are now in useZappMessaging hook (messaging.*)

  // Contact state is now in contactOps hook


  // Playbook dialog state for chat
  const [playbookDialogOpen, setPlaybookDialogOpen] = useState(false);
  const [multiSendInProgress, setMultiSendInProgress] = useState(false);

  // Monta o texto de itens que viram mensagem de texto (texto, link, lista, template)
  const buildPlaybookText = useCallback((item: PlaybookItem, processedText?: string): string => {
    const parts: string[] = [];
    const base = (processedText ?? item.text_content ?? "").trim();
    if (item.content_type === 'link') {
      const title = (item.link_title || "").trim();
      const desc = (item.link_description || "").trim();
      const url = (item.link_url || item.media_url || "").trim();
      if (title) parts.push(title);
      if (desc) parts.push(desc);
      if (base) parts.push(base);
      if (url) parts.push(url);
      return parts.join("\n").trim();
    }
    return base;
  }, []);

  // Helper to send a single playbook item
  const sendSinglePlaybookItem = useCallback(async (item: PlaybookItem, processedText?: string) => {
    const textPayload = buildPlaybookText(item, processedText);
    if (['text', 'link', 'list', 'template'].includes(item.content_type) && textPayload) {
      messaging.setMessageInput(textPayload);
      // Wait a tick for state to update, then trigger send
      await new Promise(resolve => setTimeout(resolve, 100));
      await messaging.sendMessage();
    } else if (item.content_type === 'image' && item.media_url) {
      const response = await fetch(item.media_url);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const fileName = item.name || 'playbook-image.jpg';
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
      await messaging.sendMediaMessage(file, 'image', item.media_caption || undefined);
    } else if (item.content_type === 'audio' && item.media_url) {
      const response = await fetch(item.media_url);
      if (!response.ok) throw new Error('Failed to fetch audio');
      const blob = await response.blob();
      await messaging.sendMediaMessage(new File([blob], 'audio.webm', { type: blob.type || 'audio/webm' }), 'document');
    } else if ((item.content_type === 'video' || item.content_type === 'document') && item.media_url) {
      const response = await fetch(item.media_url);
      if (!response.ok) throw new Error(`Failed to fetch ${item.content_type}`);
      const blob = await response.blob();
      const fileName = item.media_filename || item.name || `playbook-file`;
      const mimeType = blob.type || (item.content_type === 'video' ? 'video/mp4' : 'application/octet-stream');
      const file = new File([blob], fileName, { type: mimeType });
      await messaging.sendMediaMessage(file, item.content_type === 'video' ? 'video' : 'document', item.media_caption || undefined);
    } else if (item.media_url) {
      navigator.clipboard.writeText(item.media_url);
      toast.info("Item copiado para a área de transferência (sem conteúdo enviável).");
    } else {
      toast.error("Item do playbook sem conteúdo para enviar.");
      throw new Error('Playbook item has no sendable content');
    }
  }, [messaging, buildPlaybookText]);

  // Multi-send handler
  const handleMultiSend = useCallback(async (payload: MultiSendPayload) => {
    const { items: sendItems, processedTexts, delaySeconds } = payload;
    setMultiSendInProgress(true);
    const toastId = toast.loading(`Enviando 1/${sendItems.length} itens...`);
    
    try {
      for (let i = 0; i < sendItems.length; i++) {
        const item = sendItems[i];
        const processedText = processedTexts[i];
        
        toast.loading(`Enviando ${i + 1}/${sendItems.length}: ${item.name}`, { id: toastId });
        
        try {
          await sendSinglePlaybookItem(item, processedText);
        } catch (error) {
          console.error(`Error sending playbook item ${item.name}:`, error);
          toast.error(`Erro ao enviar: ${item.name}`);
        }
        
        // Wait delay between items (except after the last one)
        if (i < sendItems.length - 1) {
          for (let s = delaySeconds; s > 0; s--) {
            toast.loading(`Enviado ${i + 1}/${sendItems.length}. Próximo em ${s}s...`, { id: toastId });
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      toast.success(`${sendItems.length} itens enviados com sucesso!`, { id: toastId });
    } catch (error) {
      toast.error('Erro no envio múltiplo', { id: toastId });
    } finally {
      setMultiSendInProgress(false);
    }
  }, [sendSinglePlaybookItem]);
  
  // Close ticket dialog state
  const [closeTicketDialogOpen, setCloseTicketDialogOpen] = useState(false);
  
  // Link client dialog state
  const [linkClientDialogOpen, setLinkClientDialogOpen] = useState(false);
  
  // Edit group dialog state
  const [editGroupDialogOpen, setEditGroupDialogOpen] = useState(false);
  
  // Permanent delete conversation dialog state
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);

  // Message fetching and realtime are now handled by useZappMessaging hook

  // Department, Agent, Tag CRUD functions are now in crud hook (useZappCrudOperations)

  // Conversation actions (assign, release, status, delete, flags, read/unread) are now in convActions hook

  // Helper to get contact info from assignment
  const getContactInfo = useCallback((assignment: ConversationAssignment) => {
    const zc = assignment.zapp_conversation;
    const c = assignment.conversation?.client;
    const name = zc?.is_group 
      ? (zc?.contact_name || "Grupo sem nome")
      : (zc?.client?.full_name || zc?.lead?.full_name || zc?.contact_name || c?.full_name || zc?.phone_e164 || "Desconhecido");
    const phone = zc?.phone_e164 || c?.phone_e164 || "";
    const searchableText = normalizeSearchText([
      zc?.client?.full_name, zc?.lead?.full_name, zc?.contact_name, c?.full_name, phone, zc?.last_message_preview,
    ].filter(Boolean).join(" "));
    return {
      name, phone,
      avatar: zc?.client?.avatar_url || zc?.avatar_url || c?.avatar_url || null,
      clientId: zc?.client_id || c?.id || null,
      isClient: !!(zc?.client_id || c?.id),
      isGroup: zc?.is_group || false,
      lastMessage: zc?.last_message_preview || null,
      lastMessagePreview: zc?.last_message_preview || "",
      unreadCount: zc?.unread_count || 0,
      lastMessageAt: zc?.last_message_at || assignment.updated_at,
      isPinned: zc?.is_pinned || false,
      isMuted: zc?.is_muted || false,
      isArchived: zc?.is_archived || false,
      isFavorite: zc?.is_favorite || false,
      isBlocked: zc?.is_blocked || false,
      searchableText,
    };
  }, []);

  // Contact operations hook (create conversations, search contacts, save client/lead)
  const contactOps = useZappContactOperations({
    currentUser,
    isAdmin,
    currentAgent,
    agents,
    selectedConversation,
    selectedSectorId,
    selectedIntegrationId,
    currentSectorDepartmentId,
    hasVendasAccess,
    setAssignments,
    setSelectedConversation,
    setInboxTab,
    setFilterConversationType,
    fetchData,
    fetchMessages,
    getContactInfo,
  });

  // Ref para garantir que o lookup async da conversa alvo rode só uma vez
  const conversationLookupRef = useRef<string | null>(null);

  // Handle URL parameters for auto-selecting or creating conversations
  useEffect(() => {
    if (urlParamsProcessed || loading || !currentUser?.account_id) return;
    
    const conversationId = searchParams.get('conversation');
    const newPhone = searchParams.get('newPhone');
    const newName = searchParams.get('newName');
    const leadId = searchParams.get('leadId');
    const clientId = searchParams.get('clientId');
    
    if (conversationId) {
      // 1. Tenta encontrar na lista atual
      const assignment = assignments.find(
        a => a.zapp_conversation_id === conversationId || a.zapp_conversation?.id === conversationId
      );
      if (assignment) {
        // Bloqueio: atribuída a outro atendente
        if (assignment.agent_id && currentAgent?.id && assignment.agent_id !== currentAgent.id) {
          const agent = agents.find(a => a.id === assignment.agent_id);
          const name = agent?.user?.name || "outro atendente";
          toast.warning(`Esta conversa está atribuída a ${name}.`, {
            description: "Peça a transferência para conseguir abrir.",
          });
          replaceSearchParams((next) => next.delete('conversation'));
          setUrlParamsProcessed(true);
          return;
        }
        setSelectedConversation(assignment);
        setInboxTab(assignment.agent_id === currentAgent?.id ? "mine" : "queue");
        replaceSearchParams((next) => next.delete('conversation'));
        setUrlParamsProcessed(true);
        return;
      }
      
      // 2. Não está na lista — busca metadados no DB (apenas uma vez por id)
      if (conversationLookupRef.current !== conversationId && currentAgent?.id) {
        conversationLookupRef.current = conversationId;
        (async () => {
          const { data, error } = await supabase
            .from("zapp_conversation_assignments")
            .select("agent_id, zapp_conversation:zapp_conversations!inner(sector_id, integration_id)")
            .eq("zapp_conversation_id", conversationId)
            .maybeSingle();
          
          if (error || !data) {
            toast.error("Conversa não encontrada.");
            replaceSearchParams((next) => next.delete('conversation'));
            setUrlParamsProcessed(true);
            return;
          }
          
          // Atribuída a outro? Avisa e não abre.
          if (data.agent_id && data.agent_id !== currentAgent.id) {
            const { data: agentRow } = await supabase
              .from("zapp_agents")
              .select("user:users(name)")
              .eq("id", data.agent_id)
              .maybeSingle();
            const name = (agentRow as any)?.user?.name || "outro atendente";
            toast.warning(`Esta conversa está atribuída a ${name}.`, {
              description: "Peça a transferência para conseguir abrir.",
            });
            replaceSearchParams((next) => next.delete('conversation'));
            setUrlParamsProcessed(true);
            return;
          }
          
          // Fila (ou sua) — troca setor/instância pra carregar a conversa
          const convSector = (data.zapp_conversation as any)?.sector_id as SectorId | undefined;
          const convIntegration = (data.zapp_conversation as any)?.integration_id as string | undefined;
          let switched = false;
          if (convSector && convSector !== selectedSectorId) {
            setSelectedSectorId(convSector);
            switched = true;
          }
          if (convIntegration && convIntegration !== selectedIntegrationId) {
            setSelectedIntegrationId(convIntegration);
            switched = true;
          }
          if (!switched) {
            toast.info("Conversa não visível no filtro atual. Ajuste os filtros para encontrá-la.");
            replaceSearchParams((next) => next.delete('conversation'));
            setUrlParamsProcessed(true);
          }
          // Se trocou contexto, o efeito re-executa quando os assignments recarregarem
        })();
      }
      return;
    }
    
    if (newPhone && currentAgent && !conversationId) {
      setUrlParamsProcessed(true);
      const contact = {
        id: leadId || clientId || '',
        full_name: decodeURIComponent(newName || ''),
        phone_e164: `+${newPhone}`,
        avatar_url: null,
      };
      if (leadId || clientId) {
        contactOps.createConversationFromUrl(contact, !!leadId);
      }
    }
  }, [assignments, loading, currentUser?.account_id, currentAgent, agents, searchParams, urlParamsProcessed, contactOps, selectedSectorId, selectedIntegrationId, replaceSearchParams]);

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return null;
    const agent = agents.find(a => a.id === agentId);
    return agent?.user?.name || null;
  };

  // All messaging functions (send, media, audio, delete, edit, contact, quick replies, formatting)
  // are now handled by the useZappMessaging hook (messaging.*)
  // Filter users not already agents — only commercial team members
  const COMMERCIAL_NAMES = ["jonathan", "darlan", "george", "vanessa"];
  const availableUsers = teamUsers.filter(
    (user) => {
      const isCommercial = COMMERCIAL_NAMES.some(name => user.name.toLowerCase().includes(name));
      const isNotAlreadyAgent = !agents.some((agent) => agent.user_id === user.id) || crud.editingAgent?.user_id === user.id;
      return isCommercial && isNotAlreadyAgent;
    }
  );

  // currentAgent is now provided by useZappData hook

  // Import recent conversations from WhatsApp
  const importRecentConversations = async () => {
    if (!currentUser?.account_id) return;
    
    setImportingConversations(true);
    try {
      const limit = parseInt(importLimit) || 50;
      
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "import-conversations",
          limit: limit,
          sector_id: selectedSectorId, // Import for current sector
        },
      });

      if (response.error) throw new Error(response.error.message);
      
      const result = response.data;
      const imported = result?.imported || 0;
      const skipped = result?.skipped || 0;
      
      toast.success(`Importadas ${imported} conversas (${skipped} já existiam)`);
      fetchData();
    } catch (error: any) {
      console.error("Error importing conversations:", error);
      toast.error(error.message || "Erro ao importar conversas");
    } finally {
      setImportingConversations(false);
    }
  };

  // Refresh messages from WhatsApp (sync-chat-history)
  const refreshMessages = useCallback(async () => {
    if (!selectedIntegrationId) {
      toast.error("Nenhuma instância WhatsApp selecionada");
      return;
    }
    
    setIsRefreshingMessages(true);
    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "sync-chat-history", 
          integration_id: selectedIntegrationId,
          days: 3, // Buscar últimos 3 dias (período recente)
        },
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const result = response.data?.data;
      if (result) {
        if (result.synced > 0) {
          toast.success(
            `${result.synced} mensagens sincronizadas!`,
            { description: `${result.skipped} já existiam no sistema.` }
          );
          // Recarregar mensagens da conversa ativa se houver
          fetchData();
        } else {
          toast.info("Nenhuma mensagem nova encontrada", {
            description: `${result.skipped} mensagens já estavam sincronizadas.`
          });
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar mensagens:", error);
      toast.error("Erro ao buscar mensagens do WhatsApp");
    } finally {
      setIsRefreshingMessages(false);
    }
  }, [selectedIntegrationId, fetchData]);

  // Contact CRUD functions (saveNewClient, saveNewLead, openAddContactDialog, 
  // openNewConversationDialog, searchContacts, createConversationWithContact)
  // are now in contactOps hook


  // Filtered conversations based on tab (mine vs queue)
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      // Archive filter logic
      const isArchived = a.zapp_conversation?.is_archived || false;
      
      // If viewing archived, show only archived; otherwise hide archived
      if (filterArchived) {
        if (!isArchived) return false;
      } else {
        if (isArchived) return false;
      }
      
      // Get contact info FIRST - we need isGroup for filtering
      const contact = getContactInfo(a);
      const isGroup = contact.isGroup;
      
      // Closed conversations filter
      // When filterStatus is "closed", show only closed
      // Otherwise, HIDE closed conversations by default
      // EXCEPTION: Pinned groups ALWAYS show in the groups tab and in "Todas", even if closed
      const isClosed = a.status === "closed";
      const isPinned = contact.isPinned;
      const isPinnedGroupInAllOrGroups = isGroup && isPinned && (filterConversationType === "all" || filterConversationType === "group");
      const skipClosedFilterForPinnedGroups = isPinnedGroupInAllOrGroups;
      
      if (!skipClosedFilterForPinnedGroups) {
        if (filterStatus === "closed") {
          if (!isClosed) return false;
        } else if (filterStatus === "all") {
          // When showing "all", hide closed conversations
          if (isClosed) return false;
        }
      }
      
      // Tab filter: "mine" = assigned to current agent, "queue" = unassigned conversations only
      // Admins e Gestores podem ver TODAS as conversas em ambas as abas (para monitoramento)
      // Atendentes comuns só veem suas próprias conversas na aba "mine" e apenas não atribuídas na "queue"
      // Skip tab filter when viewing archived or closed (show all regardless of assignment)
      // EXCEPTION: Groups skip tab filter when viewing groups tab; pinned groups also skip it in "Todas"
      const skipTabFilterForGroups = filterConversationType === "group" && isGroup;
      const skipTabFilterForPinnedGroups = isPinnedGroupInAllOrGroups;
      
      // Checar se o usuário tem visibilidade total (Admin, Gestor, Gerente, Head, Diretor, C-level, Sócio)
      // Admin/Gestor do setor enxergam as conversas de todos; Membro/Viewer só as suas
      const hasFullVisibility = zappCaps.canSeeAllSectorConversations;
      
      // Conversations with no agent should ALWAYS show in queue, regardless of status
      // This catches orphaned "waiting" conversations with no agent assigned
      const isUnassigned = a.agent_id === null;
      
      // "Minhas" agora sempre parte das conversas do próprio atendente.
      // Quem tem visibilidade total pode alternar para um colega específico (filterAgentId)
      // ou para toda a equipe do setor (filterAgentId === "__team__").
      const matchesMineScope = hasFullVisibility
        ? (filterAgentId === "all"
            ? a.agent_id === currentAgent?.id
            : filterAgentId === "__team__"
              ? a.agent_id !== null
              : a.agent_id === filterAgentId)
        : a.agent_id === currentAgent?.id;

      const matchesTab = (filterArchived || filterStatus === "closed" || skipTabFilterForGroups || skipTabFilterForPinnedGroups) ? true : (
        inboxTab === "mine" 
          ? matchesMineScope
          : isUnassigned // Fila SEMPRE mostra apenas conversas sem agente atribuído (igual para todos)
      );

      
      const matchesSearch = matchesSearchQuery(contact, searchQuery);
      // Status filter: "triage" means no agent assigned (in queue) - also catches orphaned "waiting" with no agent
      const matchesStatus = filterStatus === "all" || filterStatus === "closed" ||
        (filterStatus === "triage" ? isUnassigned : a.status === filterStatus);
      
      // Unread filter
      const matchesUnread = !filterUnread || (contact.unreadCount > 0);
      
      // Conversation type filter: all, individual, or group
      const matchesConversationType = 
        filterConversationType === "all" ||
        (filterConversationType === "individual" && !isGroup) ||
        (filterConversationType === "group" && isGroup);
      
      // Product filter
      const clientId = a.zapp_conversation?.client_id || a.conversation?.client?.id;
      const clientProds = clientId ? clientProducts[clientId] : undefined;
      const matchesProduct = filterProductId === "all" || 
        (clientProds && clientProds.some(p => p.id === filterProductId));
      
      // Tag filter
      const matchesTag = filterTagId === "all" || 
        (a.conversation_tags && a.conversation_tags.some(ct => ct.tag_id === filterTagId));
      
      // Agent filter (na aba "Minhas" o escopo já é tratado em matchesMineScope)
      const matchesAgent = filterAgentId === "all" || filterAgentId === "__team__" || inboxTab === "mine" || a.agent_id === filterAgentId;

      
      return matchesTab && matchesSearch && matchesStatus && matchesUnread && matchesConversationType && matchesProduct && matchesTag && matchesAgent;
    });
  }, [assignments, searchQuery, filterStatus, filterUnread, filterConversationType, filterArchived, inboxTab, currentAgent?.id, filterProductId, filterTagId, filterAgentId, clientProducts, zappCaps.canSeeAllSectorConversations]);

  // Tag counts (over all visible assignments, ignoring current tag filter)
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = { all: assignments.length };
    for (const a of assignments) {
      if (a.conversation_tags) {
        for (const ct of a.conversation_tags) {
          counts[ct.tag_id] = (counts[ct.tag_id] || 0) + 1;
        }
      }
    }
    return counts;
  }, [assignments]);

  // getAgentName is defined above (near line 873)

  // Memoized stats to avoid recalculating on every render
  // Admin/Gestor veem todas as conversas; atendentes comuns só veem as suas
  const stats = useMemo(() => {
    const hasFullVisibility = zappCaps.canSeeAllSectorConversations;
    
    const onlineAgents = agents.filter((a) => a.is_online && a.is_active).length;
    
    // Fila SEMPRE mostra apenas conversas sem agente atribuído (igual para todos os usuários)
    const totalQueueConversations = assignments.filter((a) => 
      a.agent_id === null && 
      a.status !== "closed" && 
      !a.zapp_conversation?.is_archived
    ).length;
    
    // A contagem de "Minhas" acompanha o escopo selecionado no seletor de atendente
    const inMineScope = (a: typeof assignments[number]) => {
      if (!hasFullVisibility) return a.agent_id === currentAgent?.id;
      if (filterAgentId === "all") return a.agent_id === currentAgent?.id;
      if (filterAgentId === "__team__") return a.agent_id !== null;
      return a.agent_id === filterAgentId;
    };

    const myConversations = assignments.filter(
      (a) => inMineScope(a) && a.status !== "closed" && !a.zapp_conversation?.is_archived
    ).length;
    
    const activeConversations = assignments.filter((a) => a.status === "active").length;
    const assignedToOthers = assignments.filter((a) => a.agent_id && a.agent_id !== currentAgent?.id && a.status !== "closed").length;
    
    // Unread counts também respeitam o escopo
    const myUnreadCount = assignments.filter(
      (a) =>
        inMineScope(a) &&
        a.status !== "closed" &&
        !a.zapp_conversation?.is_archived &&
        (a.zapp_conversation?.unread_count || 0) > 0
    ).length;

    
    // Queue unread: sempre mostra apenas conversas SEM agente (igual para todos)
    const queueUnreadCount = assignments.filter((a) => 
      a.agent_id === null &&
      a.status !== "closed" && 
      !a.zapp_conversation?.is_archived &&
      (a.zapp_conversation?.unread_count || 0) > 0
    ).length;
    
    return { onlineAgents, totalQueueConversations, myConversations, activeConversations, assignedToOthers, myUnreadCount, queueUnreadCount };
  }, [agents, assignments, currentAgent?.id, zappCaps.canSeeAllSectorConversations, filterAgentId]);
  
  const { onlineAgents, totalQueueConversations, myConversations, activeConversations, assignedToOthers, myUnreadCount, queueUnreadCount } = stats;

  // Memoized helper functions to avoid recreating on every render
  const getInitials = useCallback((name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2), []);

  const formatTime = useCallback((date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return format(d, "HH:mm");
    } else if (diffDays === 1) {
      return "Ontem";
    } else if (diffDays < 7) {
      return format(d, "EEEE", { locale: ptBR });
    } else {
      return format(d, "dd/MM/yyyy");
    }
  }, []);

  // Get contact info for selected conversation
  const selectedContactInfo = useMemo(() => {
    if (!selectedConversation) return null;
    return getContactInfo(selectedConversation);
  }, [selectedConversation, getContactInfo]);

  // Get client products for selected conversation
  const selectedClientProducts = useMemo(() => {
    if (!selectedConversation) return [];
    const clientId = selectedConversation.zapp_conversation?.client_id || selectedConversation.conversation?.client?.id;
    return clientId ? clientProducts[clientId] || [] : [];
  }, [selectedConversation, clientProducts]);

  // Check access permission — admin panel "royzapp" sector toggle is the source of truth.
  const hasZappAccess = isAdmin || hasSectorAccess("royzapp") || hasPermission(PERMISSIONS.ROYZAPP_ACCESS);

  const showInitialRoyZappLoader =
    permissionsLoading ||
    (!!selectedSectorId &&
      !initialDataLoaded &&
      (sectorAccessLoading || zappAccessLoading || integrationResolving || (canLoadZappData && loading)));

  if (showInitialRoyZappLoader) {
    return (
      <div className="flex items-center justify-center h-full bg-zapp-bg">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-zapp-accent flex items-center justify-center">
            <MessageSquare className="h-8 w-8 text-white" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-zapp-accent mx-auto" />
          <p className="text-zapp-text-muted">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!hasZappAccess) {
    return (
      <div className="flex items-center justify-center h-full bg-zapp-bg">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <X className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="text-zapp-text text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-zapp-text-muted">
            Você não tem permissão para acessar o ROY zAPP. Se um administrador acabou de liberar seu acesso, clique em <strong>Recarregar permissões</strong> antes de tentar novamente.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              variant="default"
              onClick={reloadPermissions}
              disabled={reloadingPermissions}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", reloadingPermissions && "animate-spin")} />
              {reloadingPermissions ? "Recarregando…" : "Recarregar permissões"}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="border-zapp-border text-zapp-text hover:bg-zapp-hover"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Entrada direta no setor: apenas Maikol e Everton veem o seletor de setores.
  // Todos os outros entram no único WhatsApp de setor liberado no ROY zAPP
  // (controle independente do acesso geral ao setor).
  const generalSectorIds = new Set(sectorAccess.map((a) => a.sector_id));
  const autoSectors = (ZAPP_WHATSAPP_SECTORS as readonly SectorId[]).filter((id) =>
    canOpenZappSector(id, generalSectorIds.has(id))
  );

  if (!selectedSectorId && !canChooseSector) {
    if (sectorAccessLoading || zappAccessLoading || autoSectors.length > 0) {

      return (
        <div className="flex items-center justify-center h-full bg-zapp-bg">
          <Loader2 className="h-6 w-6 animate-spin text-zapp-accent" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-full bg-zapp-bg">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
            <Building2 className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-zapp-text text-xl font-semibold">Nenhum setor liberado</h2>
          <p className="text-zapp-text-muted">
            Você ainda não tem um setor de atendimento liberado no ROY zAPP. Peça a um administrador para conceder acesso.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button variant="default" onClick={reloadPermissions} disabled={reloadingPermissions}>
              <RefreshCw className={cn("h-4 w-4 mr-2", reloadingPermissions && "animate-spin")} />
              {reloadingPermissions ? "Recarregando…" : "Recarregar permissões"}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="border-zapp-border text-zapp-text hover:bg-zapp-hover"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedSectorId && activeView === "whatsapp-admin" && isAdmin) {
    return <ZappWhatsAppAdminPanel />;
  }

  // Maikol/Everton escolhem o setor antes de abrir qualquer tela operacional.
  // Isso evita uma view persistida (Equipe/Tags/etc.) abrir sem setor e misturar
  // dados de WhatsApps diferentes.
  if (!selectedSectorId) {
    return <ZappSectorSelector onSelectSector={(sectorId, integrationId) => {
      setSelectedSectorId(sectorId);
      setSelectedIntegrationId(integrationId);
      setActiveView("inbox");
      replaceSearchParams((next) => {
        next.set("sector", sectorId);
        if (integrationId) next.set("integrationId", integrationId);
        else next.delete("integrationId");
        next.set("view", "inbox");
      });
    }} />;
  }
  // Tag and conversation tag functions are now in crud hook
  const isInboxView = activeView === "inbox";
  const showConversationList = isInboxView || isCrmSectorView || isMeetingsView;


  return (
    <div className="flex flex-row flex-1 min-h-0 w-full overflow-hidden bg-zapp-bg">
      {/* Left panel - Conversation list */}
      <div 
        className={cn(
          "flex flex-col overflow-hidden border-r border-zapp-border",
          showConversationList ? "w-full lg:w-[440px] lg:min-w-[440px] lg:max-w-[440px]" : "w-full flex-1",
          showConversationList && selectedConversation ? "hidden lg:flex" : "flex"
        )}
      >
        <ZappConversationPanel
          currentUser={currentUser}
          isAdmin={isAdmin || hasGlobalVisibility}
          canSeeAllSectorConversations={zappCaps.canSeeAllSectorConversations}

          allowedViews={allowedViews}
          activeView={activeView}
          setActiveView={changeView}
          inboxTab={inboxTab}
          setInboxTab={setInboxTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterUnread={filterUnread}
          setFilterUnread={setFilterUnread}
          filterConversationType={filterConversationType}
          setFilterConversationType={setFilterConversationType}
          filterArchived={filterArchived}
          setFilterArchived={setFilterArchived}
          filterProductId={filterProductId}
          setFilterProductId={setFilterProductId}
          filterTagId={filterTagId}
          setFilterTagId={setFilterTagId}
          filterAgentId={filterAgentId}
          setFilterAgentId={setFilterAgentId}
          sectorDepartmentId={currentSectorDepartmentId}
          filteredAssignments={filteredAssignments}
          agents={agents}
          tags={tags}
          tagCounts={tagCounts}
          departments={departments}
          teamUsers={teamUsers}
          availableProducts={availableProducts}
          availableUsersCount={availableUsers.length}
          clientProducts={clientProducts}
          clientResponsibles={clientResponsibles}
          convToClientId={convToClientId}
          leadDealStages={leadDealStages}
          activeConversations={activeConversations}
          myConversations={myConversations}
          myUnreadCount={myUnreadCount}
          totalQueueConversations={totalQueueConversations}
          queueUnreadCount={queueUnreadCount}
          onlineAgents={onlineAgents}
          sectorId={selectedSectorId}
          sectorName={currentSector?.name}
          sectorColor={currentSector?.color?.replace('text-', '').replace('-600', '')}
          selectedConversation={selectedConversation}
          showConversationList={showConversationList}
          zappRole={zappRole}
          currentAgentId={currentAgent?.id || null}
          whatsappConnected={whatsappConnected}
          whatsappConnecting={whatsappConnecting}
          whatsappInstanceName={whatsappInstanceName}
          roundRobinEnabled={roundRobinEnabled}
          respectLimitEnabled={respectLimitEnabled}
          soundEnabled={soundEnabled}
          importLimit={importLimit}
          importingConversations={importingConversations}
          onSelectConversation={(a) => {
            
            setSelectedConversation(a);
            const zappConvId = a.zapp_conversation?.id;
            if (zappConvId && (a.zapp_conversation?.unread_count || 0) > 0) {
              convActions.markAsRead(zappConvId);
            }
          }}
          onOpenNewConversationDialog={contactOps.openNewConversationDialog}
          onOpenAgentDialog={crud.openAgentDialog}
          onToggleAgentOnline={crud.toggleAgentOnline}
          onToggleAgentGlobalAccess={crud.toggleAgentGlobalAccess}
          canManageGlobalAccess={isAdmin || isManagementUser(currentUser)}
          onDeleteAgent={crud.setDeletingAgentId}
          onOpenDepartmentDialog={crud.openDepartmentDialog}
          onDeleteDepartment={crud.setDeletingDepartmentId}
          onOpenTagDialog={crud.openTagDialog}
          onDeleteTag={crud.setDeletingTagId}
          onMarkAsRead={convActions.markAsRead}
          onMarkAsUnread={convActions.markAsUnread}
          onUpdateFlag={convActions.updateConversationFlag}
          onOpenTagConversationDialog={crud.openConversationTagDialog}
          onDeleteConversation={convActions.deleteConversation}
          onDismissConversation={convActions.dismissByAssignmentId}
          onToggleWhatsAppConnection={toggleWhatsAppConnection}
          onRoundRobinChange={(checked) => {
            setRoundRobinEnabled(checked);
            localStorage.setItem("zapp_roundRobin", String(checked));
          }}
          onRespectLimitChange={(checked) => {
            setRespectLimitEnabled(checked);
            localStorage.setItem("zapp_respectLimit", String(checked));
          }}
          onSoundChange={(checked) => {
            setSoundEnabled(checked);
            localStorage.setItem("zapp_sound", String(checked));
          }}
          onImportLimitChange={setImportLimit}
          onImportConversations={importRecentConversations}
          userSignature={userSignature}
          onSignatureChange={(value) => {
            setUserSignature(value);
            if (currentUser) {
              supabase
                .from("users")
                .update({ zapp_signature: value })
                .eq("id", currentUser.id)
                .then();
            }
          }}
          spellingEnabled={spellingEnabled}
          onSpellingChange={(checked) => {
            setSpellingEnabled(checked);
            localStorage.setItem("zapp_spelling_enabled", String(checked));
          }}
          getAgentName={getAgentName}
          onPullFromQueue={convActions.pullFromQueue}
          notificationPermission={notificationPermission}
          onRequestNotificationPermission={requestNotificationPermission}
          onRefreshMessages={refreshMessages}
          isRefreshingMessages={isRefreshingMessages}
          accountId={currentUser?.account_id}
          selectedIntegrationId={selectedIntegrationId}
          onSelectIntegration={(integrationId) => {
            if (integrationId === selectedIntegrationId) return;
            setSelectedIntegrationId(integrationId);
            setSelectedConversation(null);
            replaceSearchParams((next) => next.set('integrationId', integrationId));

            // Persist preference for this user/sector
            if (currentUser?.auth_user_id && currentUser?.account_id && selectedSectorId) {
              supabase
                .from("user_instance_preferences")
                .upsert({
                  user_id: currentUser.auth_user_id,
                  account_id: currentUser.account_id,
                  sector_id: selectedSectorId,
                  integration_id: integrationId,
                }, { onConflict: "user_id,sector_id" })
                .then(({ error }) => {
                  if (error) console.error("[RoyZapp] save instance preference error", error);
                });
            }
          }}
          onClearIntegration={() => {
            setSelectedIntegrationId(undefined);
            setSelectedConversation(null);
            replaceSearchParams((next) => next.delete('integrationId'));
          }}
        />
      </div>

      {/* Right panel - Chat view, CRM or Meetings context */}
      {showConversationList && (
      <div 
        className={cn(
          "flex-1 min-w-0 flex flex-col overflow-hidden",
          !selectedConversation && !isMeetingsView ? "hidden lg:flex" : "flex"
        )}
      >
        {isMeetingsView ? (
          <div className="flex-1 min-h-0 overflow-y-auto bg-zapp-bg">
            <MeetingsPanel />
          </div>
        ) : isCrmSectorView ? (
          selectedConversation ? (
            <ZappCRMPanel
              conversationPhone={selectedConversation.zapp_conversation?.phone_e164 || selectedConversation.zapp_conversation?.group_jid}
              conversationClientId={selectedConversation.zapp_conversation?.client_id}
              conversationLeadId={selectedConversation.zapp_conversation?.lead_id}
              conversationContactName={selectedConversation.zapp_conversation?.contact_name || selectedConversation.zapp_conversation?.client?.full_name || selectedConversation.zapp_conversation?.lead?.full_name}
              autoOpenCreateDeal={crmCreateDealTick}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-zapp-bg px-6 text-center">
              <div className="space-y-3 text-zapp-text-muted">
                <Briefcase className="h-10 w-10 mx-auto opacity-40" />
                <p className="text-sm">Selecione uma conversa na lista para ver o CRM</p>
              </div>
            </div>
          )
        ) : (
          <ZappChatView
            selectedConversation={selectedConversation}
          messages={messages}
          hasMoreMessages={hasMoreMessages}
          isLoadingOlderMessages={isLoadingOlderMessages}
          isLoadingMessages={isLoadingMessages}
          onLoadOlderMessages={loadOlderMessages}
          contactInfo={selectedContactInfo || { name: "", phone: "", avatar: null, clientId: null, isClient: false, isGroup: false, lastMessage: null, lastMessagePreview: "", unreadCount: 0, lastMessageAt: "", isPinned: false, isMuted: false, isArchived: false, isFavorite: false, isBlocked: false, searchableText: "" }}
          clientProducts={selectedClientProducts}
          currentAgentId={currentAgent?.id || null}
           messageInput={messaging.messageInput}
           sendingMessage={messaging.sendingMessage}
           uploadingMedia={messaging.uploadingMedia}
           isRecording={messaging.isRecording}
           recordingDuration={messaging.recordingDuration}
           audioPreview={messaging.audioPreview}
           imagePreview={messaging.imagePreview}
           onSetImagePreview={messaging.setImagePreview}
           showFormatting={messaging.showFormatting}
           messageInputRef={messaging.messageInputRef}
           imageInputRef={messaging.imageInputRef}
           fileInputRef={messaging.fileInputRef}
           sectorId={selectedSectorId}
           spellingEnabled={spellingEnabled}
           onlineAgents={onlineAgents}
           totalQueueConversations={totalQueueConversations}
           activeConversations={activeConversations}
           onBack={closeConversation}
           onOpenClientEdit={(id) => {
             setEditingClientId(id);
             setClientEditSheetOpen(true);
           }}
            onAssignToMe={(id) => {
              if (!zappCaps.canClaim) {
                toast.error("Seu papel neste WhatsApp não permite assumir conversas.");
                return;
              }
              convActions.assignToMe(id);
            }}
            onReleaseToQueue={(id) => {
              if (!zappCaps.canClaim) {
                toast.error("Seu papel neste WhatsApp não permite devolver conversas.");
                return;
              }
              convActions.releaseToQueue(id);
            }}
            onUpdateStatus={(id, status) => {
              if (!zappCaps.canClaim) {
                toast.error("Seu papel neste WhatsApp não permite alterar o status.");
                return;
              }
              convActions.updateConversationStatus(id, status);
            }}
            onOpenTransfer={() => {
              if (!zappCaps.canTransfer) {
                toast.error("Apenas Admin e Gestor do setor podem transferir conversas.");
                return;
              }
              setTransferDialogOpen(true);
            }}
           onOpenRoiDialog={() => {}}
           onOpenRiskDialog={() => {}}
           onOpenAddClient={contactOps.openAddContactDialog}
           onOpenLinkClient={() => setLinkClientDialogOpen(true)}
           onClientLinked={() => fetchData()}
           onDeleteConversation={() => setPermanentDeleteDialogOpen(true)}
           onDismissConversation={
             selectedConversation?.zapp_conversation?.is_group 
               ? convActions.dismissGroupConversation 
               : undefined
           }
           onOpenEditGroup={
             selectedConversation?.zapp_conversation?.is_group 
               ? () => setEditGroupDialogOpen(true) 
               : undefined
           }
           accountId={currentUser?.account_id}
           showLeadOption={hasVendasAccess}
           onMessageChange={messaging.setMessageInput}
            onSendMessage={() => {
              if (!zappCaps.canReply) {
                toast.error("Seu acesso a este WhatsApp é somente leitura.");
                return;
              }
              messaging.sendMessage();
            }}
           onKeyPress={messaging.handleKeyPress}
           onToggleFormatting={() => messaging.setShowFormatting(!messaging.showFormatting)}
           onInsertFormatting={messaging.insertFormatting}
           onStartRecording={messaging.startRecording}
           onStopRecording={messaging.stopRecording}
           onCancelRecording={messaging.cancelRecording}
           onDiscardAudioPreview={messaging.discardAudioPreview}
           onConfirmAudioSend={messaging.confirmAudioSend}
           onFileSelect={messaging.handleFileSelect}
           onOpenContactPicker={() => messaging.setContactPickerOpen(true)}
           onOpenQuickReplies={() => messaging.setQuickRepliesOpen(true)}
           replyingTo={messaging.replyingTo}
           onReplyMessage={messaging.handleReplyMessage}
           onCancelReply={() => messaging.setReplyingTo(null)}
           onDeleteMessage={messaging.handleDeleteMessage}
           onEditMessage={messaging.handleEditMessage}
           onRetryMessage={messaging.retryMessage}
           onRetryMediaDownload={messaging.retryMediaDownload}
           onMentionInsert={messaging.handleMentionInsert}
           signatureEnabled={signatureEnabled}
           hasSignature={!!userSignature.trim()}
           onToggleSignature={() => {
             const newValue = !signatureEnabled;
             setSignatureEnabled(newValue);
             if (currentUser) {
               supabase
                 .from("users")
                 .update({ zapp_signature_enabled: newValue })
                 .eq("id", currentUser.id)
                 .then();
             }
           }}
           onOpenPlaybook={() => setPlaybookDialogOpen(true)}
           filePreview={messaging.filePreview}
           onSetFilePreview={(preview) => {
              if (preview && preview.file.size > 70 * 1024 * 1024) {
                toast.error("Arquivo muito grande. Máximo 70MB.");
               URL.revokeObjectURL(preview.url);
               return;
             }
             messaging.setFilePreview(preview);
           }}
           isMetaChannel={(() => {
             const intId = selectedConversation?.zapp_conversation?.integration_id || selectedIntegrationId;
             return intId ? integrationProviders[intId] === "meta_official" : false;
           })()}
            onOpenTemplates={() => setTemplatesDialogOpen(true)}
            canTransfer={zappCaps.canTransfer}
            canReply={zappCaps.canReply}
            canClaim={zappCaps.canClaim}
            onOpenCreateDeal={() => {
              const conv = selectedConversation?.zapp_conversation;
              const hasContactRecord = !!conv?.lead_id || !!conv?.client_id;
              if (!hasContactRecord) {
                setConfirmCreateDealOpen(true);
                return;
              }
              setForceCrmView(true);
              setCrmCreateDealTick((n) => n + 1);
              changeView("sector");
            }}

        />
        )}
      </div>
      )}

      {/* Department Dialog */}
      <ZappDepartmentDialog
        open={crud.departmentDialogOpen}
        onOpenChange={crud.setDepartmentDialogOpen}
        editingDepartment={crud.editingDepartment}
        form={crud.departmentForm}
        onFormChange={crud.setDepartmentForm}
        onSave={crud.saveDepartment}
        saving={crud.savingDepartment}
        deletingId={crud.deletingDepartmentId}
        onDeleteConfirm={crud.deleteDepartment}
        onDeleteCancel={() => crud.setDeletingDepartmentId(null)}
      />

      {/* Agent Dialog */}
      <ZappAgentDialog
        open={crud.agentDialogOpen}
        onOpenChange={crud.setAgentDialogOpen}
        editingAgent={crud.editingAgent}
        form={crud.agentForm}
        onFormChange={crud.setAgentForm}
        onSave={crud.saveAgent}
        saving={crud.savingAgent}
        availableUsers={availableUsers}
        departments={departments}
        deletingId={crud.deletingAgentId}
        onDeleteConfirm={crud.deleteAgent}
        onDeleteCancel={() => crud.setDeletingAgentId(null)}
      />



      {/* Transfer Dialog */}
      <ZappTransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        transferTarget={transferTarget}
        onTransferTargetChange={setTransferTarget}
        agents={agents}
        departments={departments}
        currentAgentId={selectedConversation?.agent_id}
        onTransfer={async () => {
          if (!selectedConversation || !transferTarget.id) return;
          await convActions.transferConversation(transferTarget);
          setTransferDialogOpen(false);
          setTransferTarget({ type: "agent", id: "" });
        }}
      />

      {/* Tag Dialog */}
      <ZappTagDialog
        open={crud.tagDialogOpen}
        onOpenChange={crud.setTagDialogOpen}
        editingTag={crud.editingTag}
        form={crud.tagForm}
        onFormChange={crud.setTagForm}
        onSave={crud.saveTag}
        saving={crud.savingTag}
        deletingId={crud.deletingTagId}
        onDeleteConfirm={crud.deleteTag}
        onDeleteCancel={() => crud.setDeletingTagId(null)}
      />

      {/* Conversation Tagging Dialog */}
      <ZappConversationTagDialog
        open={crud.conversationTagDialogOpen}
        onOpenChange={crud.setConversationTagDialogOpen}
        tags={tags}
        selectedTags={crud.selectedConversationTags}
        onToggleTag={crud.toggleConversationTag}
        onSave={crud.saveConversationTags}
        saving={crud.savingConversationTags}
        onNavigateToTags={() => changeView("tags")}
      />

      {/* Client Quick Edit Sheet with Deals */}
      <ClientZappSheet
        clientId={editingClientId}
        open={clientEditSheetOpen}
        onOpenChange={setClientEditSheetOpen}
        onClientUpdated={() => fetchData()}
      />

      {/* Contact Picker Dialog */}
      <ZappContactPickerDialog
        open={messaging.contactPickerOpen}
        onOpenChange={messaging.setContactPickerOpen}
        searchQuery={messaging.contactSearch}
        onSearchChange={messaging.setContactSearch}
        filteredClients={allClients.filter(c => {
          if (!messaging.contactSearch.trim()) return false;
          const search = messaging.contactSearch.toLowerCase();
          return c.full_name.toLowerCase().includes(search) || c.phone_e164.includes(search);
        }).slice(0, 10)}
        onSelectContact={messaging.sendContact}
        sending={messaging.sendingContact}
      />

      {/* Quick Replies Dialog */}
      <ZappQuickRepliesDialog
        open={messaging.quickRepliesOpen}
        onOpenChange={messaging.setQuickRepliesOpen}
        quickReplies={messaging.quickReplies}
        onUseReply={messaging.useQuickReply}
        onEditReply={(reply) => {
          messaging.setEditingQuickReply(reply);
          messaging.setQuickReplyForm({ title: reply.title, content: reply.content });
          messaging.setQuickReplyDialogOpen(true);
        }}
        onDeleteReply={messaging.deleteQuickReply}
        onCreateNew={() => {
          messaging.setEditingQuickReply(null);
          messaging.setQuickReplyForm({ title: "", content: "" });
          messaging.setQuickReplyDialogOpen(true);
        }}
        editDialogOpen={messaging.quickReplyDialogOpen}
        onEditDialogChange={messaging.setQuickReplyDialogOpen}
        editingReply={messaging.editingQuickReply}
        form={messaging.quickReplyForm}
        onFormChange={messaging.setQuickReplyForm}
        onSave={messaging.saveQuickReply}
        saving={messaging.savingQuickReply}
      />

      {/* Add Client/Lead Dialog */}
      <ZappAddContactDialog
        open={contactOps.addContactDialogOpen}
        onOpenChange={contactOps.setAddContactDialogOpen}
        phone={contactOps.addContactPhone}
        contactName={contactOps.addContactName}
        showLeadOption={hasVendasAccess}
        onSaveClient={contactOps.saveNewClient}
        onSaveLead={contactOps.saveNewLead}
        savingClient={contactOps.savingNewClient}
        savingLead={contactOps.savingNewLead}
        accountId={currentUser?.account_id}
        conversationId={selectedConversation?.zapp_conversation_id || selectedConversation?.zapp_conversation?.id}
        onLinked={() => {
          fetchData();
          if (selectedConversation) {
            const zappConvId = selectedConversation.zapp_conversation_id || selectedConversation.zapp_conversation?.id;
            if (zappConvId) {
              fetchMessages(zappConvId);
            }
          }
        }}
      />

      {/* New Conversation Dialog */}
      <ZappNewConversationDialog
        open={contactOps.newConversationDialogOpen}
        onOpenChange={contactOps.setNewConversationDialogOpen}
        searchQuery={contactOps.newConversationSearch}
        onSearchChange={contactOps.setNewConversationSearch}
        clients={contactOps.newConversationClients}
        onSelectClient={contactOps.createConversationWithContact}
        creating={contactOps.creatingConversation}
        isLeadMode={selectedSectorId === "vendas"}
      />

      {/* Playbook Dialog for Chat */}
      <PlaybookDialog
        open={playbookDialogOpen}
        onOpenChange={setPlaybookDialogOpen}
        sectorId={selectedSectorId}
        onUseItem={async (item, processedText) => {
          // For single send: text/link goes to input, media sends directly
          const textPayload = buildPlaybookText(item, processedText);
          if (['text', 'link', 'list', 'template'].includes(item.content_type) && textPayload) {
            messaging.setMessageInput(textPayload);
            messaging.messageInputRef.current?.focus();
          } else if (item.content_type === 'image' && item.media_url) {
            try {
              const response = await fetch(item.media_url);
              if (!response.ok) throw new Error('Failed to fetch image');
              const blob = await response.blob();
              const fileName = item.name || 'playbook-image.jpg';
              const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
              const url = URL.createObjectURL(blob);
              messaging.setImagePreview({ file, url, caption: item.media_caption || undefined });
              toast.success(item.media_caption ? "Imagem com legenda anexada! Clique em enviar." : "Imagem anexada! Clique em enviar.");
              messaging.messageInputRef.current?.focus();
            } catch (error) {
              console.error('Error loading playbook image:', error);
              toast.error("Erro ao carregar imagem do playbook");
            }
          } else {
            try {
              await sendSinglePlaybookItem(item, processedText);
            } catch (error) {
              console.error('Error sending playbook item:', error);
              toast.error("Erro ao enviar item do playbook");
            }
          }
        }}
        onMultiSend={handleMultiSend}
        variables={extractPlaybookVariables({
          conversation: selectedConversation,
          currentUser: currentUser,
          deal: null,
        })}
      />

      {/* Close Ticket Dialog */}
      {selectedConversation && (
        <ZappCloseTicketDialog
          open={closeTicketDialogOpen}
          onOpenChange={setCloseTicketDialogOpen}
          assignment={selectedConversation}
          agentName={currentAgent?.user?.name || currentUser?.name || ""}
          sectorId={selectedSectorId || ""}
          departmentName={currentAgent?.department?.name || ""}
          onSuccess={() => {
            setCloseTicketDialogOpen(false);
            setSelectedConversation(null);
            fetchData();
          }}
        />
      )}

      {/* Link Client Dialog */}
      {selectedConversation && (
        <ZappLinkClientDialog
          open={linkClientDialogOpen}
          onOpenChange={setLinkClientDialogOpen}
          conversationId={selectedConversation.zapp_conversation_id || selectedConversation.zapp_conversation?.id || ""}
          conversationPhone={selectedConversation.zapp_conversation?.phone_e164 || ""}
          contactName={selectedConversation.zapp_conversation?.contact_name || ""}
          accountId={currentUser?.account_id || ""}
          isGroup={selectedConversation.zapp_conversation?.is_group || false}
          onLinked={() => {
            setLinkClientDialogOpen(false);
            fetchData();
          }}
        />
      )}

      {/* Edit Group Dialog */}
      {selectedConversation?.zapp_conversation?.is_group && (
        <ZappEditGroupDialog
          open={editGroupDialogOpen}
          onOpenChange={setEditGroupDialogOpen}
          conversationId={selectedConversation.zapp_conversation.id}
          groupJid={selectedConversation.zapp_conversation.group_jid || ""}
          currentName={selectedConversation.zapp_conversation.contact_name || ""}
          onSuccess={() => fetchData()}
        />
      )}

      {/* Permanent Delete Conversation Dialog */}
      <AlertDialog 
        open={permanentDeleteDialogOpen} 
        onOpenChange={setPermanentDeleteDialogOpen}
      >
        <AlertDialogContent className="bg-zapp-panel border-zapp-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zapp-text">
              Excluir conversa permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zapp-text-muted">
              Esta ação não pode ser desfeita. A conversa e todo o histórico de mensagens 
              serão apagados permanentemente.
              <br/><br/>
              <strong className="text-zapp-text">O cadastro de Lead/Cliente será mantido.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zapp-border text-zapp-text hover:bg-zapp-hover">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={convActions.permanentlyDeleteConversation}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação: criar negócio para conversa sem lead/cliente */}
      <AlertDialog open={confirmCreateDealOpen} onOpenChange={setConfirmCreateDealOpen}>
        <AlertDialogContent className="bg-zapp-panel border-zapp-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zapp-text">
              Criar negócio para este contato?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zapp-text-muted">
              Esta conversa ainda não tem lead nem cliente vinculado. Um novo lead será
              criado com os dados abaixo e vinculado ao negócio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-zapp-border bg-zapp-bg p-3 text-sm space-y-1">
            <p className="text-zapp-text">
              <span className="text-zapp-text-muted">Nome: </span>
              {selectedConversation?.zapp_conversation?.contact_name || "Sem nome"}
            </p>
            <p className="text-zapp-text">
              <span className="text-zapp-text-muted">Telefone: </span>
              {selectedConversation?.zapp_conversation?.phone_e164 ||
                selectedConversation?.zapp_conversation?.group_jid ||
                "Não informado"}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zapp-border text-zapp-text hover:bg-zapp-hover">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setForceCrmView(true);
                setCrmCreateDealTick((n) => n + 1);
                changeView("sector");
              }}
            >
              Criar negócio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      {/* Meta templates dialog (only meaningful when current channel is Meta) */}
      <ZappMetaTemplatesDialog
        open={templatesDialogOpen}
        onOpenChange={setTemplatesDialogOpen}
        integrationId={
          selectedConversation?.zapp_conversation?.integration_id ||
          selectedIntegrationId ||
          null
        }
        phone={selectedContactInfo?.phone || null}
        contactName={selectedContactInfo?.name || null}
      />
    </div>
  );
}
