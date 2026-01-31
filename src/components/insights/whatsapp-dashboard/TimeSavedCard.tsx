import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface TimeSavedCardProps {
  totalMessages: number;
  avgTimePerMessageSeconds?: number;
  isLoading?: boolean;
}

export function TimeSavedCard({ 
  totalMessages, 
  avgTimePerMessageSeconds = 30,
  isLoading 
}: TimeSavedCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-muted rounded-full animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-48 animate-pulse" />
              <div className="h-8 bg-muted rounded w-32 animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate time saved (assuming automated responses save time)
  const totalSecondsHandled = totalMessages * avgTimePerMessageSeconds;
  
  // Convert to human-readable format
  const months = Math.floor(totalSecondsHandled / (30 * 24 * 60 * 60));
  const remainingAfterMonths = totalSecondsHandled % (30 * 24 * 60 * 60);
  const days = Math.floor(remainingAfterMonths / (24 * 60 * 60));
  const remainingAfterDays = remainingAfterMonths % (24 * 60 * 60);
  const hours = Math.floor(remainingAfterDays / (60 * 60));

  let timeString = '';
  if (months > 0) {
    timeString = `${months} ${months === 1 ? 'mês' : 'meses'} ${hours}h`;
  } else if (days > 0) {
    timeString = `${days} ${days === 1 ? 'dia' : 'dias'} ${hours}h`;
  } else {
    timeString = `${hours} horas`;
  }

  return (
    <Card className="bg-card/50 border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Tempo economizado por utilizar a RYKA
            </p>
            <p className="text-2xl font-bold text-primary">
              {timeString}
            </p>
            <p className="text-xs text-muted-foreground">
              Automatização e otimização de processos
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
