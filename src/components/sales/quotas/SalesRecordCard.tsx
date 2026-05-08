import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Crown } from "lucide-react";

interface SalesRecordCardProps {
  record: number;
  monthLabel: string | null;
  current: number;
  loading?: boolean;
}

export function SalesRecordCard({ record, monthLabel, current, loading }: SalesRecordCardProps) {
  const isNewRecord = current > 0 && current >= record && record > 0;
  const remaining = Math.max(0, record - current);

  return (
    <Card className="overflow-hidden relative">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" />
          Recorde Pessoal
        </CardTitle>
        <CardDescription>Maior número de vendas em um único mês</CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="flex flex-col items-center justify-center py-4">
          {loading ? (
            <div className="h-16 w-24 bg-muted animate-pulse rounded" />
          ) : (
            <>
              <div className="text-6xl font-bold tabular-nums bg-gradient-to-br from-amber-400 to-orange-600 bg-clip-text text-transparent">
                {record}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {record === 0 ? "vendas" : `venda${record > 1 ? "s" : ""}`}
                {monthLabel ? ` · ${monthLabel}` : ""}
              </p>

              <div className="mt-5 text-center">
                {isNewRecord ? (
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 animate-pulse">
                    🏆 NOVO RECORDE este mês!
                  </p>
                ) : record === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Feche sua primeira venda para começar a contar 🚀
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Faltam <span className="font-semibold text-foreground">{remaining}</span>{" "}
                    venda{remaining !== 1 ? "s" : ""} para bater seu recorde
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
