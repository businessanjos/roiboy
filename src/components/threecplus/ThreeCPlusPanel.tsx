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
  } = useThreeCPlus();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showExtension, setShowExtension] = useState(false);
  const [manualPhone, setManualPhone] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Initialize connection
  const handleInit = useCallback(async () => {
    if (initialized) return;
    const ok = await connect();
    if (ok) {
      setInitialized(true);
      await fetchCampaigns();
    }
  }, [connect, fetchCampaigns, initialized]);

  // Open panel
  const handleOpen = useCallback(async () => {
    setIsOpen(true);
    setIsMinimized(false);
    if (!initialized) {
      await handleInit();
    }
  }, [handleInit, initialized]);

  // Connect Socket.io after getting connection info
  useEffect(() => {
    if (connectionInfo && !isConnected) {
      connectSocket(connectionInfo.domain, connectionInfo.api_token);
      setShowExtension(true);
    }
  }, [connectionInfo, isConnected, connectSocket]);

  // Login to selected campaign
  const handleLogin = useCallback(
    async (campaignId: string) => {
      const campaign = campaigns.find((c) => String(c.id) === campaignId);
      if (campaign) {
        await loginCampaign(campaign);
      }
    },
    [campaigns, loginCampaign]
  );

  // Make manual call
  const handleManualCall = useCallback(async () => {
    if (!manualPhone.trim()) return;
    const ok = await manualCall(manualPhone.trim());
    if (ok) setManualPhone("");
  }, [manualCall, manualPhone]);

  const statusInfo = getStatusInfo(agentStatus);
  const StatusIcon = statusInfo.icon;
  const isInCall = agentStatus === "on_call" || agentStatus === "manual_call_connected";

  // Floating button when panel is closed
  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg transition-all hover:scale-105",
          "bg-primary text-primary-foreground",
          isInCall && "bg-red-600 text-white animate-pulse"
        )}
      >
        <Phone className="h-5 w-5" />
        <span className="text-sm font-medium">3C Plus</span>
        {agentStatus !== "offline" && (
          <span className={cn("h-2.5 w-2.5 rounded-full", statusInfo.color)} />
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
        <span className={cn("h-2.5 w-2.5 rounded-full", statusInfo.color)} />
        <span className="text-sm font-medium">{statusInfo.label}</span>
        {isInCall && (
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
            className={cn("text-xs gap-1", isInCall && "border-red-500 text-red-500")}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", statusInfo.color)} />
            {statusInfo.label}
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
          {/* Campaign Login */}
          {agentStatus === "offline" && (
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Campanha
              </label>
              {campaigns.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando...
                    </div>
                  ) : (
                    "Nenhuma campanha disponível"
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Select onValueChange={handleLogin} disabled={loading}>
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
                </div>
              )}
            </div>
          )}

          {/* Active Session Info */}
          {agentStatus !== "offline" && selectedCampaign && (
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              <div>
                <p className="text-xs text-muted-foreground">Campanha</p>
                <p className="text-sm font-medium truncate max-w-[200px]">
                  {selectedCampaign.name}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={logout}
                disabled={loading || isInCall}
              >
                <LogOut className="h-3.5 w-3.5 mr-1" />
                Sair
              </Button>
            </div>
          )}

          {/* In-Call Display */}
          {isInCall && currentCall && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center">
                    <PhoneCall className="h-4 w-4 text-red-500 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {currentCall.contact_name || currentCall.phone || "Chamada ativa"}
                    </p>
                    {currentCall.phone && currentCall.contact_name && (
                      <p className="text-xs text-muted-foreground">{currentCall.phone}</p>
                    )}
                  </div>
                </div>
                <Badge variant="destructive" className="font-mono text-sm">
                  {formatTime(callTimer)}
                </Badge>
              </div>

              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={hangup}
                disabled={loading}
              >
                <PhoneOff className="h-4 w-4 mr-2" />
                Desligar
              </Button>

              {/* Qualifications */}
              {currentCall.qualifications && currentCall.qualifications.length > 0 && (
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

          {/* Manual Call */}
          {(agentStatus === "idle" || agentStatus === "manual_mode") && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Ligação Manual
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="(11) 99999-9999"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualCall()}
                  className="text-sm"
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
            </div>
          )}

          {/* Exit manual mode button */}
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
