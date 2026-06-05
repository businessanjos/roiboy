import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload, FileCheck2, Check, X, Loader2, Mail, Phone,
  Calendar, Stethoscope, FileSignature, GraduationCap, Trash2, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  HRAdmission, useHRAdmissionDocuments, useUpdateAdmission, useUpdateAdmissionDoc,
  ADMISSION_STAGES, ADMISSION_STAGE_LABELS,
} from "@/hooks/useHRAdmissions";

interface Props {
  admission: HRAdmission | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const DOC_STATUS_LABEL = {
  pending: "Pendente",
  received: "Recebido",
  approved: "Aprovado",
  rejected: "Rejeitado",
} as const;

const DOC_STATUS_COLOR = {
  pending: "bg-muted text-muted-foreground",
  received: "bg-blue-500/10 text-blue-700",
  approved: "bg-emerald-500/10 text-emerald-700",
  rejected: "bg-rose-500/10 text-rose-700",
} as const;

export default function AdmissionDrawer({ admission, open, onOpenChange }: Props) {
  const { currentUser } = useCurrentUser();
  const { data: docs, isLoading } = useHRAdmissionDocuments(admission?.id);
  const updateAdmission = useUpdateAdmission();
  const updateDoc = useUpdateAdmissionDoc();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  if (!admission) return null;

  const initials = admission.candidate_name.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  const requiredDocs = (docs || []).filter((d) => d.required);
  const approvedCount = requiredDocs.filter((d) => d.status === "approved").length;
  const docsProgress = requiredDocs.length > 0 ? Math.round((approvedCount / requiredDocs.length) * 100) : 0;

  const handleUpload = async (docId: string, file: File) => {
    if (!currentUser?.account_id) return;
    setUploadingId(docId);
    try {
      const ext = file.name.split(".").pop();
      const path = `${currentUser.account_id}/${admission.id}/${docId}.${ext}`;
      const { error: upErr } = await supabase.storage.from("admission-docs").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("admission-docs").createSignedUrl(path, 60 * 60 * 24 * 365);
      await updateDoc.mutateAsync({
        id: docId,
        admission_id: admission.id,
        status: "received",
        file_url: signed?.signedUrl || path,
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
      });
      toast.success("Arquivo enviado");
    } catch (e: any) {
      toast.error("Erro ao enviar: " + e.message);
    } finally {
      setUploadingId(null);
    }
  };

  const setDocStatus = (docId: string, status: "approved" | "rejected" | "pending") =>
    updateDoc.mutate({ id: docId, admission_id: admission.id, status });

  const handleRemoveFile = async (docId: string) => {
    if (!currentUser?.account_id) return;
    if (!confirm("Remover o arquivo enviado deste documento?")) return;
    try {
      const { data: list } = await supabase.storage
        .from("admission-docs")
        .list(`${currentUser.account_id}/${admission.id}`);
      const matches = (list || []).filter((f) => f.name.startsWith(`${docId}.`));
      if (matches.length > 0) {
        await supabase.storage.from("admission-docs").remove(
          matches.map((f) => `${currentUser.account_id}/${admission.id}/${f.name}`)
        );
      }
      await updateDoc.mutateAsync({
        id: docId,
        admission_id: admission.id,
        status: "pending",
        file_url: null,
        file_name: null,
        uploaded_at: null,
      });
      toast.success("Arquivo removido");
    } catch (e: any) {
      toast.error("Erro ao remover: " + e.message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-primary/20">
              <AvatarImage src={admission.candidate_photo_url || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl">{admission.candidate_name}</SheetTitle>
              <p className="text-sm text-muted-foreground">{admission.position_title}{admission.department ? ` · ${admission.department}` : ""}</p>
              <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                {admission.candidate_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{admission.candidate_email}</span>}
                {admission.candidate_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{admission.candidate_phone}</span>}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Stage + start date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Etapa</Label>
              <Select value={admission.stage} onValueChange={(v) => updateAdmission.mutate({ id: admission.id, stage: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADMISSION_STAGES.map((s) => <SelectItem key={s} value={s}>{ADMISSION_STAGE_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data de início</Label>
              <Input
                type="date"
                defaultValue={admission.start_date || ""}
                onBlur={(e) => e.target.value !== (admission.start_date || "") && updateAdmission.mutate({ id: admission.id, start_date: e.target.value || null })}
              />
            </div>
          </div>

          {/* Exam admissional */}
          <div className="rounded-lg border bg-rose-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm"><Stethoscope className="h-4 w-4 text-rose-600" />Exame Admissional</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Clínica</Label>
                <Input
                  defaultValue={admission.exam_clinic || ""}
                  placeholder="Nome da clínica"
                  onBlur={(e) => e.target.value !== (admission.exam_clinic || "") && updateAdmission.mutate({ id: admission.id, exam_clinic: e.target.value || null })}
                />
              </div>
              <div>
                <Label className="text-xs">Data agendada</Label>
                <Input
                  type="datetime-local"
                  defaultValue={admission.exam_scheduled_at ? admission.exam_scheduled_at.slice(0, 16) : ""}
                  onBlur={(e) => updateAdmission.mutate({ id: admission.id, exam_scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
              <div>
                <Label className="text-xs">Resultado</Label>
                <Select
                  value={admission.exam_result || "none"}
                  onValueChange={(v) => updateAdmission.mutate({ id: admission.id, exam_result: v === "none" ? null : v, exam_done_at: v === "none" ? null : new Date().toISOString() })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pendente</SelectItem>
                    <SelectItem value="apto">Apto</SelectItem>
                    <SelectItem value="apto_restricoes">Apto com restrições</SelectItem>
                    <SelectItem value="inapto">Inapto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Contract & onboarding */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border bg-blue-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm"><FileSignature className="h-4 w-4 text-blue-600" />Contrato</div>
              <Input
                type="datetime-local"
                defaultValue={admission.contract_signed_at ? admission.contract_signed_at.slice(0, 16) : ""}
                onBlur={(e) => updateAdmission.mutate({ id: admission.id, contract_signed_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
              <p className="text-xs text-muted-foreground">Data de assinatura</p>
            </div>
            <div className="rounded-lg border bg-violet-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm"><GraduationCap className="h-4 w-4 text-violet-600" />Integração</div>
              <Input
                type="datetime-local"
                defaultValue={admission.onboarding_scheduled_at ? admission.onboarding_scheduled_at.slice(0, 16) : ""}
                onBlur={(e) => updateAdmission.mutate({ id: admission.id, onboarding_scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
              <p className="text-xs text-muted-foreground">Data agendada</p>
            </div>
          </div>

          <Separator />

          {/* Documents checklist */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4" />
                <h3 className="font-semibold">Checklist de Documentos</h3>
              </div>
              <Badge variant="outline" className="text-xs">{approvedCount}/{requiredDocs.length} aprovados · {docsProgress}%</Badge>
            </div>

            {isLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : (docs || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento configurado.</p>
            ) : (
              <div className="space-y-2">
                {(docs || []).map((doc) => (
                  <div key={doc.id} className="border rounded-lg p-3 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{doc.label}</p>
                        {doc.required && <Badge variant="outline" className="text-[10px] h-4 px-1">obrigatório</Badge>}
                      </div>
                      {doc.file_name && (
                        <a href={doc.file_url || "#"} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1">
                          <ExternalLink className="h-3 w-3" />{doc.file_name}
                        </a>
                      )}
                    </div>
                    <Badge className={`text-xs ${DOC_STATUS_COLOR[doc.status]}`} variant="secondary">{DOC_STATUS_LABEL[doc.status]}</Badge>

                    <input
                      ref={(el) => (fileInputs.current[doc.id] = el)}
                      type="file"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(doc.id, e.target.files[0])}
                    />
                    <Button size="sm" variant="outline" disabled={uploadingId === doc.id} onClick={() => fileInputs.current[doc.id]?.click()} title={doc.file_name ? "Substituir arquivo" : "Enviar arquivo"}>
                      {uploadingId === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    </Button>
                    {doc.file_name && (
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveFile(doc.id)} title="Excluir arquivo">
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    )}
                    {doc.status !== "approved" ? (
                      <Button size="sm" variant="ghost" onClick={() => setDocStatus(doc.id, "approved")} title="Aprovar"><Check className="h-4 w-4 text-emerald-600" /></Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setDocStatus(doc.id, "pending")} title="Reabrir"><X className="h-4 w-4 text-muted-foreground" /></Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Notes */}
          <div>
            <Label className="text-xs">Anotações internas</Label>
            <Textarea
              defaultValue={admission.notes || ""}
              rows={3}
              placeholder="Detalhes sobre a admissão..."
              onBlur={(e) => e.target.value !== (admission.notes || "") && updateAdmission.mutate({ id: admission.id, notes: e.target.value || null })}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Criada em {format(new Date(admission.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
