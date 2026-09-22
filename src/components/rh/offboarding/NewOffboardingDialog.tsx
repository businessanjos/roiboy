import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHROffboardings, type HROffboarding } from "@/hooks/useHROffboardings";
import { TERMINATION_TYPE_LABELS, type TerminationType } from "@/lib/rescissionCalc";

interface CollabOpt { id: string; full_name: string; position: string | null; kind: "collaborator" | "service_provider"; bond: string }

export default function NewOffboardingDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (o: HROffboarding) => void }) {
  const { currentUser } = useCurrentUser();
  const { create } = useHROffboardings();
  const [collabs, setCollabs] = useState<CollabOpt[]>([]);
  const [personSearch, setPersonSearch] = useState("");
  const [bondFilter, setBondFilter] = useState<"all" | "collaborator" | "service_provider">("all");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    person_key: "",
    termination_type: "sem_justa_causa" as TerminationType,
    notice_communicated_at: new Date().toISOString().slice(0, 10),
    reason: "",
    will_replace: false,
  });

  useEffect(() => {
    if (!currentUser?.account_id || !open) return;
    (async () => {
      const [clt, pj] = await Promise.all([
        supabase.from("hr_collaborators")
          .select("id, full_name, position, employment_type")
          .eq("account_id", currentUser.account_id)
          .eq("status", "active")
          .order("full_name"),
        supabase.from("hr_service_providers")
          .select("id, full_name, position, service_type, provider_kind")
          .eq("account_id", currentUser.account_id)
          .eq("status", "active")
          .order("full_name"),
      ]);
      const list: CollabOpt[] = [
        ...((clt.data || []) as any[]).map((c) => ({
          id: c.id, full_name: c.full_name, position: c.position,
          kind: "collaborator" as const,
          bond: c.employment_type === "intern" ? "Estágio" : c.employment_type === "socio" ? "Sócio" : "CLT",
        })),
        ...((pj.data || []) as any[]).map((p) => ({
          id: p.id, full_name: p.full_name, position: p.position || p.service_type,
          kind: "service_provider" as const,
          bond: p.provider_kind === "director" ? "PJ · Cargo de confiança" : "PJ",
        })),
      ].sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
      setCollabs(list);
    })();
  }, [currentUser?.account_id, open]);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filteredCollabs = collabs.filter((c) => {
    if (bondFilter !== "all" && c.kind !== bondFilter) return false;
    if (!personSearch.trim()) return true;
    const q = norm(personSearch);
    return norm(c.full_name).includes(q) || norm(c.position || "").includes(q);
  });
  const selectedPerson = collabs.find((c) => `${c.kind}:${c.id}` === form.person_key) || null;

  async function handleCreate() {
    if (!selectedPerson) return;
    setLoading(true);
    try {
      const created = await create({
        collaborator_id: selectedPerson.kind === "collaborator" ? selectedPerson.id : null,
        service_provider_id: selectedPerson.kind === "service_provider" ? selectedPerson.id : null,
        subject_type: selectedPerson.kind,
        termination_type: form.termination_type,
        reason: form.reason,
        notice_communicated_at: form.notice_communicated_at,
        will_replace: form.will_replace,
      } as any);
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
            <Label>Pessoa *</Label>
            <div className="mt-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8 h-9" placeholder="Buscar por nome ou cargo..." value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} />
              </div>
              <Select value={bondFilter} onValueChange={(v) => setBondFilter(v as any)}>
                <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="collaborator">CLT / Estágio</SelectItem>
                  <SelectItem value="service_provider">PJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-2 max-h-52 overflow-y-auto rounded-md border divide-y">
              {filteredCollabs.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Nenhuma pessoa encontrada.</p>
              ) : filteredCollabs.map((c) => {
                const key = `${c.kind}:${c.id}`;
                const active = form.person_key === key;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setForm({ ...form, person_key: key })}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-muted/60 ${active ? "bg-primary/10" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.full_name}</span>
                      {c.position && <span className="block truncate text-xs text-muted-foreground">{c.position}</span>}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{c.bond}</Badge>
                  </button>
                );
              })}
            </div>
            {selectedPerson && (
              <p className="mt-1.5 text-xs text-muted-foreground">Selecionado: <span className="font-medium text-foreground">{selectedPerson.full_name}</span> · {selectedPerson.bond}</p>
            )}
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
