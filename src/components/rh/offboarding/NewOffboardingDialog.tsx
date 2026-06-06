import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHROffboardings, type HROffboarding } from "@/hooks/useHROffboardings";
import { TERMINATION_TYPE_LABELS, type TerminationType } from "@/lib/rescissionCalc";

interface CollabOpt { id: string; full_name: string; position: string | null }

export default function NewOffboardingDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (o: HROffboarding) => void }) {
  const { currentUser } = useCurrentUser();
  const { create } = useHROffboardings();
  const [collabs, setCollabs] = useState<CollabOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    collaborator_id: "",
    termination_type: "sem_justa_causa" as TerminationType,
    notice_communicated_at: new Date().toISOString().slice(0, 10),
    reason: "",
    will_replace: false,
  });

  // load active collaborators
  useState(() => {
    if (!currentUser?.account_id) return;
    supabase.from("hr_collaborators")
      .select("id, full_name, position")
      .eq("account_id", currentUser.account_id)
      .eq("status", "active")
      .order("full_name")
      .then(({ data }) => setCollabs((data || []) as any));
  });

  async function handleCreate() {
    if (!form.collaborator_id) return;
    setLoading(true);
    try {
      const created = await create(form as any);
      onCreated(created as HROffboarding);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo desligamento</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Colaborador *</Label>
            <Select value={form.collaborator_id} onValueChange={(v) => setForm({ ...form, collaborator_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {collabs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}{c.position ? ` · ${c.position}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de desligamento *</Label>
            <Select value={form.termination_type} onValueChange={(v) => setForm({ ...form, termination_type: v as TerminationType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TERMINATION_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data da comunicação</Label>
            <Input type="date" value={form.notice_communicated_at} onChange={(e) => setForm({ ...form, notice_communicated_at: e.target.value })} />
          </div>
          <div>
            <Label>Motivo (curto)</Label>
            <Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ex.: Performance abaixo do esperado, reestruturação..." />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Checkbox id="will_replace" checked={form.will_replace} onCheckedChange={(v) => setForm({ ...form, will_replace: !!v })} />
            <Label htmlFor="will_replace" className="cursor-pointer">A vaga será reposta (cria rascunho em Vagas)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!form.collaborator_id || loading}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
