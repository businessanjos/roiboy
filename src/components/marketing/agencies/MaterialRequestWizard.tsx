import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { MATERIAL_REQUEST_CATEGORIES, MaterialRequestCategory } from "@/lib/agency";
import { useCreateMaterialRequest } from "@/hooks/useMaterialRequests";
import { toast } from "sonner";
import { ImageIcon, Video, Type, LayoutTemplate, MoreHorizontal } from "lucide-react";

const CATEGORY_ICON: Record<MaterialRequestCategory, any> = {
  criativo_estatico: ImageIcon,
  video: Video,
  copy: Type,
  landing_page: LayoutTemplate,
  outro: MoreHorizontal,
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agencyId: string;
}

export function MaterialRequestWizard({ open, onOpenChange, agencyId }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [category, setCategory] = useState<MaterialRequestCategory | null>(null);
  const [form, setForm] = useState<any>({ title: "", description: "", priority: "normal", due_date: "" });
  const [payload, setPayload] = useState<Record<string, any>>({});
  const create = useCreateMaterialRequest();

  function reset() {
    setStep(1);
    setCategory(null);
    setForm({ title: "", description: "", priority: "normal", due_date: "" });
    setPayload({});
  }

  async function handleSubmit() {
    if (!category || !form.title.trim()) {
      toast.error("Categoria e título são obrigatórios");
      return;
    }
    try {
      await create.mutateAsync({
        agency_id: agencyId,
        category,
        title: form.title.trim(),
        description: form.description || undefined,
        payload,
        priority: form.priority,
        due_date: form.due_date || null,
      });
      toast.success("Solicitação enviada");
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova solicitação de material</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {MATERIAL_REQUEST_CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICON[c.value];
              return (
                <Card
                  key={c.value}
                  className={`p-4 cursor-pointer hover:border-primary transition-colors ${category === c.value ? "border-primary" : ""}`}
                  onClick={() => { setCategory(c.value); setStep(2); }}
                >
                  <Icon className="h-6 w-6 mb-2 text-primary" />
                  <div className="font-medium">{c.label}</div>
                </Card>
              );
            })}
          </div>
        )}

        {step === 2 && category && (
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Criativo para webinar de outubro"
              />
            </div>
            <div>
              <Label>Descrição / Briefing geral</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Category-specific fields */}
            {category === "criativo_estatico" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Formato</Label>
                  <Select value={payload.formato} onValueChange={(v) => setPayload({ ...payload, formato: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feed">Feed</SelectItem>
                      <SelectItem value="story">Story</SelectItem>
                      <SelectItem value="reels">Reels</SelectItem>
                      <SelectItem value="carousel">Carrossel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Objetivo</Label>
                  <Input value={payload.objetivo ?? ""} onChange={(e) => setPayload({ ...payload, objetivo: e.target.value })} placeholder="Conversão, alcance..." />
                </div>
                <div className="col-span-2">
                  <Label>Headline</Label>
                  <Input value={payload.headline ?? ""} onChange={(e) => setPayload({ ...payload, headline: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>CTA</Label>
                  <Input value={payload.cta ?? ""} onChange={(e) => setPayload({ ...payload, cta: e.target.value })} placeholder="Saiba mais, Inscreva-se..." />
                </div>
                <div className="col-span-2">
                  <Label>Referências (links)</Label>
                  <Textarea value={payload.referencias ?? ""} onChange={(e) => setPayload({ ...payload, referencias: e.target.value })} rows={2} />
                </div>
              </div>
            )}

            {category === "video" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Duração</Label>
                  <Input value={payload.duracao ?? ""} onChange={(e) => setPayload({ ...payload, duracao: e.target.value })} placeholder="15s, 30s, 60s..." />
                </div>
                <div>
                  <Label>Plataforma</Label>
                  <Select value={payload.plataforma} onValueChange={(v) => setPayload({ ...payload, plataforma: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meta">Meta</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="organico">Orgânico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Roteiro / ideia</Label>
                  <Textarea value={payload.roteiro ?? ""} onChange={(e) => setPayload({ ...payload, roteiro: e.target.value })} rows={3} />
                </div>
                <div>
                  <Label>Voz-off?</Label>
                  <Select value={payload.voz_off} onValueChange={(v) => setPayload({ ...payload, voz_off: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {category === "copy" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Canal</Label>
                  <Select value={payload.canal} onValueChange={(v) => setPayload({ ...payload, canal: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ads">Ads</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="landing">Landing page</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tom</Label>
                  <Input value={payload.tom ?? ""} onChange={(e) => setPayload({ ...payload, tom: e.target.value })} placeholder="Direto, consultivo..." />
                </div>
                <div>
                  <Label>Nº de variações</Label>
                  <Input type="number" value={payload.variacoes ?? ""} onChange={(e) => setPayload({ ...payload, variacoes: e.target.value })} />
                </div>
              </div>
            )}

            {category === "landing_page" && (
              <div className="space-y-3">
                <div>
                  <Label>Objetivo</Label>
                  <Input value={payload.objetivo ?? ""} onChange={(e) => setPayload({ ...payload, objetivo: e.target.value })} />
                </div>
                <div>
                  <Label>Produto / oferta</Label>
                  <Input value={payload.produto ?? ""} onChange={(e) => setPayload({ ...payload, produto: e.target.value })} />
                </div>
                <div>
                  <Label>URL atual (se houver)</Label>
                  <Input value={payload.url_atual ?? ""} onChange={(e) => setPayload({ ...payload, url_atual: e.target.value })} />
                </div>
                <div>
                  <Label>Seções desejadas</Label>
                  <Textarea value={payload.secoes ?? ""} onChange={(e) => setPayload({ ...payload, secoes: e.target.value })} rows={3} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prazo desejado</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 2 && <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {step === 2 && (
            <Button onClick={handleSubmit} disabled={create.isPending}>
              {create.isPending ? "Enviando..." : "Enviar solicitação"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
