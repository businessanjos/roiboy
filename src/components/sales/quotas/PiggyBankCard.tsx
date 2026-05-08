import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PiggyBank } from "lucide-react";

interface PiggyBankCardProps {
  value: number;
  salesCount: number;
  loading?: boolean;
}

// Marcos de progresso por número de vendas no mês
const MILESTONES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function nextMilestone(salesCount: number) {
  for (const m of MILESTONES) if (m > salesCount) return m;
  return null;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

export function PiggyBankCard({ value, salesCount, loading }: PiggyBankCardProps) {
  const next = nextMilestone(salesCount);
  const remaining = next ? next - salesCount : 0;

  return (
    <Card className="overflow-hidden relative">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-pink-500" />
          Cofrinho de Bônus & SPIFFs
        </CardTitle>
        <CardDescription>
          Acompanhe o acumulado de bônus e SPIFFs do mês.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="flex flex-col items-center justify-center py-2">
          <div className="text-center space-y-1">
            {loading ? (
              <div className="h-9 w-40 bg-muted animate-pulse rounded mx-auto" />
            ) : (
              <>
                <div className="text-3xl font-bold tabular-nums text-foreground">
                  {fmtBRL(value)}
                </div>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {salesCount} {salesCount === 1 ? "venda" : "vendas"} no mês
                </p>
              </>
            )}
          </div>

          {next && !loading && (
            <div className="w-full mt-5">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (salesCount / next) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
