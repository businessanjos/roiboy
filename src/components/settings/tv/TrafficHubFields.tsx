import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_AGENCIES, ORGANIC_PERIODS, PAID_PERIODS, type TrafficAgency, type TrafficParts } from "@/lib/tv/trafficHub";

export function useTrafficAgencies() {
  return useQuery({
    queryKey: ["tv-traffic-agencies"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("tv_settings").select("traffic_agencies").eq("id", 1).maybeSingle();
      const list = data?.traffic_agencies as TrafficAgency[] | null;
      return Array.isArray(list) && list.length ? list : DEFAULT_AGENCIES;
    },
    staleTime: 60_000,
  });
}

export function TrafficHubFields({ value, onChange }: { value: TrafficParts; onChange: (p: TrafficParts) => void }) {
  const { data: agencies = DEFAULT_AGENCIES } = useTrafficAgencies();
  const periods = value.kind === "paid" ? PAID_PERIODS : ORGANIC_PERIODS;
  const unknown = value.kind === "paid" && value.agencia && !agencies.some((a) => a.id === value.agencia);
  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
      {value.kind === "paid" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Agência</Label>
          <Select value={value.agencia} onValueChange={(v) => onChange({ ...value, agencia: v })}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Escolha a agência" /></SelectTrigger>
            <SelectContent>
              {agencies.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              {unknown && <SelectItem value={value.agencia}>{value.agencia}</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1.5"><Label className="text-xs">Período</Label>
        <Select value={value.periodo} onValueChange={(v) => onChange({ ...value, periodo: v })}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>{periods.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}
