import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateTvSettings } from "@/hooks/useTvWall";
import { DEFAULT_AGENCIES, ORGANIC_PERIODS, PAID_PERIODS, type TrafficAgency, type TrafficParts } from "@/lib/tv/trafficHub";
import { runTv } from "./tvShared";

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
  const [edit, setEdit] = useState(false);
  const periods = value.kind === "paid" ? PAID_PERIODS : ORGANIC_PERIODS;
  const unknown = value.kind === "paid" && value.agencia && !agencies.some((a) => a.id === value.agencia);
  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
      {value.kind === "paid" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between"><Label className="text-xs">Agência</Label>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={() => setEdit(true)}><Pencil className="h-3 w-3" />Editar</button></div>
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
      {edit && <AgenciesDialog agencies={agencies} onClose={() => setEdit(false)} />}
    </div>
  );
}

function AgenciesDialog({ agencies, onClose }: { agencies: TrafficAgency[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<TrafficAgency[]>(agencies);
  const clean = rows.map((r) => ({ name: r.name.trim(), id: r.id.trim() })).filter((r) => r.name && r.id);
  const save = () => runTv(async () => {
    await updateTvSettings({ traffic_agencies: clean });
    await qc.invalidateQueries({ queryKey: ["tv-traffic-agencies"] });
    onClose();
  }, "Agências salvas");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>Agências da Central de Tráfego</DialogTitle>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_40px] gap-2 text-xs text-muted-foreground"><span>Nome</span><span>Identificador</span><span /></div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_40px] gap-2">
              <Input className="h-10 text-base sm:text-sm" value={r.name} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} aria-label="Nome da agência" />
              <Input className="h-10 font-mono text-base sm:text-sm" value={r.id} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, id: e.target.value } : x))} aria-label="Identificador da agência" />
              <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Remover agência" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows([...rows, { name: "", id: "" }])}><Plus className="h-4 w-4 mr-1" />Adicionar agência</Button>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!clean.length}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
