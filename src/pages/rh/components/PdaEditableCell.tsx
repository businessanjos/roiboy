import { useEffect, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Pencil } from "lucide-react";
import { PdaBadge, YesNoBadge } from "@/components/rh/PdaBadge";
import { formatMoney, type PdaOption } from "@/lib/rh/pda";

const YES_NO: PdaOption[] = [
  { value: "sim", label: "SIM", color: "#16a34a" },
  { value: "nao", label: "NÃO", color: "#dc2626" },
];

function Trigger({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 text-left hover:bg-muted/60 transition-colors"
    >
      <span className="flex-1 min-w-0">{children}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0" />
    </button>
  );
}

/** Célula de seleção única. */
export function OptionCell({
  value, options, onSave,
}: { value?: string | null; options: PdaOption[]; onSave: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Trigger><PdaBadge value={value} options={options} /></Trigger>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1.5" align="start">
        <div className="max-h-[260px] overflow-y-auto space-y-0.5">
          <button
            type="button"
            onClick={() => { onSave(null); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            Limpar
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onSave(o.value); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
              <span className="flex-1 text-left">{o.label}</span>
              {value === o.value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Célula de múltipla seleção (setores). */
export function MultiOptionCell({
  values, options, onSave,
}: { values?: string[] | null; options: PdaOption[]; onSave: (v: string[]) => void }) {
  const list = values || [];
  const toggle = (v: string) =>
    onSave(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Trigger>
          {list.length === 0 ? "—" : (
            <span className="flex flex-wrap gap-1">
              {list.map((s) => <PdaBadge key={s} value={s} options={options} />)}
            </span>
          )}
        </Trigger>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1.5" align="start">
        <div className="max-h-[260px] overflow-y-auto space-y-0.5">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox checked={list.includes(o.value)} className="pointer-events-none" tabIndex={-1} />
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
              <span className="flex-1 text-left">{o.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Célula SIM/NÃO. */
export function YesNoCell({
  value, onSave,
}: { value?: boolean | null; onSave: (v: boolean | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Trigger><YesNoBadge value={value} /></Trigger>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1.5" align="start">
        <button type="button" onClick={() => { onSave(null); setOpen(false); }} className="flex w-full rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted">Limpar</button>
        {YES_NO.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => { onSave(o.value === "sim"); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />
            {o.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Célula de valor em reais. */
export function MoneyCell({
  value, onSave,
}: { value?: number | null; onSave: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  useEffect(() => { setText(value == null ? "" : String(value).replace(".", ",")); }, [value]);

  const commit = () => {
    setEditing(false);
    const raw = text.trim();
    if (raw === "") { if (value != null) onSave(null); return; }
    const n = parseFloat(raw.replace(/\./g, "").replace(",", "."));
    const next = Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
    if (next !== value) onSave(next);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        className="h-8 w-32 text-right"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^\d,.]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group flex w-full items-center justify-end gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 hover:bg-muted/60"
    >
      {formatMoney(value)}
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
    </button>
  );
}

/** Célula de gestor. */
export function ManagerCell({
  value, people, onSave,
}: {
  value?: string | null;
  people: { id: string; full_name: string; avatar_url?: string | null }[];
  onSave: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = people.find((p) => p.id === value);
  const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const filtered = people.filter((p) => p.full_name.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Trigger>
          {selected ? (
            <span className="flex items-center gap-2 whitespace-nowrap">
              <Avatar className="h-6 w-6">
                <AvatarImage src={selected.avatar_url || undefined} />
                <AvatarFallback className="text-[9px]">{initials(selected.full_name)}</AvatarFallback>
              </Avatar>
              {selected.full_name}
            </span>
          ) : "—"}
        </Trigger>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5" align="start">
        <Input placeholder="Buscar pessoa..." value={q} onChange={(e) => setQ(e.target.value)} className="h-8 mb-1.5" />
        <div className="max-h-[260px] overflow-y-auto space-y-0.5">
          <button type="button" onClick={() => { onSave(null); setOpen(false); }} className="flex w-full rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted">Sem gestor</button>
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onSave(p.id); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={p.avatar_url || undefined} />
                <AvatarFallback className="text-[9px]">{initials(p.full_name)}</AvatarFallback>
              </Avatar>
              <span className="flex-1 text-left truncate">{p.full_name}</span>
              {value === p.id && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

