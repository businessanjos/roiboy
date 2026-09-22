import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PDA_COLORS, PDA_DEFAULTS_BY_FIELD, PDA_FIELDS, type PdaFieldKey, type PdaOption } from "@/lib/rh/pda";
import { useHRPdaOptions } from "@/hooks/useHRPdaOptions";

const COLOR_LIST = Object.values(PDA_COLORS);

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-8 w-8 rounded-md border shrink-0"
          style={{ backgroundColor: color }}
          title="Cor"
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-6 gap-2">
          {COLOR_LIST.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={`h-7 w-7 rounded-md border ${c === color ? "ring-2 ring-offset-1 ring-ring" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function PdaOptionsDialog({
  open, onOpenChange, initialField,
}: { open: boolean; onOpenChange: (v: boolean) => void; initialField?: PdaFieldKey }) {
  const { editableFor, saveField, loading } = useHRPdaOptions();
  const [field, setField] = useState<PdaFieldKey>(initialField || PDA_FIELDS[0].key);
  const [items, setItems] = useState<PdaOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open && initialField) setField(initialField); }, [open, initialField]);
  useEffect(() => { setItems(editableFor(field)); }, [field, editableFor, open]);

  const current = useMemo(() => PDA_FIELDS.find((f) => f.key === field)!, [field]);

  const update = (i: number, patch: Partial<PdaOption>) =>
    setItems((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const move = (i: number, dir: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const handleSave = async () => {
    const clean = items
      .map((o) => ({ ...o, label: o.label.trim() }))
      .filter((o) => o.label.length > 0)
      .map((o) => ({ ...o, value: o.value?.trim() || o.label }));
    const seen = new Set<string>();
    for (const o of clean) {
      if (seen.has(o.value)) { toast.error(`Opção repetida: ${o.label}`); return; }
      seen.add(o.value);
    }
    setSaving(true);
    const ok = await saveField(field, clean);
    setSaving(false);
    if (ok) toast.success("Opções atualizadas");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Opções do PDA</DialogTitle>
          <DialogDescription>
            Crie, renomeie, reordene ou remova as opções de cada campo. Quem já estiver com uma opção removida mantém o valor antigo até ser alterado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {PDA_FIELDS.map((f) => (
              <Button
                key={f.key}
                type="button"
                size="sm"
                variant={f.key === field ? "default" : "outline"}
                onClick={() => setField(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {current.hint && <p className="text-xs text-muted-foreground">{current.hint}</p>}

          <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
            {loading && items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma opção. Adicione a primeira abaixo.</p>
            ) : items.map((o, i) => (
              <div key={`${o.value}-${i}`} className="flex items-center gap-2">
                <ColorPicker color={o.color} onChange={(c) => update(i, { color: c })} />
                <Input value={o.label} onChange={(e) => update(i, { label: e.target.value })} className="flex-1" />
                <Button type="button" variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button" variant="ghost" size="icon"
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setItems((prev) => [...prev, { value: "", label: "", color: PDA_COLORS.cinza }])}
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar opção
            </Button>
            <Button
              type="button" variant="ghost" size="sm"
              onClick={() => setItems((PDA_DEFAULTS_BY_FIELD[field] || []).map((o) => ({ ...o })))}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Restaurar padrão
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar opções"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
