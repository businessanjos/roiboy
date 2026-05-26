import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Copy, ExternalLink, BarChart3, Loader2, Trash2, Edit2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { CampaignFormAnalytics } from "./CampaignFormAnalytics";

interface CampaignForm {
  id: string;
  title: string;
  description: string | null;
  slug: string | null;
  is_active: boolean;
  fields: string[];
  campaign_meta: Record<string, any>;
  appearance: Record<string, any>;
  created_at: string;
  responses_count?: number;
}

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  is_required: boolean;
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function publicUrl(slug: string) {
  return `${window.location.origin}/c/${slug}`;
}

export function CampaignFormsTab() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [forms, setForms] = useState<CampaignForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CampaignForm | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [analyticsFor, setAnalyticsFor] = useState<CampaignForm | null>(null);

  async function load() {
    if (!accountId) return;
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("forms")
      .select("id, title, description, slug, is_active, fields, campaign_meta, appearance, created_at")
      .eq("account_id", accountId)
      .eq("is_campaign", true)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar formulários");
      setLoading(false);
      return;
    }
    // counts (last 30d)
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const ids = (rows || []).map((r) => r.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: cnt } = await supabase
        .from("form_responses")
        .select("form_id")
        .in("form_id", ids)
        .gte("submitted_at", since);
      (cnt || []).forEach((r: any) => {
        counts[r.form_id] = (counts[r.form_id] || 0) + 1;
      });
    }
    setForms((rows || []).map((r: any) => ({ ...r, fields: r.fields || [], responses_count: counts[r.id] || 0 })));
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [accountId]);

  function openNew() {
    setEditing({
      id: "",
      title: "",
      description: "",
      slug: "",
      is_active: true,
      fields: [],
      campaign_meta: { primary_color: "", redirect_url: "", thanks_message: "" },
      appearance: {},
      created_at: "",
    });
    setDialogOpen(true);
  }

  function openEdit(f: CampaignForm) {
    setEditing({ ...f, campaign_meta: f.campaign_meta || {}, appearance: f.appearance || {}, fields: f.fields || [] });
    setDialogOpen(true);
  }

  async function remove(f: CampaignForm) {
    if (!confirm(`Excluir o formulário "${f.title}"? Todas as respostas serão removidas.`)) return;
    const { error } = await supabase.from("forms").delete().eq("id", f.id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Excluído"); load(); }
  }

  if (analyticsFor) {
    return (
      <CampaignFormAnalytics
        form={analyticsFor}
        onBack={() => setAnalyticsFor(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Formulários Roy</h2>
          <p className="text-sm text-muted-foreground">Substitua o Typeform: crie formulários hospedados em <code>/c/seu-slug</code> com tracking de funil, UTM e matching automático com lead/deal.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Novo formulário</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : forms.length === 0 ? (
        <Card className="bg-card/50 border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <Globe className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum formulário ainda. Crie o primeiro para começar a capturar leads de campanhas pagas.</p>
            <Button onClick={openNew} variant="outline" className="gap-2"><Plus className="w-4 h-4" />Criar formulário</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {forms.map((f) => (
            <Card key={f.id} className="bg-card/50">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{f.title}</h3>
                    {f.is_active ? <Badge variant="outline" className="text-emerald-500 border-emerald-500/40">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
                    <Badge variant="secondary">{f.fields.length} campos</Badge>
                    <Badge variant="secondary">{f.responses_count} resp/30d</Badge>
                  </div>
                  {f.slug ? (
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="truncate">{publicUrl(f.slug)}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(publicUrl(f.slug!)); toast.success("Link copiado"); }}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" asChild>
                        <a href={publicUrl(f.slug)} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-500 mt-1">Sem slug — defina um para publicar</p>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setAnalyticsFor(f)} className="gap-1"><BarChart3 className="w-4 h-4" />Analytics</Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(f)} className="gap-1"><Edit2 className="w-4 h-4" />Editar</Button>
                <Button size="icon" variant="ghost" onClick={() => remove(f)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <CampaignFormEditor
          open={dialogOpen}
          onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
          form={editing}
          accountId={accountId!}
          onSaved={() => { setDialogOpen(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function CampaignFormEditor({
  open, onOpenChange, form, accountId, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: CampaignForm;
  accountId: string;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description || "");
  const [slug, setSlug] = useState(form.slug || "");
  const [isActive, setIsActive] = useState(form.is_active);
  const [primaryColor, setPrimaryColor] = useState(form.campaign_meta?.primary_color || "");
  const [redirectUrl, setRedirectUrl] = useState(form.campaign_meta?.redirect_url || "");
  const [thanksMessage, setThanksMessage] = useState(form.campaign_meta?.thanks_message || "");
  const [selectedFields, setSelectedFields] = useState<string[]>(form.fields || []);
  const [availableFields, setAvailableFields] = useState<CustomField[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("custom_fields")
        .select("id, name, field_type, is_required")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("display_order");
      setAvailableFields(data || []);
    })();
  }, [accountId]);

  useEffect(() => {
    if (!form.id && !slug && title) setSlug(slugify(title));
    // eslint-disable-next-line
  }, [title]);

  function toggleField(id: string) {
    setSelectedFields((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function moveField(id: string, dir: -1 | 1) {
    const idx = selectedFields.indexOf(id);
    if (idx === -1) return;
    const next = [...selectedFields];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setSelectedFields(next);
  }

  async function save() {
    if (!title.trim()) return toast.error("Título obrigatório");
    if (!slug.trim()) return toast.error("Slug obrigatório");
    if (selectedFields.length === 0) return toast.error("Selecione pelo menos um campo");

    setSaving(true);
    const payload = {
      account_id: accountId,
      title: title.trim(),
      description: description.trim() || null,
      slug: slugify(slug),
      is_active: isActive,
      is_campaign: true,
      fields: selectedFields,
      campaign_meta: {
        primary_color: primaryColor || null,
        redirect_url: redirectUrl || null,
        thanks_message: thanksMessage || null,
      },
    };

    let err: any = null;
    if (form.id) {
      const { error } = await supabase.from("forms").update(payload).eq("id", form.id);
      err = error;
    } else {
      const { error } = await supabase.from("forms").insert(payload);
      err = error;
    }
    setSaving(false);
    if (err) {
      if (err.code === "23505") toast.error("Já existe um formulário com esse slug");
      else toast.error("Erro ao salvar");
      return;
    }
    toast.success("Salvo");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar formulário" : "Novo formulário"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Captação Mentoria Outubro" />
              </div>
              <div className="space-y-1.5">
                <Label>Slug (URL pública)</Label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">/c/</span>
                  <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="mentoria-outubro" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição (aparece na primeira tela)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Ativo (responde via URL pública)</Label>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <Label className="text-sm font-semibold">Aparência & finalização</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Cor primária (hex opcional)</Label>
                  <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#0EA5E9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">URL de redirect após envio</Label>
                  <Input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} placeholder="https://obrigado.seusite.com" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mensagem de agradecimento</Label>
                <Textarea value={thanksMessage} onChange={(e) => setThanksMessage(e.target.value)} rows={2} placeholder="Obrigado! Em breve entraremos em contato." />
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <Label className="text-sm font-semibold">Campos do formulário ({selectedFields.length})</Label>
              <p className="text-xs text-muted-foreground">Selecione e ordene os campos personalizados que farão parte do wizard.</p>

              {selectedFields.length > 0 && (
                <div className="border border-border rounded-md p-2 space-y-1 bg-muted/30">
                  <p className="text-xs text-muted-foreground px-2 py-1">Ordem (de cima para baixo):</p>
                  {selectedFields.map((id, i) => {
                    const cf = availableFields.find((f) => f.id === id);
                    if (!cf) return null;
                    return (
                      <div key={id} className="flex items-center gap-2 px-2 py-1.5 bg-card rounded">
                        <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                        <span className="flex-1 text-sm">{cf.name}</span>
                        <Badge variant="secondary" className="text-xs">{cf.field_type}</Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveField(id, -1)} disabled={i === 0}>↑</Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveField(id, 1)} disabled={i === selectedFields.length - 1}>↓</Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleField(id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border border-border rounded-md p-2 max-h-64 overflow-y-auto">
                <p className="text-xs text-muted-foreground px-2 py-1">Campos disponíveis:</p>
                {availableFields.filter((cf) => !selectedFields.includes(cf.id)).map((cf) => (
                  <label key={cf.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/40 rounded cursor-pointer">
                    <Checkbox checked={false} onCheckedChange={() => toggleField(cf.id)} />
                    <span className="flex-1 text-sm">{cf.name}</span>
                    <Badge variant="secondary" className="text-xs">{cf.field_type}</Badge>
                  </label>
                ))}
                {availableFields.length === 0 && (
                  <p className="text-xs text-muted-foreground p-3 text-center">Nenhum campo personalizado cadastrado. Crie em Configurações → Campos Personalizados.</p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
