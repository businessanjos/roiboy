import { useMemo, useState } from "react";
import { Copy, AlertTriangle, CheckSquare, Search, ExternalLink, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { csProcesses, type Block } from "@/lib/csProcesses";

const accents = ["border-l-purple-500", "border-l-teal-500", "border-l-blue-500"];
const dots = ["bg-purple-500", "bg-teal-500", "bg-blue-500"];
const URL_RE = /(https?:\/\/[^\s)]+)/g;

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{[^}]+\}|https?:\/\/[^\s)]+)/g).map((p, i) =>
        /^\{/.test(p) ? <mark key={i} className="rounded bg-primary/15 px-1 text-primary">{p}</mark>
        : /^https?:/.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-primary underline">{p}</a>
        : <span key={i}>{p.replace(/\*\*/g, "")}</span>)}
    </>
  );
}

function BlockView({ b }: { b: Block }) {
  if (b.kind === "message") {
    const clean = b.text.replace(/\*\*/g, "");
    return (
      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Mensagem pronta</span>
          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => { navigator.clipboard.writeText(clean); toast.success("Mensagem copiada"); }}>
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
        </div>
        <p className="whitespace-pre-wrap text-sm"><Rich text={b.text} /></p>
      </div>
    );
  }
  if (b.kind === "alert") return <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-sm"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /><Rich text={b.text} /></div>;
  if (b.kind === "task") return <div className="flex gap-2 text-sm"><CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span><Rich text={b.text} /></span></div>;
  if (b.kind === "meta") return <div className="flex gap-2 text-sm"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span><b>{b.label}:</b> <Rich text={b.text} /></span></div>;
  const urls = b.text.match(URL_RE);
  if (urls && b.text.replace(URL_RE, "").replace(/[:\-\s]/g, "").length < 20) {
    return <a href={urls[0]} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" className="gap-1"><ExternalLink className="h-3.5 w-3.5" />{b.text.replace(URL_RE, "").replace(/:\s*$/, "") || "Abrir link"}</Button></a>;
  }
  return <p className="text-sm text-muted-foreground"><Rich text={b.text} /></p>;
}

export default function CSProcesses() {
  const [active, setActive] = useState(0);
  const [q, setQ] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const proc = csProcesses[active];
  const phases = useMemo(() => {
    if (!q.trim()) return proc?.phases ?? [];
    const n = norm(q);
    return (proc?.phases ?? []).map((ph) => ({ ...ph, steps: ph.steps.filter((s) => norm(s.title + JSON.stringify(s.blocks)).includes(n)) })).filter((ph) => ph.steps.length);
  }, [proc, q]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Processos do CS</h1>
        <p className="text-sm text-muted-foreground">Passo a passo, mensagens prontas e links de cada processo.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {csProcesses.map((p, i) => (
          <button key={p.id} onClick={() => setActive(i)} className={`rounded-xl border border-l-4 p-3 text-left transition ${accents[i % 3]} ${i === active ? "bg-accent" : "hover:bg-accent/50"}`}>
            <div className="font-medium">{p.title}</div>
            <div className="text-xs text-muted-foreground">{p.phases.length} fases · {p.phases.reduce((a, f) => a + f.steps.length, 0)} etapas</div>
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar etapa ou mensagem…" className="pl-9" />
      </div>
      <div className="space-y-6">
        {phases.length === 0 && <p className="text-sm text-muted-foreground">Nada encontrado.</p>}
        {phases.map((ph) => (
          <section key={ph.title} className="relative border-l pl-6">
            <span className={`absolute -left-1.5 top-1 h-3 w-3 rounded-full ${dots[active % 3]}`} />
            <h2 className="mb-3 font-semibold">{ph.title}</h2>
            <div className="space-y-3">
              {ph.steps.map((s, i) => (
                <div key={i} className="space-y-2 rounded-xl border bg-card p-4">
                  {s.title && <h3 className="font-medium">{s.title}</h3>}
                  {s.blocks.map((b, j) => <BlockView key={j} b={b} />)}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
