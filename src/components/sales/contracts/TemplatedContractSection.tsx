import { useEffect, useMemo, useState } from "react";
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
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => updatePlaceholder(v.key, e.target.value === "" ? "" : Number(e.target.value))}
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
  const rendered = useMemo(() => {
    const html = renderTemplate(templateHtml ?? "", templateVariables, placeholderValues);
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

  if (!templateHtml) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Selecione um produto/template para gerar o contrato.
      </div>
    );
  }
  return (
    <div
      className="contract-document bg-white text-black mx-auto"
      style={{ width: "100%", maxWidth: "210mm", minHeight: "297mm" }}
      // The template HTML brings its own <style> + layout. Render as-is, no prose, no pre-wrap.
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
};
