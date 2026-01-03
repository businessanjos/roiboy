import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Phone, Mail, FileText, Building2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { DuplicateMatch } from "@/hooks/useDuplicateDetection";

interface DuplicateAlertProps {
  duplicates: DuplicateMatch[];
  onDismiss?: () => void;
  onSelectClient?: (clientId: string) => void;
}

const matchTypeConfig = {
  phone: { label: "Telefone", icon: Phone, color: "text-blue-600" },
  cpf: { label: "CPF", icon: FileText, color: "text-purple-600" },
  cnpj: { label: "CNPJ", icon: Building2, color: "text-amber-600" },
  email: { label: "E-mail", icon: Mail, color: "text-emerald-600" },
};

export function DuplicateAlert({ duplicates, onDismiss, onSelectClient }: DuplicateAlertProps) {
  if (duplicates.length === 0) return null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .slice(0, 2)
      .map(n => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <Alert variant="destructive" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-400">
        Possível cliente duplicado
      </AlertTitle>
      <AlertDescription className="mt-3">
        <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
          Encontramos {duplicates.length === 1 ? "um cliente" : `${duplicates.length} clientes`} com dados similares.
          Verifique antes de continuar:
        </p>
        
        <div className="space-y-2">
          {duplicates.map((match) => {
            const config = matchTypeConfig[match.matchType];
            const MatchIcon = config.icon;
            
            return (
              <div
                key={match.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-background border border-amber-200 dark:border-amber-800"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={match.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(match.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{match.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                        <MatchIcon className={`h-3 w-3 ${config.color}`} />
                        {config.label}: {match.matchValue}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {onSelectClient && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => onSelectClient(match.id)}
                    >
                      Usar este
                    </Button>
                  )}
                  <Link to={`/clients/${match.id}`} target="_blank">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {onDismiss && (
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={onDismiss}>
              Ignorar e continuar
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
