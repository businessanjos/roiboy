import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface MetricRow {
  snapshot_at: string;
  followers_count: number | null;
  following_count: number | null;
  media_count: number | null;
  total_likes: number | null;
  total_comments: number | null;
}

const fmtNum = (n: number | null | undefined) =>
  n == null ? "-" : n.toLocaleString("pt-BR");

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export function InstagramEvolutionChart({
  clientId,
  username,
}: {
  clientId: string;
  username: string;
}) {
  const [history, setHistory] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("client_instagram_metrics_history" as any)
        .select("snapshot_at, followers_count, following_count, media_count")
        .eq("client_id", clientId)
        .eq("username", username)
        .order("snapshot_at", { ascending: true })
        .limit(60);
      if (active) {
        setHistory((data as any) || []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [clientId, username]);

  if (loading) return null;
  if (history.length < 2) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-xs text-muted-foreground">
          A evolução de seguidores e posts será exibida aqui após o segundo registro
          (atualizamos automaticamente a cada 30 dias).
        </CardContent>
      </Card>
    );
  }

  const first = history[0];
  const last = history[history.length - 1];
  const followersDelta = (last.followers_count ?? 0) - (first.followers_count ?? 0);
  const mediaDelta = (last.media_count ?? 0) - (first.media_count ?? 0);

  const chartData = history.map((h) => ({
    date: fmtDate(h.snapshot_at),
    seguidores: h.followers_count ?? 0,
    posts: h.media_count ?? 0,
  }));

  const Trend = ({ value }: { value: number }) => {
    const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
    const cls =
      value > 0 ? "text-emerald-500" : value < 0 ? "text-destructive" : "text-muted-foreground";
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
        <Icon className="h-3.5 w-3.5" />
        {value > 0 ? "+" : ""}
        {fmtNum(value)}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-semibold">Evolução do perfil</h4>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div>
            Seguidores: <Trend value={followersDelta} />
          </div>
          <div>
            Posts: <Trend value={mediaDelta} />
          </div>
          <div>
            {history.length} registro{history.length > 1 ? "s" : ""} ·{" "}
            {fmtDate(first.snapshot_at)} → {fmtDate(last.snapshot_at)}
          </div>
        </div>
      </div>
      <div className="h-52 w-full">
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => fmtNum(value)}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="seguidores"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Seguidores"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="posts"
              stroke="#ec4899"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Posts"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
