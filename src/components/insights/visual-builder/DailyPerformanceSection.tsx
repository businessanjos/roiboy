import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface DailyPerformanceSettings {
  pipelineId?: string | null;
  userId?: string | null;
  goals?: Record<string, number>;
}

const FIXED_ROWS = [
  { key: "__won__", label: "Venda" },
  { key: "__lost__", label: "Perdido" },
  { key: "__revenue__", label: "Receita (R$)" },
];

interface Props {
  value: DailyPerformanceSettings;
  onChange: (next: DailyPerformanceSettings) => void;
}

export function DailyPerformanceSection({ value, onChange }: Props) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id ?? null;

  const { data: pipelines = [] } = useQuery({
    queryKey: ["dp-pipelines", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("account_id", accountId!)
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["dp-stages", accountId, value.pipelineId],
    enabled: !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("deal_stages")
        .select("id, name, display_order, pipeline_id")
        .eq("account_id", accountId!)
        .eq("is_active", true)
        .order("display_order");
      if (value.pipelineId) q = q.eq("pipeline_id", value.pipelineId);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["dp-users", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, name")
        .eq("account_id", accountId!)
        .order("name");
      return data || [];
    },
  });

  const setGoal = (key: string, raw: string) => {
    const num = Number(raw.replace(",", "."));
    const goals = { ...(value.goals || {}) };
    if (!raw || Number.isNaN(num) || num <= 0) delete goals[key];
    else goals[key] = num;
    onChange({ ...value, goals });
  };

  const rows = [
    ...stages.map((s: any) => ({ key: s.name, label: s.name })),
    ...FIXED_ROWS,
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-base font-medium">Funil</Label>
        <Select
          value={value.pipelineId || "all"}
          onValueChange={(v) => onChange({ ...value, pipelineId: v === "all" ? null : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos os funis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os funis</SelectItem>
            {pipelines.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-base font-medium">Vendedor</Label>
        <Select
          value={value.userId || "all"}
          onValueChange={(v) => onChange({ ...value, userId: v === "all" ? null : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Time todo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Time todo (agregado)</SelectItem>
            {users.map((u: any) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Deixe em "Time todo" para seguir o filtro global de vendedor do painel.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-base font-medium">Metas do período</Label>
        <p className="text-xs text-muted-foreground">
          Meta total por linha. A meta diária é calculada dividindo pelos dias úteis do período.
        </p>
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-[1fr_110px] items-center gap-2">
              <span className="truncate text-sm text-muted-foreground">{r.label}</span>
              <Input
                inputMode="numeric"
                placeholder="—"
                value={value.goals?.[r.key] ?? ""}
                onChange={(e) => setGoal(r.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
