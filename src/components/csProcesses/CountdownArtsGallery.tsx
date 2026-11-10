import { useState } from "react";
import { Images, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import a30 from "@/assets/countdown-ec/faltam-30-dias-ec.png.asset.json";
import a15 from "@/assets/countdown-ec/faltam-15-dias-ec.png.asset.json";
import a10 from "@/assets/countdown-ec/faltam-10-dias-ec.png.asset.json";
import a5 from "@/assets/countdown-ec/faltam-5-dias-ec.png.asset.json";
import a3 from "@/assets/countdown-ec/faltam-3-dias-ec.png.asset.json";
import a2 from "@/assets/countdown-ec/faltam-2-dias-ec.png.asset.json";
import a1 from "@/assets/countdown-ec/faltam-1-dias-ec.png.asset.json";

/** Pasta do Drive que esta galeria substitui. */
export const COUNTDOWN_DRIVE_URL = /1OxVh6eyrl9p_LjKwNoAWaMaOge_f8Pg4/;

const ARTS = [
  { days: 30, url: a30.url }, { days: 15, url: a15.url }, { days: 10, url: a10.url },
  { days: 5, url: a5.url }, { days: 3, url: a3.url }, { days: 2, url: a2.url }, { days: 1, url: a1.url },
];
const label = (d: number) => `Faltam ${d} ${d === 1 ? "dia" : "dias"}`;

async function download(url: string, name: string) {
  const blob = await (await fetch(url)).blob();
  const href = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = href; el.download = name; document.body.appendChild(el); el.click(); el.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30_000);
}

export function CountdownArtsButton() {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const art = sel !== null ? ARTS[sel] : null;
  return (
    <>
      <Button variant="secondary" className="gap-2" onClick={() => setOpen(true)}><Images className="h-4 w-4" />Ver artes da contagem regressiva</Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSel(null); }}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contagem regressiva — Eternum Club</DialogTitle>
            <DialogDescription>Escolha a arte do dia, abra em tamanho grande e baixe para enviar.</DialogDescription>
          </DialogHeader>
          {art ? (
            <div className="flex flex-col items-center gap-4">
              <div className="flex w-full items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setSel(null)}>← Todas as artes</Button>
                <span className="text-lg font-semibold">{label(art.days)}</span>
                <Button size="sm" className="gap-1.5" onClick={() => download(art.url, `${label(art.days)} - EC.png`)}><Download className="h-4 w-4" />Baixar</Button>
              </div>
              <div className="flex w-full items-center gap-2">
                <Button variant="ghost" size="icon" disabled={sel === 0} onClick={() => setSel(sel! - 1)}><ChevronLeft /></Button>
                <img src={art.url} alt={label(art.days)} draggable={false} className="mx-auto max-h-[65vh] flex-1 rounded-xl object-contain" />
                <Button variant="ghost" size="icon" disabled={sel === ARTS.length - 1} onClick={() => setSel(sel! + 1)}><ChevronRight /></Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {ARTS.map((x, i) => (
                <div key={x.days} className="group overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <button type="button" onClick={() => setSel(i)} className="block w-full">
                    <img src={x.url} alt={label(x.days)} loading="lazy" draggable={false} className="aspect-square w-full bg-muted object-contain" />
                  </button>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm font-semibold">{label(x.days)}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Baixar" onClick={() => download(x.url, `${label(x.days)} - EC.png`)}><Download className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
