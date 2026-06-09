import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Mail, Phone, MapPin, Calendar, FileText, ExternalLink,
  User, Briefcase, GraduationCap, Heart, ChevronRight, X,
  CheckCircle2, XCircle, ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { HRJobApplication, CandidateStage } from "@/types/job";
import { CANDIDATE_STAGE_LABELS, KANBAN_STAGES } from "@/types/job";
import { useUpdateCandidateStage } from "@/hooks/useHRJobs";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { analyzeCandidateMatchAI } from "@/hooks/useHRJobStages";
import { Sparkles, Loader2 } from "lucide-react";

const SENIORITY_LABELS: Record<string, string> = {
  intern: "Estágio", junior: "Júnior", pleno: "Pleno", senior: "Sênior",
  specialist: "Especialista", lead: "Líder", manager: "Gerente", director: "Diretor",
};

const GENDER_LABELS: Record<string, string> = {
  male: "Masculino", female: "Feminino", non_binary: "Não-binário", other: "Outro", prefer_not_to_say: "Prefiro não informar",
};

const RACE_LABELS: Record<string, string> = {
  white: "Branca", black: "Preta", brown: "Parda", asian: "Amarela", indigenous: "Indígena", prefer_not_to_say: "Prefiro não informar",
};

const getScoreColor = (score: number | null): "default" | "secondary" | "outline" => {
  if (score === null) return "secondary";
  if (score >= 80) return "default";
  if (score >= 60) return "secondary";
  return "outline";
};

const getNextStage = (current: CandidateStage): CandidateStage | null => {
  const idx = KANBAN_STAGES.indexOf(current);
  if (idx === -1 || idx >= KANBAN_STAGES.length - 1) return null;
  return KANBAN_STAGES[idx + 1];
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: HRJobApplication | null;
  jobId: string;
}

export default function CandidateDetailDrawer({ open, onOpenChange, candidate, jobId }: Props) {
  const updateStage = useUpdateCandidateStage();
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  if (!candidate) return null;

  const nextStage = getNextStage(candidate.stage);

  const handleMoveStage = (stage: CandidateStage) => {
    updateStage.mutate(
      { candidateIds: [candidate.id], stage, jobId },
      { onSuccess: () => toast.success(`Candidato movido para ${CANDIDATE_STAGE_LABELS[stage]}`) }
    );
  };

  const handleSaveNotes = async () => {
    if (!notes.trim()) return;
    setSavingNotes(true);
    const currentNotes = candidate.notes || "";
    const timestamp = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    const newNotes = currentNotes
      ? `${currentNotes}\n\n---\n[${timestamp}]\n${notes.trim()}`
      : `[${timestamp}]\n${notes.trim()}`;

    const { error } = await supabase
      .from("hr_job_applications")
      .update({ notes: newNotes } as any)
      .eq("id", candidate.id);

    setSavingNotes(false);
    if (error) {
      toast.error("Erro ao salvar nota");
    } else {
      toast.success("Nota adicionada!");
      setNotes("");
      candidate.notes = newNotes; // optimistic
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        {/* Header */}
        <div className="p-6 pb-4 border-b bg-muted/30">
          <SheetHeader className="mb-3">
            <SheetTitle className="text-xl">{candidate.candidate_name}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{CANDIDATE_STAGE_LABELS[candidate.stage]}</Badge>
            {candidate.ai_score !== null && (
              <Badge variant={getScoreColor(candidate.ai_score)}>Score IA: {candidate.ai_score}</Badge>
            )}
            {candidate.candidate_pcd && <Badge variant="secondary">PCD</Badge>}
          </div>
          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 mt-4">
            {nextStage && (
              <Button size="sm" onClick={() => handleMoveStage(nextStage)} disabled={updateStage.isPending}>
                <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                Mover para {CANDIDATE_STAGE_LABELS[nextStage]}
              </Button>
            )}
            {candidate.stage !== "hired" && (
              <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50"
                onClick={() => handleMoveStage("hired")} disabled={updateStage.isPending}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Contratar
              </Button>
            )}
            {candidate.stage !== "rejected" && (
              <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => handleMoveStage("rejected")} disabled={updateStage.isPending}>
                <XCircle className="h-3.5 w-3.5 mr-1.5" />Rejeitar
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info" className="p-6">
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="analysis">Análise IA</TabsTrigger>
            <TabsTrigger value="notes">Notas</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="space-y-5 mt-0">
            {/* Contact */}
            <section>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />Contato
              </h4>
              <div className="space-y-2.5">
                <InfoRow icon={<Mail className="h-4 w-4" />} label={candidate.candidate_email} href={`mailto:${candidate.candidate_email}`} />
                {candidate.candidate_phone && <InfoRow icon={<Phone className="h-4 w-4" />} label={candidate.candidate_phone} href={`tel:${candidate.candidate_phone}`} />}
                {(candidate.candidate_city || candidate.candidate_state) && (
                  <InfoRow icon={<MapPin className="h-4 w-4" />} label={[candidate.candidate_city, candidate.candidate_state].filter(Boolean).join(", ")} />
                )}
                {candidate.candidate_birth_date && (
                  <InfoRow icon={<Calendar className="h-4 w-4" />} label={format(new Date(candidate.candidate_birth_date), "dd/MM/yyyy", { locale: ptBR })} />
                )}
              </div>
            </section>

            <Separator />

            {/* Professional */}
            <section>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />Profissional
              </h4>
              <div className="space-y-2.5">
                {candidate.desired_position && <InfoRow icon={<Briefcase className="h-4 w-4" />} label={candidate.desired_position} />}
                {candidate.desired_seniority && (
                  <InfoRow icon={<GraduationCap className="h-4 w-4" />} label={SENIORITY_LABELS[candidate.desired_seniority] || candidate.desired_seniority} />
                )}
                <InfoRow icon={<Calendar className="h-4 w-4" />} label={`Candidatou-se em ${format(new Date(candidate.applied_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`} />
              </div>
            </section>

            {/* Resume */}
            {candidate.resume_url && (
              <>
                <Separator />
                <section>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />Currículo
                  </h4>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        // Support both new (storage path) and legacy (full public URL) values.
                        let path = candidate.resume_url as string;
                        const marker = "/hr-resumes/";
                        if (path.includes(marker)) {
                          path = path.substring(path.indexOf(marker) + marker.length);
                        }
                        const { data, error } = await supabase.storage
                          .from("hr-resumes")
                          .createSignedUrl(path, 60 * 10);
                        if (error || !data?.signedUrl) {
                          toast.error("Não foi possível abrir o currículo");
                          return;
                        }
                        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                      } catch {
                        toast.error("Não foi possível abrir o currículo");
                      }
                    }}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />Abrir currículo
                  </button>
                </section>
              </>
            )}

            {/* Cover Letter */}
            {candidate.cover_letter && (
              <>
                <Separator />
                <section>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Carta de Apresentação</h4>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{candidate.cover_letter}</p>
                </section>
              </>
            )}

            {/* Diversity */}
            {(candidate.candidate_gender || candidate.candidate_race || candidate.candidate_pcd) && (
              <>
                <Separator />
                <section>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5" />Diversidade & Inclusão
                  </h4>
                  <div className="space-y-2.5">
                    {candidate.candidate_gender && (
                      <InfoRow icon={<User className="h-4 w-4" />} label={GENDER_LABELS[candidate.candidate_gender] || candidate.candidate_gender} />
                    )}
                    {candidate.candidate_race && (
                      <InfoRow icon={<User className="h-4 w-4" />} label={RACE_LABELS[candidate.candidate_race] || candidate.candidate_race} />
                    )}
                    {candidate.candidate_pcd && (
                      <InfoRow icon={<User className="h-4 w-4" />} label={`PCD: ${candidate.candidate_pcd_type || "Sim"}`} />
                    )}
                  </div>
                </section>
              </>
            )}
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="space-y-4 mt-0">
            <AiMatchPanel candidate={candidate} />
          </TabsContent>



          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-4 mt-0">
            {candidate.notes && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm whitespace-pre-wrap">{candidate.notes}</p>
              </div>
            )}
            <div className="space-y-2">
              <Textarea placeholder="Adicionar uma nota sobre o candidato..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
              <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes || !notes.trim()}>
                {savingNotes ? "Salvando..." : "Adicionar Nota"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ icon, label, href }: { icon: React.ReactNode; label: string; href?: string }) {
  const content = (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground flex-shrink-0">{icon}</span>
      <span className={href ? "text-primary hover:underline" : ""}>{label}</span>
    </div>
  );
  return href ? <a href={href} className="block">{content}</a> : content;
}
