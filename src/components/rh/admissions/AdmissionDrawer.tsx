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
  Copy, Link as LinkIcon, Sparkles, MessageSquareWarning, Eye, EyeOff, FileText, Landmark, AlertTriangle,
} from "lucide-react";
import ExamReferralDialog from "./ExamReferralDialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { getPublicOrigin } from "@/lib/publicLink";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  HRAdmission, useHRAdmissionDocuments, useUpdateAdmission, useUpdateAdmissionDoc,
  useDeleteAdmission, ADMISSION_STAGES, ADMISSION_STAGE_LABELS,
} from "@/hooks/useHRAdmissions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const deleteAdmission = useDeleteAdmission();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [referralOpen, setReferralOpen] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  if (!admission) return null;

  const initials = admission.candidate_name.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  const requiredDocs = (docs || []).filter((d) => d.required);
  const approvedCount = requiredDocs.filter((d) => d.status === "approved").length;
  const docsProgress = requiredDocs.length > 0 ? Math.round((approvedCount / requiredDocs.length) * 100) : 0;
  const awaitingReview = (docs || []).filter((d) => d.status === "received" && d.uploaded_via === "candidate").length;

  const handleUpload = async (docId: string, file: File) => {
    if (!currentUser?.account_id) return;
    setUploadingId(docId);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const path = `${currentUser.account_id}/${admission.id}/${docId}/${unique}.${ext}`;
      const { error: upErr } = await supabase.storage.from("admission-docs").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("admission-docs").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl || path;

      // Lê anexos atuais para fazer append
      const { data: current } = await supabase
        .from("hr_admission_documents" as any)
        .select("attachments")
        .eq("id", docId)
        .maybeSingle();
      const currentAttachments = ((current as any)?.attachments || []) as any[];
      const newAttachment = {
        name: file.name,
        url,
        path,
        uploaded_at: new Date().toISOString(),
        uploaded_via: "rh" as const,
      };

      await updateDoc.mutateAsync({
        id: docId,
        admission_id: admission.id,
        status: "received",
        file_url: url,
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
        uploaded_via: "rh",
        notes: null,
        attachments: [...currentAttachments, newAttachment] as any,
      });
      toast.success("Arquivo enviado");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro";
      toast.error("Erro ao enviar: " + msg);
    } finally {
      setUploadingId(null);
    }
  };

  const setDocStatus = (docId: string, status: "approved" | "rejected" | "pending") =>
    updateDoc.mutate({ id: docId, admission_id: admission.id, status });

  const handleRemoveAttachment = async (docId: string, path: string | null) => {
    if (!confirm("Remover este arquivo?")) return;
    try {
      // Apaga do storage se houver path conhecido
      if (path) {
        await supabase.storage.from("admission-docs").remove([path]).catch(() => {});
      }
      // Lê anexos atuais e remove o que bate
      const { data: current } = await supabase
        .from("hr_admission_documents" as any)
        .select("attachments, status")
        .eq("id", docId)
        .maybeSingle();
      const list = (((current as any)?.attachments || []) as any[]).filter(
        (a) => (a?.path || "") !== (path || "")
      );
      const last = list.length > 0 ? list[list.length - 1] : null;
      const currentStatus = (current as any)?.status as string | undefined;
      const nextStatus =
        list.length === 0 ? "pending" : currentStatus === "approved" ? "received" : currentStatus;

      await updateDoc.mutateAsync({
        id: docId,
        admission_id: admission.id,
        status: nextStatus as any,
        file_url: last?.url || null,
        file_name: last?.name || null,
        uploaded_at: last ? new Date().toISOString() : null,
        attachments: list as any,
      });
      toast.success("Arquivo removido");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro";
      toast.error("Erro ao remover: " + msg);
    }
  };



  const handleReject = async (docId: string) => {
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error("Informe o motivo da rejeição para o candidato.");
      return;
    }
    await updateDoc.mutateAsync({
      id: docId,
      admission_id: admission.id,
      status: "rejected",
      notes: reason,
    });
    setRejectingId(null);
    setRejectReason("");
    toast.success("Documento rejeitado. O candidato verá o motivo no portal.");
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
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 font-semibold text-sm"><Stethoscope className="h-4 w-4 text-rose-600" />Exame Admissional</div>
              <Button size="sm" variant="outline" onClick={() => setReferralOpen(true)} className="h-7">
                <FileText className="h-3.5 w-3.5 mr-1" /> Guia de Encaminhamento
              </Button>
            </div>
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

          {/* eSocial / Contabilidade */}
          {(() => {
            const startDate = admission.start_date ? new Date(admission.start_date + "T00:00:00") : null;
            const daysToStart = startDate ? Math.ceil((startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
            const confirmed = !!admission.esocial_confirmed_at;
            const sent = !!admission.esocial_sent_to_accountant_at;
            const overdue = !confirmed && daysToStart !== null && daysToStart <= 2;
            return (
              <div className={`rounded-lg border p-4 space-y-3 ${overdue ? "border-rose-500/40 bg-rose-500/5" : "bg-teal-500/5"}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Landmark className="h-4 w-4 text-teal-600" />
                    eSocial / Envio para Contabilidade
                    {confirmed && <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]" variant="outline">Confirmado</Badge>}
                    {!confirmed && sent && <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px]" variant="outline">Aguardando protocolo</Badge>}
                    {overdue && (
                      <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30 text-[10px]" variant="outline">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {daysToStart! < 0 ? "Atrasado" : `Faltam ${daysToStart}d`}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={async () => {
                      const email = admission.esocial_accountant_email?.trim();
                      if (!email) {
                        toast.error("Cadastre o e-mail do contador primeiro.");
                        return;
                      }
                      const subject = encodeURIComponent(`Admissão CLT - ${admission.candidate_name}`);
                      const bodyLines = [
                        `Olá,`,
                        ``,
                        `Segue dados para envio do evento S-2200 (Admissão) no eSocial:`,
                        ``,
                        `Nome: ${admission.candidate_name}`,
                        `Cargo: ${admission.position_title || "—"}`,
                        `Departamento: ${admission.department || "—"}`,
                        `Tipo: ${admission.contract_type?.toUpperCase()}`,
                        `Data de início: ${admission.start_date || "—"}`,
                        admission.candidate_email ? `E-mail: ${admission.candidate_email}` : "",
                        admission.candidate_phone ? `Telefone: ${admission.candidate_phone}` : "",
                        ``,
                        `Documentos e contrato estão disponíveis nesta plataforma. Posso enviar em anexo se preferir.`,
                        ``,
                        `Por favor, retorne com o número do protocolo S-2200 assim que enviado.`,
                        ``,
                        `Obrigado!`,
                      ].filter(Boolean).join("%0D%0A");
                      window.open(`mailto:${email}?subject=${subject}&body=${bodyLines}`, "_blank");
                      if (!sent) {
                        await updateAdmission.mutateAsync({ id: admission.id, esocial_sent_to_accountant_at: new Date().toISOString() });
                        toast.success("E-mail aberto e data de envio registrada.");
                      }
                    }}
                  >
                    <Mail className="h-3.5 w-3.5 mr-1" /> Enviar para contador
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  O contador precisa enviar o evento <strong>S-2200</strong> no eSocial até <strong>1 dia antes</strong> do início das atividades.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">E-mail do contador</Label>
                    <Input
                      type="email"
                      defaultValue={admission.esocial_accountant_email || ""}
                      placeholder="contador@escritorio.com.br"
                      onBlur={(e) => e.target.value !== (admission.esocial_accountant_email || "") && updateAdmission.mutate({ id: admission.id, esocial_accountant_email: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Enviado em</Label>
                    <Input
                      type="datetime-local"
                      defaultValue={admission.esocial_sent_to_accountant_at ? admission.esocial_sent_to_accountant_at.slice(0, 16) : ""}
                      onBlur={(e) => updateAdmission.mutate({ id: admission.id, esocial_sent_to_accountant_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Confirmado em</Label>
                    <Input
                      type="datetime-local"
                      defaultValue={admission.esocial_confirmed_at ? admission.esocial_confirmed_at.slice(0, 16) : ""}
                      onBlur={(e) => updateAdmission.mutate({ id: admission.id, esocial_confirmed_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Protocolo S-2200</Label>
                    <Input
                      defaultValue={admission.esocial_event_protocol || ""}
                      placeholder="Ex.: 1.2.0-2026.06.09.12.34.56-000000001"
                      onBlur={(e) => e.target.value !== (admission.esocial_event_protocol || "") && updateAdmission.mutate({ id: admission.id, esocial_event_protocol: e.target.value || null })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Observações</Label>
                    <Textarea
                      rows={2}
                      defaultValue={admission.esocial_notes || ""}
                      placeholder="Notas, pendências, dependentes, etc."
                      onBlur={(e) => e.target.value !== (admission.esocial_notes || "") && updateAdmission.mutate({ id: admission.id, esocial_notes: e.target.value || null })}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          <Separator />


          {/* Public candidate link */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <LinkIcon className="h-4 w-4 text-amber-600" />
              Link para o candidato enviar os documentos
            </div>
            <p className="text-xs text-muted-foreground">
              Compartilhe este link com {admission.candidate_name.split(" ")[0]} (WhatsApp/e-mail). Ele/ela poderá enviar os documentos diretamente, sem precisar de login.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={admission.public_token ? `${getPublicOrigin()}/admissao/${admission.public_token}` : "Gerando…"}
                className="font-mono text-xs bg-background"
                onFocus={(e) => e.target.select()}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!admission.public_token}
                onClick={async () => {
                  if (!admission.public_token) return;
                  await navigator.clipboard.writeText(`${getPublicOrigin()}/admissao/${admission.public_token}`);
                  toast.success("Link copiado!");
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
              </Button>
            </div>
          </div>

          {/* Documents checklist */}
          <div>
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4" />
                <h3 className="font-semibold">Checklist de Documentos</h3>
              </div>
              <div className="flex items-center gap-2">
                {awaitingReview > 0 && (
                  <Badge className="text-xs bg-blue-500/15 text-blue-700 border-blue-500/30" variant="outline">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {awaitingReview} novo{awaitingReview > 1 ? "s" : ""} envio{awaitingReview > 1 ? "s" : ""} do candidato
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">{approvedCount}/{requiredDocs.length} aprovados · {docsProgress}%</Badge>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : (docs || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento configurado.</p>
            ) : (
              <div className="space-y-2">
                {(docs || []).map((doc) => {
                  const fromCandidate = doc.uploaded_via === "candidate";
                  const highlight = doc.status === "received" && fromCandidate;
                  const isForm = doc.doc_type === "form";
                  const hasFormData = isForm && doc.form_data && Object.values(doc.form_data).some((v) => (v || "").toString().trim().length > 0);
                  return (
                    <div
                      key={doc.id}
                      className={`border rounded-lg p-3 flex flex-wrap items-center gap-3 transition ${
                        highlight ? "border-blue-500/40 bg-blue-500/5 ring-1 ring-blue-500/20" : ""
                      } ${doc.visible_to_candidate === false ? "opacity-60 bg-muted/30" : ""}`}
                    >
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{doc.label}</p>
                          <button
                            type="button"
                            onClick={() => updateDoc.mutate({ id: doc.id, admission_id: admission.id, required: !doc.required })}
                            title={doc.required ? "Tornar opcional" : "Tornar obrigatório"}
                            className={`text-[10px] h-5 px-1.5 rounded border transition ${
                              doc.required
                                ? "border-rose-500/40 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20"
                                : "border-muted-foreground/30 bg-muted text-muted-foreground hover:bg-muted/70"
                            }`}
                          >
                            {doc.required ? "obrigatório" : "opcional"}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateDoc.mutate({ id: doc.id, admission_id: admission.id, visible_to_candidate: !(doc.visible_to_candidate !== false) } as any)}
                            title={doc.visible_to_candidate === false ? "Mostrar para o candidato no portal" : "Ocultar do candidato (uso interno do RH)"}
                            className={`text-[10px] h-5 px-1.5 rounded border transition inline-flex items-center gap-1 ${
                              doc.visible_to_candidate === false
                                ? "border-muted-foreground/30 bg-muted text-muted-foreground hover:bg-muted/70"
                                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                            }`}
                          >
                            {doc.visible_to_candidate === false ? (
                              <><EyeOff className="h-3 w-3" /> oculto do candidato</>
                            ) : (
                              <><Eye className="h-3 w-3" /> visível ao candidato</>
                            )}
                          </button>
                          {isForm && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 border-indigo-500/40 text-indigo-700 bg-indigo-500/10">
                              formulário
                            </Badge>
                          )}
                          {fromCandidate && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 border-blue-500/40 text-blue-700">
                              enviado pelo candidato
                            </Badge>
                          )}
                        </div>
                        {isForm && hasFormData && (
                          <ul className="mt-2 space-y-1 text-xs bg-muted/40 rounded p-2 border">
                            {(doc.form_schema || []).map((f) => {
                              const v = (doc.form_data || {})[f.key];
                              if (!v) return null;
                              return (
                                <li key={f.key} className="flex gap-2">
                                  <span className="text-muted-foreground font-medium w-32 shrink-0">{f.label}:</span>
                                  <span className="break-all">{v}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {isForm && !hasFormData && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            Aguardando o candidato preencher pelo portal.
                          </p>
                        )}
                        {!isForm && doc.attachments && doc.attachments.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {doc.attachments.map((att, idx) => (
                              <li key={`${doc.id}-${idx}`} className="flex items-center gap-2 text-xs">
                                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                                <a
                                  href={att.url || "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline truncate flex-1"
                                >
                                  {att.name || "arquivo"}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAttachment(doc.id, att.path)}
                                  title="Remover este arquivo"
                                  className="text-rose-500 hover:text-rose-700 shrink-0"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {doc.status === "rejected" && doc.notes && (
                          <p className="text-xs text-rose-600 mt-1">Motivo enviado: {doc.notes}</p>
                        )}
                      </div>
                      <Badge className={`text-xs ${DOC_STATUS_COLOR[doc.status]}`} variant="secondary">{DOC_STATUS_LABEL[doc.status]}</Badge>

                      {!isForm && (
                        <>
                          <input
                            ref={(el) => (fileInputs.current[doc.id] = el)}
                            type="file"
                            className="hidden"
                            onChange={(e) => { if (e.target.files?.[0]) { handleUpload(doc.id, e.target.files[0]); e.target.value = ""; } }}
                          />
                          <Button size="sm" variant="outline" disabled={uploadingId === doc.id} onClick={() => fileInputs.current[doc.id]?.click()} title={doc.attachments?.length ? "Adicionar outro arquivo" : "Enviar arquivo"}>
                            {uploadingId === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          </Button>
                        </>
                      )}
                      {doc.status !== "approved" ? (
                        <Button size="sm" variant="ghost" onClick={() => setDocStatus(doc.id, "approved")} title="Aprovar"><Check className="h-4 w-4 text-emerald-600" /></Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setDocStatus(doc.id, "pending")} title="Reabrir"><X className="h-4 w-4 text-muted-foreground" /></Button>
                      )}
                      {((doc.file_name || hasFormData) && doc.status !== "approved") && (
                        <Dialog
                          open={rejectingId === doc.id}
                          onOpenChange={(o) => { if (!o) { setRejectingId(null); setRejectReason(""); } }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Rejeitar com motivo"
                              onClick={() => { setRejectingId(doc.id); setRejectReason(doc.notes || ""); }}
                            >
                              <MessageSquareWarning className="h-4 w-4 text-amber-600" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Rejeitar "{doc.label}"</DialogTitle>
                              <DialogDescription>
                                O motivo abaixo será mostrado ao candidato no portal para que ele reenvie corretamente.
                              </DialogDescription>
                            </DialogHeader>
                            <Textarea
                              autoFocus
                              rows={3}
                              placeholder="Ex.: A foto está desfocada, não dá pra ler o número. Pode reenviar uma foto mais nítida?"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <DialogFooter>
                              <Button variant="outline" onClick={() => { setRejectingId(null); setRejectReason(""); }}>Cancelar</Button>
                              <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => handleReject(doc.id)}>
                                Rejeitar e notificar
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  );
                })}
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

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Criada em {format(new Date(admission.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Excluir admissão
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir admissão de {admission.candidate_name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação remove permanentemente o card e todos os documentos vinculados a esta admissão. Não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-rose-600 hover:bg-rose-700"
                    onClick={async () => {
                      await deleteAdmission.mutateAsync(admission.id);
                      onOpenChange(false);
                    }}
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SheetContent>
      <ExamReferralDialog admission={admission} open={referralOpen} onOpenChange={setReferralOpen} />
    </Sheet>
  );
}
