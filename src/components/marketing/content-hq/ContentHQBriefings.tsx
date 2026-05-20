import { useState } from "react";
import { Talent, usePillars, useContentPieces, useUpsertPiece, PLATFORMS, callContentHQAI } from "@/hooks/useContentHQ";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Plus, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

export function ContentHQBriefings({ talent }: { talent: Talent }) {
  const { data: pillars = [] } = usePillars(talent.id);
  const { data: pieces = [] } = useContentPieces(talent.id);
  const upsert = useUpsertPiece();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pillarId, setPillarId] = useState<string>("");
  const [platform, setPlatform] = useState<string>("instagram");
  const [count, setCount] = useState(6);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const selected = pieces.find(p => p.id === selectedId);

  const handleGeneratePautas = async () => {
    if (!pillarId) { toast({ title: "Escolha um pilar" }); return; }
    setLoading(true);
    try {
      const pillar = pillars.find(p => p.id === pillarId);
      const r = await callContentHQAI("generate_pautas", talent, { pillar_name: pillar?.name, pillar_description: pillar?.description, platform, count });
      for (const p of (r.pautas || [])) {
        await new Promise<void>((res) => upsert.mutate({
          talent_id: talent.id, pillar_id: pillarId, title: p.title, hook: p.hook, platform, format: p.format, status: "backlog", ai_generated: true,
        } as any, { onSuccess: () => res(), onError: () => res() }));
      }
      toast({ title: `${r.pautas?.length || 0} pautas criadas` });
    } finally { setLoading(false); }
  };

  const handleGenerateBriefing = async (pieceId: string) => {
    const p = pieces.find(x => x.id === pieceId);
    if (!p) return;
    setLoading(true);
    try {
      const pillar = pillars.find(x => x.id === p.pillar_id);
      const r = await callContentHQAI("generate_briefing", talent, { title: p.title, platform: p.platform, format: p.format, pillar_name: pillar?.name });
      setEditing({ ...p, ...r, briefing: { ...(p.briefing || {}), production_notes: r.production_notes } });
    } finally { setLoading(false); }
  };

  const handleSave = () => {
    if (!editing) return;
    upsert.mutate(editing, { onSuccess: () => setEditing(null) });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Gerar pautas em lote com IA</h3>
        <div className="grid sm:grid-cols-4 gap-2">
          <Select value={pillarId} onValueChange={setPillarId}>
            <SelectTrigger><SelectValue placeholder="Pilar" /></SelectTrigger>
            <SelectContent>{pillars.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PLATFORMS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" value={count} onChange={(e) => setCount(Number(e.target.value))} />
          <Button onClick={handleGeneratePautas} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Pautas — {talent.name}</h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {pieces.map(p => {
            const pl = PLATFORMS.find(x => x.id === p.platform);
            return (
              <div key={p.id} className={`p-3 rounded border cursor-pointer ${selectedId === p.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`} onClick={() => setSelectedId(p.id)}>
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{p.title}</div>
                    {p.hook && <div className="text-xs text-muted-foreground line-clamp-1">{p.hook}</div>}
                  </div>
                  <Badge variant="outline" className={pl?.color}>{pl?.label}</Badge>
                </div>
              </div>
            );
          })}
          {pieces.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma pauta ainda. Use o gerador acima.</p>}
        </div>
      </Card>

      {selected && !editing && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{selected.title}</h3>
            <Button size="sm" onClick={() => handleGenerateBriefing(selected.id)} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar briefing completo
            </Button>
          </div>
          {selected.script && <Section label="Roteiro" value={selected.script} />}
          {selected.caption && <Section label="Legenda" value={selected.caption} />}
          {selected.cta && <Section label="CTA" value={selected.cta} />}
          {selected.hashtags && <Section label="Hashtags" value={selected.hashtags} />}
          {selected.thumbnail_brief && <Section label="Thumbnail" value={selected.thumbnail_brief} />}
          <Button size="sm" variant="outline" onClick={() => setEditing(selected)}>Editar</Button>
        </Card>
      )}

      {editing && (
        <Card className="p-4 space-y-2">
          <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
          <Textarea placeholder="Hook" value={editing.hook || ""} onChange={(e) => setEditing({ ...editing, hook: e.target.value })} rows={2} />
          <Textarea placeholder="Roteiro" value={editing.script || ""} onChange={(e) => setEditing({ ...editing, script: e.target.value })} rows={8} />
          <Textarea placeholder="Legenda" value={editing.caption || ""} onChange={(e) => setEditing({ ...editing, caption: e.target.value })} rows={3} />
          <Input placeholder="CTA" value={editing.cta || ""} onChange={(e) => setEditing({ ...editing, cta: e.target.value })} />
          <Input placeholder="Hashtags" value={editing.hashtags || ""} onChange={(e) => setEditing({ ...editing, hashtags: e.target.value })} />
          <Textarea placeholder="Brief de thumbnail" value={editing.thumbnail_brief || ""} onChange={(e) => setEditing({ ...editing, thumbnail_brief: e.target.value })} rows={2} />
          <div className="flex gap-2">
            <Button onClick={handleSave} className="gap-2"><Save className="h-4 w-4" /> Salvar</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}
