import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DateField } from "@/components/ui/date-field";
import { Power, PowerOff, RefreshCw, Camera, Tv, X, Loader2 } from "lucide-react";
import { useTvCanManage, useTvWall, sendTvCommand, updateTvSettings } from "@/hooks/useTvWall";
import { isRecent } from "@/lib/tv/tvUrl";
import { TvScreenCard } from "./TvScreenCard";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function splitDt(v: string | null) {
  if (!v) return { d: "", t: "" };
  const dt = new Date(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`, t: `${pad(dt.getHours())}:${pad(dt.getMinutes())}` };
}

function UntilField({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string | null) => void }) {
  const init = splitDt(value);
  const [d, setD] = useState(init.d);
  const [t, setT] = useState(init.t || "19:30");
  useEffect(() => { const s = splitDt(value); setD(s.d); if (s.t) setT(s.t); }, [value]);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2 items-center flex-wrap">
        <DateField value={d} onChange={(e: any) => setD(e.target.value)} className="w-40" />
        <Input type="time" value={t} onChange={(e) => setT(e.target.value)} className="w-28" />
        <Button size="sm" variant="outline" disabled={!d} onClick={() => onSave(new Date(`${d}T${t || "00:00"}`).toISOString())}>Salvar</Button>
        {value && (
          <Button size="sm" variant="ghost" onClick={() => onSave(null)}><X className="h-4 w-4 mr-1" />Limpar</Button>
        )}
      </div>
      {value && <p className="text-xs text-muted-foreground">Ativo até {new Date(value).toLocaleString("pt-BR")}</p>}
    </div>
  );
}

export function TvWallManager() {
  const { data: canManage, isLoading: loadingAccess } = useTvCanManage();
  const { data, isLoading } = useTvWall(!!canManage);
  const [holiday, setHoliday] = useState("");
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(i); }, []);

  if (loadingAccess || (canManage && isLoading)) {
    return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!canManage) return <p className="text-sm text-muted-foreground">Somente gestão/administração acessa as TVs.</p>;
  if (!data) return null;

  const settings = data.settings ?? {};
  const agentOnline = data.status.some((s) => isRecent(s.last_seen));
  const run = async (fn: () => Promise<void>, ok: string) => {
    try { await fn(); toast.success(ok); } catch (e: any) { toast.error(e.message ?? "Erro"); }
  };
  const saveSettings = (patch: Record<string, unknown>) => run(() => updateTvSettings(patch), "Horário salvo");
  const days: number[] = settings.days ?? [];
  const holidays: string[] = settings.holidays ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap space-y-0">
          <CardTitle className="flex items-center gap-2"><Tv className="h-5 w-5" />TVs do escritório</CardTitle>
          {agentOnline
            ? <Badge className="bg-success/15 text-success border-success/30" variant="outline">Agente online</Badge>
            : <Badge variant="destructive">Agente offline</Badge>}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => run(() => sendTvCommand(null, "on"), "Comando enviado")}><Power className="h-4 w-4 mr-2" />Ligar todas</Button>
          <Button variant="outline" onClick={() => run(() => sendTvCommand(null, "off"), "Comando enviado")}><PowerOff className="h-4 w-4 mr-2" />Desligar todas</Button>
          <Button variant="outline" onClick={() => run(() => sendTvCommand(null, "reload"), "Comando enviado")}><RefreshCw className="h-4 w-4 mr-2" />Recarregar todas</Button>
          <Button variant="outline" onClick={() => run(() => sendTvCommand(null, "screenshot"), "Pedido de capturas enviado")}><Camera className="h-4 w-4 mr-2" />Atualizar capturas</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Horário geral</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-4">
            {DAYS.map((label, i) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={days.includes(i)}
                  onCheckedChange={(c) => saveSettings({ days: c ? [...days, i].sort() : days.filter((x) => x !== i) })}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1.5"><Label>Ligar às</Label>
              <Input type="time" defaultValue={settings.on_time} key={`on-${settings.on_time}`} className="w-28" onBlur={(e) => e.target.value !== settings.on_time && saveSettings({ on_time: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Desligar às</Label>
              <Input type="time" defaultValue={settings.off_time} key={`off-${settings.off_time}`} className="w-28" onBlur={(e) => e.target.value !== settings.off_time && saveSettings({ off_time: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Feriados (não liga)</Label>
            <div className="flex gap-2 items-center">
              <DateField value={holiday} onChange={(e: any) => setHoliday(e.target.value)} className="w-40" />
              <Button size="sm" variant="outline" disabled={!holiday || holidays.includes(holiday)}
                onClick={() => { saveSettings({ holidays: [...holidays, holiday].sort() }); setHoliday(""); }}>Adicionar</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {holidays.map((h) => (
                <Badge key={h} variant="secondary" className="gap-1">
                  {new Date(`${h}T12:00`).toLocaleDateString("pt-BR")}
                  <button aria-label="Remover feriado" onClick={() => saveSettings({ holidays: holidays.filter((x) => x !== h) })}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <UntilField label="Manter ligadas até…" value={settings.keep_on_until} onSave={(v) => saveSettings({ keep_on_until: v })} />
            <UntilField label="Manter desligadas até…" value={settings.keep_off_until} onSave={(v) => saveSettings({ keep_off_until: v })} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {data.screens.map((s) => (
          <TvScreenCard
            key={s.slot}
            screen={s}
            status={data.status.find((x) => x.slot === s.slot)}
            events={data.events.filter((e) => e.slot === s.slot || e.slot == null).slice(0, 15)}
            commands={data.commands.filter((c) => c.slot === s.slot || c.slot == null).slice(0, 15)}
          />
        ))}
      </div>
    </div>
  );
}
