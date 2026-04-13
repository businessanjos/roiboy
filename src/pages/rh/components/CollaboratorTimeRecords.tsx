import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Clock, Timer } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface TimeRecord {
  id: string;
  record_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  total_hours: number | null;
  overtime_hours: number | null;
  status: string;
  justification: string | null;
}

interface Props {
  collaboratorId: string;
  accountId: string;
}

const STATUS_LABELS: Record<string, string> = {
  regular: "Regular",
  late: "Atraso",
  absent: "Falta",
  justified: "Justificado",
  holiday: "Feriado",
};

export default function CollaboratorTimeRecords({ collaboratorId, accountId }: Props) {
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [monthFilter, setMonthFilter] = useState(format(new Date(), "yyyy-MM"));
  const [form, setForm] = useState({
    record_date: format(new Date(), "yyyy-MM-dd"),
    clock_in: "08:00", clock_out: "17:00",
    break_start: "12:00", break_end: "13:00",
    status: "regular",
  });

  const fetchRecords = useCallback(async () => {
    const start = startOfMonth(new Date(monthFilter + "-01"));
    const end = endOfMonth(start);
    const { data } = await supabase
      .from("hr_time_records")
      .select("*")
      .eq("collaborator_id", collaboratorId)
      .gte("record_date", format(start, "yyyy-MM-dd"))
      .lte("record_date", format(end, "yyyy-MM-dd"))
      .order("record_date", { ascending: false });
    setRecords((data || []) as TimeRecord[]);
    setLoading(false);
  }, [collaboratorId, monthFilter]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const calcHours = () => {
    if (!form.clock_in || !form.clock_out) return 0;
    const [hi, mi] = form.clock_in.split(":").map(Number);
    const [ho, mo] = form.clock_out.split(":").map(Number);
    let total = (ho * 60 + mo) - (hi * 60 + mi);
    if (form.break_start && form.break_end) {
      const [hbs, mbs] = form.break_start.split(":").map(Number);
      const [hbe, mbe] = form.break_end.split(":").map(Number);
      total -= (hbe * 60 + mbe) - (hbs * 60 + mbs);
    }
    return Math.max(0, +(total / 60).toFixed(2));
  };

  const handleSubmit = async () => {
    if (!form.record_date) return;
    const totalHours = calcHours();
    const overtime = Math.max(0, totalHours - 8);
    const { error } = await supabase.from("hr_time_records").insert({
      account_id: accountId,
      collaborator_id: collaboratorId,
      record_date: form.record_date,
      clock_in: form.clock_in || null,
      clock_out: form.clock_out || null,
      break_start: form.break_start || null,
      break_end: form.break_end || null,
      total_hours: totalHours,
      overtime_hours: overtime,
      status: form.status,
    } as any);
    if (error) {
      if (error.code === "23505") toast.error("Já existe registro para esta data");
      else toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Ponto registrado!");
    setDialogOpen(false);
    fetchRecords();
  };

  const totalHoursMonth = records.reduce((s, r) => s + (r.total_hours || 0), 0);
  const totalOvertimeMonth = records.reduce((s, r) => s + (r.overtime_hours || 0), 0);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-[180px]" />
          <Badge variant="outline" className="text-xs">{totalHoursMonth.toFixed(1)}h total</Badge>
          {totalOvertimeMonth > 0 && (
            <Badge variant="secondary" className="text-xs">{totalOvertimeMonth.toFixed(1)}h extra</Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Registrar Ponto
        </Button>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Nenhum registro no período</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left p-2 font-medium text-muted-foreground">Data</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Entrada</th>
                <th className="text-left p-2 font-medium text-muted-foreground hidden sm:table-cell">Intervalo</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Saída</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Total</th>
                <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="p-2">{format(new Date(r.record_date + "T12:00"), "dd/MM")}</td>
                  <td className="p-2 text-muted-foreground">{r.clock_in?.slice(0, 5) || "—"}</td>
                  <td className="p-2 text-muted-foreground hidden sm:table-cell">
                    {r.break_start && r.break_end ? `${r.break_start.slice(0, 5)}-${r.break_end.slice(0, 5)}` : "—"}
                  </td>
                  <td className="p-2 text-muted-foreground">{r.clock_out?.slice(0, 5) || "—"}</td>
                  <td className="p-2 font-medium">{r.total_hours ? `${r.total_hours}h` : "—"}</td>
                  <td className="p-2">
                    <Badge variant={r.status === "absent" ? "destructive" : r.status === "late" ? "outline" : "secondary"} className="text-xs">
                      {STATUS_LABELS[r.status] || r.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Ponto</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.record_date} onChange={e => setForm(f => ({ ...f, record_date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Entrada</Label><Input type="time" value={form.clock_in} onChange={e => setForm(f => ({ ...f, clock_in: e.target.value }))} /></div>
              <div><Label>Saída</Label><Input type="time" value={form.clock_out} onChange={e => setForm(f => ({ ...f, clock_out: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início intervalo</Label><Input type="time" value={form.break_start} onChange={e => setForm(f => ({ ...f, break_start: e.target.value }))} /></div>
              <div><Label>Fim intervalo</Label><Input type="time" value={form.break_end} onChange={e => setForm(f => ({ ...f, break_end: e.target.value }))} /></div>
            </div>
            <p className="text-sm text-muted-foreground">Total: {calcHours()}h</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!form.record_date}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
