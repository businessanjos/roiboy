import { useEffect, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  AUTOFILL_SOURCES,
  extractPlaceholders,
  type TemplateVariableDef,
  type TemplateVariableType,
} from "@/lib/contractTemplates";

interface TemplateBuilderProps {
  initial?: {
    name?: string;
    description?: string;
    product_id?: string | null;
    content_html?: string;
    variables?: TemplateVariableDef[];
    is_default?: boolean;
    is_active?: boolean;
  };
  products: { id: string; name: string }[];
  onSave: (payload: {
    name: string;
    description: string;
    product_id: string | null;
    content_html: string;
    variables: TemplateVariableDef[];
    is_default: boolean;
    is_active: boolean;
  }) => Promise<void> | void;
  saving?: boolean;
}

const TYPES: { value: TemplateVariableType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "currency", label: "Moeda (R$)" },
  { value: "date", label: "Data" },
];

export const TemplateBuilder = ({ initial, products, onSave, saving }: TemplateBuilderProps) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [productId, setProductId] = useState<string | null>(initial?.product_id ?? null);
  const [contentHtml, setContentHtml] = useState(initial?.content_html ?? "");
  const [variables, setVariables] = useState<TemplateVariableDef[]>(initial?.variables ?? []);
  const [isDefault, setIsDefault] = useState(!!initial?.is_default);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const detectedKeys = extractPlaceholders(contentHtml);

  const addVariable = (key?: string) => {
    setVariables([
      ...variables,
      {
        key: (key ?? "NOVA_VARIAVEL").toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
        label: key ? key.replace(/_/g, " ") : "Nova variável",
        type: "text",
        source: null,
        default: "",
      },
    ]);
  };

  const updateVar = (idx: number, partial: Partial<TemplateVariableDef>) => {
    const next = [...variables];
    next[idx] = { ...next[idx], ...partial };
    setVariables(next);
  };

  const removeVar = (idx: number) => {
    const next = [...variables];
    next.splice(idx, 1);
    setVariables(next);
  };

  const importDetected = () => {
    const existing = new Set(variables.map((v) => v.key));
    const additions = detectedKeys
      .filter((k) => !existing.has(k))
      .map<TemplateVariableDef>((k) => ({
        key: k,
        label: k.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
        type: "text",
        source: null,
      }));
    if (!additions.length) {
      toast.message("Nenhum placeholder novo no texto.");
      return;
    }
    setVariables([...variables, ...additions]);
    toast.success(`${additions.length} variável(eis) importadas`);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome do template");
      return;
    }
    await onSave({
      name: name.trim(),
      description: description.trim(),
      product_id: productId,
      content_html: contentHtml,
      variables,
      is_default: isDefault,
      is_active: isActive,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nome do template</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Produto vinculado (opcional)</Label>
          <Select value={productId ?? "__none__"} onValueChange={(v) => setProductId(v === "__none__" ? null : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Sem vínculo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Sem vínculo —</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Descrição</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          Modelo padrão
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Ativo
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs">
            Conteúdo do contrato (use {"{{"}<span className="font-mono">VARIAVEL</span>{"}}"} para placeholders)
          </Label>
          <Button type="button" size="sm" variant="outline" onClick={importDetected}>
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            Detectar variáveis no texto
          </Button>
        </div>
        <Textarea
          value={contentHtml}
          onChange={(e) => setContentHtml(e.target.value)}
          rows={20}
          className="font-mono text-xs"
          placeholder={`Exemplo:\n\nCONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nCONTRATANTE: {{RAZAO_SOCIAL}}, CNPJ {{CNPJ}}, com sede em {{ENDERECO}}.\n\nObjeto: {{OBJETO}}\n\nValor: {{VALOR_TOTAL}} parcelado em {{PARCELAS}}x.\n\nVigência: {{DURACAO_MESES}} meses.\n\nForo: {{FORO}}.`}
        />
        {detectedKeys.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Placeholders no texto: {detectedKeys.map((k) => `{{${k}}}`).join(" • ")}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs">Variáveis configuráveis</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => addVariable()}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar variável
          </Button>
        </div>
        <div className="space-y-2">
          {variables.map((v, idx) => (
            <Card key={idx} className="p-3 grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3">
                <Label className="text-[10px] uppercase">Chave</Label>
                <Input
                  value={v.key}
                  onChange={(e) =>
                    updateVar(idx, {
                      key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
                    })
                  }
                  className="font-mono text-xs"
                />
              </div>
              <div className="col-span-3">
                <Label className="text-[10px] uppercase">Label</Label>
                <Input
                  value={v.label}
                  onChange={(e) => updateVar(idx, { label: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px] uppercase">Tipo</Label>
                <Select value={v.type} onValueChange={(t) => updateVar(idx, { type: t as TemplateVariableType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Label className="text-[10px] uppercase">Auto-preenchimento</Label>
                <Select
                  value={v.source ?? ""}
                  onValueChange={(s) => updateVar(idx, { source: s || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTOFILL_SOURCES.map((s) => (
                      <SelectItem key={s.value || "__none__"} value={s.value || "__none__"}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="icon" onClick={() => removeVar(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="col-span-12">
                <Label className="text-[10px] uppercase">Valor padrão (opcional)</Label>
                <Input
                  value={(v.default as any) ?? ""}
                  onChange={(e) => updateVar(idx, { default: e.target.value })}
                />
              </div>
            </Card>
          ))}
          {variables.length === 0 && (
            <p className="text-xs text-muted-foreground border border-dashed rounded p-4 text-center">
              Nenhuma variável definida. Use <span className="font-mono">{"{{NOME}}"}</span> no texto e clique em
              "Detectar variáveis no texto".
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "Salvando..." : "Salvar template"}
        </Button>
      </div>
    </div>
  );
};

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  initial?: TemplateBuilderProps["initial"];
  products: { id: string; name: string }[];
  onSave: TemplateBuilderProps["onSave"];
  saving?: boolean;
}

export const TemplateDialog = ({
  open,
  onOpenChange,
  title,
  initial,
  products,
  onSave,
  saving,
}: TemplateDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <TemplateBuilder
          initial={initial}
          products={products}
          onSave={async (p) => {
            await onSave(p);
            onOpenChange(false);
          }}
          saving={saving}
        />
      </DialogContent>
    </Dialog>
  );
};
