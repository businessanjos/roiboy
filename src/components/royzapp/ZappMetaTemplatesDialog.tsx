import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, BadgeCheck, Search, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MetaTemplateComponent {
  type: string;
  text?: string;
  format?: string;
  example?: { body_text?: string[][]; header_text?: string[] };
}

interface MetaTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  components: MetaTemplateComponent[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string | null;
  phone: string | null;
  contactName?: string | null;
  onSent?: () => void;
}

function extractBodyText(t: MetaTemplate): string {
  return t.components.find((c) => c.type.toUpperCase() === "BODY")?.text || "";
}

function extractVariables(text: string): string[] {
  // Captures both {{1}} (positional) and {{customer_name}} (named) in order, deduplicated
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

function renderPreview(text: string, vars: string[], values: string[]): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const i = vars.indexOf(key);
    return values[i] || `{{${key}}}`;
  });
}

export function ZappMetaTemplatesDialog({
  open,
  onOpenChange,
  integrationId,
  phone,
  contactName,
  onSent,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [needsWabaId, setNeedsWabaId] = useState(false);
  const [wabaInput, setWabaInput] = useState("");
  const [savingWaba, setSavingWaba] = useState(false);
  const [selected, setSelected] = useState<MetaTemplate | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = async () => {
    if (!integrationId) return;
    setLoading(true);
    setError(null);
    setNeedsWabaId(false);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "meta-manager",
        { body: { action: "list_templates", integration_id: integrationId } }
      );
      if (fnErr) {
        // fnErr from edge often comes with body error info; try to parse
        const ctx: any = (fnErr as any).context;
        const msg = ctx?.body?.error || (fnErr as Error).message || "";
        const code = ctx?.body?.code;
        if (code === "missing_waba_id" || /WABA ID/.test(msg)) {
          setNeedsWabaId(true);
        } else {
          setError(msg || "Falha ao carregar templates");
        }
        return;
      }
      if (data?.data?.needs_waba_id || data?.data?.code === "missing_waba_id") {
        setNeedsWabaId(true);
        setTemplates([]);
        return;
      }
      if (data?.error) {
        setTemplates([]);
        setError(data.error);
        return;
      }
      setTemplates(data?.data?.templates || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && integrationId) {
      setSelected(null);
      setSearch("");
      setError(null);
      loadTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, integrationId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        extractBodyText(t).toLowerCase().includes(q)
    );
  }, [templates, search]);

  const handleSelect = (t: MetaTemplate) => {
    setSelected(t);
    const n = countVariables(extractBodyText(t));
    setParams(Array(n).fill(""));
  };

  const handleSaveWaba = async () => {
    if (!wabaInput.trim() || !integrationId) return;
    setSavingWaba(true);
    try {
      const { error: fnErr } = await supabase.functions.invoke("meta-manager", {
        body: {
          action: "update_config",
          integration_id: integrationId,
          config_patch: { waba_id: wabaInput.trim() },
        },
      });
      if (fnErr) throw fnErr;
      toast.success("WABA ID salvo");
      setWabaInput("");
      await loadTemplates();
    } catch (e) {
      toast.error("Falha ao salvar WABA ID", { description: (e as Error).message });
    } finally {
      setSavingWaba(false);
    }
  };

  const handleSend = async () => {
    if (!selected || !phone || !integrationId) return;
    if (params.some((p) => !p.trim())) {
      toast.error("Preencha todas as variáveis do template");
      return;
    }
    setSending(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "meta-manager",
        {
          body: {
            action: "send_template",
            integration_id: integrationId,
            phone,
            template_name: selected.name,
            template_language: selected.language,
            body_params: params,
          },
        }
      );
      if (fnErr) {
        const msg = (fnErr as any).context?.body?.error || (fnErr as Error).message;
        throw new Error(msg);
      }
      toast.success("Template enviado!");
      onOpenChange(false);
      onSent?.();
    } catch (e) {
      toast.error("Falha ao enviar template", { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-emerald-500" />
            Templates aprovados (Meta)
          </DialogTitle>
          <DialogDescription>
            {contactName ? `Para ${contactName} · ` : ""}
            {phone || "—"} · Use templates para iniciar conversa fora da janela de 24h.
          </DialogDescription>
        </DialogHeader>

        {needsWabaId ? (
          <div className="space-y-3 py-4">
            <Alert>
              <AlertDescription>
                Esta integração ainda não tem o <strong>WhatsApp Business Account ID (WABA ID)</strong> configurado. Informe abaixo para listar templates aprovados.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="waba">WABA ID</Label>
              <Input
                id="waba"
                value={wabaInput}
                onChange={(e) => setWabaInput(e.target.value)}
                placeholder="Ex: 987654321098765"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Encontre em Meta Business Settings → Contas do WhatsApp → ID.
              </p>
            </div>
            <Button onClick={handleSaveWaba} disabled={savingWaba || !wabaInput.trim()}>
              {savingWaba ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
              ) : (
                "Salvar e listar templates"
              )}
            </Button>
          </div>
        ) : selected ? (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setSelected(null)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar à lista
            </Button>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{selected.name}</h3>
                <Badge variant="outline" className="uppercase text-[10px]">
                  {selected.language}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {selected.category}
                </Badge>
              </div>
            </div>
            <ScrollArea className="flex-1 -mx-1 px-1">
              <div className="space-y-4">
                {params.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm">Variáveis</Label>
                    {params.map((v, i) => (
                      <div key={i} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {`{{${i + 1}}}`}
                        </Label>
                        <Input
                          value={v}
                          onChange={(e) => {
                            const next = [...params];
                            next[i] = e.target.value;
                            setParams(next);
                          }}
                          placeholder={`Valor para variável ${i + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-sm">Pré-visualização</Label>
                  <div className="rounded-lg border bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                    {renderPreview(extractBodyText(selected), params)}
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                ) : (
                  "Enviar template"
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou conteúdo..."
                className="pl-10"
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : filtered.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12">
                Nenhum template aprovado encontrado.
                <br />
                <span className="text-xs">
                  Crie e submeta templates em Meta Business → WhatsApp Manager → Modelos de mensagem.
                </span>
              </div>
            ) : (
              <ScrollArea className="flex-1 -mx-1 px-1">
                <div className="space-y-2">
                  {filtered.map((t) => {
                    const body = extractBodyText(t);
                    return (
                      <button
                        key={`${t.name}-${t.language}`}
                        onClick={() => handleSelect(t)}
                        className={cn(
                          "w-full text-left rounded-lg border bg-card p-3 hover:bg-accent transition"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{t.name}</span>
                          <Badge variant="outline" className="uppercase text-[10px]">
                            {t.language}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {t.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {body}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
