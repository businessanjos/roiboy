import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Loader2, Monitor, Moon, Search, Smartphone, Tv, Youtube, LayoutDashboard } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { updateTvScreen } from "@/hooks/useTvWall";
import {
  ANDROID_PAIR_SECONDS, LG_PAIR_SECONDS, PAIR_ERROR_TEXT, type FoundTv, type PairError,
  nextFreeSlot, normalizePairCode, pairState, parseDiscover,
} from "@/lib/tv/addTv";
import { runTv } from "./tvShared";

const db = supabase as any;
const STEPS = ["Prepare a TV", "Escolha a TV", "Dê um nome", "Autorize na TV"];

async function insertCommand(slot: number | null, command: string, payload: Record<string, unknown>) {
  const { data, error } = await db.from("tv_commands").insert({ slot, command, payload }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

function useCommand(id: string | null) {
  return useQuery({
    queryKey: ["tv-cmd", id],
    enabled: !!id,
    refetchInterval: (q) => (q.state.data && ["done", "error"].includes(q.state.data.status) ? false : 2000),
    queryFn: async () => {
      const { data, error } = await db.from("tv_commands").select("status,result").eq("id", id).single();
      if (error) throw error;
      return data as { status: string; result: string | null };
    },
  });
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mt-4 grid grid-cols-4 gap-1.5">
      {STEPS.map((l, i) => (
        <li key={l} className="space-y-1">
          <div className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
          <p className={cn("text-[11px] leading-tight", i === step ? "font-medium text-foreground" : "text-muted-foreground")}>{i + 1}. {l}</p>
        </li>
      ))}
    </ol>
  );
}

function LgPrompt() {
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-lg border-4 border-foreground/80 bg-muted p-4" aria-hidden>
      <div className="rounded-md border bg-card p-3 text-center shadow-sm">
        <p className="text-xs font-medium">Permitir conexão do Roy?</p>
        <div className="mt-2.5 flex justify-center gap-2">
          <span className="rounded px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-card">Aceitar</span>
          <span className="rounded border px-3 py-1 text-xs text-muted-foreground">Recusar</span>
        </div>
      </div>
    </div>
  );
}

export function TvAddSheet({ open, onOpenChange, screens, events }: { open: boolean; onOpenChange: (v: boolean) => void; screens: any[]; events: any[] }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [discoverId, setDiscoverId] = useState<string | null>(null);
  const [tv, setTv] = useState<FoundTv | null>(null);
  const freeSlot = useMemo(() => nextFreeSlot(screens.map((s) => s.slot)), [screens]);
  const [name, setName] = useState("");
  const [slot, setSlot] = useState<number>(1);
  const [group, setGroup] = useState<"Parede" | "Outras">("Outras");
  const [created, setCreated] = useState<number | null>(null);
  const [pairId, setPairId] = useState<string | null>(null);
  const [pairStart, setPairStart] = useState(0);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [show, setShow] = useState<"dashboard" | "youtube" | "rest">("rest");
  const [link, setLink] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  const disc = useCommand(discoverId);
  const pair = useCommand(pairId);
  const discovering = !!discoverId && !["done", "error"].includes(disc.data?.status ?? "");
  const found = disc.data?.status === "done" ? parseDiscover(disc.data.result) : [];
  const fresh = found.filter((d) => !d.known);
  const ps = pairState(pairId ? pair.data : null, events, created, pairStart - 5000);
  const paired = ps.paired;
  const pairErr: PairError | null = ps.error;
  const limit = tv?.brand === "android" || events.some((e) => e.slot === created && e.kind === "pair_code_needed" && new Date(e.created_at).getTime() >= pairStart - 5000) ? ANDROID_PAIR_SECONDS : LG_PAIR_SECONDS;
  const left = Math.max(0, limit - Math.floor((now - pairStart) / 1000));
  const codeAsked = ps.codeAsked;

  const refresh = () => qc.invalidateQueries({ queryKey: ["tv-wall"] });
  const reset = () => { setStep(0); setDiscoverId(null); setTv(null); setCreated(null); setPairId(null); setCode(""); setCodeSent(false); setShow("rest"); setLink(""); };

  const close = async () => {
    if (created && !paired) { await db.from("tv_screens").delete().eq("slot", created); refresh(); }
    reset(); onOpenChange(false);
  };

  const search = () => runTv(async () => { setDiscoverId(await insertCommand(null, "discover", {})); setStep(1); }, "");
  const choose = (d: FoundTv) => {
    setTv(d); const n = freeSlot ?? 1; setSlot(n); setName(`TV ${n}`); setGroup("Outras"); setStep(2);
  };
  const startPair = async (s: number) => {
    setCode(""); setCodeSent(false); setPairStart(Date.now());
    setPairId(await insertCommand(s, "pair", { ip: tv!.ip, mac: tv!.mac, brand: tv!.brand, name: name.trim() }));
  };
  const create = () => runTv(async () => {
    if (screens.some((s) => s.slot === slot)) throw new Error(`O número ${slot} já está em uso.`);
    const { error } = await db.from("tv_screens").insert({
      slot, name: name.trim(), url: null, enabled: true, schedule_mode: "global",
      location: group === "Parede" ? "Parede" : null, notes: [tv!.model, tv!.ip].filter(Boolean).join(" · "),
    });
    if (error) throw error;
    setCreated(slot); refresh(); setStep(3); await startPair(slot);
  }, "");
  const sendCode = () => runTv(async () => { await insertCommand(created, "pair_code", { code }); setCodeSent(true); }, "");
  const finish = () => runTv(async () => {
    const url = show === "rest" ? null : link.trim() || null;
    if (url) await updateTvScreen(created!, { url });
    refresh(); reset(); onOpenChange(false);
  }, "TV pronta. Ela aparece na lista.");

  const slotTaken = screens.some((s) => s.slot === slot);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader><SheetTitle>Adicionar TV</SheetTitle></SheetHeader>
        <Stepper step={step} />

        {step === 0 && (
          <div className="mt-6 space-y-4">
            <p className="text-sm">Ligue a TV e confirme que ela está no mesmo Wi-Fi do escritório.</p>
            <Button className="w-full" onClick={search}><Search className="h-4 w-4 mr-1.5" />Procurar TVs</Button>
          </div>
        )}

        {step === 1 && (
          <div className="mt-6 space-y-3">
            {discovering ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />Procurando TVs na rede… isso leva até 40 segundos.
              </div>
            ) : disc.data?.status === "error" ? (
              <>
                <p className="text-sm text-destructive">Não deu para procurar TVs agora.</p>
                <Button variant="outline" className="w-full" onClick={search}>Procurar de novo</Button>
              </>
            ) : (
              <>
                {found.map((d) => (
                  <div key={d.ip} className={cn("flex items-center gap-3 rounded-lg border bg-card p-3", d.known && "opacity-60")}>
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted">{d.brand === "lg" ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{d.brand === "lg" ? "LG" : "Android"}{d.model ? ` · ${d.model}` : ""} · {d.ip}</p>
                    </div>
                    {d.known ? <span className="text-xs text-muted-foreground shrink-0">Já conectada</span>
                      : <Button size="sm" onClick={() => choose(d)} disabled={!freeSlot}>Conectar</Button>}
                  </div>
                ))}
                {!fresh.length && (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5">
                    <p className="font-medium">Não encontramos nenhuma TV nova. Confira:</p>
                    <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                      <li>A TV está ligada (não só em espera)?</li>
                      <li>Em Configurações &gt; Rede, ela mostra "Conectado" na mesma rede do escritório?</li>
                      <li>Acabou de ligar? Espere 1 minuto.</li>
                    </ul>
                  </div>
                )}
                {!freeSlot && <p className="text-xs text-destructive">Todos os 20 lugares de TV estão ocupados.</p>}
                <Button variant="outline" className="w-full" onClick={search}><Search className="h-4 w-4 mr-1.5" />Procurar de novo</Button>
              </>
            )}
          </div>
        )}

        {step === 2 && tv && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">{tv.name} · {tv.ip}</p>
            <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></div>
            <div className="space-y-1.5"><Label>Número do slot</Label>
              <Input type="number" min={1} max={20} value={slot} onChange={(e) => setSlot(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} className="w-28" />
              {slotTaken && <p className="text-xs text-destructive">Esse número já está em uso.</p>}
            </div>
            <div className="space-y-1.5"><Label>Grupo</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["Parede", "Outras"] as const).map((g) => (
                  <Button key={g} type="button" variant={group === g ? "default" : "outline"} onClick={() => setGroup(g)}>{g}</Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
              <Button className="flex-1" disabled={!name.trim() || slotTaken} onClick={create}>Continuar</Button>
            </div>
          </div>
        )}

        {step === 3 && tv && (
          <div className="mt-6 space-y-4">
            {paired ? (
              <>
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                  <p className="text-lg font-semibold">{name.trim()} conectada</p>
                </div>
                <div className="space-y-2">
                  <Label>O que ela deve mostrar?</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([["dashboard", "Dashboard", LayoutDashboard], ["youtube", "YouTube", Youtube], ["rest", "Tela de descanso", Moon]] as const).map(([k, l, I]) => (
                      <Button key={k} type="button" variant={show === k ? "default" : "outline"} className="h-auto flex-col gap-1 py-2.5 text-xs whitespace-normal" onClick={() => setShow(k)}>
                        <I className="h-4 w-4" />{l}
                      </Button>
                    ))}
                  </div>
                  {show !== "rest" && <Input placeholder={show === "dashboard" ? "Cole o link do dashboard" : "Cole o link da playlist"} value={link} onChange={(e) => setLink(e.target.value)} />}
                </div>
                <Button className="w-full" disabled={show !== "rest" && !link.trim()} onClick={finish}><Check className="h-4 w-4 mr-1.5" />Concluir</Button>
              </>
            ) : pairErr ? (
              <>
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">{PAIR_ERROR_TEXT[pairErr]}</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={close}>Cancelar</Button>
                  <Button className="flex-1" onClick={() => runTv(() => startPair(created!), "")}>Tentar de novo</Button>
                </div>
              </>
            ) : tv.brand === "lg" && !codeAsked ? (
              <>
                <LgPrompt />
                <p className="text-sm">Olhe para a TV: em alguns segundos vai aparecer uma janela pedindo permissão. Com o controle, selecione <b>ACEITAR</b> (em algumas TVs aparece como "Sim" ou "Permitir") e aperte OK. Não selecione Recusar.</p>
                <p className="text-center text-3xl font-semibold tabular-nums">{left}s</p>
                <Button variant="outline" className="w-full" onClick={close}>Cancelar</Button>
              </>
            ) : (
              <>
                <div className="grid place-items-center py-2"><Tv className="h-10 w-10 text-muted-foreground" /></div>
                <p className="text-sm">Olhe para a TV: vai aparecer um código de 6 letras e números. Digite aqui.</p>
                <Input value={code} onChange={(e) => setCode(normalizePairCode(e.target.value))} placeholder="ABC123" maxLength={6} autoFocus
                  className="h-14 text-center text-2xl font-semibold tracking-[0.4em] uppercase" />
                <p className="text-xs text-muted-foreground text-center">
                  {codeSent ? "Código enviado. Aguardando a TV confirmar…" : codeAsked ? "A TV já mostrou o código." : "Aguardando a TV mostrar o código…"} · {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={close}>Cancelar</Button>
                  <Button className="flex-1" disabled={code.length !== 6 || codeSent} onClick={sendCode}>Confirmar</Button>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
