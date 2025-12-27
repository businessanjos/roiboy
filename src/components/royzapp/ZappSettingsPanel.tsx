import { memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wifi,
  WifiOff,
  Power,
  Users,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ZappSettingsPanelProps {
  whatsappConnected: boolean;
  whatsappConnecting: boolean;
  whatsappInstanceName: string | null;
  roundRobinEnabled: boolean;
  respectLimitEnabled: boolean;
  soundEnabled: boolean;
  importLimit: string;
  importingConversations: boolean;
  onToggleWhatsAppConnection: () => void;
  onRoundRobinChange: (checked: boolean) => void;
  onRespectLimitChange: (checked: boolean) => void;
  onSoundChange: (checked: boolean) => void;
  onImportLimitChange: (value: string) => void;
  onImportConversations: () => void;
}

export const ZappSettingsPanel = memo(function ZappSettingsPanel({
  whatsappConnected,
  whatsappConnecting,
  whatsappInstanceName,
  roundRobinEnabled,
  respectLimitEnabled,
  soundEnabled,
  importLimit,
  importingConversations,
  onToggleWhatsAppConnection,
  onRoundRobinChange,
  onRespectLimitChange,
  onSoundChange,
  onImportLimitChange,
  onImportConversations,
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

        <div className="flex items-center justify-between p-3 bg-zapp-panel rounded-lg">
          <div>
            <p className="text-zapp-text text-sm">Som de nova conversa</p>
            <p className="text-zapp-text-muted text-xs">Tocar som ao receber mensagem</p>
          </div>
          <Switch 
            checked={soundEnabled} 
            onCheckedChange={onSoundChange}
            className="data-[state=checked]:bg-zapp-accent" 
          />
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
