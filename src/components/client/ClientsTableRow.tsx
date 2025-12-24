import { memo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VNPSBadge } from "@/components/ui/vnps-badge";
import { CustomField } from "@/components/custom-fields";
import { FieldValueEditor } from "@/components/custom-fields";
import { CheckCircle2, AlertCircle, MessageCircle, Wifi, WifiOff, ArrowRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  getInitials, 
  getContractExpiryStatus,
  getResponsibleUser,
  VNPSData, 
  ScoreData, 
  ContractData, 
  WhatsAppData, 
  TeamUser 
} from "@/hooks/useClientsPage";

interface ClientsTableRowProps {
  client: any;
  vnpsData?: VNPSData;
  scoreData?: ScoreData;
  contractData?: ContractData;
  whatsappData?: WhatsAppData;
  customFields: CustomField[];
  fieldValues: Record<string, any>;
  teamUsers: TeamUser[];
  onProductClick: (client: any) => void;
  onContractClick: (client: any) => void;
  onDeleteClick: (client: any) => void;
  onFieldValueChange: (clientId: string, fieldId: string, value: any) => void;
  accountId: string;
}

export const ClientsTableRow = memo(function ClientsTableRow({
  client,
  vnpsData,
  scoreData,
  contractData,
  whatsappData,
  customFields,
  fieldValues,
  teamUsers,
  onProductClick,
  onContractClick,
  onDeleteClick,
  onFieldValueChange,
  accountId,
}: ClientsTableRowProps) {
  const responsibleUser = getResponsibleUser(client, teamUsers);
  const hasMessages = whatsappData && whatsappData.messageCount > 0;

  return (
    <TableRow className="hover:bg-muted/30 group">
      {/* Client Cell */}
      <TableCell className="sticky left-0 bg-background group-hover:bg-muted/30 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
        <div className="min-w-[180px] flex items-center gap-2">
          <Avatar className="h-9 w-9 flex-shrink-0">
            {client.avatar_url ? (
              <AvatarImage src={client.avatar_url} alt={client.full_name} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {getInitials(client.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <Link 
              to={`/clients/${client.id}`}
              className="font-medium truncate hover:text-primary hover:underline transition-colors block"
            >
              {client.full_name}
            </Link>
            <p className="text-xs text-muted-foreground">{client.phone_e164}</p>
          </div>
        </div>
      </TableCell>

      {/* Product Cell */}
      <TableCell className="text-center">
        <button
          onClick={() => onProductClick(client)}
          className="cursor-pointer hover:opacity-80 transition-opacity"
        >
          {client.client_products && client.client_products.length > 0 ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-wrap justify-center gap-1">
                    {client.client_products.slice(0, 2).map((cp: any) => (
                      <Badge key={cp.product_id} variant="secondary" className="text-xs">
                        {cp.products?.name || "Produto"}
                      </Badge>
                    ))}
                    {client.client_products.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{client.client_products.length - 2}
                      </Badge>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    {client.client_products.map((cp: any) => (
                      <p key={cp.product_id}>{cp.products?.name}</p>
                    ))}
                    <p className="mt-1 text-primary">Clique para editar</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground">-</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Clique para adicionar produtos</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </button>
      </TableCell>

      {/* Contract Cell */}
      <TableCell className="text-center">
        <button
          onClick={() => onContractClick(client)}
          className="cursor-pointer hover:opacity-80 transition-opacity"
        >
          {contractData ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Ativo</span>
                    {contractData.end_date && (
                      <span className="text-[10px] opacity-75">
                        até {format(new Date(contractData.end_date), "dd/MM/yy", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <p className="font-medium text-green-600 dark:text-green-400">Contrato Ativo</p>
                    {contractData.start_date && (
                      <p>Início: {format(new Date(contractData.start_date), "dd/MM/yyyy", { locale: ptBR })}</p>
                    )}
                    {contractData.end_date && (
                      <p>Fim: {format(new Date(contractData.end_date), "dd/MM/yyyy", { locale: ptBR })}</p>
                    )}
                    <p className="mt-1 text-primary">Clique para gerenciar</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3" />
                    <span>Sem contrato</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Clique para adicionar contrato</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </button>
      </TableCell>

      {/* Roizometer Cell */}
      <TableCell className="text-center">
        {scoreData ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded-md text-xs font-bold",
                  scoreData.roizometer >= 70
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : scoreData.roizometer >= 40
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-destructive/10 text-destructive"
                )}>
                  {scoreData.roizometer}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <p className="font-medium">Roizômetro: {scoreData.roizometer}%</p>
                  <p className="text-muted-foreground">Percepção de ROI do cliente</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* E-Score Cell */}
      <TableCell className="text-center">
        {scoreData ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded-md text-xs font-bold",
                  scoreData.escore >= 70
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : scoreData.escore >= 40
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-destructive/10 text-destructive"
                )}>
                  {scoreData.escore}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <p className="font-medium">E-Score: {scoreData.escore}</p>
                  <p className="text-muted-foreground">Engajamento do cliente</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* WhatsApp Cell */}
      <TableCell className="text-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
                hasMessages 
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              )}>
                {hasMessages ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {hasMessages && <span>{whatsappData!.messageCount}</span>}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {hasMessages ? (
                <div className="text-xs">
                  <p className="font-medium text-green-600 dark:text-green-400">WhatsApp conectado</p>
                  <p>{whatsappData!.messageCount} mensagem(ns)</p>
                  {whatsappData!.lastMessageAt && (
                    <p>Última: {format(new Date(whatsappData!.lastMessageAt), "dd/MM/yy", { locale: ptBR })}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs">Sem mensagens WhatsApp</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>

      {/* V-NPS Cell */}
      <TableCell className="text-center">
      {vnpsData ? (
          <VNPSBadge
            score={vnpsData.vnps_score}
            vnpsClass={vnpsData.vnps_class as "detractor" | "neutral" | "promoter"}
            trend={vnpsData.trend as "up" | "flat" | "down" | undefined}
            size="sm"
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Responsible Cell */}
      <TableCell className="text-center">
        {responsibleUser ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-1.5">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                      {getInitials(responsibleUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs max-w-[80px] truncate">{responsibleUser.name.split(' ')[0]}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <p className="font-medium">{responsibleUser.name}</p>
                  <p className="text-muted-foreground">{responsibleUser.email}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Custom Field Cells */}
      {customFields.map((field) => (
        <TableCell key={field.id} className="text-center min-w-[120px]">
          <FieldValueEditor
            field={field}
            currentValue={fieldValues[field.id]}
            onValueChange={(fieldId, newValue) => onFieldValueChange(client.id, fieldId, newValue)}
            clientId={client.id}
            accountId={accountId}
          />
        </TableCell>
      ))}

      {/* Actions Cell */}
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                  onClick={() => onDeleteClick(client)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Excluir cliente</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
            <Link to={`/clients/${client.id}`}>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});
