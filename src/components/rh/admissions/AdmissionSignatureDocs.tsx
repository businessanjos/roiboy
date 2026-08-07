import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileSignature, CheckCircle2, Clock, Eye, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useHRDocumentTemplates, useApplyTemplatesToAdmission } from "@/hooks/useHRDocumentTemplates";
import { sanitizeDocumentHtml } from "@/lib/hr/admissionDocVars";
import type { HRAdmissionDocument } from "@/hooks/useHRAdmissions";

interface Props {
  admissionId: string;
  docs: HRAdmissionDocument[];
}

export default function AdmissionSignatureDocs({ admissionId, docs }: Props) {
  const qc = useQueryClient();
  const { data: templates } = useHRDocumentTemplates();
  const apply = useApplyTemplatesToAdmission();
  const [manage, setManage] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [viewing, setViewing] = useState<HRAdmissionDocument | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const signDocs = useMemo(() => docs.filter((d) => d.doc_type === "signature"), [docs]);
  const signedCount = signDocs.filter((d) => !!d.signed_at).length;
  const existingKeys = new Set(signDocs.map((d) => d.doc_key));
  const available = (templates || []).filter((t) => t.active && !existingKeys.has(t.doc_key));

  const openManage = () => {
    setSelected(available.filter((t) => t.default_selected).map((t) => t.id));
    setManage(true);
  };

  const handleApply = async () => {
    if (selected.length === 0) return setManage(false);
    await apply.mutateAsync({ admissionId, templateIds: selected });
    setManage(false);
  };

  const handleRemove = async (doc: HRAdmissionDocument) => {
    if (doc.signed_at) return;
    if (!confirm(`Remover "${doc.label}" desta admissão?`)) return;
    setRemoving(doc.id);
    try {
      const { error } = await supabase.from("hr_admission_documents" as any).delete().eq("id", doc.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["hr-admission-docs", admissionId] });
      toast.success("Documento removido");
    } catch (e: any) {
      toast.error("Erro ao remover: " + e.message);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileSignature className="h-4 w-4" />
          <h3 className="font-semibold">Documentos para assinar</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{signedCount}/{signDocs.length} assinados</Badge>
          <Button size="sm" variant="outline" onClick={openManage} disabled={available.length === 0}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
          </Button>
        </div>
      </div>

      {signDocs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
          Nenhum documento de assinatura nesta admissão.
          {available.length > 0 && <> Clique em <strong>Adicionar</strong> para incluir os modelos da biblioteca.</>}
        </p>
      ) : (
        <div className="space-y-2">
          {signDocs.map((doc) => (
            <div key={doc.id} className="border rounded-lg p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-medium">{doc.label}</p>
                {doc.signed_at ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Assinado por {doc.signer_name} em {new Date(doc.signed_at).toLocaleString("pt-BR")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">Aguardando assinatura do colaborador</p>
                )}
              </div>
              {doc.signed_at ? (
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Assinado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30">
                  <Clock className="h-3 w-3 mr-1" /> Pendente
                </Badge>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewing(doc)} title="Ver documento">
                <Eye className="h-4 w-4" />
              </Button>
              {!doc.signed_at && (
                <Button
                  size="icon" variant="ghost"
                  className="h-8 w-8 text-destructive"
                  disabled={removing === doc.id}
                  onClick={() => handleRemove(doc)}
                  title="Remover desta admissão"
                >
                  {removing === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Registro de aceites */}
      {signDocs.length > 0 && (
        <div className="mt-4 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Registro de aceites
            </p>
            <Badge variant="outline" className="text-[11px]">
              {signedCount} de {signDocs.length} concluídos
            </Badge>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-3">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${signDocs.length ? (signedCount / signDocs.length) * 100 : 0}%` }}
            />
          </div>
          {signedCount === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum documento assinado até o momento.</p>
          ) : (
            <ul className="space-y-2">
              {signDocs
                .filter((d) => !!d.signed_at)
                .sort((a, b) => (a.signed_at! < b.signed_at! ? 1 : -1))
                .map((d) => (
                  <li key={d.id} className="text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="font-medium">{d.label}</span>
                    <span className="text-muted-foreground">
                      · {d.signer_name || "—"}
                      {d.signer_cpf ? ` · CPF ${d.signer_cpf}` : ""} ·{" "}
                      {new Date(d.signed_at!).toLocaleString("pt-BR")}
                      {d.signer_ip ? ` · IP ${d.signer_ip}` : ""}
                    </span>
                  </li>
                ))}
            </ul>
          )}
          {signedCount < signDocs.length && (
            <p className="text-xs text-muted-foreground mt-2">
              Pendentes: {signDocs.filter((d) => !d.signed_at).map((d) => d.label).join(", ")}
            </p>
          )}
        </div>
      )}


      {/* Selecionar modelos */}
      <Dialog open={manage} onOpenChange={setManage}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar documentos para assinar</DialogTitle>
            <DialogDescription>Escolha os modelos que este colaborador precisa assinar no portal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {available.map((t) => (
              <label key={t.id} className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/40">
                <Checkbox
                  checked={selected.includes(t.id)}
                  onCheckedChange={(v) =>
                    setSelected((prev) => (v ? [...prev, t.id] : prev.filter((id) => id !== t.id)))
                  }
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManage(false)}>Cancelar</Button>
            <Button onClick={handleApply} disabled={apply.isPending}>
              {apply.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Adicionar {selected.length > 0 ? `(${selected.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualizar documento */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.label}</DialogTitle>
            {viewing?.signed_at && (
              <DialogDescription>
                Assinado por {viewing.signer_name} · CPF {viewing.signer_cpf || "—"} ·{" "}
                {new Date(viewing.signed_at).toLocaleString("pt-BR")} · IP {viewing.signer_ip || "—"}
              </DialogDescription>
            )}
          </DialogHeader>
          <div
            className="admission-doc rounded-md border border-border bg-background p-5 text-sm"
            dangerouslySetInnerHTML={{
              __html: sanitizeDocumentHtml(viewing?.signed_html || viewing?.body_html || ""),
            }}
          />
          {viewing?.signature_image_url && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-1">Assinatura do colaborador</p>
              <img src={viewing.signature_image_url} alt="Assinatura" className="h-20 object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
