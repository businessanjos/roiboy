import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Minus, X, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: "bg-blue-500/5", border: "border-blue-500/20", text: "text-blue-500" },
  emerald: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-500" },
  amber: { bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-500" },
  purple: { bg: "bg-purple-500/5", border: "border-purple-500/20", text: "text-purple-500" },
  rose: { bg: "bg-rose-500/5", border: "border-rose-500/20", text: "text-rose-500" },
  cyan: { bg: "bg-cyan-500/5", border: "border-cyan-500/20", text: "text-cyan-500" },
};

export function PinnedKpisStrip() {
  const qc = useQueryClient();
  const { data: kpis = [] } = useQuery({
    queryKey: ["sales-pinned-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_dashboard_pinned_kpis")
        .select("*")
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (kpis.length === 0) return null;

  const remove = async (id: string) => {
    await supabase.from("sales_dashboard_pinned_kpis").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["sales-pinned-kpis"] });
  };

  const refresh = async (id: string) => {
    toast.loading("Recalculando KPI…", { id });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recompute-pinned-kpi`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ kpi_id: id }),
      });
      if (!r.ok) throw new Error(await r.text());
      qc.invalidateQueries({ queryKey: ["sales-pinned-kpis"] });
      toast.success("KPI atualizado", { id });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao recalcular", { id });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">KPIs fixados via IA</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {kpis.map((k: any) => {
          const colors = COLOR_MAP[k.color] ?? COLOR_MAP.blue;
          const Trend = k.last_trend === "up" ? TrendingUp : k.last_trend === "down" ? TrendingDown : Minus;
          return (
            <Card key={k.id} className={`p-3 ${colors.bg} ${colors.border} border relative group`}>
              <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refresh(k.id)} title="Recalcular">
                  <RefreshCw className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(k.id)} title="Remover">
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <p className={`text-xs ${colors.text} font-medium truncate pr-12`}>{k.label}</p>
              <p className="text-xl font-bold mt-1">{k.last_value_text ?? k.last_value ?? "—"}</p>
              {k.last_comparison && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Trend className="w-3 h-3" />
                  <span className="truncate">{k.last_comparison}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
