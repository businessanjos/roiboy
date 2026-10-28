import { useState } from "react";
import { ArrowDown, ArrowUp, LayoutList, Rows3, Square, Trash2, Type, Undo2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OFFER_DETAIL_ICONS } from "@/pages/public/PublicJobOffer";

type Item = { id: string; title: string; body: string; icon?: string };
type Key = "extra_strips" | "extra_details" | "custom_sections";

const GROUPS: { key: Key; label: string; hint: string; icon: typeof Rows3; titlePh: string; bodyPh: string; defaultIcon?: string }[] = [
  { key: "extra_strips", label: "Faixa", hint: "Linha com ícone, nome e valor (ex.: Plano de saúde · Unimed)", icon: Rows3, titlePh: "Nome (ex.: Plano de saúde)", bodyPh: "Valor (ex.: Unimed Nacional)", defaultIcon: "sparkles" },
  { key: "extra_details", label: "Quadro", hint: "Quadro em “Detalhes da posição”", icon: Square, titlePh: "Título", bodyPh: "Conteúdo", defaultIcon: "briefcase" },
  { key: "custom_sections", label: "Bloco de texto", hint: "Seção com título e parágrafo", icon: Type, titlePh: "Título do bloco", bodyPh: "Texto" },
];

export function OfferPreviewBuilder({ open, onOpenChange, strips, details, sections, onChange }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  strips: Item[];
  details: Item[];
  sections: Item[];
  onChange: (key: Key, value: Item[]) => void;
}) {
  const lists: Record<Key, Item[]> = { extra_strips: strips, extra_details: details, custom_sections: sections };
  const [history, setHistory] = useState<{ key: Key; value: Item[] }[]>([]);

  const commit = (key: Key, value: Item[], snapshot = true) => {
    if (snapshot) setHistory((h) => [...h.slice(-30), { key, value: lists[key] }]);
    onChange(key, value);
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    onChange(last.key, last.value);
  };
  const add = (key: Key) => {
    const g = GROUPS.find((x) => x.key === key)!;
    const item: Item = { id: crypto.randomUUID(), title: "", body: "", ...(g.defaultIcon ? { icon: g.defaultIcon } : {}) };
    commit(key, [...lists[key], item]);
  };
  const move = (key: Key, i: number, dir: -1 | 1) => {
    const arr = [...lists[key]];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    commit(key, arr);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LayoutList className="h-5 w-5" /> Adicionar e organizar</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {GROUPS.map((g) => (
            <Button key={g.key} type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => add(g.key)} title={g.hint}>
              <g.icon className="h-4 w-4" /> + {g.label}
            </Button>
          ))}
          <Button type="button" variant="ghost" size="sm" className="ml-auto gap-1.5" disabled={!history.length} onClick={undo}>
            <Undo2 className="h-4 w-4" /> Desfazer
          </Button>
        </div>

        <div className="space-y-5 mt-2">
          {GROUPS.map((g) => {
            const items = lists[g.key];
            return (
              <div key={g.key} className="space-y-2">
                <div className="flex items-baseline justify-between border-b pb-1">
                  <p className="text-sm font-medium">{g.label === "Faixa" ? "Faixas" : g.label === "Quadro" ? "Quadros" : "Blocos de texto"}</p>
                  <p className="text-xs text-muted-foreground">{g.hint}</p>
                </div>
                {items.length === 0 && <p className="text-xs text-muted-foreground py-1">Nenhum ainda. Use “+ {g.label}”.</p>}
                {items.map((it, i) => (
                  <div key={it.id} className="flex gap-2 items-start rounded-md border p-2">
                    <div className="flex flex-col">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => move(g.key, i, -1)} title="Subir"><ArrowUp className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={i === items.length - 1} onClick={() => move(g.key, i, 1)} title="Descer"><ArrowDown className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex gap-2">
                        {g.defaultIcon && (
                          <Select value={it.icon || g.defaultIcon} onValueChange={(v) => commit(g.key, items.map((x, idx) => idx === i ? { ...x, icon: v } : x))}>
                            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(OFFER_DETAIL_ICONS).map(([k, { label, Icon }]) => (
                                <SelectItem key={k} value={k}><span className="flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span></SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Input className="h-9" value={it.title} placeholder={g.titlePh}
                          onFocus={() => setHistory((h) => [...h.slice(-30), { key: g.key, value: items }])}
                          onChange={(e) => commit(g.key, items.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x), false)} />
                      </div>
                      {g.key === "custom_sections" ? (
                        <Textarea rows={3} value={it.body} placeholder={g.bodyPh}
                          onFocus={() => setHistory((h) => [...h.slice(-30), { key: g.key, value: items }])}
                          onChange={(e) => commit(g.key, items.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x), false)} />
                      ) : (
                        <Input className="h-9" value={it.body} placeholder={g.bodyPh}
                          onFocus={() => setHistory((h) => [...h.slice(-30), { key: g.key, value: items }])}
                          onChange={(e) => commit(g.key, items.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x), false)} />
                      )}
                    </div>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => commit(g.key, items.filter((_, idx) => idx !== i))} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">As mudanças aparecem na prévia na hora e são salvas junto com a carta.</p>
      </DialogContent>
    </Dialog>
  );
}
