import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, Copy, AlertTriangle, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useHRDocumentTemplates, useApplyTemplatesToAdmission, type HRDocumentTemplate } from "@/hooks/useHRDocumentTemplates";
import {
  SIGNER_FIELDS, renderTemplate, sanitizeDocumentHtml, missingVariables, signerFieldLabel,
  signerDataFromOcr,
} from "@/lib/hr/admissionDocVars";
import { getPublicOrigin } from "@/lib/publicLink";

interface AdmissionOption {
  id: string;
  candidate_name: string;
  position_title: string | null;
  contract_type: string;
  public_token: string | null;
  signer_data: Record<string, string> | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTemplateId?: string;
}

export default function GenerateCandidateDocDialog({ open, onOpenChange, initialTemplateId }: Props) {
  const { currentUser } = useCurrentUser();
  const { data: templates } = useHRDocumentTemplates();
  const apply = useApplyTemplatesToAdmission();

  const [templateId, setTemplateId] = useState<string>(initialTemplateId || "");
  const [admissionId, setAdmissionId] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const { data: admissions, isLoading } = useQuery({
    queryKey: ["hr-admissions-doc-picker", currentUser?.account_id],
    enabled: open && !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_admissions" as any)
        .select("id, candidate_name, position_title, contract_type, public_token, signer_data")
        .eq("account_id", currentUser!.account_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AdmissionOption[];
    },
  });

  useEffect(() => {
    if (open) {
      setTemplateId(initialTemplateId || "");
      setAdmissionId("");
      setOverrides({});
    }
  }, [open, initialTemplateId]);

  const template = useMemo<HRDocumentTemplate | undefined>(
    () => (templates || []).find((t) => t.id === templateId),
    [templates, templateId],
  );
  const admission = useMemo(
    () => (admissions || []).find((a) => a.id === admissionId),
    [admissions, admissionId],
  );

  const values = useMemo(() => {
    const base: Record<string, string> = { ...(admission?.signer_data || {}) };
    if (admission && !base.NOME_COMPLETO) base.NOME_COMPLETO = admission.candidate_name;
    return { ...base, ...overrides };
  }, [admission, overrides]);

  const missing = useMemo(
    () => (template ? missingVariables(template.body_html, values) : []),
    [template, values],
  );

  const previewHtml = useMemo(
    () => (template ? sanitizeDocumentHtml(renderTemplate(template.body_html, values)) : ""),
    [template, values],
  );

  const portalLink = admission?.public_token
    ? `${getPublicOrigin()}/admissao/${admission.public_token}`
    : null;

  const send = async () => {
    if (!template) return toast.error("Escolha o documento");
    if (!admission) return toast.error("Escolha o candidato");
    await apply.mutateAsync({ admissionId: admission.id, templateIds: [template.id] });
    if (portalLink) {
      navigator.clipboard?.writeText(portalLink).catch(() => {});
      toast.success("Documento enviado. Link do portal copiado.");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar documento para o candidato</DialogTitle>
          <DialogDescription>
            Escolha o modelo e o candidato: os dados dele preenchem o documento automaticamente. Revise a
            pré-visualização antes de enviar para assinatura no portal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Documento</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger>
              <SelectContent>
                {(templates || []).filter((t) => t.active).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Candidato</Label>
            <Select value={admissionId} onValueChange={setAdmissionId} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione o candidato"} />
              </SelectTrigger>
              <SelectContent>
                {(admissions || []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.candidate_name}{a.position_title ? ` · ${a.position_title}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {admission && (
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserCheck className="h-4 w-4 text-primary" />
              Dados usados no preenchimento
              <Badge variant="outline" className="text-[10px] uppercase">{admission.contract_type}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {SIGNER_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{f.label}</Label>
                  <Input
                    value={values[f.key] || ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setOverrides((p) => ({ ...p, [f.key]: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
            {missing.length > 0 && (
              <p className="text-xs text-amber-600 flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Faltam dados: {missing.map(signerFieldLabel).join(", ")}. O candidato completa no portal antes de assinar.
              </p>
            )}
          </div>
        )}

        {template ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Pré-visualização</p>
            <div
              className="admission-doc rounded-md border border-border bg-background p-5 text-sm max-h-[45vh] overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">
            Selecione um documento para ver a pré-visualização.
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex items-center gap-2">
            {portalLink && (
              <Button
                variant="outline" size="sm"
                onClick={() => { navigator.clipboard?.writeText(portalLink); toast.success("Link copiado"); }}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar link do portal
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={send} disabled={!template || !admission || apply.isPending}>
              {apply.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              Enviar para assinatura
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
