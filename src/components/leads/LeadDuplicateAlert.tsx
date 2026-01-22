import { AlertTriangle, Phone, Mail, FileText, Building2, ExternalLink, UserCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadDuplicateMatch } from "@/hooks/useLeadDuplicateDetection";

interface LeadDuplicateAlertProps {
  duplicates: LeadDuplicateMatch[];
  onDismiss?: () => void;
  onSelectLead?: (lead: LeadDuplicateMatch) => void;
  onViewLead?: (leadId: string) => void;
  allowIgnore?: boolean;
}

const matchTypeConfig = {
  phone: { label: "Telefone", icon: Phone, color: "text-blue-600 bg-blue-100" },
  cpf: { label: "CPF", icon: FileText, color: "text-orange-600 bg-orange-100" },
  cnpj: { label: "CNPJ", icon: Building2, color: "text-purple-600 bg-purple-100" },
  email: { label: "Email", icon: Mail, color: "text-emerald-600 bg-emerald-100" },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  new: { label: "Novo", color: "bg-blue-500" },
  contacted: { label: "Contatado", color: "bg-amber-500" },
  qualified: { label: "Qualificado", color: "bg-emerald-500" },
  unqualified: { label: "Não Qualificado", color: "bg-gray-500" },
  converted: { label: "Convertido", color: "bg-purple-500" },
};

export function LeadDuplicateAlert({ 
  duplicates, 
  onDismiss, 
  onSelectLead,
  onViewLead,
  allowIgnore = true
}: LeadDuplicateAlertProps) {
  if (duplicates.length === 0) return null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <Alert variant="destructive" className="bg-amber-50 border-amber-200">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800">
        Lead já cadastrado
      </AlertTitle>
      <AlertDescription className="text-amber-700">
        <p className="mb-3">
          Encontramos {duplicates.length} lead{duplicates.length > 1 ? "s" : ""} com dados similares. 
          Verifique antes de continuar:
        </p>
        
        <div className="space-y-2 mb-4">
          {duplicates.map((lead) => {
            const config = matchTypeConfig[lead.matchType];
            const Icon = config.icon;
            const status = statusLabels[lead.status] || statusLabels.new;

            return (
              <div
                key={lead.id}
                className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-amber-200 shadow-sm overflow-hidden"
              >
                {/* Header: Avatar + Nome + Status */}
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-amber-100 text-amber-700 text-xs font-medium">
                      {getInitials(lead.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground truncate flex-1 text-sm">
                    {lead.full_name}
                  </span>
                  <Badge className={`${status.color} text-white text-xs shrink-0`}>
                    {status.label}
                  </Badge>
                </div>
                
                {/* Detalhes: Match Type + Data */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`${config.color} text-xs max-w-full`}>
                    <Icon className="h-3 w-3 mr-1 shrink-0" />
                    <span className="truncate">{config.label}: {lead.matchValue}</span>
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                
                {/* Ações */}
                <div className="flex items-center gap-2 pt-1">
                  {onViewLead && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewLead(lead.id)}
                      className="text-amber-700 border-amber-300 hover:bg-amber-100 flex-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      Ver
                    </Button>
                  )}
                  
                  {onSelectLead && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onSelectLead(lead)}
                      className="bg-amber-600 hover:bg-amber-700 text-white flex-1"
                    >
                      <UserCheck className="h-3.5 w-3.5 mr-1" />
                      Usar este
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {onDismiss && allowIgnore && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-amber-700 hover:text-amber-800 hover:bg-amber-100"
            >
              Ignorar e criar novo lead
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
