import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface ConversionScoreCardsProps {
  overallConversion: number;
  stageConversions?: { from: string; to: string; rate: number; fromCount?: number; toCount?: number }[];
  wonDeals?: number;
  totalDeals?: number;
  isLoading?: boolean;
}

export function ConversionScoreCards({ 
  overallConversion,
  stageConversions = [],
  wonDeals = 0,
  totalDeals = 0,
  isLoading 
}: ConversionScoreCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="text-center animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-2" />
            <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  // Default stage conversions if not provided
  const defaultConversions = [
    { from: 'Lead', to: 'Contato Feito', rate: 0, fromCount: 0, toCount: 0 },
    { from: 'Contato Feito', to: 'Proposta Enviada', rate: 0, fromCount: 0, toCount: 0 },
  ];

  const conversions = stageConversions.length > 0 ? stageConversions : defaultConversions;

  return (
    <TooltipProvider>
      <div className="grid grid-cols-3 gap-6 py-4 border-t border-b border-border/50">
        {/* Overall Conversion */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">Conversão Total</p>
          <p className="text-2xl font-bold text-primary">{overallConversion}%</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1">
                <HelpCircle className="h-3 w-3" />
                <span>Como é calculado?</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-sm">
                <strong>{wonDeals}</strong> negócios ganhos ÷ <strong>{totalDeals}</strong> total de negócios = <strong>{overallConversion}%</strong>
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Stage to Stage Conversions */}
        {conversions.slice(0, 2).map((conv, index) => (
          <div key={index} className="text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {conv.from} → {conv.to}
            </p>
            <p className="text-2xl font-bold">{conv.rate}%</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1">
                  <HelpCircle className="h-3 w-3" />
                  <span>Como é calculado?</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-sm">
                  <strong>{conv.toCount ?? 0}</strong> em "{conv.to}" ÷ <strong>{conv.fromCount ?? 0}</strong> em "{conv.from}" = <strong>{conv.rate}%</strong>
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
