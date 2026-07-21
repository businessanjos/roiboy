import { Telescope, TrendingUp, Heart, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

const roiTrend = [
  { month: "Jan", roi: 2.1 },
  { month: "Fev", roi: 2.4 },
  { month: "Mar", roi: 2.8 },
  { month: "Abr", roi: 3.1 },
  { month: "Mai", roi: 3.0 },
  { month: "Jun", roi: 3.4 },
  { month: "Jul", roi: 3.7 },
];

const engagementByChannel = [
  { channel: "Instagram", value: 78 },
  { channel: "YouTube", value: 64 },
  { channel: "TikTok", value: 71 },
  { channel: "WhatsApp", value: 88 },
  { channel: "Email", value: 42 },
];

const churnSignals = [
  { label: "Frustração em atendimento", score: 72, level: "high" as const },
  { label: "Queda de interação (30d)", score: 58, level: "medium" as const },
  { label: "Menções negativas públicas", score: 41, level: "medium" as const },
  { label: "Reclamações financeiras", score: 24, level: "low" as const },
];

const levelStyles: Record<"high" | "medium" | "low", string> = {
  high: "bg-red-500/10 text-red-600 border-red-500/30",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  low: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
};

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  positive,
  hint,
  accent,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  hint: string;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent} bg-opacity-20`}>
          <Icon className="h-4 w-4 text-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <div className="mt-2 flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              positive
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                : "bg-red-500/10 text-red-600 border-red-500/30"
            }
          >
            {positive ? (
              <ArrowUpRight className="h-3 w-3 mr-1" />
            ) : (
              <ArrowDownRight className="h-3 w-3 mr-1" />
            )}
            {delta}
          </Badge>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketingIntelligence() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <Telescope className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Market Intelligence</h1>
          <p className="text-muted-foreground">
            Painel de indicadores estratégicos de mercado, engajamento e retenção emocional
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          icon={TrendingUp}
          label="ROI estimado"
          value="3.7x"
          delta="+18% vs mês anterior"
          positive
          hint="baseado em faturamento x investimento"
          accent="bg-emerald-500"
        />
        <KpiCard
          icon={Heart}
          label="Engajamento médio"
          value="72%"
          delta="+6 pts"
          positive
          hint="média ponderada dos canais"
          accent="bg-purple-500"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Risco de churn emocional"
          value="Médio"
          delta="+4 pts"
          positive={false}
          hint="14 mentorados em alerta"
          accent="bg-amber-500"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução do ROI (últimos 7 meses)</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={roiTrend}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="roi"
                  stroke="hsl(160 84% 39%)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engajamento por canal</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={engagementByChannel}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="channel" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="value" fill="hsl(270 70% 60%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sinais de risco de churn emocional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {churnSignals.map((signal) => (
            <div key={signal.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{signal.label}</span>
                  <Badge variant="outline" className={levelStyles[signal.level]}>
                    {signal.level === "high"
                      ? "Alto"
                      : signal.level === "medium"
                      ? "Médio"
                      : "Baixo"}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">{signal.score}/100</span>
              </div>
              <Progress value={signal.score} className="h-2" />
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-2">
            Indicadores calculados a partir de sinais de conversas, atendimento e menções.
            Este painel usa dados de referência enquanto a coleta automatizada é integrada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
