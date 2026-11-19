import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { DateField } from "@/components/ui/date-field";
import { updateTvSettings } from "@/hooks/useTvWall";
import { runTv } from "./tvShared";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function splitDt(v: string | null) {
  if (!v) return { d: "", t: "" };
  const dt = new Date(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`, t: `${pad(dt.getHours())}:${pad(dt.getMinutes())}` };
}

function UntilField({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string | null) => void }) {
  const [d, setD] = useState(splitDt(value).d);
  const [t, setT] = useState(splitDt(value).t || "19:30");
  useEffect(() => { const s = splitDt(value); setD(s.d); if (s.t) setT(s.t); }, [value]);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 items-center flex-wrap">
        <DateField value={d} onChange={(e: any) => setD(e.target.value)} className="w-36" />
        <Input type="time" value={t} onChange={(e) => setT(e.target.value)} className="w-24" />
        <Button size="sm" variant="outline" disabled={!d} onClick={() => onSave(new Date(`${d}T${t || "00:00"}`).toISOString())}>Salvar</Button>
        {value && <Button size="sm" variant="ghost" onClick={() => onSave(null)}><X className="h-4 w-4" /></Button>}
      </div>
      {value && <p className="text-xs text-muted-foreground">Ativo até {new Date(value).toLocaleString("pt-BR")}</p>}
    </div>
  );
}

export function TvScheduleSheet({ open, onOpenChange, settings }: { open: boolean; onOpenChange: (v: boolean) => void; settings: any }) {
  const [holiday, setHoliday] = useState("");
  const save = (patch: Record<string, unknown>) => runTv(() => updateTvSettings(patch), "Horário salvo");
  const days: number[] = settings?.days ?? [];
  const holidays: string[] = settings?.holidays ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Horário geral</SheetTitle></SheetHeader>
        <div className="space-y-5 pt-4">
          <div className="space-y-2">
            <Label className="text-xs">Dias</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((l, i) => {
                const on = days.includes(i);
                return (
                  <Button key={i} size="sm" variant={on ? "default" : "outline"} className="h-8 w-11 px-0"
                    onClick={() => save({ days: on ? days.filter((x) => x !== i) : [...days, i].sort() })}>{l}</Button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-4">
            <div className="space-y-1.5"><Label className="text-xs">Ligar às</Label>
              <Input type="time" defaultValue={settings?.on_time} key={`on-${settings?.on_time}`} className="w-28"
                onBlur={(e) => e.target.value !== settings?.on_time && save({ on_time: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Desligar às</Label>
              <Input type="time" defaultValue={settings?.off_time} key={`off-${settings?.off_time}`} className="w-28"
                onBlur={(e) => e.target.value !== settings?.off_time && save({ off_time: e.target.value })} /></div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs">Feriados (não liga)</Label>
            <div className="flex gap-2">
              <DateField value={holiday} onChange={(e: any) => setHoliday(e.target.value)} className="w-36" />
              <Button size="sm" variant="outline" disabled={!holiday || holidays.includes(holiday)}
                onClick={() => { save({ holidays: [...holidays, holiday].sort() }); setHoliday(""); }}>Adicionar</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {holidays.map((h) => (
                <Badge key={h} variant="secondary" className="gap-1">
                  {new Date(`${h}T12:00`).toLocaleDateString("pt-BR")}
                  <button aria-label="Remover feriado" onClick={() => save({ holidays: holidays.filter((x) => x !== h) })}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
          </div>
          <Separator />
          <UntilField label="Manter ligadas até…" value={settings?.keep_on_until ?? null} onSave={(v) => save({ keep_on_until: v })} />
          <UntilField label="Manter desligadas até…" value={settings?.keep_off_until ?? null} onSave={(v) => save({ keep_off_until: v })} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
