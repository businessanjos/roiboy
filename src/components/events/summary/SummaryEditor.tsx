import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus, GripVertical, Quote, Sparkles, List as ListIcon, AlignLeft } from "lucide-react";
import type { SummaryDoc, SummaryBlock, SummarySection } from "./SummaryPDF";

interface Props {
  value: SummaryDoc;
  onChange: (v: SummaryDoc) => void;
}

export default function SummaryEditor({ value, onChange }: Props) {
  const update = (patch: Partial<SummaryDoc>) => onChange({ ...value, ...patch });

  const updateSection = (idx: number, patch: Partial<SummarySection>) => {
    const next = [...value.sections];
    next[idx] = { ...next[idx], ...patch };
    update({ sections: next });
  };

  const updateBlock = (sIdx: number, bIdx: number, patch: Partial<SummaryBlock>) => {
    const next = [...value.sections];
    const blocks = [...next[sIdx].blocks];
    blocks[bIdx] = { ...blocks[bIdx], ...patch } as SummaryBlock;
    next[sIdx] = { ...next[sIdx], blocks };
    update({ sections: next });
  };

  const addBlock = (sIdx: number, type: SummaryBlock["type"]) => {
    const next = [...value.sections];
    const blocks = [...next[sIdx].blocks];
    const newBlock: SummaryBlock =
      type === "paragraph" ? { type: "paragraph", text: "" }
      : type === "quote" ? { type: "quote", author: "", text: "" }
      : type === "highlight" ? { type: "highlight", text: "" }
      : { type: "list", title: "", items: [""] };
    blocks.push(newBlock);
    next[sIdx] = { ...next[sIdx], blocks };
    update({ sections: next });
  };

  const removeBlock = (sIdx: number, bIdx: number) => {
    const next = [...value.sections];
    next[sIdx] = { ...next[sIdx], blocks: next[sIdx].blocks.filter((_, i) => i !== bIdx) };
    update({ sections: next });
  };

  const removeSection = (sIdx: number) => {
    update({ sections: value.sections.filter((_, i) => i !== sIdx) });
  };

  const addSection = () => {
    update({ sections: [...value.sections, { heading: "Nova seção", blocks: [{ type: "paragraph", text: "" }] }] });
  };

  const moveSection = (sIdx: number, dir: -1 | 1) => {
    const j = sIdx + dir;
    if (j < 0 || j >= value.sections.length) return;
    const next = [...value.sections];
    [next[sIdx], next[j]] = [next[j], next[sIdx]];
    update({ sections: next });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Título (ex: DIA 1)</label>
            <Input value={value.title || ""} onChange={(e) => update({ title: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Data</label>
            <Input value={value.date || ""} onChange={(e) => update({ date: e.target.value })} placeholder="15/03/2026" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Subtítulo da capa (opcional)</label>
            <Input value={value.subtitle || ""} onChange={(e) => update({ subtitle: e.target.value })} />
          </div>
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-muted-foreground">URL da imagem de capa (opcional)</label>
            <Input value={value.coverImageUrl || ""} onChange={(e) => update({ coverImageUrl: e.target.value })} placeholder="https://..." />
          </div>
        </CardContent>
      </Card>

      {value.sections.map((section, sIdx) => (
        <Card key={sIdx} className="border-l-4 border-l-amber-500/60">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Input
                value={section.heading}
                onChange={(e) => updateSection(sIdx, { heading: e.target.value })}
                className="text-lg font-semibold"
              />
              <Button variant="ghost" size="icon" onClick={() => moveSection(sIdx, -1)} title="Mover para cima">↑</Button>
              <Button variant="ghost" size="icon" onClick={() => moveSection(sIdx, 1)} title="Mover para baixo">↓</Button>
              <Button variant="ghost" size="icon" onClick={() => removeSection(sIdx)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            <div className="space-y-2 pl-4 border-l-2 border-muted">
              {section.blocks.map((block, bIdx) => (
                <div key={bIdx} className="group relative bg-muted/30 rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Select
                        value={block.type}
                        onValueChange={(t) => {
                          const nv: SummaryBlock =
                            t === "paragraph" ? { type: "paragraph", text: (block as any).text || "" }
                            : t === "quote" ? { type: "quote", author: "", text: (block as any).text || "" }
                            : t === "highlight" ? { type: "highlight", text: (block as any).text || "" }
                            : { type: "list", title: "", items: [""] };
                          updateBlock(sIdx, bIdx, nv);
                        }}
                      >
                        <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paragraph"><span className="flex items-center gap-2"><AlignLeft className="h-3 w-3" />Parágrafo</span></SelectItem>
                          <SelectItem value="quote"><span className="flex items-center gap-2"><Quote className="h-3 w-3" />Citação</span></SelectItem>
                          <SelectItem value="highlight"><span className="flex items-center gap-2"><Sparkles className="h-3 w-3" />Destaque</span></SelectItem>
                          <SelectItem value="list"><span className="flex items-center gap-2"><ListIcon className="h-3 w-3" />Lista</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeBlock(sIdx, bIdx)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>

                  {block.type === "paragraph" && (
                    <Textarea
                      value={block.text}
                      onChange={(e) => updateBlock(sIdx, bIdx, { text: e.target.value })}
                      rows={3}
                      placeholder="Parágrafo..."
                    />
                  )}
                  {block.type === "quote" && (
                    <div className="space-y-2">
                      <Input
                        value={block.author}
                        onChange={(e) => updateBlock(sIdx, bIdx, { author: e.target.value })}
                        placeholder="Quem falou (ex: Bruna Pieri)"
                      />
                      <Textarea
                        value={block.text}
                        onChange={(e) => updateBlock(sIdx, bIdx, { text: e.target.value })}
                        rows={3}
                        placeholder="Citação literal..."
                      />
                    </div>
                  )}
                  {block.type === "highlight" && (
                    <Textarea
                      value={block.text}
                      onChange={(e) => updateBlock(sIdx, bIdx, { text: e.target.value })}
                      rows={2}
                      placeholder="Frase de impacto..."
                      className="bg-yellow-100/60"
                    />
                  )}
                  {block.type === "list" && (
                    <div className="space-y-2">
                      <Input
                        value={block.title || ""}
                        onChange={(e) => updateBlock(sIdx, bIdx, { title: e.target.value })}
                        placeholder="Título da lista (opcional)"
                      />
                      {block.items.map((item, ii) => (
                        <div key={ii} className="flex gap-2">
                          <Input
                            value={item}
                            onChange={(e) => {
                              const items = [...block.items];
                              items[ii] = e.target.value;
                              updateBlock(sIdx, bIdx, { items });
                            }}
                            placeholder={`Item ${ii + 1}`}
                          />
                          <Button variant="ghost" size="icon" onClick={() => {
                            const items = block.items.filter((_, k) => k !== ii);
                            updateBlock(sIdx, bIdx, { items });
                          }}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => updateBlock(sIdx, bIdx, { items: [...block.items, ""] })}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar item
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => addBlock(sIdx, "paragraph")}><AlignLeft className="h-3 w-3 mr-1" />Parágrafo</Button>
                <Button variant="outline" size="sm" onClick={() => addBlock(sIdx, "quote")}><Quote className="h-3 w-3 mr-1" />Citação</Button>
                <Button variant="outline" size="sm" onClick={() => addBlock(sIdx, "highlight")}><Sparkles className="h-3 w-3 mr-1" />Destaque</Button>
                <Button variant="outline" size="sm" onClick={() => addBlock(sIdx, "list")}><ListIcon className="h-3 w-3 mr-1" />Lista</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={addSection} className="w-full">
        <Plus className="h-4 w-4 mr-2" /> Adicionar seção
      </Button>
    </div>
  );
}
