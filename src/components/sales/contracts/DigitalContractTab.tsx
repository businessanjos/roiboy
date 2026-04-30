import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2,
  Save,
  FileDown,
  Send,
  Link as LinkIcon,
  RefreshCw,
  Eye,
  Pencil,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { ContractDocument, type DigitalContractData, type Deliverable } from "./ContractDocument";
import { ContractEditor } from "./ContractEditor";
import { TemplatedContractPreview } from "./TemplatedContractSection";
import { ContractWizard } from "./ContractWizard";
import type { TemplateVariableDef } from "@/lib/contractTemplates";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface DigitalContractTabProps {
  dealId: string;
  dealValue?: number | null;
  clientId?: string | null;
  clientName?: string;
}

interface ContractRow {
  id: string;
  contract_number: string | null;
  status: string;
  share_token: string;
  signed_pdf_path: string | null;
  signed_at: string | null;
  zapsign_document_token: string | null;
}

// Convert flat DB row -> editor data
const rowToData = (row: any): DigitalContractData => ({
  contract_number: row.contract_number,
  client_name: row.client_name ?? "",
  client_cpf_cnpj: row.client_cpf_cnpj,
  client_address: row.client_address,
  client_email: row.client_email,
  client_marital_status: row.client_marital_status,
  client_nationality: row.client_nationality,
  client_representative: row.client_representative,
  client_representative_cpf: row.client_representative_cpf,
  object_description: row.object_description,
  service_mode: row.service_mode ?? "deliverables",
  monthly_hours: row.monthly_hours,
  extra_hour_rate: row.extra_hour_rate,
  total_value: row.total_value,
  down_payment_percentage: row.down_payment_percentage,
  down_payment_value: row.down_payment_value,
  down_payment_date: row.down_payment_date,
  installments: row.installments,
  installment_value: row.installment_value,
  first_due_date: row.first_due_date,
  due_day: row.due_day,
  contract_duration_months: row.contract_duration_months,
  has_renewal: row.has_renewal,
  include_witnesses: row.include_witnesses,
  deliverables: (row.deliverables as Deliverable[]) ?? [],
  late_fee_percentage: row.late_fee_percentage,
  late_interest_percentage: row.late_interest_percentage,
  rescission_penalty_percentage: row.rescission_penalty_percentage,
  jurisdiction: row.jurisdiction,
  payment_method: row.payment_method,
  company_name: row.company_name,
  company_cnpj: row.company_cnpj,
  company_address: row.company_address,
  company_representative: row.company_representative,
  company_representative_cpf: row.company_representative_cpf,
  company_email: row.company_email,
  company_bank_info: row.company_bank_info as any,
});

const dataToRow = (d: DigitalContractData) => ({
  client_name: d.client_name ?? "",
  client_cpf_cnpj: d.client_cpf_cnpj ?? null,
  client_address: d.client_address ?? null,
  client_email: d.client_email ?? null,
  client_marital_status: d.client_marital_status ?? null,
  client_nationality: d.client_nationality ?? null,
  client_representative: d.client_representative ?? null,
  client_representative_cpf: d.client_representative_cpf ?? null,
  object_description: d.object_description ?? null,
  service_mode: d.service_mode ?? "deliverables",
  monthly_hours: d.monthly_hours ?? null,
  extra_hour_rate: d.extra_hour_rate ?? null,
  total_value: d.total_value ?? null,
  down_payment_percentage: d.down_payment_percentage ?? null,
  down_payment_value: d.down_payment_value ?? null,
  down_payment_date: d.down_payment_date ?? null,
  installments: d.installments ?? null,
  installment_value: d.installment_value ?? null,
  first_due_date: d.first_due_date ?? null,
  due_day: d.due_day ?? null,
  contract_duration_months: d.contract_duration_months ?? null,
  has_renewal: d.has_renewal ?? null,
  include_witnesses: d.include_witnesses ?? null,
  deliverables: (d.deliverables ?? []) as any,
  late_fee_percentage: d.late_fee_percentage ?? null,
  late_interest_percentage: d.late_interest_percentage ?? null,
  rescission_penalty_percentage: d.rescission_penalty_percentage ?? null,
  jurisdiction: d.jurisdiction ?? null,
  payment_method: d.payment_method ?? null,
  company_name: d.company_name ?? null,
  company_cnpj: d.company_cnpj ?? null,
  company_address: d.company_address ?? null,
  company_representative: d.company_representative ?? null,
  company_representative_cpf: d.company_representative_cpf ?? null,
  company_email: d.company_email ?? null,
  company_bank_info: (d.company_bank_info ?? null) as any,
});

export const DigitalContractTab = ({
  dealId,
  dealValue,
  clientId,
  clientName,
}: DigitalContractTabProps) => {
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sendingZapsign, setSendingZapsign] = useState(false);
  const [contract, setContract] = useState<ContractRow | null>(null);
  const [data, setData] = useState<DigitalContractData>({ client_name: clientName ?? "" });
  // Template state (separate from `data`)
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [templateHtml, setTemplateHtml] = useState<string | null>(null);
  const [templateVariables, setTemplateVariables] = useState<TemplateVariableDef[]>([]);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, any>>({});
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [dealExtras, setDealExtras] = useState<{ entry_value?: number | null; won_at?: string | null }>({});
  const [productExtras, setProductExtras] = useState<{
    payment_methods?: string[] | null;
    billing_period?: string | null;
    cash_price?: number | null;
    installment_price?: number | null;
  }>({});
  const [clientFull, setClientFull] = useState<any | null>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const pdfPreviewRef = useRef<HTMLDivElement>(null);

  const accountId = currentUser?.account_id;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!accountId) return;
      setLoading(true);
      try {
        const { data: existing, error } = await supabase
          .from("digital_contracts")
          .select("*")
          .eq("deal_id", dealId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;

        if (existing) {
          setContract({
            id: existing.id,
            contract_number: existing.contract_number,
            status: existing.status,
            share_token: existing.share_token,
            signed_pdf_path: existing.signed_pdf_path,
            signed_at: existing.signed_at,
            zapsign_document_token: existing.zapsign_document_token,
          });
          setData(rowToData(existing));
          setTemplateId((existing as any).template_id ?? null);
          setProductId((existing as any).product_id ?? null);
          setTemplateHtml((existing as any).template_html ?? null);
          setTemplateVariables(((existing as any).template_variables as TemplateVariableDef[]) ?? []);
          setPlaceholderValues(((existing as any).placeholder_values as Record<string, any>) ?? {});
        } else {
          const { data: defaults } = await supabase
            .from("contract_company_defaults")
            .select("*")
            .eq("account_id", accountId)
            .maybeSingle();

          let clientInfo: any = null;
          if (clientId) {
            const { data: client } = await supabase
              .from("clients")
              .select("id, full_name, cpf, cnpj, rg, birth_date, phone_e164, emails, street, street_number, complement, neighborhood, city, state, zip_code, company_name")
              .eq("id", clientId)
              .maybeSingle();
            clientInfo = client;
            if (!cancelled) setClientFull(client ?? null);
          }

          const buildAddress = (c: any) => {
            if (!c) return null;
            const parts = [c.street, c.street_number, c.neighborhood, c.city, c.state].filter(Boolean);
            return parts.length ? parts.join(", ") : null;
          };

          const installments = 1;
          const total = Number(dealValue ?? 0);
          const seed: DigitalContractData = {
            client_name: clientInfo?.full_name ?? clientName ?? "",
            client_cpf_cnpj: clientInfo?.cpf ?? clientInfo?.cnpj ?? null,
            client_address: buildAddress(clientInfo),
            client_email: Array.isArray(clientInfo?.emails) ? clientInfo.emails[0] : null,
            object_description: "",
            service_mode: "deliverables",
            total_value: total,
            installments,
            installment_value: total,
            down_payment_percentage: 0,
            due_day: 10,
            contract_duration_months: 12,
            has_renewal: false,
            include_witnesses: true,
            deliverables: [],
            late_fee_percentage: 2,
            late_interest_percentage: 1,
            rescission_penalty_percentage: 10,
            jurisdiction: defaults?.default_jurisdiction ?? null,
            company_name: defaults?.company_name ?? null,
            company_cnpj: defaults?.company_cnpj ?? null,
            company_address: defaults?.company_address ?? null,
            company_representative: defaults?.company_representative ?? null,
            company_representative_cpf: defaults?.company_representative_cpf ?? null,
            company_email: defaults?.company_email ?? null,
            company_bank_info: (defaults?.company_bank_info as any) ?? null,
          };
          setData(seed);
        }
      } catch (e) {
        console.error("[DigitalContractTab] load error:", e);
        toast.error("Erro ao carregar contrato");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [dealId, accountId, clientId, clientName, dealValue]);

  // Fetch deal extras (entry_value, won_at) once for autofill
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: deal } = await supabase
        .from("deals")
        .select("entry_value, won_at")
        .eq("id", dealId)
        .maybeSingle();
      if (cancelled || !deal) return;
      setDealExtras({ entry_value: deal.entry_value, won_at: deal.won_at });
    })();
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  // Auto-fill total value from selected product price when empty + capture extras for autofill
  useEffect(() => {
    if (!productId) {
      setProductExtras({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: product } = await supabase
        .from("products")
        .select("price, payment_methods, billing_period, cash_price, installment_price")
        .eq("id", productId)
        .maybeSingle();
      if (cancelled || !product) return;
      setProductExtras({
        payment_methods: (product.payment_methods as string[] | null) ?? null,
        billing_period: product.billing_period ?? null,
        cash_price: product.cash_price ?? null,
        installment_price: product.installment_price ?? null,
      });
      const price = Number(product.price);
      if (!Number.isFinite(price) || price <= 0) return;
      setData((prev) => {
        const current = Number(prev.total_value ?? 0);
        if (current > 0) return prev;
        const installments = prev.installments && prev.installments > 0 ? prev.installments : 1;
        return {
          ...prev,
          total_value: price,
          installment_value: prev.installment_value ?? price / installments,
        };
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const handleSave = async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      const templatePayload = {
        template_id: templateId,
        product_id: productId,
        template_html: templateHtml,
        template_variables: templateVariables as any,
        placeholder_values: placeholderValues as any,
      };
      if (contract) {
        const { error } = await supabase
          .from("digital_contracts")
          .update({ ...dataToRow(data), ...templatePayload } as any)
          .eq("id", contract.id);
        if (error) throw error;
        toast.success("Contrato atualizado");
      } else {
        const { data: numData, error: numErr } = await supabase.rpc(
          "next_digital_contract_number" as any,
          { p_account_id: accountId } as any,
        );
        if (numErr) throw numErr;
        const contract_number = numData as unknown as string;

        const insertPayload = {
          account_id: accountId,
          deal_id: dealId,
          client_id: clientId ?? null,
          contract_number,
          status: "draft",
          created_by: currentUser?.auth_user_id ?? null,
          ...dataToRow({ ...data, contract_number }),
          ...templatePayload,
        };
        const { data: created, error } = await supabase
          .from("digital_contracts")
          .insert(insertPayload)
          .select()
          .single();
        if (error) throw error;
        setContract({
          id: created.id,
          contract_number: created.contract_number,
          status: created.status,
          share_token: created.share_token,
          signed_pdf_path: created.signed_pdf_path,
          signed_at: created.signed_at,
          zapsign_document_token: created.zapsign_document_token,
        });
        setData({ ...data, contract_number });
        toast.success(`Contrato ${contract_number} criado`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao salvar contrato");
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    const target = pdfPreviewRef.current ?? docRef.current;
    if (!target || !contract) {
      toast.error("Salve o contrato antes de gerar o PDF.");
      return;
    }
    setGeneratingPdf(true);
    try {
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const blob = pdf.output("blob");
      const filePath = `${accountId}/${contract.id}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("digital-contracts")
        .upload(filePath, blob, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;

      const { data: signed } = await supabase.storage
        .from("digital-contracts")
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);

      await supabase
        .from("digital_contracts")
        .update({ signed_pdf_path: filePath })
        .eq("id", contract.id);

      setContract({ ...contract, signed_pdf_path: filePath });
      if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
      toast.success("PDF gerado");
      setPdfPreviewOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao gerar PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSendZapsign = async () => {
    if (!contract) {
      toast.error("Salve o contrato antes de enviar.");
      return;
    }
    if (!data.client_email) {
      toast.error("Defina o e-mail do cliente.");
      return;
    }
    setSendingZapsign(true);
    try {
      const { error } = await supabase.functions.invoke("zapsign-send", {
        body: { contract_id: contract.id },
      });
      if (error) throw error;
      toast.success("Enviado para assinatura via ZapSign");
      const { data: updated } = await supabase
        .from("digital_contracts")
        .select("*")
        .eq("id", contract.id)
        .maybeSingle();
      if (updated) {
        setContract({
          id: updated.id,
          contract_number: updated.contract_number,
          status: updated.status,
          share_token: updated.share_token,
          signed_pdf_path: updated.signed_pdf_path,
          signed_at: updated.signed_at,
          zapsign_document_token: updated.zapsign_document_token,
        });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao enviar para ZapSign");
    } finally {
      setSendingZapsign(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!contract) return;
    try {
      const { error } = await supabase.functions.invoke("zapsign-check-status", {
        body: { contract_id: contract.id },
      });
      if (error) throw error;
      const { data: updated } = await supabase
        .from("digital_contracts")
        .select("*")
        .eq("id", contract.id)
        .maybeSingle();
      if (updated) {
        setContract({
          id: updated.id,
          contract_number: updated.contract_number,
          status: updated.status,
          share_token: updated.share_token,
          signed_pdf_path: updated.signed_pdf_path,
          signed_at: updated.signed_at,
          zapsign_document_token: updated.zapsign_document_token,
        });
      }
      toast.success("Status atualizado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao consultar status");
    }
  };

  const handleCopyPublicLink = () => {
    if (!contract?.share_token) return;
    const url = `${window.location.origin}/contrato/${contract.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">
            {contract?.contract_number ? `Contrato ${contract.contract_number}` : "Novo contrato (não salvo)"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Status: <span className="font-medium">{contract?.status ?? "rascunho"}</span>
            {contract?.signed_at && " • Assinado"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span className="ml-1.5">Salvar</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!contract) {
              toast.error("Salve o contrato antes de gerar o PDF.");
              return;
            }
            setPdfPreviewOpen(true);
          }}
          disabled={!contract || generatingPdf}
        >
          <Eye className="h-3.5 w-3.5" />
          <span className="ml-1.5">Pré-visualizar PDF</span>
        </Button>
        <Button size="sm" variant="outline" onClick={handleCopyPublicLink} disabled={!contract?.share_token}>
          <LinkIcon className="h-3.5 w-3.5" />
          <span className="ml-1.5">Link público</span>
        </Button>
        <Button size="sm" onClick={handleSendZapsign} disabled={!contract || sendingZapsign}>
          {sendingZapsign ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          <span className="ml-1.5">Enviar p/ assinatura</span>
        </Button>
        {contract?.zapsign_document_token && (
          <Button size="sm" variant="ghost" onClick={handleCheckStatus}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </Card>

      <ContractWizard
        templateId={templateId}
        productId={productId}
        templateHtml={templateHtml}
        templateVariables={templateVariables}
        placeholderValues={placeholderValues}
        autofill={{
          client: {
            id: clientFull?.id ?? clientId ?? null,
            full_name: clientFull?.full_name ?? data.client_name ?? null,
            cpf: clientFull?.cpf ?? data.client_cpf_cnpj ?? null,
            cnpj: clientFull?.cnpj ?? null,
            rg: clientFull?.rg ?? null,
            email: (Array.isArray(clientFull?.emails) ? clientFull.emails[0] : null) ?? data.client_email ?? null,
            address: data.client_address ?? null,
            phone: clientFull?.phone_e164 ?? null,
            razao_social: clientFull?.company_name ?? clientFull?.full_name ?? data.client_name ?? null,
            nome_fantasia: clientFull?.company_name ?? null,
            street: clientFull?.street ?? null,
            street_number: clientFull?.street_number ?? null,
            complement: clientFull?.complement ?? null,
            neighborhood: clientFull?.neighborhood ?? null,
            city: clientFull?.city ?? null,
            state: clientFull?.state ?? null,
            zip_code: clientFull?.zip_code ?? null,
            birth_date: clientFull?.birth_date ?? null,
          },
          deal: {
            value: data.total_value ?? dealValue ?? null,
            installments: data.installments ?? null,
            installment_value: data.installment_value ?? null,
            entry_value: data.down_payment_value ?? dealExtras.entry_value ?? null,
            payment_method: data.payment_method ?? null,
            start_date:
              data.first_due_date ??
              (dealExtras.won_at ? dealExtras.won_at.slice(0, 10) : null) ??
              new Date().toISOString().slice(0, 10),
            end_date: null,
          },
          product: {
            payment_method: Array.isArray(productExtras.payment_methods) && productExtras.payment_methods.length > 0
              ? productExtras.payment_methods[0]
              : null,
            installments:
              productExtras.installment_price && productExtras.installment_price > 0 && data.total_value
                ? Math.max(1, Math.round(Number(data.total_value) / Number(productExtras.installment_price)))
                : null,
            billing_period: productExtras.billing_period ?? null,
            duration_months: null,
          },
          user: {
            name: currentUser?.name ?? null,
            email: currentUser?.email ?? null,
          },
          company: {
            name: data.company_name,
            cnpj: data.company_cnpj,
            address: data.company_address,
            representative: data.company_representative,
            email: data.company_email,
          },
          today: new Date().toISOString().slice(0, 10),
        }}
        onChange={(next) => {
          setTemplateId(next.template_id);
          setProductId(next.product_id);
          setTemplateHtml(next.template_html);
          setTemplateVariables(next.template_variables);
          setPlaceholderValues(next.placeholder_values);
        }}
        disabled={saving}
      />

      <Tabs defaultValue="editor" className="w-full">
        <TabsList className="h-8">
          <TabsTrigger value="editor" className="text-xs h-7">
            <Pencil className="h-3 w-3 mr-1.5" /> Editor
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs h-7">
            <Eye className="h-3 w-3 mr-1.5" /> Preview
          </TabsTrigger>
        </TabsList>
        <TabsContent value="editor" className="mt-3">
          <ContractEditor data={data} onChange={setData} disabled={saving} dealId={dealId} />
        </TabsContent>
        <TabsContent value="preview" className="mt-3">
          <ScrollArea className="h-[60vh] rounded-md border bg-muted/30">
            <div ref={docRef} className="p-4">
              {templateHtml ? (
                <TemplatedContractPreview
                  templateHtml={templateHtml}
                  templateVariables={templateVariables}
                  placeholderValues={placeholderValues}
                />
              ) : (
                <ContractDocument data={data} />
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <Dialog open={pdfPreviewOpen} onOpenChange={(o) => !generatingPdf && setPdfPreviewOpen(o)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[92vh] p-0 flex flex-col gap-0">
          <DialogHeader className="px-5 py-3 border-b shrink-0">
            <DialogTitle className="text-base">Pré-visualização do contrato</DialogTitle>
            <DialogDescription className="text-xs">
              Revise o layout exatamente como aparecerá no PDF antes de gerar o arquivo final.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 bg-muted/30">
            <div className="mx-auto my-4 max-w-[210mm] bg-background shadow-md">
              <div ref={pdfPreviewRef} className="p-6">
                {templateHtml ? (
                  <TemplatedContractPreview
                    templateHtml={templateHtml}
                    templateVariables={templateVariables}
                    placeholderValues={placeholderValues}
                  />
                ) : (
                  <ContractDocument data={data} />
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="px-5 py-3 border-t shrink-0 flex-row sm:justify-between gap-2">
            <p className="text-[11px] text-muted-foreground self-center">
              Formato A4 · Renderização final usada na geração do PDF
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPdfPreviewOpen(false)}
                disabled={generatingPdf}
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Fechar
              </Button>
              <Button size="sm" onClick={handleGeneratePdf} disabled={generatingPdf}>
                {generatingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <FileDown className="h-3.5 w-3.5 mr-1.5" />
                )}
                {generatingPdf ? "Gerando..." : "Confirmar e gerar PDF"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
