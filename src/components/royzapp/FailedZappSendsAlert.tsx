import { useNavigate } from "react-router-dom";
import { AlertTriangle, X, Mic, Image as ImageIcon, Video, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFailedZappSends, type FailedSend } from "@/hooks/useFailedZappSends";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const typeIcon = (t: string) => {
  switch (t) {
    case "audio": return Mic;
    case "image": return ImageIcon;
    case "video": return Video;
    case "document": return FileText;
    default: return MessageSquare;
  }
};

const sectorLabel = (s: string | null) => {
  if (!s) return "—";
  if (s === "operacoes") return "Operações";
  if (s === "vendas") return "Vendas";
  return s;
};

export function FailedZappSendsAlert() {
  const navigate = useNavigate();
  const { items, count, breakdown, dismiss, dismissAll } = useFailedZappSends();

  if (count === 0) {
    return null;
  }

  const goToConversation = (item: FailedSend) => {
    navigate(`/roy-zapp?conversation=${item.zapp_conversation_id}`);
  };

  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 relative text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full text-[10px] font-medium flex items-center justify-center bg-destructive text-destructive-foreground">
                  {count > 9 ? "9+" : count}
                </span>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {count} {count === 1 ? "envio sem confirmação" : "envios sem confirmação"} (24h)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="p-3 border-b border-border flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Envios sem confirmação
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mensagens enviadas nas últimas 24h sem ID do WhatsApp
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={dismissAll}
          >
            Limpar
          </Button>
        </div>

        {/* Breakdown */}
        <div className="p-3 border-b border-border space-y-1.5">
          {Object.entries(breakdown).map(([sector, types]) => (
            <div key={sector} className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-foreground">{sectorLabel(sector)}</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {Object.entries(types).map(([type, n]) => {
                  const Icon = typeIcon(type);
                  return (
                    <Badge key={type} variant="secondary" className="gap-1 font-normal">
                      <Icon className="h-3 w-3" />
                      {type} · {n}
                    </Badge>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Per-message list */}
        <ScrollArea className="max-h-[320px]">
          <div className="divide-y divide-border">
            {items.slice(0, 30).map((item) => {
              const Icon = typeIcon(item.message_type);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "p-3 hover:bg-muted/50 group flex items-start gap-2 cursor-pointer"
                  )}
                  onClick={() => goToConversation(item)}
                >
                  <div className="mt-0.5 h-7 w-7 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-700 shrink-0">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-medium truncate">
                        {item.contact_name || item.phone_e164 || "Contato"}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal">
                        {sectorLabel(item.sector_id)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {item.message_type === "audio" ? "🎙 Áudio" :
                       item.message_type === "image" ? "🖼 Imagem" :
                       item.message_type === "video" ? "🎬 Vídeo" :
                       item.message_type === "document" ? "📎 Documento" :
                       (item.content || "—")}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => { e.stopPropagation(); dismiss(item.id); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
            {items.length > 30 && (
              <p className="p-3 text-xs text-center text-muted-foreground">
                +{items.length - 30} mais não exibidos
              </p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
