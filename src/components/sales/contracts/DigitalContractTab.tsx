import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2,
  Save,
  FileDown,
  Send,
  Link as LinkIcon,
  RefreshCw,
  Eye,
  Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { ContractDocument, type DigitalContractData } from "./ContractDocument";
import { ContractEditor } from "./ContractEditor";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface DigitalContractTabProps {
  dealId: string;
  dealValue?: number | null;
  clientId?: string | null;
  clientName?: string;
}

interface DigitalContractRow {
  id: string;
  account_id: string;
  deal_id: string | null;
  client_id: string | null;
  contract_number: string | null;
  status: string;
  data: DigitalContractData;
  pdf_url: string | null;
  share_token: string | null;
  zapsign_doc_token: string | null;
  zapsign_signed_at: string | null;
}

const newToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

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
  const [contract, setContract] = useState<DigitalContractRow | null>(null);
  const [data, setData] = useState<DigitalContractData>({ client_name: clientName ?? "" });
  const docRef = useRef<HTMLDivElement>(null);

  const accountId = currentUser?.account_id;

  // Load existing contract or seed defaults from deal + account defaults
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
          setContract(existing as unknown as DigitalContractRow);
          setData((existing as any).data ?? { client_name: clientName ?? "" });
        } else {
          // Seed with deal values + company defaults
          const { data: defaults } = await supabase
            .from("contract_company_defaults")
            .select("*")
            .eq("account_id", accountId)
            .maybeSingle();

          let clientInfo: any = null;
          if (clientId) {
            const { data: client } = await supabase
              .from("clients")
              .select("name, cpf_cnpj, address, emails")
              .eq("id", clientId)
              .maybeSingle();
            clientInfo = client;
          }

          const installments = 1;
          const total = Number(dealValue ?? 0);
          const seed: DigitalContractData = {
            client_name: clientInfo?.name ?? clientName ?? "",
            client_cpf_cnpj: clientInfo?.cpf_cnpj ?? null,
            client_address: clientInfo?.address ?? null,
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
            company_bank_info: defaults?.company_bank_info ?? null,
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

  const handleSave = async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      if (contract) {
        const { error } = await supabase
          .from("digital_contracts")
          .update({ data: data as any })
          .eq("id", contract.id);
        if (error) throw error;
        toast.success("Contrato atualizado");
      } else {
        // Generate sequential number
        const { data: numData, error: numErr } = await supabase.rpc(
          "next_digital_contract_number",
          { _account_id: accountId },
        );
        if (numErr) throw numErr;
        const contract_number = numData as unknown as string;
        const share_token = newToken();
        const insertPayload = {
          account_id: accountId,
          deal_id: dealId,
          client_id: clientId ?? null,
          contract_number,
          status: "draft",
          data: { ...data, contract_number } as any,
          share_token,
          created_by: currentUser?.auth_user_id ?? null,
        };
        const { data: created, error } = await supabase
          .from("digital_contracts")
          .insert(insertPayload)
          .select()
          .single();
        if (error) throw error;
        setContract(created as unknown as DigitalContractRow);
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
    if (!docRef.current || !contract) {
      toast.error("Salve o contrato antes de gerar o PDF.");
      return;
    }
    setGeneratingPdf(true);
    try {
      const canvas = await html2canvas(docRef.current, {
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
        .update({ pdf_url: filePath })
        .eq("id", contract.id);

      setContract({ ...contract, pdf_url: filePath });
      if (signed?.signedUrl) {
        window.open(signed.signedUrl, "_blank");
      }
      toast.success("PDF gerado");
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
      const { data: res, error } = await supabase.functions.invoke("zapsign-send", {
        body: { contract_id: contract.id },
      });
      if (error) throw error;
      toast.success("Enviado para assinatura via ZapSign");
      // refresh
      const { data: updated } = await supabase
        .from("digital_contracts")
        .select("*")
        .eq("id", contract.id)
        .maybeSingle();
      if (updated) setContract(updated as unknown as DigitalContractRow);
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
      if (updated) setContract(updated as unknown as DigitalContractRow);
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
            {contract?.zapsign_signed_at && " • Assinado"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span className="ml-1.5">Salvar</span>
        </Button>
        <Button size="sm" variant="outline" onClick={handleGeneratePdf} disabled={!contract || generatingPdf}>
          {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
          <span className="ml-1.5">PDF</span>
        </Button>
        <Button size="sm" variant="outline" onClick={handleCopyPublicLink} disabled={!contract?.share_token}>
          <LinkIcon className="h-3.5 w-3.5" />
          <span className="ml-1.5">Link público</span>
        </Button>
        <Button size="sm" onClick={handleSendZapsign} disabled={!contract || sendingZapsign}>
          {sendingZapsign ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          <span className="ml-1.5">Enviar p/ assinatura</span>
        </Button>
        {contract?.zapsign_doc_token && (
          <Button size="sm" variant="ghost" onClick={handleCheckStatus}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </Card>

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
          <ContractEditor data={data} onChange={setData} disabled={saving} />
        </TabsContent>
        <TabsContent value="preview" className="mt-3">
          <ScrollArea className="h-[60vh] rounded-md border bg-muted/30">
            <div className="p-4">
              <ContractDocument ref={docRef} data={data} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
