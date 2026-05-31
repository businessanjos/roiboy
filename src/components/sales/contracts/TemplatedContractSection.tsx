import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, RotateCw } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import {
  buildPlaceholderValues,
  renderTemplate,
  type AutofillContext,
  type TemplateVariableDef,
} from "@/lib/contractTemplates";
import rykasMentoringLogo from "@/assets/rykas-mentoring-logo.png";

interface TemplatedContractSectionProps {
  templateId: string | null;
  productId: string | null;
  templateHtml: string | null;
  templateVariables: TemplateVariableDef[];
  placeholderValues: Record<string, any>;
  onChange: (next: {
    template_id: string | null;
    product_id: string | null;
    template_html: string | null;
    template_variables: TemplateVariableDef[];
    placeholder_values: Record<string, any>;
  }) => void;
  autofill: AutofillContext;
  disabled?: boolean;
}

interface TemplateOption {
  id: string;
  name: string;
  product_id: string | null;
  is_default: boolean;
  content_html: string;
  variables: TemplateVariableDef[];
}

export const TemplatedContractSection = ({
  templateId,
  productId,
  templateHtml,
  templateVariables,
  placeholderValues,
  onChange,
  autofill,
  disabled,
}: TemplatedContractSectionProps) => {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});

  const parseDecimalInput = (raw: string) => {
    const cleaned = raw.replace(/[^\d,.-]/g, "");
    if (!cleaned || cleaned === "-" || cleaned === "," || cleaned === ".") return null;
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    const decimalIndex = Math.max(lastComma, lastDot);
    const integerPart = decimalIndex >= 0 ? cleaned.slice(0, decimalIndex).replace(/[^\d-]/g, "") : cleaned.replace(/[^\d-]/g, "");
    const decimalPart = decimalIndex >= 0 ? cleaned.slice(decimalIndex + 1).replace(/\D/g, "") : "";
    const normalized = decimalPart ? `${integerPart || "0"}.${decimalPart}` : integerPart;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const displayNumericValue = (key: string, value: any) => {
    if (numericDrafts[key] !== undefined) return numericDrafts[key];
    if (value === "" || value === null || value === undefined) return "";
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(2).replace(".", ",") : String(value).replace(".", ",");
  };

  const finishNumericEdit = (key: string) => {
    setNumericDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!accountId) return;
      setLoading(true);
      try {
        const [tpls, prods] = await Promise.all([
          supabase
            .from("contract_templates" as any)
            .select("id,name,product_id,is_default,content_html,variables,is_active")
            .eq("account_id", accountId)
            .eq("is_active", true)
            .order("is_default", { ascending: false })
            .order("name"),
          supabase
            .from("products")
            .select("id,name")
            .eq("account_id", accountId)
            .eq("is_active", true)
            .order("name"),
        ]);
        if (cancelled) return;
        if (tpls.error) throw tpls.error;
        if (prods.error) throw prods.error;
        setTemplates((tpls.data ?? []) as any);
        setProducts((prods.data ?? []) as any);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message ?? "Erro ao carregar templates");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  /** When the user picks a product: pick the default template for it (or first available) */
  const handleProductChange = (newProductId: string | null) => {
    const candidate =
      templates.find((t) => t.product_id === newProductId && t.is_default) ||
      templates.find((t) => t.product_id === newProductId) ||
      null;

    if (candidate) {
      const merged = buildPlaceholderValues(candidate.variables ?? [], autofill, placeholderValues);
      onChange({
        template_id: candidate.id,
        product_id: newProductId,
        template_html: candidate.content_html,
        template_variables: candidate.variables ?? [],
        placeholder_values: merged,
      });
      toast.success(`Template "${candidate.name}" aplicado`);
    } else {
      onChange({
        template_id: null,
        product_id: newProductId,
        template_html: templateHtml,
        template_variables: templateVariables,
        placeholder_values: placeholderValues,
      });
      if (newProductId) toast.message("Nenhum template vinculado a este produto.");
    }
  };

  const handleTemplateChange = (newTemplateId: string | null) => {
    if (!newTemplateId) {
      onChange({
        template_id: null,
        product_id: productId,
        template_html: null,
        template_variables: [],
        placeholder_values: placeholderValues,
      });
      return;
    }
    const tpl = templates.find((t) => t.id === newTemplateId);
    if (!tpl) return;
    const merged = buildPlaceholderValues(tpl.variables ?? [], autofill, placeholderValues);
    onChange({
      template_id: tpl.id,
      product_id: tpl.product_id ?? productId,
      template_html: tpl.content_html,
      template_variables: tpl.variables ?? [],
      placeholder_values: merged,
    });
  };

  const handleResync = () => {
    const fresh = buildPlaceholderValues(templateVariables, autofill, {});
    // Preserve only keys NOT covered by autofill
    const merged = { ...placeholderValues, ...fresh };
    onChange({
      template_id: templateId,
      product_id: productId,
      template_html: templateHtml,
      template_variables: templateVariables,
      placeholder_values: merged,
    });
    toast.success("Variáveis re-sincronizadas com cliente/deal");
  };

  const updatePlaceholder = (key: string, value: any) => {
    onChange({
      template_id: templateId,
      product_id: productId,
      template_html: templateHtml,
      template_variables: templateVariables,
      placeholder_values: { ...placeholderValues, [key]: value },
    });
  };

  const renderInput = (v: TemplateVariableDef) => {
    const value = placeholderValues?.[v.key] ?? "";
    if (v.type === "textarea") {
      return (
        <Textarea
          rows={3}
          value={value}
          onChange={(e) => updatePlaceholder(v.key, e.target.value)}
        />
      );
    }
    if (v.type === "date") {
      return (
        <Input
          type="date"
          value={value}
          onChange={(e) => updatePlaceholder(v.key, e.target.value)}
        />
      );
    }
    if (v.type === "number" || v.type === "currency") {
      return (
        <Input
          type="text"
          inputMode="decimal"
          placeholder={v.type === "currency" ? "0,00" : "0"}
          value={displayNumericValue(v.key, value)}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^\d,.-]/g, "");
            setNumericDrafts((prev) => ({ ...prev, [v.key]: cleaned }));
            const parsed = parseDecimalInput(cleaned);
            updatePlaceholder(v.key, cleaned === "" ? "" : parsed ?? cleaned);
          }}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const parsed = parseDecimalInput(raw);
            if (!raw) updatePlaceholder(v.key, "");
            if (parsed !== null) updatePlaceholder(v.key, parsed);
            finishNumericEdit(v.key);
          }}
        />
      );
    }
    return (
      <Input value={value} onChange={(e) => updatePlaceholder(v.key, e.target.value)} />
    );
  };

  if (loading) {
    return (
      <Card className="p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Modelo do contrato
          </p>
          <p className="text-xs text-muted-foreground">
            Selecione o produto para carregar o template correspondente. As edições nos campos abaixo são preservadas ao trocar.
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/sales/contracts/templates">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Gerenciar templates
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Produto</Label>
          <Select
            disabled={disabled}
            value={productId ?? "__none__"}
            onValueChange={(v) => handleProductChange(v === "__none__" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Nenhum —</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Template</Label>
          <Select
            disabled={disabled}
            value={templateId ?? "__none__"}
            onValueChange={(v) => handleTemplateChange(v === "__none__" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Nenhum —</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                  {t.is_default ? " (padrão)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {templateVariables.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Variáveis do contrato</p>
            <Button variant="ghost" size="sm" onClick={handleResync} disabled={disabled}>
              <RotateCw className="h-3 w-3 mr-1.5" />
              Re-sincronizar com deal/cliente
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {templateVariables.map((v) => (
              <div key={v.key} className={v.type === "textarea" ? "col-span-2" : ""}>
                <Label className="text-xs flex items-center gap-2">
                  {v.label}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {"{{"}
                    {v.key}
                    {"}}"}
                  </span>
                </Label>
                {renderInput(v)}
                {v.source && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Auto: {v.source}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

interface TemplatedContractPreviewProps {
  templateHtml: string | null;
  templateVariables: TemplateVariableDef[];
  placeholderValues: Record<string, any>;
}

export const TemplatedContractPreview = ({
  templateHtml,
  templateVariables,
  placeholderValues,
}: TemplatedContractPreviewProps) => {
  const forceReadablePillarsLayout = (html: string) => {
    if (!html.includes("rk-pillars") && !html.includes("rk-clause")) return html;
    const override = `<style>
/* === Fonte segura no PDF: Geist é carregada por @import inline e o
   html2canvas não espera — caía em fallback "hairline" ilegível.
   Forçamos stack de sistema com peso normal e sem features OpenType. === */
.contract-document,.contract-document *{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif!important;font-feature-settings:normal!important;font-variant-ligatures:normal!important;-webkit-font-smoothing:antialiased!important;text-rendering:optimizeLegibility!important;}
.contract-document{font-weight:400!important;letter-spacing:0!important;}
.contract-document p,.contract-document li,.contract-document dd,.contract-document dt,.contract-document span,.contract-document div{font-weight:400!important;letter-spacing:0!important;}
.contract-document strong,.contract-document b{font-weight:700!important;}
/* === Cláusulas: nunca cortar/abreviar títulos ou marcadores === */
.contract-document .rk-clause{display:grid!important;grid-template-columns:190px minmax(0,1fr)!important;column-gap:18px!important;align-items:start!important;}
.contract-document .rk-clause > *:not(.rk-clause-num){grid-column:2!important;min-width:0!important;max-width:100%!important;overflow-wrap:break-word!important;}
.contract-document .rk-clause .rk-clause-num{grid-column:1!important;grid-row:1!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;word-break:normal!important;overflow-wrap:break-word!important;hyphens:auto!important;line-height:1.35!important;max-width:190px!important;}
.contract-document .rk-clause p,.contract-document .rk-clause li,.contract-document .rk-clause ul,.contract-document .rk-clause ol{min-width:0!important;max-width:100%!important;}
.contract-document .rk-clause ul,.contract-document .rk-clause ol{padding-left:22px!important;margin:6px 0 10px!important;}
.contract-document .rk-clause li{margin:3px 0!important;line-height:1.55!important;}
/* === Sem justify: evita "rios" e buracos enormes entre palavras no PDF === */
.contract-document .rk-clause,.contract-document .rk-clause p,.contract-document .rk-clause li,.contract-document .rk-clause div,.contract-document .rk-clause span{text-align:left!important;word-spacing:normal!important;text-align-last:left!important;hyphens:none!important;}
.contract-document p,.contract-document li{text-align:left!important;word-spacing:normal!important;}
.contract-document .rk-toc ol li,.contract-document .rk-cover-meta .item .v{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:break-word!important;}

/* === Quadro 3P1R: layout em linhas largas, à prova de A4 === */
.contract-document .rk-pillars{display:block!important;margin:30px 0!important;border:1px solid var(--ink,#000)!important;background:#fff!important;border-radius:0!important;overflow:hidden!important;}
.contract-document .rk-pillars::before{content:"MÉTODO 3P1R · JORNADA DE IMPLEMENTAÇÃO";display:block!important;padding:12px 22px!important;background:var(--ink,#000)!important;color:#fff!important;font-size:7.5pt!important;font-weight:800!important;letter-spacing:.22em!important;text-transform:uppercase!important;}
.contract-document .rk-pillar{position:relative!important;display:grid!important;grid-template-columns:72px 130px minmax(0,1fr)!important;gap:18px!important;align-items:start!important;padding:22px 24px 22px 28px!important;border-right:none!important;border-bottom:1px solid var(--line,#e5e5e5)!important;background:#fff!important;}
.contract-document .rk-pillar:last-child{border-bottom:none!important;}
.contract-document .rk-pillar::before{content:""!important;position:absolute!important;left:0!important;top:0!important;bottom:0!important;width:5px!important;background:var(--ink,#000)!important;}
.contract-document .rk-pillar > *{min-width:0!important;}
.contract-document .rk-pillar .num{font-family:'Geist','Inter',sans-serif!important;font-size:32pt!important;font-weight:850!important;color:var(--ink,#000)!important;line-height:.88!important;letter-spacing:-.04em!important;margin:0!important;text-align:right!important;}
.contract-document .rk-pillar .name{font-size:8pt!important;font-weight:800!important;letter-spacing:.16em!important;text-transform:uppercase!important;color:var(--ink,#000)!important;line-height:1.45!important;margin:5px 0 0!important;padding:0!important;border-bottom:none!important;}
.contract-document .rk-pillar .desc{font-size:10pt!important;color:var(--muted,#6b6b70)!important;line-height:1.62!important;text-align:left!important;hyphens:none!important;word-break:normal!important;overflow-wrap:break-word!important;margin:2px 0 0!important;max-width:100%!important;}

/* === Responsividade: em telas estreitas (< 720px) empilha === */
@media (max-width: 720px){
  .contract-document .rk-pillar{grid-template-columns:64px minmax(0,1fr)!important;}
  .contract-document .rk-pillar .num{grid-row:1;grid-column:1;text-align:left!important;font-size:26pt!important;}
  .contract-document .rk-pillar .name{grid-row:1;grid-column:2;align-self:center!important;}
  .contract-document .rk-pillar .desc{grid-column:1 / -1;margin-top:8px!important;}
}
</style>`;
    return html.includes("</style>") ? html.replace(/<\/style>/i, `</style>${override}`) : `${override}${html}`;
  };

  const rendered = useMemo(() => {
    const html = forceReadablePillarsLayout(renderTemplate(templateHtml ?? "", templateVariables, placeholderValues));
    if (!html) return "";
    // Replace the visible cover brand mark only. The template also mentions
    // "Rykas Mentoring" inside CSS comments, so replacing the first text match
    // can miss the visible label entirely.
    const logoImg = `<img src="${rykasMentoringLogo}" alt="Rykas Mentoring" style="height:48px;width:auto;object-fit:contain;display:block;" />`;
    const coverMarkPattern = /<div class="rk-cover-mark">\s*<span class="dot"><\/span>\s*<span class="label">\s*Rykas\s*Mentoring\s*<\/span>\s*<\/div>/i;
    if (coverMarkPattern.test(html)) {
      return html.replace(coverMarkPattern, `<div class="rk-cover-mark">${logoImg}</div>`);
    }
    if (/<span class="label">\s*Rykas\s*Mentoring\s*<\/span>/i.test(html)) {
      return html.replace(/<span class="label">\s*Rykas\s*Mentoring\s*<\/span>/i, logoImg);
    }
    return html;
  }, [templateHtml, templateVariables, placeholderValues]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerHeight, setInnerHeight] = useState<number>(0);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return;
    const A4_WIDTH_PX = 794; // 210mm @ 96dpi
    const update = () => {
      const w = wrapper.clientWidth;
      if (!w) return;
      const next = Math.min(1, w / A4_WIDTH_PX);
      setScale(next);
      setInnerHeight(inner.offsetHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapper);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [rendered]);

  if (!templateHtml) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Selecione um produto/template para gerar o contrato.
      </div>
    );
  }
  return (
    <div
      ref={wrapperRef}
      className="w-full overflow-hidden"
      style={{ height: innerHeight ? innerHeight * scale : undefined }}
    >
      <div
        style={{
          width: "210mm",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div
          ref={innerRef}
          className="contract-document bg-white text-black"
          style={{ width: "210mm", minHeight: "297mm" }}
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      </div>
    </div>
  );
};
