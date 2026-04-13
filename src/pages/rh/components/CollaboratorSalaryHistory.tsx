import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, TrendingUp, ArrowUpRight, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const CHANGE_TYPES: Record<string, { label: string; color: string }> = {
  promotion: { label: "Promoção", color: "text-green-600" },
  adjustment: { label: "Reajuste", color: "text-blue-600" },
  transfer: { label: "Transferência", color: "text-purple-600" },
  demotion: { label: "Rebaixamento", color: "text-orange-600" },
  initial: { label: "Admissão", color: "text-muted-foreground" },
};

interface SalaryEntry {
  id: string;
  effective_date: string;
  change_type: string;
  previous_salary: number | null;
  new_salary: number | null;
  previous_position: string | null;
  new_position: string | null;
  previous_department: string | null;
  new_department: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  collaboratorId: string;
  accountId: string;
  currentSalary: number | null;
  currentPosition: string | null;
  currentDepartment: string | null;
}

export default function CollaboratorSalaryHistory({ collaboratorId, accountId, currentSalary, currentPosition, currentDepartment }: Props) {
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    effective_date: "", change_type: "adjustment",
    new_salary: "", new_position: "", new_department: "",
    reason: "", notes: "",
  });

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase
      .from("hr_salary_history")
      .select("*")
      .eq("collaborator_id", collaboratorId)
      .order("effective_date", { ascending: false });
    setEntries((data || []) as SalaryEntry[]);
    setLoading(false);
  }, [collaboratorId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleSubmit = async () => {
    if (!form.effective_date) return;
    const { error } = await supabase.from("hr_salary_history").insert({
      account_id: accountId,
      collaborator_id: collaboratorId,
      effective_date: form.effective_date,
      change_type: form.change_type,
      previous_salary: currentSalary,
      new_salary: form.new_salary ? parseFloat(form.new_salary) : null,
      previous_position: currentPosition,
      new_position: form.new_position || null,
      previous_department: currentDepartment,
      new_department: form.new_department || null,
      reason: form.reason || null,
      notes: form.notes || null,
    } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Registro adicionado!");
    setDialogOpen(false);
    setForm({ effective_date: "", change_type: "adjustment", new_salary: "", new_position: "", new_department: "", reason: "", notes: "" });
    fetchEntries();
  };

  const fmtCurrency = (v: number | null) => v != null ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-muted-foreground">{entries.length} registro{entries.length !== 1 ? "s" : ""}</h3>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Registro
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12">
          <TrendingUp className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Nenhum histórico registrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => {
            const ct = CHANGE_TYPES[entry.change_type] || CHANGE_TYPES.adjustment;
            const salaryDiff = entry.new_salary && entry.previous_salary
              ? entry.new_salary - entry.previous_salary : null;
            return (
              <div key={entry.id} className="p-3 border rounded-lg space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${ct.color}`}>{ct.label}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(entry.effective_date), "dd/MM/yyyy")}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  {(entry.previous_salary || entry.new_salary) && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">{fmtCurrency(entry.previous_salary)}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-medium">{fmtCurrency(entry.new_salary)}</span>
                      {salaryDiff != null && salaryDiff > 0 && (
                        <span className="text-xs text-green-600 flex items-center"><ArrowUpRight className="h-3 w-3" />+{((salaryDiff / (entry.previous_salary || 1)) * 100).toFixed(1)}%</span>
                      )}
                    </div>
                  )}
                  {entry.new_position && entry.previous_position && entry.new_position !== entry.previous_position && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {entry.previous_position} <ArrowRight className="h-3 w-3" /> <span className="font-medium text-foreground">{entry.new_position}</span>
                    </div>
                  )}
                </div>
                {entry.reason && <p className="text-xs text-muted-foreground">{entry.reason}</p>}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Registro de Movimentação</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data efetiva *</Label>
                <Input type="date" value={form.effective_date} onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.change_type} onValueChange={v => setForm(f => ({ ...f, change_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANGE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Novo salário</Label>
              <Input type="number" value={form.new_salary} onChange={e => setForm(f => ({ ...f, new_salary: e.target.value }))} placeholder={currentSalary ? `Atual: R$ ${currentSalary}` : "R$ 0,00"} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Novo cargo</Label>
                <Input value={form.new_position} onChange={e => setForm(f => ({ ...f, new_position: e.target.value }))} placeholder={currentPosition || ""} />
              </div>
              <div>
                <Label>Novo departamento</Label>
                <Input value={form.new_department} onChange={e => setForm(f => ({ ...f, new_department: e.target.value }))} placeholder={currentDepartment || ""} />
              </div>
            </div>
            <div>
              <Label>Motivo</Label>
              <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!form.effective_date}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
