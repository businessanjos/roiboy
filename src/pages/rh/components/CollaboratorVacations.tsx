import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, CalendarDays, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

const REQUEST_TYPES: Record<string, string> = {
  vacation: "Férias",
  sick_leave: "Licença Médica",
  maternity: "Licença Maternidade",
  paternity: "Licença Paternidade",
  personal: "Licença Pessoal",
  bereavement: "Luto",
  other: "Outro",
};

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "secondary" },
};

interface VacationRequest {
  id: string;
  request_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  status: string;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
}

interface Props {
  collaboratorId: string;
  accountId: string;
}

export default function CollaboratorVacations({ collaboratorId, accountId }: Props) {
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    request_type: "vacation", start_date: "", end_date: "", notes: "",
  });

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from("hr_vacation_requests")
      .select("*")
      .eq("collaborator_id", collaboratorId)
      .order("start_date", { ascending: false });
    setRequests((data || []) as VacationRequest[]);
    setLoading(false);
  }, [collaboratorId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const daysCount = form.start_date && form.end_date
    ? differenceInDays(new Date(form.end_date), new Date(form.start_date)) + 1
    : 0;

  const handleSubmit = async () => {
    if (!form.start_date || !form.end_date || daysCount <= 0) return;
    const { error } = await supabase.from("hr_vacation_requests").insert({
      account_id: accountId,
      collaborator_id: collaboratorId,
      request_type: form.request_type,
      start_date: form.start_date,
      end_date: form.end_date,
      days_count: daysCount,
      notes: form.notes || null,
    } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Solicitação registrada!");
    setDialogOpen(false);
    setForm({ request_type: "vacation", start_date: "", end_date: "", notes: "" });
    fetchRequests();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("hr_vacation_requests").update({ status } as any).eq("id", id);
    if (error) { toast.error("Erro"); return; }
    toast.success(status === "approved" ? "Aprovado!" : "Rejeitado");
    fetchRequests();
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  const totalDaysUsed = requests.filter(r => r.status === "approved" && r.request_type === "vacation")
    .reduce((sum, r) => sum + r.days_count, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-medium text-muted-foreground">{requests.length} solicitaç{requests.length !== 1 ? "ões" : "ão"}</h3>
          <Badge variant="outline" className="text-xs">{totalDaysUsed} dias de férias usados</Badge>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Solicitação
        </Button>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12">
          <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Nenhuma solicitação registrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(req => {
            const st = STATUS_MAP[req.status] || STATUS_MAP.pending;
            return (
              <div key={req.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <CalendarDays className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{REQUEST_TYPES[req.request_type] || req.request_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(req.start_date), "dd/MM/yyyy")} → {format(new Date(req.end_date), "dd/MM/yyyy")} • {req.days_count} dia{req.days_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                {req.status === "pending" && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateStatus(req.id, "approved")}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateStatus(req.id, "rejected")}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Solicitação</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.request_type} onValueChange={v => setForm(f => ({ ...f, request_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REQUEST_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            {daysCount > 0 && <p className="text-sm text-muted-foreground">{daysCount} dia{daysCount !== 1 ? "s" : ""}</p>}
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={daysCount <= 0}>Registrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
