import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CANDIDATE_STAGE_LABELS, KANBAN_STAGES, type CandidateStage } from "@/types/job";
import { Loader2 } from "lucide-react";

const MAX_BYTES = 10 * 1024 * 1024;
const EXTS = ["pdf", "doc", "docx"];

export default function AddCandidateDialog({ open, onOpenChange, jobId }: { open: boolean; onOpenChange: (o: boolean) => void; jobId: string }) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [stage, setStage] = useState<CandidateStage>("applied");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(""); setEmail(""); setPhone(""); setCity(""); setState(""); setStage("applied"); setNotes(""); setFile(null); };

  const submit = async () => {
    if (!name.trim()) return toast.error("Informe o nome do candidato.");
    if (!email.trim() && !phone.trim()) return toast.error("Informe e-mail ou telefone.");
    if (!currentUser?.account_id) return toast.error("Não foi possível identificar sua conta.");
    setSaving(true);
    try {
      let resume_url: string | null = null;
      if (file) {
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        if (file.size > MAX_BYTES) throw new Error("Currículo acima de 10MB.");
        if (!EXTS.includes(ext)) throw new Error("Use currículo em PDF, DOC ou DOCX.");
        const safe = name.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60);
        const path = `${jobId}/${Date.now()}_${safe}.${ext}`;
        const { error } = await supabase.storage.from("hr-resumes").upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (error) throw new Error("Não foi possível anexar o currículo. Tente novamente ou salve sem anexo.");
        resume_url = path;
      }
      const { error } = await supabase.from("hr_job_applications").insert({
        job_id: jobId,
        account_id: currentUser.account_id,
        candidate_name: name.trim().slice(0, 200),
        candidate_email: email.trim().toLowerCase().slice(0, 200),
        candidate_phone: phone.trim() || null,
        candidate_city: city.trim() || null,
        candidate_state: state.trim() || null,
        cover_letter: notes.trim() || null,
        resume_url,
        stage,
        status: "active",
      } as any);
      if (error) throw new Error("Não foi possível cadastrar o candidato: " + error.message);
      qc.invalidateQueries({ queryKey: ["hr-job-applications", jobId] });
      toast.success("Candidato adicionado!");
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao cadastrar candidato.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar candidato</DialogTitle>
          <DialogDescription>Cadastre manualmente alguém que chegou por indicação, WhatsApp ou outro canal.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label>Nome completo *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Telefone / WhatsApp</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-[1fr_96px] gap-3">
            <div><Label>Cidade</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div><Label>UF</Label><Input maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} /></div>
          </div>
          <div>
            <Label>Etapa inicial</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as CandidateStage)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KANBAN_STAGES.map((s) => <SelectItem key={s} value={s}>{CANDIDATE_STAGE_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Currículo (opcional)</Label><Input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <div><Label>Observações</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: indicado pela Carmen" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
