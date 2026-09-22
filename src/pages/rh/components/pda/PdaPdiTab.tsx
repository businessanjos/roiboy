import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { PdaBadge, YesNoBadge } from "@/components/rh/PdaBadge";
import { useHRPdaOptions } from "@/hooks/useHRPdaOptions";

export type PdiCycle = {
  id: string;
  label: string;
  pdi_done: boolean | null;
  pdi_delivered: boolean | null;
  effort_level: string | null;
  change_quality: string | null;
  plan: string | null;
  created_at: string;
};

const EMPTY = {
  label: "",
  pdi_done: "" as string,
  pdi_delivered: "" as string,
  effort_level: "",
  change_quality: "",
  plan: "",
};

function suggestLabel() {
  const d = new Date();
  return `${d.getFullYear()}-T${Math.floor(d.getMonth() / 3) + 1}`;
}

export default function PdaPdiTab({
  personId,
  accountId,
  sourceTable = "hr_collaborators",
  onSyncLatest,
}: {
  personId: string;
  accountId?: string | null;
  sourceTable?: string;
  onSyncLatest?: (v: {
    pda_pdi_done: boolean | null;
    pda_pdi_delivered: boolean | null;
    pda_effort_level: string | null;
    pda_change_quality: string | null;
  }) => void;
}) {
  const { currentUser } = useCurrentUser();
  const { optionsFor } = useHRPdaOptions();
  const [cycles, setCycles] = useState<PdiCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PdiCycle | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetchCycles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hr_pda_cycles")
      .select("id, label, pdi_done, pdi_delivered, effort_level, change_quality, plan, created_at")
      .eq("person_id", personId)
      .order("created_at", { ascending: false });
    setCycles((data || []) as PdiCycle[]);
    setLoading(false);
    return (data || []) as PdiCycle[];
  }, [personId]);

  useEffect(() => { fetchCycles(); }, [fetchCycles]);

  const openDialog = (c?: PdiCycle) => {
    if (c) {
      setEditing(c);
      setForm({
        label: c.label,
        pdi_done: c.pdi_done == null ? "" : c.pdi_done ? "sim" : "nao",
        pdi_delivered: c.pdi_delivered == null ? "" : c.pdi_delivered ? "sim" : "nao",
        effort_level: c.effort_level || "",
        change_quality: c.change_quality || "",
        plan: c.plan || "",
      });
    } else {
      setEditing(null);
      setForm({ ...EMPTY, label: suggestLabel() });
    }
    setOpen(true);
  };

  const syncLatest = (list: PdiCycle[]) => {
    const latest = list[0];
    if (!latest || !onSyncLatest) return;
    onSyncLatest({
      pda_pdi_done: latest.pdi_done,
      pda_pdi_delivered: latest.pdi_delivered,
      pda_effort_level: latest.effort_level,
      pda_change_quality: latest.change_quality,
    });
  };

  const save = async () => {
    if (!form.label.trim()) { toast.error("Informe o rótulo do ciclo"); return; }
    setSaving(true);
    const payload = {
      account_id: accountId,
      person_id: personId,
      source_table: sourceTable,
      label: form.label.trim(),
      pdi_done: form.pdi_done === "" ? null : form.pdi_done === "sim",
      pdi_delivered: form.pdi_delivered === "" ? null : form.pdi_delivered === "sim",
      effort_level: form.effort_level || null,
      change_quality: form.change_quality || null,
      plan: form.plan.trim() || null,
      created_by: currentUser?.id || null,
    };
    const { error } = editing
      ? await supabase.from("hr_pda_cycles").update(payload as any).eq("id", editing.id)
      : await supabase.from("hr_pda_cycles").insert(payload as any);
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar o ciclo"); return; }
    toast.success("Ciclo salvo");
    setOpen(false);
    syncLatest(await fetchCycles());
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este ciclo de PDI?")) return;
    const { error } = await supabase.from("hr_pda_cycles").delete().eq("id", id);
    if (error) { toast.error("Não foi possível excluir"); return; }
    syncLatest(await fetchCycles());
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Os campos de PDI da lista do PDA refletem o ciclo mais recente.
        </p>
        <Button size="sm" onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2" /> Novo ciclo</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : cycles.length === 0 ? (
        <div className="border border-dashed rounded-xl py-10 text-center text-sm text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nenhum ciclo de PDI registrado.
        </div>
      ) : (
        <div className="space-y-2">
          {cycles.map((c, idx) => (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{c.label}</span>
                  {idx === 0 && <Badge variant="outline" className="text-[10px]">Mais recente</Badge>}
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5">PDI feito <YesNoBadge value={c.pdi_done} /></span>
                  <span className="flex items-center gap-1.5">Entregue <YesNoBadge value={c.pdi_delivered} /></span>
                  {c.effort_level && <PdaBadge value={c.effort_level} options={optionsFor("pda_effort_level")} />}
                  {c.change_quality && <PdaBadge value={c.change_quality} options={optionsFor("pda_change_quality")} />}
                </div>
                {c.plan && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{c.plan}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar ciclo" : "Novo ciclo de PDI"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Rótulo</Label>
              <Input value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} placeholder="2026-T3" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>PDI feito?</Label>
                <Select value={form.pdi_done} onValueChange={(v) => setForm(f => ({ ...f, pdi_done: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">SIM</SelectItem>
                    <SelectItem value="nao">NÃO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>PDI entregue?</Label>
                <Select value={form.pdi_delivered} onValueChange={(v) => setForm(f => ({ ...f, pdi_delivered: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">SIM</SelectItem>
                    <SelectItem value="nao">NÃO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nível de esforço</Label>
                <Select value={form.effort_level} onValueChange={(v) => setForm(f => ({ ...f, effort_level: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {optionsFor("pda_effort_level").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>QM - Qualidade da Mudança</Label>
                <Select value={form.change_quality} onValueChange={(v) => setForm(f => ({ ...f, change_quality: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {optionsFor("pda_change_quality").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Plano</Label>
              <Textarea rows={5} value={form.plan} onChange={(e) => setForm(f => ({ ...f, plan: e.target.value }))} placeholder="O que será desenvolvido neste ciclo…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
