import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Plus,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { ContractDocument, type DigitalContractData, type Deliverable } from "./ContractDocument";
import { ContractEditor } from "./ContractEditor";
import { TemplatedContractPreview } from "./TemplatedContractSection";
import { ContractWizard } from "./ContractWizard";
import { mergeContractorPlaceholders, type TemplateVariableDef } from "@/lib/contractTemplates";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { buildPublicContractUrl } from "@/lib/publicLink";

type ZapSignerRole = "contratante" | "contratado" | "representante_legal" | "testemunha" | "fiador";
type ZapAuthMode =
  | "assinaturaTela"
  | "tokenEmail"
  | "tokenSms"
  | "assinaturaTela-tokenEmail"
  | "assinaturaTela-tokenSms"
  | "selfie"
  | "documentoSelfie"
  | "videoselfie"
  | "cpf"
  | "certificadoDigital";
interface SignerDraft {
  enabled: boolean;
  role: ZapSignerRole;
  name: string;
  email: string;
  phone: string;
  auth_mode: ZapAuthMode;
}
const ROLE_LABEL: Record<ZapSignerRole, string> = {
  contratante: "Contratante",
  contratado: "Contratado",
  representante_legal: "Representante Legal",
  testemunha: "Testemunha",
  fiador: "Fiador",
};

const AUTH_MODE_LABEL: Record<ZapAuthMode, string> = {
  assinaturaTela: "Assinatura na tela (padrão)",
  tokenEmail: "Token por e-mail",
  tokenSms: "Token por SMS",
  "assinaturaTela-tokenEmail": "Assinatura + token e-mail",
  "assinaturaTela-tokenSms": "Assinatura + token SMS",
  selfie: "Selfie (foto do signatário)",
  documentoSelfie: "Selfie + foto do documento",
  videoselfie: "Vídeo selfie",
  cpf: "Validação por CPF",
  certificadoDigital: "Certificado digital (ICP-Brasil)",
};

// Signatários fixos da CONTRATADA (sempre exibidos, editáveis se necessário)
const FIXED_CONTRACTADA_SIGNERS: SignerDraft[] = [
  {
    enabled: true,
    role: "representante_legal",
    name: "Everton Pieri",
    email: "everton@anjosbusiness.com.br",
    phone: "",
    auth_mode: "assinaturaTela",
  },
  {
    enabled: true,
    role: "testemunha",
    name: "Jessica Marcato",
    email: "jessicamarcato@anjosbusiness.com",
    phone: "",
    auth_mode: "assinaturaTela",
  },
  {
    enabled: true,
    role: "testemunha",
    name: "Jonathan Marcato",
    email: "jonathanmarcato@anjosbusiness.com",
    phone: "",
    auth_mode: "assinaturaTela",
  },
];


interface DigitalContractTabProps {
  dealId: string;
  dealValue?: number | null;
  clientId?: string | null;
  clientName?: string;
}

interface ZapSignerStatus {
  name: string;
  email?: string | null;
  phone_number?: string | null;
  status: string; // new | link-opened | signed | refused
  signed_at?: string | null;
  times_viewed?: number;
  last_view_at?: string | null;
  token?: string;
  sign_url?: string;
}
interface ContractRow {
  id: string;
  contract_number: string | null;
  status: string;
  share_token: string;
  signed_pdf_path: string | null;
  signed_at: string | null;
  zapsign_document_token: string | null;
  zapsign_signers?: ZapSignerStatus[] | null;
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
    name?: string | null;
    payment_methods?: string[] | null;
    billing_period?: string | null;
    cash_price?: number | null;
    installment_price?: number | null;
  }>({});
  const [clientFull, setClientFull] = useState<any | null>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const pdfPreviewRef = useRef<HTMLDivElement>(null);
  const hiddenPdfRef = useRef<HTMLDivElement>(null);

  const accountId = currentUser?.account_id;
  const resolvedPlaceholderValues = useMemo(() => {
    const merged = mergeContractorPlaceholders(templateHtml, templateVariables, placeholderValues, data);
    // Garante PRODUCT_NAME e CONTRACT_YEAR mesmo quando o template não declara essas variáveis.
    const productName = productExtras.name ?? null;
    const baseDate = (data as any)?.first_due_date ?? dealExtras.won_at ?? new Date().toISOString();
    const year = (() => {
      const d = new Date(typeof baseDate === "string" && baseDate.length <= 10 ? baseDate + "T12:00:00" : baseDate);
      return Number.isNaN(d.getTime()) ? String(new Date().getFullYear()) : String(d.getFullYear());
    })();
    const firstFilled = (...vals: any[]) => vals.find((v) => v !== null && v !== undefined && v !== "") ?? "";
    const durationText = data.contract_duration_months ? `${data.contract_duration_months} meses` : "";
    return {
      ...merged,
      TOTAL_VALUE: firstFilled(merged.TOTAL_VALUE, data.total_value),
      VALOR_TOTAL: firstFilled(merged.VALOR_TOTAL, data.total_value),
      INSTALLMENTS: firstFilled(merged.INSTALLMENTS, data.installments),
      PARCELAS: firstFilled(merged.PARCELAS, data.installments),
      INSTALLMENT_VALUE: firstFilled(merged.INSTALLMENT_VALUE, data.installment_value),
      VALOR_PARCELA: firstFilled(merged.VALOR_PARCELA, data.installment_value),
      DATA_PAGAMENTO: firstFilled(merged.DATA_PAGAMENTO, data.first_due_date),
      DUE_DATE: firstFilled(merged.DUE_DATE, data.first_due_date),
      DATA_PRIMEIRA_PARCELA: firstFilled(merged.DATA_PRIMEIRA_PARCELA, data.first_due_date),
      CONTRACT_DURATION: firstFilled(merged.CONTRACT_DURATION, durationText),
      PRODUCT_NAME: merged.PRODUCT_NAME || productName || merged.PRODUCT_NAME || "",
      PRODUTO: merged.PRODUTO || productName || "",
      PROGRAMA: merged.PROGRAMA || productName || "",
      CONTRACT_YEAR: merged.CONTRACT_YEAR || year,
      ANO: merged.ANO || year,
    };
  }, [templateHtml, templateVariables, placeholderValues, data, productExtras.name, dealExtras.won_at]);

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
          let loadedTemplateHtml = (existing as any).template_html ?? null;
          let loadedTemplateVariables = ((existing as any).template_variables as TemplateVariableDef[]) ?? [];
          let loadedProductId = (existing as any).product_id ?? null;
          const canUseLatestTemplate =
            existing.status === "draft" &&
            !!(existing as any).template_id &&
            !existing.zapsign_document_token &&
            !existing.signed_at;

          if (canUseLatestTemplate) {
            const { data: latestTemplate, error: tplError } = await supabase
              .from("contract_templates" as any)
              .select("content_html,variables,product_id")
              .eq("id", (existing as any).template_id)
              .maybeSingle();
            const tpl = latestTemplate as any;
            if (!tplError && tpl?.content_html) {
              loadedTemplateHtml = tpl.content_html;
              loadedTemplateVariables = ((tpl.variables as TemplateVariableDef[]) ?? loadedTemplateVariables);
              loadedProductId = loadedProductId ?? tpl.product_id ?? null;
            }
          }

          setContract({
            id: existing.id,
            contract_number: existing.contract_number,
            status: existing.status,
            share_token: existing.share_token,
            signed_pdf_path: existing.signed_pdf_path,
            signed_at: existing.signed_at,
            zapsign_document_token: existing.zapsign_document_token,
            zapsign_signers: ((existing as any).zapsign_signers as ZapSignerStatus[] | null) ?? null,
          });
          setData(rowToData(existing));
          setTemplateId((existing as any).template_id ?? null);
          setProductId(loadedProductId);
          setTemplateHtml(loadedTemplateHtml);
          setTemplateVariables(loadedTemplateVariables);
          setPlaceholderValues(((existing as any).placeholder_values as Record<string, any>) ?? {});

          // Sempre carregar dados completos do cliente (necessário para autofill de telefone no envio ZapSign)
          if (clientId) {
            const { data: client } = await supabase
              .from("clients")
              .select("id, full_name, cpf, cnpj, rg, birth_date, phone_e164, phone, emails, street, street_number, complement, neighborhood, city, state, zip_code, company_name")
              .eq("id", clientId)
              .maybeSingle();
            if (!cancelled) setClientFull(client ?? null);
          }
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

          // Auto-resolve product from deal's "Item da Venda" custom field and load default template
          try {
            const { mapItemVendaToProductId, DEAL_FIELD_IDS } = await import(
              "@/utils/dealToClientContractMapping"
            );
            const { data: itemRow } = await supabase
              .from("deal_field_values")
              .select("value_text")
              .eq("deal_id", dealId)
              .eq("field_id", DEAL_FIELD_IDS.ITEM_VENDA)
              .maybeSingle();
            const raw = itemRow?.value_text ?? null;
            if (raw) {
              const resolvedProductId = await mapItemVendaToProductId(raw);
              if (!cancelled && resolvedProductId) {
                setProductId(resolvedProductId);
                const { data: prod } = await supabase
                  .from("products")
                  .select("name")
                  .eq("id", resolvedProductId)
                  .maybeSingle();
                // Rykas Mentoring sempre tem vigência de 6 meses (regra de negócio fixa)
                if (!cancelled && prod?.name && /ryka.*mentoring/i.test(prod.name)) {
                  setData((prev) => ({ ...prev, contract_duration_months: 6 }));
                }
                const { data: tpls } = await supabase
                  .from("contract_templates" as any)
                  .select("id, content_html, variables, product_id, is_default, is_active")
                  .eq("account_id", accountId)
                  .eq("product_id", resolvedProductId)
                  .eq("is_active", true)
                  .order("is_default", { ascending: false })
                  .limit(1);
                const tpl = (tpls ?? [])[0] as any;
                if (!cancelled && tpl?.content_html) {
                  setTemplateId(tpl.id);
                  setTemplateHtml(tpl.content_html);
                  setTemplateVariables((tpl.variables as TemplateVariableDef[]) ?? []);
                }
              }
            }
          } catch (err) {
            console.warn("[DigitalContractTab] auto product/template resolve failed:", err);
          }
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
        .select("name, price, payment_methods, billing_period, cash_price, installment_price")
        .eq("id", productId)
        .maybeSingle();
      if (cancelled || !product) return;
      setProductExtras({
        name: product.name ?? null,
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

  // Autosave (debounced) — persiste alterações dos campos do wizard sem
  // exigir clique em "Salvar". Só roda quando o contrato já existe e
  // está em rascunho (não toca em contratos enviados/assinados).
  const autosaveSkipRef = useRef(true);
  useEffect(() => {
    if (!contract?.id) return;
    if (loading || saving) return;
    if (contract.status && contract.status !== "draft") return;
    if (autosaveSkipRef.current) {
      autosaveSkipRef.current = false;
      return;
    }
    const handle = setTimeout(async () => {
      try {
        await supabase
          .from("digital_contracts")
          .update({
            ...dataToRow(data),
            template_id: templateId,
            product_id: productId,
            template_html: templateHtml,
            template_variables: templateVariables as any,
            placeholder_values: resolvedPlaceholderValues as any,
          } as any)
          .eq("id", contract.id);
      } catch (e) {
        console.warn("[DigitalContractTab] autosave failed", e);
      }
    }, 800);
    return () => clearTimeout(handle);
  }, [contract?.id, contract?.status, data, templateId, productId, templateHtml, templateVariables, resolvedPlaceholderValues, loading, saving]);

  // Reset do guard de autosave quando o contrato carregado muda
  useEffect(() => {
    autosaveSkipRef.current = true;
  }, [contract?.id]);


  const handleSave = async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      const templatePayload = {
        template_id: templateId,
        product_id: productId,
        template_html: templateHtml,
        template_variables: templateVariables as any,
        placeholder_values: resolvedPlaceholderValues as any,
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

  const generatePdfToStorage = async (opts?: { silent?: boolean }): Promise<string | null> => {
    const target = pdfPreviewRef.current ?? docRef.current ?? hiddenPdfRef.current;
    if (!target || !contract) {
      if (!opts?.silent) toast.error("Salve o contrato antes de gerar o PDF.");
      return null;
    }

    // ------------------------------------------------------------------
    // Paginação A4 real ("virtual paginator")
    //
    // Estratégia: clonamos o .contract-document para um sandbox offscreen
    // a 210mm, e para cada `.rk-page` original redistribuímos seus filhos
    // em N novas `.rk-page` reais, de forma que NENHUMA delas ultrapasse
    // a área útil (A4 menos padding do template menos zona reservada
    // para o carimbo/hash da ZapSign). Cada página final vira EXATAMENTE
    // 1 página do PDF — sem fatiar o canvas no meio de texto, sem
    // sobreposição com o carimbo de assinatura.
    // ------------------------------------------------------------------
    const A4_W_MM = 210;
    const A4_H_MM = 297;
    const A4_W_PX = 794; // 210mm @ 96dpi
    const PX_PER_MM = A4_W_PX / A4_W_MM;
    const A4_H_PX = A4_H_MM * PX_PER_MM; // ~1123
    const ZAPSIGN_RESERVED_MM = 26; // faixa do carimbo/hash no rodapé
    const ZAPSIGN_RESERVED_PX = ZAPSIGN_RESERVED_MM * PX_PER_MM;

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();

    const docNode =
      (target.querySelector(".contract-document") as HTMLElement | null) ?? target;

    // Sandbox offscreen com largura A4 exata
    const sandbox = document.createElement("div");
    sandbox.style.cssText = [
      "position:fixed",
      "left:-10000px",
      "top:0",
      "width:210mm",
      "background:#ffffff",
      "z-index:-1",
      "pointer-events:none",
    ].join(";");
    const clone = docNode.cloneNode(true) as HTMLElement;
    clone.style.transform = "none";
    clone.style.width = "210mm";
    clone.style.minHeight = "auto";
    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);

    // Aguarda layout/fontes para medidas serem precisas
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    if ((document as any).fonts?.ready) {
      try { await (document as any).fonts.ready; } catch { /* noop */ }
    }

    try {
      const originalPages = Array.from(
        clone.querySelectorAll<HTMLElement>(".rk-page"),
      );

      // Se não houver .rk-page, trata o documento inteiro como uma única página
      const pagesToProcess: HTMLElement[] =
        originalPages.length > 0 ? originalPages : [clone];

      const finalPages: HTMLElement[] = [];

      for (const origPage of pagesToProcess) {
        const cs = getComputedStyle(origPage);
        const padTop = parseFloat(cs.paddingTop) || 0;
        const padBottom = parseFloat(cs.paddingBottom) || 0;
        // Área útil para conteúdo dentro de UMA página A4 do PDF
        const usableContentPx =
          A4_H_PX - padTop - padBottom - ZAPSIGN_RESERVED_PX;

        // Se a página original já cabe inteira, mantém como está
        if (origPage.offsetHeight <= A4_H_PX - ZAPSIGN_RESERVED_PX) {
          finalPages.push(origPage);
          continue;
        }

        // Cria fábrica de páginas vazias preservando classes/atributos
        const makeEmptyPage = (): HTMLElement => {
          const p = origPage.cloneNode(false) as HTMLElement;
          p.style.minHeight = "";
          p.style.height = "";
          return p;
        };

        const parent = origPage.parentElement!;
        const children = Array.from(origPage.children) as HTMLElement[];

        let current = makeEmptyPage();
        parent.insertBefore(current, origPage);
        finalPages.push(current);

        const contentHeightOf = (page: HTMLElement) =>
          page.offsetHeight - padTop - padBottom;

        for (const child of children) {
          current.appendChild(child);
          if (
            contentHeightOf(current) > usableContentPx &&
            current.children.length > 1
          ) {
            // Estourou: tira o último filho e começa nova página com ele
            current.removeChild(child);
            current = makeEmptyPage();
            parent.insertBefore(current, origPage);
            finalPages.push(current);
            current.appendChild(child);
          }
        }

        origPage.remove();
      }

      // Renderiza cada página final como 1 página do PDF
      for (let i = 0; i < finalPages.length; i++) {
        const fp = finalPages[i];

        // Mede a altura natural da página (pode ser <= ou > que A4)
        const naturalH = fp.offsetHeight;
        const overflows = naturalH > A4_H_PX - ZAPSIGN_RESERVED_PX;

        const canvas = await html2canvas(fp, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          windowWidth: A4_W_PX,
          width: A4_W_PX,
          height: overflows ? naturalH : A4_H_PX,
        });

        if (i > 0) pdf.addPage();

        if (!overflows) {
          // Cabe folgado: imagem ocupa página A4 inteira (com espaço inferior
          // já livre porque pintamos com height = A4_H_PX e o conteúdo está
          // colado no topo via padding do template)
          const img = canvas.toDataURL("image/jpeg", 0.95);
          pdf.addImage(img, "JPEG", 0, 0, A4_W_MM, A4_H_MM);
        } else {
          // Fallback: um único filho gigante (raro). Encaixa a altura
          // proporcionalmente, mas NUNCA ultrapassa a zona reservada.
          const maxRenderableMm = pageHeightMm - ZAPSIGN_RESERVED_MM;
          const naturalMm = (canvas.height * A4_W_MM) / canvas.width;
          const renderMm = Math.min(naturalMm, maxRenderableMm);
          const img = canvas.toDataURL("image/jpeg", 0.95);
          pdf.addImage(img, "JPEG", 0, 0, A4_W_MM, renderMm);
        }
      }
    } finally {
      sandbox.remove();
    }

    const blob = pdf.output("blob");
    const filePath = `${accountId}/${contract.id}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("digital-contracts")
      .upload(filePath, blob, { contentType: "application/pdf", upsert: true });
    if (upErr) throw upErr;

    await supabase
      .from("digital_contracts")
      .update({ signed_pdf_path: filePath })
      .eq("id", contract.id);

    setContract({ ...contract, signed_pdf_path: filePath });
    return filePath;
  };


  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      const filePath = await generatePdfToStorage();
      if (!filePath) return;
      const { data: signed } = await supabase.storage
        .from("digital-contracts")
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);
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

  const [signerDialogOpen, setSignerDialogOpen] = useState(false);
  const [signerDrafts, setSignerDrafts] = useState<SignerDraft[]>([]);
  const [documentName, setDocumentName] = useState("");

  const openSignerDialog = () => {
    if (!contract) {
      toast.error("Salve o contrato antes de enviar.");
      return;
    }
    // Prefill from current contract data
    const clientPhone = (clientFull?.phone_e164 || clientFull?.phone || "") as string;
    const drafts: SignerDraft[] = [];
    if (data.client_representative) {
      drafts.push({
        enabled: true,
        role: "representante_legal",
        name: data.client_representative || "",
        email: data.client_email || "",
        phone: clientPhone,
        auth_mode: "assinaturaTela",
      });
      drafts.push({
        enabled: false,
        role: "contratante",
        name: data.client_name || "",
        email: data.client_email || "",
        phone: clientPhone,
        auth_mode: "assinaturaTela",
      });
    } else {
      drafts.push({
        enabled: true,
        role: "contratante",
        name: data.client_name || "",
        email: data.client_email || "",
        phone: clientPhone,
        auth_mode: "assinaturaTela",
      });
    }
    // Signatários fixos da CONTRATADA (Everton + 2 testemunhas Marcato).
    // Sempre presentes, mas editáveis caso necessário.
    FIXED_CONTRACTADA_SIGNERS.forEach((fs) => drafts.push({ ...fs }));
    setSignerDrafts(drafts);
    const clientLabel = data.client_name || data.client_representative || "";
    const numberLabel = contract?.contract_number ? ` ${contract.contract_number}` : "";
    setDocumentName(`Contrato${numberLabel}${clientLabel ? ` - ${clientLabel}` : ""}`.trim());
    setSignerDialogOpen(true);
  };

  const handleSendZapsign = async () => {
    if (!contract) {
      toast.error("Salve o contrato antes de enviar.");
      return;
    }
    const selected = signerDrafts.filter((s) => s.enabled);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos um signatário.");
      return;
    }
    for (const s of selected) {
      if (!s.name.trim()) {
        toast.error(`Informe o nome do signatário (${ROLE_LABEL[s.role]}).`);
        return;
      }
      if (!s.email.trim() && !s.phone.replace(/\D/g, "")) {
        toast.error(`Informe e-mail ou WhatsApp para ${s.name || ROLE_LABEL[s.role]}.`);
        return;
      }
    }
    setSendingZapsign(true);
    try {
      // Etapa de pré-visualização: garante que o PDF esteja no storage antes de enviar
      toast.info("Gerando PDF para assinatura...");
      const filePath = await generatePdfToStorage({ silent: true });
      if (!filePath) {
        toast.error("Não foi possível gerar o PDF. Abra a Pré-visualização e tente novamente.");
        return;
      }

      const { data: invokeData, error } = await supabase.functions.invoke("zapsign-send", {
        body: {
          contract_id: contract.id,
          contract_name: documentName.trim() || undefined,
          signers: selected.map((s) => ({
            role: s.role,
            name: s.name.trim(),
            email: s.email.trim() || undefined,
            phone: s.phone.replace(/\D/g, "") || undefined,
            auth_mode: s.auth_mode,
          })),
        },
      });
      if (error) throw new Error((invokeData as any)?.error || error.message);
      if (invokeData && (invokeData as any).success === false) {
        throw new Error((invokeData as any).error || "Falha ao enviar para ZapSign");
      }
      toast.success("Enviado para assinatura via ZapSign");
      setSignerDialogOpen(false);
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
          zapsign_signers: ((updated as any).zapsign_signers as ZapSignerStatus[] | null) ?? null,
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
          zapsign_signers: ((updated as any).zapsign_signers as ZapSignerStatus[] | null) ?? null,
        });
      }
      toast.success("Status atualizado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao consultar status");
    }
  };

  const handleCopyPublicLink = () => {
    if (!contract?.share_token) return;
    const url = buildPublicContractUrl(contract.share_token);
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
        <Button size="sm" onClick={openSignerDialog} disabled={!contract || sendingZapsign}>
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
        placeholderValues={resolvedPlaceholderValues}
        autofill={{
          client: {
            // CONTRATANTE = Mentorado (sempre PF). Os dados do mentorado preenchidos
            // no wizard têm prioridade sobre o registro do cliente no CRM, que pode
            // refletir dados de faturamento (PJ).
            id: clientFull?.id ?? clientId ?? null,
            full_name: data.client_name || clientFull?.full_name || null,
            cpf: data.client_cpf_cnpj || clientFull?.cpf || null,
            cnpj: null,
            rg: clientFull?.rg ?? null,
            email: data.client_email || (Array.isArray(clientFull?.emails) ? clientFull.emails[0] : null) || null,
            address: data.client_address || [clientFull?.street, clientFull?.street_number, clientFull?.neighborhood, clientFull?.city, clientFull?.state].filter(Boolean).join(", ") || null,
            phone: clientFull?.phone_e164 ?? null,
            // Contratante é PF: razão social = nome do mentorado
            razao_social: data.client_name || clientFull?.full_name || null,
            nome_fantasia: null,
            street: clientFull?.street ?? null,
            street_number: clientFull?.street_number ?? null,
            complement: clientFull?.complement ?? null,
            neighborhood: clientFull?.neighborhood ?? null,
            city: clientFull?.city ?? null,
            state: clientFull?.state ?? null,
            zip_code: clientFull?.zip_code ?? null,
            birth_date: clientFull?.birth_date ?? null,
            nationality: data.client_nationality ?? null,
            marital_status: data.client_marital_status ?? null,
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
            name: productExtras.name ?? null,
            payment_method: Array.isArray(productExtras.payment_methods) && productExtras.payment_methods.length > 0
              ? productExtras.payment_methods[0]
              : null,
            installments:
              productExtras.installment_price && productExtras.installment_price > 0 && data.total_value
                ? Math.max(1, Math.round(Number(data.total_value) / Number(productExtras.installment_price)))
                : null,
            billing_period: productExtras.billing_period ?? null,
            duration_months: data.contract_duration_months ?? 12,
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
          setPlaceholderValues(mergeContractorPlaceholders(next.template_html, next.template_variables, next.placeholder_values, data));
        }}
        disabled={saving}
        menteeData={data}
        onMenteeChange={setData}
        dealId={dealId}
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
                  placeholderValues={resolvedPlaceholderValues}
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
                    placeholderValues={resolvedPlaceholderValues}
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

      {/* Nó oculto sempre montado para gerar PDF mesmo sem abrir o preview */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          width: "210mm",
          background: "#ffffff",
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        <div ref={hiddenPdfRef} className="p-6">
          {templateHtml ? (
            <TemplatedContractPreview
              templateHtml={templateHtml}
              templateVariables={templateVariables}
              placeholderValues={resolvedPlaceholderValues}
            />
          ) : (
            <ContractDocument data={data} />
          )}
        </div>
      </div>

      <Dialog open={signerDialogOpen} onOpenChange={(o) => !sendingZapsign && setSignerDialogOpen(o)}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] !flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-base">Selecionar signatários</DialogTitle>
            <DialogDescription className="text-xs">
              Marque quem deve assinar e revise nome, e-mail e WhatsApp. ZapSign exige pelo
              menos um meio de contato (e-mail ou WhatsApp) por signatário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Nome do documento (aparece no ZapSign e nas notificações)</Label>
            <Input
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Ex.: Contrato 0001 - Cliente"
              className="h-9 text-sm"
            />
          </div>

          <ScrollArea className="flex-1 min-h-0 h-full -mx-6 px-6">
            <div className="space-y-3 py-1">
              {signerDrafts.map((s, idx) => (
                <Card key={idx} className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={s.enabled}
                      onCheckedChange={(v) =>
                        setSignerDrafts((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, enabled: !!v } : p)),
                        )
                      }
                    />
                    <div className="flex-1">
                      <Label className="text-[11px] text-muted-foreground">Papel</Label>
                      <Select
                        value={s.role}
                        onValueChange={(v: ZapSignerRole) =>
                          setSignerDrafts((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, role: v } : p)),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ROLE_LABEL) as ZapSignerRole[]).map((r) => (
                            <SelectItem key={r} value={r} className="text-xs">
                              {ROLE_LABEL[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 self-end"
                      onClick={() =>
                        setSignerDrafts((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Nome</Label>
                      <Input
                        className="h-8 text-xs"
                        value={s.name}
                        onChange={(e) =>
                          setSignerDrafts((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)),
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">E-mail</Label>
                      <Input
                        className="h-8 text-xs"
                        type="email"
                        value={s.email}
                        onChange={(e) =>
                          setSignerDrafts((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, email: e.target.value } : p)),
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">WhatsApp (com DDD)</Label>
                      <Input
                        className="h-8 text-xs"
                        value={s.phone}
                        placeholder="11999998888"
                        onChange={(e) =>
                          setSignerDrafts((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, phone: e.target.value } : p)),
                          )
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Forma de assinatura</Label>
                    <Select
                      value={s.auth_mode}
                      onValueChange={(v: ZapAuthMode) =>
                        setSignerDrafts((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, auth_mode: v } : p)),
                        )
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(AUTH_MODE_LABEL) as ZapAuthMode[]).map((m) => (
                          <SelectItem key={m} value={m} className="text-xs">
                            {AUTH_MODE_LABEL[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </Card>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setSignerDrafts((prev) => [
                    ...prev,
                    { enabled: true, role: "testemunha", name: "", email: "", phone: "", auth_mode: "assinaturaTela" },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar signatário
              </Button>
            </div>
          </ScrollArea>

          <DialogFooter className="flex-row sm:justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSignerDialogOpen(false)}
              disabled={sendingZapsign}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSendZapsign} disabled={sendingZapsign}>
              {sendingZapsign ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1.5" />
              )}
              {sendingZapsign ? "Enviando..." : "Enviar para ZapSign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
