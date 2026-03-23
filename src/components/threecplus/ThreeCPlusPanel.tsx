import { useState, useEffect, useCallback } from "react";
import {
  Phone,
  PhoneOff,
  Pause,
  Play,
  LogIn,
  LogOut,
  Loader2,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
  X,
  Wifi,
  WifiOff,
  Coffee,
  PhoneCall,
  PhoneForwarded,
  Clock,
  Headphones,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useThreeCPlus, AgentStatus } from "@/hooks/useThreeCPlus";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getStatusInfo(status: AgentStatus) {
  switch (status) {
    case "idle":
      return { label: "Ocioso", color: "bg-green-500", icon: Headphones };
    case "on_call":
      return { label: "Em chamada", color: "bg-red-500", icon: PhoneCall };
    case "manual_mode":
      return { label: "Modo manual", color: "bg-blue-500", icon: PhoneForwarded };
    case "manual_call_connected":
      return { label: "Chamada manual", color: "bg-red-500", icon: PhoneCall };
    case "acw":
      return { label: "TPA", color: "bg-yellow-500", icon: Clock };
    case "on_break":
      return { label: "Intervalo", color: "bg-orange-500", icon: Coffee };
    case "connecting":
      return { label: "Conectando...", color: "bg-blue-400", icon: Loader2 };
    default:
      return { label: "Offline", color: "bg-muted", icon: WifiOff };
  }
}

export function ThreeCPlusPanel() {
  const {
    agentStatus,
    currentCall,
    campaigns,
    workBreaks,
    selectedCampaign,
    connectionInfo,
    isConnected,
    loading,
    callTimer,
    savedExtension,
    savedExtensionPassword,
    connect,
    connectSocket,
    fetchCampaigns,
    loginCampaign,
    logout,
    manualCall,
    hangup,
    qualify,
    enterPause,
    exitPause,
    exitManualMode,
    saveExtension,
    loadExtension,
  } = useThreeCPlus();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showExtension, setShowExtension] = useState(false);
  const [manualPhone, setManualPhone] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [extensionLoaded, setExtensionLoaded] = useState(false);
  const [extensionInput, setExtensionInput] = useState("");
  const [extensionPasswordInput, setExtensionPasswordInput] = useState("");
  const [showCampaignSection, setShowCampaignSection] = useState(false);

  // Initialize connection
  const handleInit = useCallback(async () => {
    const ok = initialized ? true : await connect();

    if (ok && !initialized) {
      setInitialized(true);
      loadExtension();
    }

    if (ok && campaigns.length === 0) {
      await fetchCampaigns();
    }
  }, [campaigns.length, connect, fetchCampaigns, initialized, loadExtension]);

  // Sync saved extension to input
  useEffect(() => {
    if (savedExtension && !extensionInput) {
      setExtensionInput(savedExtension);
    }
  }, [savedExtension, extensionInput]);

  // Open panel
  const handleOpen = useCallback(async () => {
    setIsOpen(true);
    setIsMinimized(false);
    await handleInit();
  }, [handleInit]);

  useEffect(() => {
    setExtensionLoaded(false);
  }, [connectionInfo?.extension_url]);

  // Connect Socket.io to the client's own domain (not a generic socket server)
  useEffect(() => {
    if (connectionInfo && !isConnected) {
      connectSocket(connectionInfo.domain, connectionInfo.api_token);
      setShowExtension(true);
    }
  }, [connectionInfo, isConnected, connectSocket]);

  // Login to selected campaign
  const handleLogin = useCallback(
    async (campaignId: string) => {
      if (!extensionLoaded) return;

      const campaign = campaigns.find((c) => String(c.id) === campaignId);
      if (campaign) {
        await loginCampaign(campaign);
      }
    },
    [campaigns, extensionLoaded, loginCampaign]
  );

  // Make manual call
  const handleManualCall = useCallback(async () => {
    if (!manualPhone.trim()) return;
    const ok = await manualCall(manualPhone.trim());
    if (ok) setManualPhone("");
  }, [manualCall, manualPhone]);

  const statusInfo = getStatusInfo(agentStatus);
  const isInCall = agentStatus === "on_call" || agentStatus === "manual_call_connected";
  const hasCallTarget = Boolean(currentCall?.phone || currentCall?.contact_name);
  const hasCallActivity = isInCall || hasCallTarget;
  const isDialing = hasCallTarget && !isInCall;
  const callDisplayName = currentCall?.contact_name || currentCall?.phone || "Ligação em andamento";
  const callDisplaySubtitle =
    currentCall?.phone && currentCall?.contact_name
      ? currentCall.phone
      : isInCall
        ? "Chamada conectada"
        : agentStatus === "manual_mode"
          ? "Aguardando conexão da chamada no 3C Plus"
          : agentStatus === "connecting"
            ? "Preparando o agente para discagem"
            : "Aguardando atualização do status da ligação";
  const canLogin = !loading && extensionLoaded;
  const canDialManually = extensionLoaded && (agentStatus === "offline" || agentStatus === "idle" || agentStatus === "manual_mode" || agentStatus === "connecting");
  const defaultStatusInfo =
    agentStatus !== "offline"
      ? statusInfo
      : extensionLoaded
        ? { label: isConnected ? "Ramal carregado" : "Ramal carregado", color: "bg-green-500", icon: Wifi }
        : connectionInfo || loading
          ? { label: "Conectando...", color: "bg-blue-400", icon: Loader2 }
          : statusInfo;
  const liveStatusInfo = hasCallActivity
    ? {
        label: isInCall ? "Em chamada" : "Discando...",
        color: isInCall ? "bg-destructive" : "bg-primary",
        icon: isInCall ? PhoneCall : PhoneForwarded,
      }
    : defaultStatusInfo;

  // Floating button when panel is closed
  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className={cn(
          "fixed bottom-20 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg transition-all hover:scale-105",
          hasCallActivity
            ? "bg-destructive text-destructive-foreground animate-pulse"
            : "bg-primary text-primary-foreground"
        )}
      >
        <Phone className="h-5 w-5" />
        <span className="text-sm font-medium">3C Plus</span>
        {(agentStatus !== "offline" || connectionInfo || loading || hasCallActivity) && (
          <span className={cn("h-2.5 w-2.5 rounded-full", liveStatusInfo.color)} />
        )}
      </button>
    );
  }

  // Minimized bar
  if (isMinimized) {
    return (
      <div
        className={cn(
          "fixed bottom-0 right-6 z-50 flex items-center gap-3 rounded-t-lg px-4 py-2 shadow-lg",
          "bg-card border border-b-0 border-border"
        )}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full", liveStatusInfo.color)} />
        <span className="text-sm font-medium">{liveStatusInfo.label}</span>
        {hasCallActivity && (
          <span className="max-w-[120px] truncate text-xs text-muted-foreground">{callDisplayName}</span>
        )}
        {(callTimer > 0 || isInCall) && (
          <Badge variant="destructive" className="text-xs">
            {formatTime(callTimer)}
          </Badge>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(false)}>
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 right-6 z-50 flex flex-col w-[380px] rounded-t-xl shadow-2xl",
        "bg-card border border-b-0 border-border",
        "max-h-[calc(100vh-5rem)]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">3C Plus</span>
          {isConnected ? (
            <Wifi className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <Badge
            variant="outline"
            className={cn(
              "text-xs gap-1",
              hasCallActivity && (isInCall ? "border-destructive text-destructive" : "border-primary text-primary")
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", liveStatusInfo.color)} />
            {liveStatusInfo.label}
          </Badge>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(true)}>
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-auto">
        <div className="p-4 space-y-4">

          {/* ===== PRIMARY: Manual Dial (no campaign required) ===== */}
          {canDialManually && !hasCallActivity && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Discar
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="(11) 99999-9999"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualCall()}
                  className="text-sm"
                  autoFocus
                />
                <Button
                  size="icon"
                  onClick={handleManualCall}
                  disabled={!manualPhone.trim() || loading}
                  className="shrink-0"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {!savedExtension && !extensionLoaded && (
                <p className="text-xs text-yellow-600">
                  ⚠️ Configure seu ramal abaixo para fazer ligações.
                </p>
              )}
              {savedExtension && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Headphones className="h-3 w-3" />
                  <span>Ramal: <strong>{savedExtension}</strong></span>
                  {savedExtensionPassword && (
                    <span className="text-green-600">• Senha OK</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== Ramal Config (when not configured) ===== */}
          {extensionLoaded && !savedExtension && !hasCallActivity && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-yellow-600" />
                <p className="text-sm font-medium">Configure seu ramal</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Informe o número do seu ramal e a senha na 3C Plus para fazer ligações diretas sem campanha.
              </p>
              <div className="space-y-2">
                <Input
                  placeholder="Ramal (ex: 1001)"
                  value={extensionInput}
                  onChange={(e) => setExtensionInput(e.target.value)}
                  className="text-sm"
                />
                <Input
                  type="password"
                  placeholder="Senha do ramal"
                  value={extensionPasswordInput}
                  onChange={(e) => setExtensionPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && extensionInput.trim() && extensionPasswordInput.trim() && saveExtension(extensionInput.trim(), extensionPasswordInput.trim())}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => saveExtension(extensionInput.trim(), extensionPasswordInput.trim())}
                  disabled={!extensionInput.trim() || !extensionPasswordInput.trim() || loading}
                >
                  Salvar
                </Button>
              </div>
            </div>
          )}

          {/* ===== Saved Extension display with edit ===== */}
          {savedExtension && !hasCallActivity && (
            <div className="space-y-2 bg-muted/50 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Headphones className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Ramal: <strong>{savedExtension}</strong></span>
                  {savedExtensionPassword && (
                    <span className="text-xs text-green-600">• Senha configurada</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Novo ramal"
                  value={extensionInput !== savedExtension ? extensionInput : ""}
                  onChange={(e) => setExtensionInput(e.target.value)}
                  className="text-xs h-6 flex-1"
                />
                <Input
                  type="password"
                  placeholder="Nova senha"
                  value={extensionPasswordInput}
                  onChange={(e) => setExtensionPasswordInput(e.target.value)}
                  className="text-xs h-6 flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    const newExt = extensionInput.trim() && extensionInput !== savedExtension ? extensionInput.trim() : savedExtension;
                    const newPwd = extensionPasswordInput.trim() || savedExtensionPassword || "";
                    saveExtension(newExt, newPwd);
                  }}
                  disabled={(!extensionInput.trim() || extensionInput === savedExtension) && !extensionPasswordInput.trim()}
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* ===== Call Activity Display ===== */}
          {hasCallActivity && (
            <div
              className={cn(
                "rounded-lg border p-4 space-y-3",
                isInCall ? "border-destructive/30 bg-destructive/5" : "border-primary/20 bg-primary/5"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      isInCall ? "bg-destructive/15" : "bg-primary/15"
                    )}
                  >
                    {isInCall ? (
                      <PhoneCall className="h-4 w-4 text-destructive animate-pulse" />
                    ) : (
                      <PhoneForwarded className="h-4 w-4 text-primary animate-pulse" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">
                        {isInCall ? "Chamada ativa" : isDialing ? "Ligando agora" : "Ligação em andamento"}
                      </p>
                      <Badge variant={isInCall ? "destructive" : "secondary"} className="text-[11px]">
                        {isInCall ? "Ao vivo" : liveStatusInfo.label}
                      </Badge>
                    </div>

                    <p className="truncate text-sm font-medium">{callDisplayName}</p>
                    <p className="text-xs text-muted-foreground">{callDisplaySubtitle}</p>
                  </div>
                </div>

                {(callTimer > 0 || isInCall) && (
                  <Badge variant={isInCall ? "destructive" : "outline"} className="shrink-0 font-mono text-sm">
                    {formatTime(callTimer)}
                  </Badge>
                )}
              </div>

              <div className="grid gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={hangup}
                  disabled={loading}
                >
                  <PhoneOff className="h-4 w-4 mr-2" />
                  {currentCall?.id
                    ? "Desligar"
                    : agentStatus === "manual_mode"
                      ? "Cancelar tentativa de ligação"
                      : "Aguardando conexão da chamada"}
                </Button>

                {agentStatus === "manual_mode" && !isInCall && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={exitManualMode}
                    disabled={loading}
                  >
                    <Play className="h-3.5 w-3.5 mr-2" />
                    Voltar ao discador
                  </Button>
                )}
              </div>

              {!currentCall?.id && (
                <p className="text-xs text-muted-foreground">
                  {agentStatus === "manual_mode"
                    ? "Se a chamada ainda estiver só em discagem, você pode cancelar por aqui antes da conexão completa."
                    : "Assim que a 3C Plus confirmar a ligação, o botão de desligar fica disponível aqui com o número em destaque."}
                </p>
              )}

              {isInCall && currentCall?.qualifications && currentCall.qualifications.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      Qualificar
                      <ChevronDown className="h-3.5 w-3.5 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-60 overflow-y-auto">
                    {currentCall.qualifications.map((q) => (
                      <DropdownMenuItem key={String(q.id)} onClick={() => qualify(q.id)}>
                        {q.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

          {/* Emergency hangup */}
          {agentStatus !== "offline" && agentStatus !== "idle" && agentStatus !== "on_break" && agentStatus !== "acw" && agentStatus !== "connecting" && agentStatus !== "manual_mode" && !isInCall && !hasCallTarget && (
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                onClick={hangup}
                disabled={loading}
              >
                <PhoneOff className="h-4 w-4 mr-2" />
                Forçar desligamento
              </Button>
            </div>
          )}

          {/* TPA (After Call Work) */}
          {agentStatus === "acw" && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium">Pós-atendimento (TPA)</p>
                  <p className="text-xs text-muted-foreground">Qualifique a chamada para continuar</p>
                </div>
              </div>
              {currentCall?.qualifications && currentCall.qualifications.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      Qualificar
                      <ChevronDown className="h-3.5 w-3.5 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-60 overflow-y-auto">
                    {currentCall.qualifications.map((q) => (
                      <DropdownMenuItem key={String(q.id)} onClick={() => qualify(q.id)}>
                        {q.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

          {/* Exit manual mode button */}
          {agentStatus === "manual_mode" && !hasCallActivity && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={exitManualMode}
              disabled={loading}
            >
              <Play className="h-3.5 w-3.5 mr-2" />
              Voltar ao discador
            </Button>
          )}

          {/* ===== SECONDARY: Campaign Section (collapsible) ===== */}
          {!hasCallActivity && (
            <Collapsible open={showCampaignSection} onOpenChange={setShowCampaignSection}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                  <span className="uppercase tracking-wider font-medium">
                    {selectedCampaign ? `Campanha: ${selectedCampaign.name}` : "Campanha (opcional)"}
                  </span>
                  {showCampaignSection ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                {/* Active campaign */}
                {agentStatus !== "offline" && selectedCampaign && (
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Campanha ativa</p>
                      <p className="text-sm font-medium truncate max-w-[200px]">
                        {selectedCampaign.name}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={logout}
                      disabled={loading}
                    >
                      <LogOut className="h-3.5 w-3.5 mr-1" />
                      Sair
                    </Button>
                  </div>
                )}

                {/* Campaign selector */}
                {agentStatus === "offline" && (
                  <>
                    {campaigns.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-2">
                        {loading ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Carregando...
                          </div>
                        ) : (
                          <p className="text-xs">Nenhuma campanha disponível</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Select onValueChange={handleLogin} disabled={!canLogin}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma campanha" />
                          </SelectTrigger>
                          <SelectContent>
                            {campaigns.map((c) => (
                              <SelectItem key={String(c.id)} value={String(c.id)}>
                                {c.name || `Campanha ${c.id}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          Campanhas são opcionais. Você pode discar direto pelo ramal sem entrar em campanha.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {selectedCampaign && agentStatus === "connecting" && !hasCallActivity && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Aguardando agente ficar ocioso
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A 3C Plus ainda está finalizando o login do agente. Você já pode clicar em discar que o sistema tenta novamente automaticamente.
                    </p>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Pause Controls */}
          {agentStatus === "idle" && workBreaks.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Coffee className="h-3.5 w-3.5 mr-2" />
                  Intervalo
                  <ChevronDown className="h-3.5 w-3.5 ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {workBreaks.map((wb) => (
                  <DropdownMenuItem key={String(wb.id)} onClick={() => enterPause(wb.id)}>
                    {wb.name}
                    {wb.time_limit && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {wb.time_limit} min
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* On Break */}
          {agentStatus === "on_break" && (
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Coffee className="h-5 w-5 text-orange-600" />
                <p className="text-sm font-medium">Em intervalo</p>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={exitPause}>
                <Play className="h-3.5 w-3.5 mr-2" />
                Encerrar intervalo
              </Button>
            </div>
          )}

          {/* WebRTC Extension iframe */}
          {showExtension && connectionInfo && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Ramal WebRTC
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setShowExtension((p) => !p)}
                >
                  {showExtension ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="rounded-lg overflow-hidden border border-border bg-background">
                <iframe
                  src={connectionInfo.extension_url}
                  allow="microphone"
                  className="w-full h-[120px] border-0"
                  title="3C Plus Extension"
                  onLoad={() => setExtensionLoaded(true)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Não feche ou recarregue durante uma chamada
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
