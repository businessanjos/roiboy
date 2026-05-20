import { useState } from "react";
import { Talent, Pillar, usePillars, useUpsertPillar, useDeletePillar, PLATFORMS } from "@/hooks/useContentHQ";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save } from "lucide-react";

export function ContentHQPillars({ talent }: { talent: Talent }) {
  const { data: pillars = [] } = usePillars(talent.id);
  const upsert = useUpsertPillar();
  const del = useDeletePillar();
  const [editing, setEditing] = useState<Partial<Pillar> | null>(null);

  const total = pillars.reduce((a, p) => a + (p.mix_percentage || 0), 0);

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pilares de conteúdo — {talent.name}</h2>
          <p className="text-sm text-muted-foreground">Mix total: <strong className={total === 100 ? "text-emerald-600" : "text-amber-600"}>{total}%</strong> {total !== 100 && "(ideal: 100%)"}</p>
        </div>
        <Button onClick={() => setEditing({ talent_id: talent.id, mix_percentage: 0, platforms: [] })} className="gap-2"><Plus className="h-4 w-4" /> Novo pilar</Button>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        {pillars.map((p) => (
          <Card key={p.id} className="p-4 space-y-2 cursor-pointer hover:border-primary" onClick={() => setEditing(p)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color || "#6b7280" }} />
                <h3 className="font-semibold">{p.name}</h3>
              </div>
              <Badge variant="outline">{p.mix_percentage}%</Badge>
            </div>
            {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
            <div className="flex gap-1 flex-wrap">
              {(p.platforms || []).map((pl) => {
                const meta = PLATFORMS.find(x => x.id === pl);
                return <Badge key={pl} variant="outline" className={meta?.color}>{meta?.label || pl}</Badge>;
              })}
            </div>
          </Card>
        ))}
        {pillars.length === 0 && <Card className="p-8 text-center text-muted-foreground md:col-span-2">Nenhum pilar ainda. Crie 4–6 pilares.</Card>}
      </div>

      {editing && (
        <Card className="p-4 space-y-3 border-primary">
          <h3 className="font-semibold">{editing.id ? "Editar" : "Novo"} pilar</h3>
          <Input placeholder="Nome do pilar" value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <Textarea placeholder="Descrição" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          <div className="flex gap-3 items-center">
            <Input type="number" placeholder="% do mix" value={editing.mix_percentage || 0} onChange={(e) => setEditing({ ...editing, mix_percentage: Number(e.target.value) })} className="w-32" />
            <Input type="color" value={editing.color || "#6b7280"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="w-16 h-10" />
          </div>
          <div>
            <div className="text-sm font-medium mb-1.5">Plataformas</div>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((pl) => {
                const sel = (editing.platforms || []).includes(pl.id);
                return (
                  <Badge key={pl.id} variant={sel ? "default" : "outline"} className="cursor-pointer"
                    onClick={() => setEditing({ ...editing, platforms: sel ? (editing.platforms || []).filter(x => x !== pl.id) : [...(editing.platforms || []), pl.id] })}>
                    {pl.label}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { upsert.mutate(editing as any, { onSuccess: () => setEditing(null) }); }} disabled={!editing.name} className="gap-2"><Save className="h-4 w-4" /> Salvar</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            {editing.id && <Button variant="destructive" size="sm" onClick={() => { del.mutate(editing.id!); setEditing(null); }} className="ml-auto gap-2"><Trash2 className="h-4 w-4" /> Excluir</Button>}
          </div>
        </Card>
      )}
    </div>
  );
}
