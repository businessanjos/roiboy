import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { HRCollaborator } from "@/hooks/useHRCollaborators";

type Mode = "set" | "add" | "percent";

interface FieldDef {
  key: keyof HRCollaborator;
  label: string;
  group: "salary" | "benefits" | "charges";
}

const FIELDS: FieldDef[] = [
  { key: "base_salary", label: "Salário base", group: "salary" },
  { key: "salary", label: "Salário (legado)", group: "salary" },
  { key: "commissions", label: "Comissões", group: "salary" },

  { key: "health_plan", label: "Plano de saúde", group: "benefits" },
  { key: "life_insurance", label: "Seguro de vida", group: "benefits" },
  { key: "meal_voucher", label: "Vale refeição", group: "benefits" },
  { key: "transport_voucher", label: "Vale transporte", group: "benefits" },
  { key: "home_office_allowance", label: "Ajuda home office", group: "benefits" },

  { key: "inss_employer", label: "INSS Patronal", group: "charges" },
  { key: "inss_third_parties", label: "INSS Terceiros", group: "charges" },
  { key: "inss_gilrat", label: "INSS GILRAT", group: "charges" },
  { key: "fgts", label: "FGTS", group: "charges" },
  { key: "vacation_provision", label: "Provisão férias", group: "charges" },
  { key: "vacation_third", label: "1/3 férias", group: "charges" },
  { key: "thirteenth_provision", label: "Provisão 13º", group: "charges" },
];

const GROUP_LABELS: Record<string, string> = {
  salary: "Salário",
  benefits: "Benefícios",
  charges: "Encargos",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selected: HRCollaborator[];
  onApply: (
    updates: { id: string; patch: Partial<HRCollaborator> }[]
  ) => Promise<void>;
}

export default function CollaboratorsBulkEditDialog({
  open, onOpenChange, selected, onApply,
}: Props) {
  const [mode, setMode] = useState<Mode>("set");
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setActive({});
    setValues({});
    setMode("set");
  };

  const handleApply = async () => {
    const fieldsToApply = FIELDS.filter(f => active[f.key as string]);
    if (fieldsToApply.length === 0) {
      toast.error("Selecione ao menos um campo para atualizar.");
      return;
    }
    // Validate inputs
    const parsed: Record<string, number> = {};
    for (const f of fieldsToApply) {
      const raw = (values[f.key as string] || "").replace(/\./g, "").replace(",", ".");
      const num = parseFloat(raw);
      if (isNaN(num)) {
        toast.error(`Valor inválido em "${f.label}".`);
        return;
      }
      parsed[f.key as string] = num;
    }

    setSaving(true);
    try {
      const updates = selected.map(c => {
        const patch: Partial<HRCollaborator> = {};
        for (const f of fieldsToApply) {
          const k = f.key as string;
          const current = (c as any)[k] as number | null | undefined;
          let next: number;
          if (mode === "set") {
            next = parsed[k];
          } else if (mode === "add") {
            next = (Number(current) || 0) + parsed[k];
          } else {
            // percent
            next = (Number(current) || 0) * (1 + parsed[k] / 100);
          }
          (patch as any)[k] = Math.round(next * 100) / 100;
        }
        return { id: c.id, patch };
      });

      await onApply(updates);
      toast.success(`${updates.length} colaborador(es) atualizado(s).`);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + (err?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Edição em lote
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground -mt-1">
          {selected.length} colaborador{selected.length !== 1 ? "es" : ""} selecionado{selected.length !== 1 ? "s" : ""}.
        </div>

        <div className="space-y-4 mt-2">
          <div>
            <Label>Operação</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="set">Definir valor (substitui)</SelectItem>
                <SelectItem value="add">Somar valor (R$)</SelectItem>
                <SelectItem value="percent">Aplicar reajuste (%)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {mode === "set" && "O valor digitado substituirá o atual em todos os selecionados."}
              {mode === "add" && "O valor será somado ao atual (use negativo para subtrair)."}
              {mode === "percent" && "Reajuste percentual sobre o valor atual. Ex: 10 = +10%, -5 = -5%."}
            </p>
          </div>

          {(["salary", "benefits", "charges"] as const).map(group => (
            <div key={group} className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                {GROUP_LABELS[group]}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FIELDS.filter(f => f.group === group).map(f => {
                  const k = f.key as string;
                  const isActive = !!active[k];
                  return (
                    <div
                      key={k}
                      className={`flex items-center gap-2 rounded-md border p-2 ${isActive ? "bg-primary/5 border-primary/40" : ""}`}
                    >
                      <Checkbox
                        checked={isActive}
                        onCheckedChange={(v) => setActive(a => ({ ...a, [k]: !!v }))}
                      />
                      <Label className="flex-1 text-sm cursor-pointer" onClick={() => setActive(a => ({ ...a, [k]: !a[k] }))}>
                        {f.label}
                      </Label>
                      <Input
                        disabled={!isActive}
                        value={values[k] || ""}
                        onChange={(e) => setValues(v => ({ ...v, [k]: e.target.value }))}
                        placeholder={mode === "percent" ? "%" : "0,00"}
                        className="h-8 w-28 text-right tabular-nums"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleApply} disabled={saving || selected.length === 0}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aplicar a {selected.length} colaborador{selected.length !== 1 ? "es" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
