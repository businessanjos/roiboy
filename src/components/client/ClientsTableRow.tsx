import { memo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CountryFlag } from "@/components/ui/CountryFlag";

import { CustomField } from "@/components/custom-fields";
import { FieldValueEditor } from "@/components/custom-fields";
import { CheckCircle2, AlertCircle, MessageCircle, Wifi, WifiOff, ArrowRight, Trash2, Clock, PauseCircle, XCircle, Ban, GraduationCap, Briefcase, TrendingUp, TrendingDown, Trophy, Building2, Activity, CalendarDays } from "lucide-react";
import { getMlsBadgeClasses, getMlsLevelLabel } from "@/lib/mls-utils";
import { cn } from "@/lib/utils";
import { 
  getInitials, 
  getContractExpiryStatus,
  getResponsibleUser,
  ContractData, 
  WhatsAppData, 
  TeamUser 
} from "@/hooks/useClientsPage";

interface ClientsTableRowProps {
  client: any;
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
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CountryFlag phone={client.phone_e164} className="text-sm leading-none" />
              <span className="truncate">{client.phone_e164}</span>
            </p>
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

      {/* MLS Level / Graduação Cell */}
      <TableCell className="text-center">
        {client.mls_level ? (
          <Badge className={cn("text-xs", getMlsBadgeClasses(client.mls_level))}>
            {getMlsLevelLabel(client.mls_level)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Business Segment / Área de Atuação Cell */}
      <TableCell className="text-center">
        {client.business_segment ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs max-w-[130px] truncate">
                  <Briefcase className="h-3 w-3 mr-1 flex-shrink-0" />
                  {client.business_segment}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{client.business_segment}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Formação */}
      <TableCell className="text-center">
        {client.education ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs max-w-[120px] truncate">
                  <GraduationCap className="h-3 w-3 mr-1 flex-shrink-0" />
                  {client.education}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {client.education}
                  {client.education_specialty ? ` • ${client.education_specialty}` : ""}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Faturamento Atual */}
      <TableCell className="text-center">
        {client.current_revenue != null ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex flex-col items-center leading-tight">
                  <span className="text-xs font-semibold text-primary">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(client.current_revenue))}
                  </span>
                  {client.current_revenue_month && (
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(client.current_revenue_month + "-01"), "MMM/yy", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Inicial: {client.initial_revenue != null
                    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(client.initial_revenue))
                    : "—"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Evolução */}
      <TableCell className="text-center">
        {(() => {
          const initial = Number(client.initial_revenue) || 0;
          const current = Number(client.current_revenue) || 0;
          if (!initial || !current) return <span className="text-xs text-muted-foreground">—</span>;
          const pct = ((current - initial) / initial) * 100;
          const positive = pct >= 0;
          const Icon = positive ? TrendingUp : TrendingDown;
          return (
            <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", positive ? "text-emerald-600" : "text-red-600")}>
              <Icon className="h-3 w-3" />
              {positive ? "+" : ""}{pct.toFixed(0)}%
            </span>
          );
        })()}
      </TableCell>

      {/* Recorde */}
      <TableCell className="text-center">
        {client.revenue_record ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex flex-col items-center leading-tight">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                    <Trophy className="h-3 w-3" />
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(client.revenue_record.revenue))}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(client.revenue_record.month + "-01"), "MMM/yy", { locale: ptBR })}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Recorde desde o início da mentoria</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Clínicas */}
      <TableCell className="text-center">
        {client.clinics_count > 0 ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  {client.clinics_count}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {client.clinics_count} clínica{client.clinics_count > 1 ? "s" : ""}
                  {client.primary_clinic_name ? ` • Principal: ${client.primary_clinic_name}` : ""}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Ryka */}
      <TableCell className="text-center">
        {(() => {
          const s = client.ryka_status || "none";
          const meta: Record<string, { label: string; cls: string; dot: string }> = {
            active: { label: "Ativo", cls: "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400", dot: "bg-emerald-500" },
            pending: { label: "Pendente", cls: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400", dot: "bg-amber-500" },
            error: { label: "Erro", cls: "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400", dot: "bg-red-500" },
            none: { label: "—", cls: "text-muted-foreground bg-muted", dot: "bg-muted-foreground/40" },
          };
          const m = meta[s];
          if (s === "none") return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium", m.cls)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
              <Activity className="h-3 w-3" />
              {m.label}
            </span>
          );
        })()}
      </TableCell>

      {/* Entrada na mentoria */}
      <TableCell className="text-center">
        {(() => {
          const raw = client.onboarding_started_at || client.contract_start_date || client.created_at;
          if (!raw) return <span className="text-xs text-muted-foreground">—</span>;
          const d = new Date(raw);
          const estimated = !client.onboarding_started_at && !client.contract_start_date;
          const now = new Date();
          const months = Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-flex flex-col items-center leading-tight">
                    <span className="inline-flex items-center gap-1 text-xs font-medium">
                      <CalendarDays className="h-3 w-3" />
                      {format(d, "MMM/yy", { locale: ptBR })}
                    </span>
                    <span className={cn("text-[10px]", estimated ? "text-amber-600" : "text-muted-foreground")}>
                      há {months} {months === 1 ? "mês" : "meses"}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {format(d, "dd/MM/yyyy", { locale: ptBR })}
                    {estimated ? " (estimado — sem data de onboarding)" : ""}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })()}
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
                  {(() => {
                    const status = contractData.status || 'active';
                    const statusConfig: Record<string, { label: string; labelTooltip: string; icon: typeof CheckCircle2; bgClass: string; textClass: string }> = {
                      active: { label: "Ativo", labelTooltip: "Contrato Ativo", icon: CheckCircle2, bgClass: "bg-green-100 dark:bg-green-900/30", textClass: "text-green-700 dark:text-green-400" },
                      pending: { label: "Pendente", labelTooltip: "Contrato Pendente (em assinatura)", icon: Clock, bgClass: "bg-blue-100 dark:bg-blue-900/30", textClass: "text-blue-700 dark:text-blue-400" },
                      paused: { label: "Pausado", labelTooltip: "Contrato Pausado", icon: PauseCircle, bgClass: "bg-amber-100 dark:bg-amber-900/30", textClass: "text-amber-700 dark:text-amber-400" },
                      cancelled: { label: "Cancelado", labelTooltip: "Distrato de Cancelamento", icon: XCircle, bgClass: "bg-red-100 dark:bg-red-900/30", textClass: "text-red-700 dark:text-red-400" },
                      ended: { label: "Encerrado", labelTooltip: "Contrato Encerrado", icon: Ban, bgClass: "bg-slate-100 dark:bg-slate-900/30", textClass: "text-slate-700 dark:text-slate-400" },
                      suspended_bonus: { label: "Susp. Bônus", labelTooltip: "Suspenso Bônus", icon: Ban, bgClass: "bg-yellow-100 dark:bg-yellow-900/30", textClass: "text-yellow-700 dark:text-yellow-400" },
                      dismissal_termination: { label: "Dist. Demissão", labelTooltip: "Distrato por Demissão", icon: XCircle, bgClass: "bg-rose-100 dark:bg-rose-900/30", textClass: "text-rose-700 dark:text-rose-400" },
                    };
                    const config = statusConfig[status] || statusConfig.active;
                    const StatusIcon = config.icon;
                    return (
                      <div className={cn("inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium", config.bgClass, config.textClass)}>
                        <StatusIcon className="h-3 w-3" />
                        <span>{config.label}</span>
                        {contractData.end_date && (
                          <span className="text-[10px] opacity-75">
                            até {format(new Date(contractData.end_date), "dd/MM/yy", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <p className={cn("font-medium", contractData.status === 'pending' ? "text-blue-600 dark:text-blue-400" : contractData.status === 'paused' ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400")}>
                      {contractData.status === 'pending' ? "Contrato Pendente (em assinatura)" : contractData.status === 'paused' ? "Contrato Pausado" : contractData.status === 'cancelled' ? "Contrato Cancelado" : contractData.status === 'ended' ? "Contrato Encerrado" : "Contrato Ativo"}
                    </p>
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
