import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Wand2,
  Eye,
  Pencil,
  Save,
  FileText,
  Sparkles,
  AlignLeft,
  Hash,
  Calendar,
  DollarSign,
  Type,
  Search,
  X,
  Settings2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AUTOFILL_SOURCES,
  buildPlaceholderValues,
  extractPlaceholders,
  renderTemplate,
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
  /** Compact mode = render inside Dialog. Otherwise full-page. */
  compact?: boolean;
}

const TYPES: { value: TemplateVariableType; label: string; icon: any }[] = [
  { value: "text", label: "Texto", icon: Type },
  { value: "textarea", label: "Texto longo", icon: AlignLeft },
  { value: "number", label: "Número", icon: Hash },
  { value: "currency", label: "Moeda (R$)", icon: DollarSign },
  { value: "date", label: "Data", icon: Calendar },
];

const TYPE_ICON: Record<TemplateVariableType, any> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  currency: DollarSign,
  date: Calendar,
};

/* ------------------------------------------------------------------ */
/* Highlighted preview helpers                                         */
/* ------------------------------------------------------------------ */

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Wrap {{KEY}} occurrences in styled pills inside the raw HTML for editor preview. */
const decoratePlaceholders = (
  html: string,
  knownKeys: Set<string>,
): string => {
  if (!html) return "";
  return html.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const known = knownKeys.has(key);
    return `<span class="placeholder-pill ${known ? "known" : "unknown"}" data-key="${key}">{{${key}}}</span>`;
  });
};

const SAMPLE_CTX = {
  client: {
    full_name: "Clínica Exemplo Estética LTDA",
    razao_social: "Clínica Exemplo Estética LTDA",
    nome_fantasia: "Clínica Exemplo",
    cnpj: "12.345.678/0001-99",
    cpf: "123.456.789-00",
    email: "contato@exemplo.com.br",
    phone: "(11) 99999-0000",
    address: "Av. Paulista, 1000 - Bela Vista, São Paulo/SP",
    inscricao_municipal: "ISENTO",
    inscricao_estadual: "ISENTO",
  },
  deal: { value: 35400, installments: 10, installment_value: 3540 },
  company: {
    name: "ETERNUM MENTORING CLUB LTDA",
    cnpj: "53.844.206/0001-64",
    address: "Av. Copacabana, 325, Sala 207, Barueri/SP",
    representative: "—",
    email: "financeiro@anjosbusiness.com.br",
  },
  today: new Date().toISOString().slice(0, 10),
};

/* ================================================================== */
/* Variable item card                                                  */
/* ================================================================== */

const VariableRow = ({
  v,
  onChange,
  onRemove,
  onInsert,
}: {
  v: TemplateVariableDef;
  onChange: (p: Partial<TemplateVariableDef>) => void;
  onRemove: () => void;
  onInsert: () => void;
}) => {
  const Icon = TYPE_ICON[v.type] ?? Type;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group rounded-lg border border-border bg-card hover:border-primary/40 transition-colors">
      {/* Header line */}
      <div className="flex items-center gap-2 p-2.5">
        <button
          type="button"
          onClick={onInsert}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          title="Clique para inserir no contrato"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium truncate">{v.label || v.key}</span>
            <span className="block text-[11px] font-mono text-muted-foreground truncate">
              {`{{${v.key}}}`}
            </span>
          </span>
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 group-hover:opacity-100"
          onClick={() => setExpanded((x) => !x)}
          title="Configurar"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
          onClick={onRemove}
          title="Remover"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Expanded settings */}
      {expanded && (
        <div className="border-t border-border p-3 space-y-2.5 bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Chave
              </Label>
              <Input
                value={v.key}
                onChange={(e) =>
                  onChange({
                    key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
                  })
                }
                className="font-mono text-xs h-8"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Rótulo
              </Label>
              <Input
                value={v.label}
                onChange={(e) => onChange({ label: e.target.value })}
                className="text-xs h-8"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Tipo
              </Label>
              <Select value={v.type} onValueChange={(t) => onChange({ type: t as TemplateVariableType })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => {
                    const I = t.icon;
                    return (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <I className="h-3.5 w-3.5" /> {t.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Auto-preenchimento
              </Label>
              <Select
                value={v.source ?? "__none__"}
                onValueChange={(s) => onChange({ source: s === "__none__" ? null : s })}
              >
                <SelectTrigger className="h-8 text-xs">
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
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Valor padrão (opcional)
            </Label>
            <Input
              value={(v.default as any) ?? ""}
              onChange={(e) => onChange({ default: e.target.value })}
              className="text-xs h-8"
              placeholder="Deixe em branco se for sempre preenchido manualmente"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* ================================================================== */
/* Main builder                                                        */
/* ================================================================== */

export const TemplateBuilder = ({
  initial,
  products,
  onSave,
  saving,
  compact = false,
}: TemplateBuilderProps) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [productId, setProductId] = useState<string | null>(initial?.product_id ?? null);
  const [contentHtml, setContentHtml] = useState(initial?.content_html ?? "");
  const [variables, setVariables] = useState<TemplateVariableDef[]>(initial?.variables ?? []);
  const [isDefault, setIsDefault] = useState(!!initial?.is_default);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"editor" | "preview">("editor");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const detectedKeys = useMemo(() => extractPlaceholders(contentHtml), [contentHtml]);
  const knownKeys = useMemo(() => new Set(variables.map((v) => v.key)), [variables]);
  const orphanKeys = detectedKeys.filter((k) => !knownKeys.has(k));
  const unusedKeys = variables.filter((v) => !detectedKeys.includes(v.key));

  const filteredVars = useMemo(() => {
    if (!search.trim()) return variables;
    const s = search.toLowerCase();
    return variables.filter(
      (v) =>
        v.key.toLowerCase().includes(s) ||
        (v.label ?? "").toLowerCase().includes(s),
    );
  }, [variables, search]);

  /* ------- variable mutations ------- */

  const addVariable = (key?: string) => {
    const safe = (key ?? `VAR_${variables.length + 1}`)
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_");
    if (variables.some((v) => v.key === safe)) {
      toast.error(`Já existe uma variável com a chave ${safe}`);
      return;
    }
    setVariables([
      ...variables,
      {
        key: safe,
        label: key
          ? key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
          : "Nova variável",
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
    const additions = orphanKeys.map<TemplateVariableDef>((k) => ({
      key: k,
      label: k.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
      type: k.includes("VALOR") || k.includes("PRECO")
        ? "currency"
        : k.includes("DATA") || k.includes("DT_")
          ? "date"
          : k.includes("PARCELAS") || k.includes("QTD")
            ? "number"
            : "text",
      source: null,
    }));
    if (!additions.length) {
      toast.message("Tudo já está mapeado.");
      return;
    }
    setVariables([...variables, ...additions]);
    toast.success(`${additions.length} variável(eis) importada(s) do texto`);
  };

  /** Insert {{KEY}} at the textarea cursor (or append if no editor focus). */
  const insertPlaceholder = (key: string) => {
    const token = `{{${key}}}`;
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? contentHtml.length;
      const end = el.selectionEnd ?? contentHtml.length;
      const next = contentHtml.slice(0, start) + token + contentHtml.slice(end);
      setContentHtml(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      setContentHtml(contentHtml + token);
    }
    toast.success(`Inserido ${token}`);
  };

  /* ------- save ------- */

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome do template");
      return;
    }
    if (!contentHtml.trim()) {
      toast.error("Conteúdo do contrato está vazio");
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

  /* ------- live preview ------- */

  const previewHtml = useMemo(() => {
    const values = buildPlaceholderValues(variables, SAMPLE_CTX as any, {});
    return renderTemplate(contentHtml, variables, values);
  }, [contentHtml, variables]);

  const decoratedEditorPreview = useMemo(
    () => decoratePlaceholders(escapeHtml(contentHtml), knownKeys),
    [contentHtml, knownKeys],
  );

  /* ================================================================ */
  /* Layout                                                            */
  /* ================================================================ */

  return (
    <TooltipProvider delayDuration={150}>
      <style>{`
        .placeholder-pill {
          display: inline-block;
          padding: 1px 6px;
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.78em;
          font-weight: 500;
          line-height: 1.3;
          margin: 0 1px;
        }
        .placeholder-pill.known {
          background: hsl(var(--primary) / 0.12);
          color: hsl(var(--primary));
          border: 1px solid hsl(var(--primary) / 0.25);
        }
        .placeholder-pill.unknown {
          background: hsl(var(--destructive) / 0.1);
          color: hsl(var(--destructive));
          border: 1px dashed hsl(var(--destructive) / 0.5);
        }
        .contract-doc h1, .contract-doc h2, .contract-doc h3 {
          font-family: Georgia, 'Times New Roman', serif;
        }
        .contract-doc h2 {
          font-size: 1rem;
          font-weight: 700;
          text-transform: uppercase;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          letter-spacing: 0.02em;
        }
        .contract-doc p { margin-bottom: 0.75rem; line-height: 1.6; text-align: justify; }
        .contract-doc table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
        .contract-doc table td, .contract-doc table th { padding: 4px 8px; vertical-align: top; }
        .contract-doc ul, .contract-doc ol { margin-left: 1.25rem; margin-bottom: 0.75rem; }
        .contract-doc li { margin-bottom: 0.25rem; line-height: 1.55; }
      `}</style>

      <div className={cn("grid gap-4", compact ? "grid-cols-1" : "lg:grid-cols-[320px_1fr]")}>
        {/* ============== LEFT: METADATA + VARIABLES ============== */}
        <aside className="space-y-4">
          {/* Metadata card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-primary" />
              Identificação
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Nome do template
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Rykas Mentoring 2026"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Produto vinculado
              </Label>
              <Select
                value={productId ?? "__none__"}
                onValueChange={(v) => setProductId(v === "__none__" ? null : v)}
              >
                <SelectTrigger className="mt-1">
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
              <p className="text-[11px] text-muted-foreground mt-1">
                Aplicado automaticamente ao escolher o produto no deal.
              </p>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Descrição
              </Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Resumo curto do contrato"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 cursor-pointer">
                <span className="text-xs">Padrão</span>
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 cursor-pointer">
                <span className="text-xs">Ativo</span>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </label>
            </div>
          </div>

          {/* Variables panel */}
          <div className="rounded-xl border border-border bg-card flex flex-col">
            <div className="p-4 pb-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Variáveis
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {variables.length}
                  </Badge>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => addVariable()}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Nova
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar variável..."
                  className="pl-7 h-8 text-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Clique em uma variável para inseri-la no contrato.
              </p>
            </div>

            {/* Orphans / unused warnings */}
            {(orphanKeys.length > 0 || unusedKeys.length > 0) && (
              <div className="px-4 pb-2 space-y-1.5">
                {orphanKeys.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 flex items-start justify-between gap-2">
                    <div className="text-[11px]">
                      <div className="font-semibold text-destructive flex items-center gap-1">
                        <Wand2 className="h-3 w-3" />
                        {orphanKeys.length} placeholder(s) sem variável
                      </div>
                      <div className="text-muted-foreground truncate">
                        {orphanKeys.slice(0, 3).map((k) => `{{${k}}}`).join(", ")}
                        {orphanKeys.length > 3 ? ` +${orphanKeys.length - 3}` : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs shrink-0"
                      onClick={importDetected}
                    >
                      Importar
                    </Button>
                  </div>
                )}
                {unusedKeys.length > 0 && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px]">
                    <div className="font-semibold text-amber-700 dark:text-amber-500">
                      {unusedKeys.length} variável(eis) não usada(s) no texto
                    </div>
                    <div className="text-muted-foreground truncate">
                      {unusedKeys.slice(0, 3).map((v) => v.key).join(", ")}
                      {unusedKeys.length > 3 ? ` +${unusedKeys.length - 3}` : ""}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Variable list */}
            <div className={cn("p-2 space-y-1.5 overflow-y-auto", compact ? "max-h-[280px]" : "max-h-[calc(100vh-520px)]")}>
              {filteredVars.length === 0 ? (
                <div className="text-center py-8 px-3">
                  <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {search ? "Nenhuma variável encontrada." : "Nenhuma variável definida."}
                  </p>
                  {!search && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="text-xs h-auto p-0 mt-1"
                      onClick={() => addVariable()}
                    >
                      Criar primeira variável
                    </Button>
                  )}
                </div>
              ) : (
                filteredVars.map((v) => {
                  const realIdx = variables.findIndex((x) => x.key === v.key);
                  return (
                    <VariableRow
                      key={v.key + realIdx}
                      v={v}
                      onChange={(p) => updateVar(realIdx, p)}
                      onRemove={() => removeVar(realIdx)}
                      onInsert={() => insertPlaceholder(v.key)}
                    />
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* ============== RIGHT: EDITOR + PREVIEW ============== */}
        <section className="space-y-3 min-w-0">
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <TabsList>
                <TabsTrigger value="editor" className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Editor
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Pré-visualização
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {detectedKeys.length} placeholder{detectedKeys.length !== 1 ? "s" : ""} ·{" "}
                  {contentHtml.length.toLocaleString("pt-BR")} caracteres
                </span>
                <Button onClick={handleSubmit} disabled={saving} size="sm">
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {saving ? "Salvando..." : "Salvar template"}
                </Button>
              </div>
            </div>

            {/* EDITOR ----------------------------------------------- */}
            <TabsContent value="editor" className="mt-3 space-y-2">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/40 flex-wrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={importDetected}
                        disabled={orphanKeys.length === 0}
                      >
                        <Zap className="h-3.5 w-3.5 mr-1" />
                        Mapear placeholders
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Cria variáveis para todos os {`{{...}}`} encontrados no texto
                    </TooltipContent>
                  </Tooltip>

                  <div className="h-4 w-px bg-border mx-1" />

                  <span className="text-[11px] text-muted-foreground">
                    Insira variáveis clicando na lista à esquerda — ou digite{" "}
                    <code className="px-1 rounded bg-background border border-border font-mono">
                      {"{{NOME}}"}
                    </code>
                  </span>
                </div>

                {/* Two-column live edit */}
                <div className="grid lg:grid-cols-2 divide-x divide-border">
                  {/* Source */}
                  <div className="p-0">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/20 border-b border-border">
                      Conteúdo (HTML / texto)
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={contentHtml}
                      onChange={(e) => setContentHtml(e.target.value)}
                      className="w-full font-mono text-xs leading-relaxed p-4 outline-none resize-none bg-transparent"
                      style={{ minHeight: 560 }}
                      spellCheck={false}
                      placeholder={`Cole ou escreva o contrato aqui.\n\nExemplo:\n\n<h2>DO OBJETO</h2>\n<p>Cláusula Primeira: O contratado prestará serviços de mentoria ao cliente {{RAZAO_SOCIAL}}, CNPJ {{CNPJ}}.</p>\n<p>O valor total é de {{VALOR_TOTAL}} parcelado em {{PARCELAS}}x.</p>\n<p>Foro: {{FORO}}.</p>`}
                    />
                  </div>
                  {/* Decorated */}
                  <div className="p-0 bg-muted/10">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/20 border-b border-border flex items-center justify-between">
                      <span>Placeholders destacados</span>
                      <span className="flex items-center gap-2 text-[10px] normal-case tracking-normal">
                        <span className="placeholder-pill known">{"{{OK}}"}</span>
                        <span className="placeholder-pill unknown">{"{{ÓRFÃO}}"}</span>
                      </span>
                    </div>
                    <pre
                      className="p-4 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed overflow-auto"
                      style={{ minHeight: 560, maxHeight: 560 }}
                      dangerouslySetInnerHTML={{ __html: decoratedEditorPreview || '<span class="text-muted-foreground">— vazio —</span>' }}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* PREVIEW ---------------------------------------------- */}
            <TabsContent value="preview" className="mt-3">
              <div className="rounded-xl border border-border bg-muted/40 p-6 overflow-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
                <div className="mx-auto bg-background rounded-md shadow-sm border border-border" style={{ maxWidth: 820, padding: "56px 72px" }}>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-6 pb-3 border-b border-border">
                    <span className="font-mono">PRÉ-VISUALIZAÇÃO COM DADOS DE EXEMPLO</span>
                    <span>{name || "Template sem nome"}</span>
                  </div>
                  <div
                    className="contract-doc prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{
                      __html: previewHtml || '<p class="text-muted-foreground italic">Sem conteúdo. Volte ao editor para começar.</p>',
                    }}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </TooltipProvider>
  );
};

/* ================================================================== */
/* Dialog wrapper (kept for backwards compat)                          */
/* ================================================================== */

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
      <DialogContent className="max-w-[1240px] w-[96vw] max-h-[94vh] overflow-y-auto p-5">
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
