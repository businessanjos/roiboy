import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, ArrowRight, Target } from "lucide-react";

interface ConversionScoreCardsProps {
  overallConversion: number;
  totalDeals: number;
  wonDeals: number;
  lostDeals: number;
  isLoading?: boolean;
}

export function ConversionScoreCards({ 
  overallConversion, 
  totalDeals, 
  wonDeals,
  lostDeals,
  isLoading 
}: ConversionScoreCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-1/2 mb-3" />
              <div className="h-8 bg-muted rounded w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const openDeals = totalDeals - wonDeals - lostDeals;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Conversão Total</span>
          </div>
          <p className="text-3xl font-bold text-primary">{overallConversion}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            {wonDeals} ganhos de {totalDeals} negócios
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-muted-foreground">Negócios Ganhos</span>
          </div>
          <p className="text-3xl font-bold text-green-500">{wonDeals}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {openDeals} em andamento
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-muted-foreground">Negócios Perdidos</span>
          </div>
          <p className="text-3xl font-bold text-red-500">{lostDeals}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalDeals > 0 ? Math.round((lostDeals / totalDeals) * 100) : 0}% do total
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
