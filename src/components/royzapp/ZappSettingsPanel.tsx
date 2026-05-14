import { memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wifi,
  WifiOff,
  Power,
  Users,
  Download,
  Loader2,
  PenLine,
  Sparkles,
  Wand2,
  Brain,
  Bell,
  BellOff,
  BellRing,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ZappConnectionsSection } from "./settings/ZappConnectionsSection";

import type { NotificationPermissionStatus } from "@/hooks/useZappNotifications";

interface ZappSettingsPanelProps {
  sectorId?: string | null;
  sectorName?: string;
  whatsappConnected: boolean;
  whatsappConnecting: boolean;
  whatsappInstanceName: string | null;
  roundRobinEnabled: boolean;
  respectLimitEnabled: boolean;
  soundEnabled: boolean;
  importLimit: string;
  importingConversations: boolean;
  userSignature: string;
  // AI Settings
  spellingEnabled?: boolean;
  // System Notifications
  notificationPermission?: NotificationPermissionStatus;
  onToggleWhatsAppConnection: () => void;
  onRoundRobinChange: (checked: boolean) => void;
  onRespectLimitChange: (checked: boolean) => void;
  onSoundChange: (checked: boolean) => void;
  onImportLimitChange: (value: string) => void;
  onImportConversations: () => void;
  onSignatureChange: (value: string) => void;
  // AI Handlers
  onSpellingChange?: (checked: boolean) => void;
  // System Notifications Handler
  onRequestNotificationPermission?: () => void;
}

export const ZappSettingsPanel = memo(function ZappSettingsPanel({
  sectorId = null,
  sectorName = "",
  whatsappConnected,
  whatsappConnecting,
  whatsappInstanceName,
  roundRobinEnabled,
  respectLimitEnabled,
  soundEnabled,
  importLimit,
  importingConversations,
  userSignature,
  spellingEnabled = true,
  notificationPermission = "default",
  onToggleWhatsAppConnection,
  onRoundRobinChange,
  onRespectLimitChange,
  onSoundChange,
  onImportLimitChange,
  onImportConversations,
  onSignatureChange,
  onSpellingChange,
  onRequestNotificationPermission,
}: ZappSettingsPanelProps) {
  const navigate = useNavigate();

  return (
    <div className="p-4 space-y-6">
      <h3 className="text-zapp-text font-medium">Configurações</h3>

      {/* WhatsApp Connection */}
      <div className="space-y-3">
        <div>
          <p className="text-zapp-text text-sm font-medium">Conexão WhatsApp</p>
          <p className="text-zapp-text-muted text-xs">Ative para receber e enviar mensagens pelo zAPP</p>
        </div>
        
        <div className={cn(
          "p-4 rounded-lg border-2 transition-colors",
          whatsappConnected 
            ? "bg-zapp-accent/10 border-zapp-accent" 
            : "bg-zapp-panel border-zapp-border"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {whatsappConnected ? (
                <div className="w-10 h-10 rounded-full bg-zapp-accent flex items-center justify-center">
                  <Wifi className="h-5 w-5 text-white" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-zapp-bg flex items-center justify-center">
                  <WifiOff className="h-5 w-5 text-zapp-text-muted" />
                </div>
              )}
              <div>
                <p className="text-zapp-text text-sm font-medium">
                  {whatsappConnected ? "Conectado" : "Desconectado"}
                </p>
                <p className="text-zapp-text-muted text-xs">
                  {whatsappConnected 
                    ? "Recebendo mensagens em tempo real" 
                    : "Clique para ativar a conexão"}
                </p>
              </div>
            </div>
            <Button
              variant={whatsappConnected ? "outline" : "default"}
              size="sm"
              onClick={onToggleWhatsAppConnection}
              disabled={whatsappConnecting}
              className={cn(
                whatsappConnected 
                  ? "border-red-500 text-red-500 hover:bg-red-500/10" 
                  : "bg-zapp-accent hover:bg-zapp-accent-hover text-white"
              )}
            >
              {whatsappConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Power className="h-4 w-4 mr-1" />
                  {whatsappConnected ? "Desligar" : "Ligar"}
                </>
              )}
            </Button>
          </div>
          {whatsappInstanceName && (
            <p className="text-zapp-text-muted text-xs mt-2">
              Instância: {whatsappInstanceName}
            </p>
          )}
        </div>
      </div>

      {/* Access Configuration Notice */}
      <div className="space-y-3 pt-4 border-t border-zapp-border">
        <div>
          <p className="text-zapp-text text-sm font-medium">Controle de Acesso</p>
          <p className="text-zapp-text-muted text-xs">
            O acesso ao ROY zAPP é controlado pela permissão "Acessar ROY zAPP" configurada na página de Equipe → Cargos.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/team")}
          className="border-zapp-border text-zapp-text hover:bg-zapp-hover"
        >
          <Users className="h-4 w-4 mr-2" />
          Gerenciar Cargos
        </Button>
      </div>

      {/* Notification Settings */}
      <div className="space-y-4 pt-4 border-t border-zapp-border">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-zapp-accent" />
          <p className="text-zapp-text text-sm font-medium">Notificações</p>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-zapp-panel rounded-lg">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-zapp-text text-sm">Som de nova conversa</p>
              <p className="text-zapp-text-muted text-xs">Tocar som ao receber mensagem</p>
            </div>
          </div>
          <Switch 
            checked={soundEnabled} 
            onCheckedChange={onSoundChange}
            className="data-[state=checked]:bg-zapp-accent" 
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-zapp-panel rounded-lg">
          <div className="flex items-center gap-2">
            {notificationPermission === "granted" ? (
              <Bell className="h-4 w-4 text-emerald-500" />
            ) : notificationPermission === "denied" ? (
              <BellOff className="h-4 w-4 text-red-500" />
            ) : (
              <Bell className="h-4 w-4 text-amber-500" />
            )}
            <div>
              <p className="text-zapp-text text-sm">Notificações do Sistema</p>
              <p className="text-zapp-text-muted text-xs">
                {notificationPermission === "granted" 
                  ? "Receba alertas mesmo em background"
                  : notificationPermission === "denied"
                  ? "Bloqueadas pelo navegador"
                  : notificationPermission === "unsupported"
                  ? "Não suportado neste navegador"
                  : "Clique para ativar alertas push"}
              </p>
            </div>
          </div>
          
          {notificationPermission === "granted" ? (
            <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Ativadas
            </span>
          ) : notificationPermission === "denied" ? (
            <span className="text-xs text-red-500 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Bloqueadas
            </span>
          ) : notificationPermission === "unsupported" ? (
            <span className="text-xs text-zapp-text-muted font-medium">
              Indisponível
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestNotificationPermission}
              className="border-zapp-accent text-zapp-accent hover:bg-zapp-accent/10 h-7 text-xs"
            >
              Ativar
            </Button>
          )}
        </div>
        
        {notificationPermission === "denied" && (
          <p className="text-xs text-amber-500 px-3">
            💡 Para ativar, clique no ícone de cadeado na barra de endereço do navegador e permita notificações.
          </p>
        )}
      </div>

      {/* Distribution Settings */}
      <div className="space-y-4 pt-4 border-t border-zapp-border">
        <p className="text-zapp-text text-sm font-medium">Distribuição</p>
        
        <div className="flex items-center justify-between p-3 bg-zapp-panel rounded-lg">
          <div>
            <p className="text-zapp-text text-sm">Distribuição round-robin</p>
            <p className="text-zapp-text-muted text-xs">Distribui igualmente entre atendentes</p>
          </div>
          <Switch 
            checked={roundRobinEnabled} 
            onCheckedChange={onRoundRobinChange}
            className="data-[state=checked]:bg-zapp-accent" 
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-zapp-panel rounded-lg">
          <div>
            <p className="text-zapp-text text-sm">Respeitar limite</p>
            <p className="text-zapp-text-muted text-xs">Não atribuir se atingiu o máximo</p>
          </div>
          <Switch 
            checked={respectLimitEnabled} 
            onCheckedChange={onRespectLimitChange}
            className="data-[state=checked]:bg-zapp-accent" 
          />
        </div>
      </div>

      {/* AI Assistant Settings */}
      <div className="space-y-4 pt-4 border-t border-zapp-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-zapp-accent" />
          <p className="text-zapp-text text-sm font-medium">Assistente IA</p>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-zapp-panel rounded-lg">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-amber-500" />
            <div>
              <p className="text-zapp-text text-sm">Corretor de Português</p>
              <p className="text-zapp-text-muted text-xs">Corrige ortografia e gramática</p>
            </div>
          </div>
          <Switch 
            checked={spellingEnabled} 
            onCheckedChange={onSpellingChange}
            className="data-[state=checked]:bg-zapp-accent" 
          />
        </div>

      </div>

      {/* User Signature */}
      <div className="space-y-4 pt-4 border-t border-zapp-border">
        <div>
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-zapp-accent" />
            <p className="text-zapp-text text-sm font-medium">Assinatura</p>
          </div>
          <p className="text-zapp-text-muted text-xs mt-1">
            Identifique-se nas mensagens que enviar. Aparecerá no topo da mensagem.
          </p>
        </div>
        
        <div className="p-4 bg-zapp-panel rounded-lg space-y-3">
          <div>
            <Label htmlFor="signature" className="text-zapp-text text-xs">
              Sua assinatura personalizada
            </Label>
            <Textarea
              id="signature"
              value={userSignature}
              onChange={(e) => onSignatureChange(e.target.value)}
              placeholder="Ex: João Silva | Consultor&#10;📞 (11) 9999-9999"
              className="mt-1 bg-zapp-input border-zapp-border text-zapp-text placeholder:text-zapp-text-muted min-h-[80px] resize-none"
            />
          </div>
          
          {userSignature && (
            <div className="p-3 bg-zapp-bg rounded-lg">
              <p className="text-xs text-zapp-text-muted mb-1">Prévia:</p>
              <div className="text-sm text-zapp-text whitespace-pre-wrap border-l-2 border-zapp-accent pl-2">
                {userSignature}
              </div>
            </div>
          )}
          
          <p className="text-xs text-zapp-text-muted">
            💡 Use o botão <PenLine className="h-3 w-3 inline" /> no chat para ativar/desativar a assinatura em cada mensagem.
          </p>
        </div>
      </div>

      {/* Import Conversations */}
      <div className="space-y-4 pt-4 border-t border-zapp-border">
        <div>
          <p className="text-zapp-text text-sm font-medium">Importar Conversas</p>
          <p className="text-zapp-text-muted text-xs">
            Carrega as últimas conversas do WhatsApp para o sistema
          </p>
        </div>
        
        <div className="p-4 bg-zapp-panel rounded-lg space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label htmlFor="importLimit" className="text-zapp-text text-xs">
                Quantidade de conversas
              </Label>
              <Select value={importLimit} onValueChange={onImportLimitChange}>
                <SelectTrigger className="mt-1 bg-zapp-input border-zapp-border text-zapp-text">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 conversas</SelectItem>
                  <SelectItem value="50">50 conversas</SelectItem>
                  <SelectItem value="100">100 conversas</SelectItem>
                  <SelectItem value="200">200 conversas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button
            onClick={onImportConversations}
            disabled={importingConversations || !whatsappConnected}
            className="w-full bg-zapp-accent hover:bg-zapp-accent-hover text-white"
          >
            {importingConversations ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Carregar Conversas
              </>
            )}
          </Button>
          
          {!whatsappConnected && (
            <p className="text-amber-500 text-xs text-center">
              Conecte o WhatsApp primeiro para importar conversas
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
