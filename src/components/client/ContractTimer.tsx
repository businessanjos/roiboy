import { useMemo } from "react";
import { differenceInDays, differenceInMonths, differenceInYears, format, isPast, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ContractTimerProps {
  startDate?: string | null;
  endDate?: string | null;
  className?: string;
  variant?: "compact" | "full";
}

export function ContractTimer({ startDate, endDate, className, variant = "compact" }: ContractTimerProps) {
  const contractInfo = useMemo(() => {
    if (!startDate || !endDate) return null;

    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const now = new Date();

    if (!isValid(start) || !isValid(end)) return null;

    const totalDays = differenceInDays(end, start);
    const elapsedDays = differenceInDays(now, start);
    const remainingDays = differenceInDays(end, now);
    const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

    const isExpired = isPast(end);
    const isNearEnd = remainingDays <= 30 && remainingDays > 0;
    const isActive = !isExpired && now >= start;

    // Format remaining time
    let remainingText = "";
    if (isExpired) {
      const daysExpired = Math.abs(remainingDays);
      if (daysExpired > 365) {
        remainingText = `Expirado há ${differenceInYears(now, end)} ano(s)`;
      } else if (daysExpired > 30) {
        remainingText = `Expirado há ${differenceInMonths(now, end)} mês(es)`;
      } else {
        remainingText = `Expirado há ${daysExpired} dia(s)`;
      }
    } else if (remainingDays > 365) {
      const years = differenceInYears(end, now);
      const months = differenceInMonths(end, now) % 12;
      remainingText = `${years} ano(s) e ${months} mês(es)`;
    } else if (remainingDays > 30) {
      const months = differenceInMonths(end, now);
      remainingText = `${months} mês(es)`;
    } else {
      remainingText = `${remainingDays} dia(s)`;
    }

    return {
      start,
      end,
      totalDays,
      elapsedDays,
      remainingDays,
      progress,
      isExpired,
      isNearEnd,
      isActive,
      remainingText,
    };
  }, [startDate, endDate]);

  if (!contractInfo) {
    return null;
  }

  const { start, end, progress, isExpired, isNearEnd, isActive, remainingText } = contractInfo;

  if (variant === "compact") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-default transition-colors",
                isExpired && "bg-destructive/10 text-destructive",
                isNearEnd && !isExpired && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                isActive && !isNearEnd && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                className
              )}
            >
              {isExpired ? (
                <AlertTriangle className="h-3 w-3" />
              ) : isNearEnd ? (
                <Clock className="h-3 w-3" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              <span>{remainingText}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="p-3 w-56">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Início</span>
                <span className="font-medium">{format(start, "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Fim</span>
                <span className="font-medium">{format(end, "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress 
                  value={progress} 
                  className={cn(
                    "h-1.5",
                    isExpired && "[&>div]:bg-destructive",
                    isNearEnd && !isExpired && "[&>div]:bg-amber-500",
                    isActive && !isNearEnd && "[&>div]:bg-green-500"
                  )}
                />
              </div>
              <div className={cn(
                "text-xs font-medium text-center pt-1 border-t",
                isExpired && "text-destructive",
                isNearEnd && !isExpired && "text-amber-600 dark:text-amber-400",
                isActive && !isNearEnd && "text-green-600 dark:text-green-400"
              )}>
                {isExpired ? "Contrato expirado" : isNearEnd ? "Próximo do vencimento" : "Contrato ativo"}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{format(start, "dd/MM/yyyy", { locale: ptBR })}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span>{format(end, "dd/MM/yyyy", { locale: ptBR })}</span>
        </div>
      </div>
      
      <Progress 
        value={progress} 
        className={cn(
          "h-2",
          isExpired && "[&>div]:bg-destructive",
          isNearEnd && !isExpired && "[&>div]:bg-amber-500",
          isActive && !isNearEnd && "[&>div]:bg-green-500"
        )}
      />
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {Math.round(progress)}% do contrato
        </span>
        <span 
          className={cn(
            "font-medium",
            isExpired && "text-destructive",
            isNearEnd && !isExpired && "text-amber-600 dark:text-amber-400",
            isActive && !isNearEnd && "text-green-600 dark:text-green-400"
          )}
        >
          {isExpired ? (
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {remainingText}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {remainingText} restantes
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
