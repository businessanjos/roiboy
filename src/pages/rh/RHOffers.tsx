import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Copy, ExternalLink, Trash2, Mail, CheckCircle2, XCircle, Eye, FileText, Send, Sparkles, FilePlus2, LayoutTemplate } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { getPublicOrigin } from "@/lib/publicLink";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type OfferRow = {
  id: string;
  public_token: string;
  candidate_name: string;
  candidate_email: string | null;
  position_title: string;
  department: string | null;
  status: string;
  salary_amount: number | null;
  salary_currency: string;
  sent_at: string | null;
  view_count: number;
  responded_at: string | null;
  created_at: string;
  accent_color: string;
  is_template: boolean;
  template_name: string | null;
};

const STATUS_MAP: Record<string, { label: string; cls: string; icon: any }> = {
  draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground", icon: FileText },
  sent: { label: "Enviada", cls: "bg-blue-500/15 text-blue-700 border-blue-300", icon: Send },
  viewed: { label: "Visualizada", cls: "bg-amber-500/15 text-amber-700 border-amber-300", icon: Eye },
  accepted: { label: "Aceita", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-300", icon: CheckCircle2 },
  declined: { label: "Recusada", cls: "bg-rose-500/15 text-rose-700 border-rose-300", icon: XCircle },
  expired: { label: "Expirada", cls: "bg-zinc-500/15 text-zinc-700 border-zinc-300", icon: XCircle },
};

export default function RHOffers() {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("hr_job_offers")
      .select("id,public_token,candidate_name,candidate_email,position_title,department,status,salary_amount,salary_currency,sent_at,view_count,responded_at,created_at,accent_color,is_template,template_name")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    setOffers((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const templates = offers.filter((o) => o.is_template);
  const realOffers = offers.filter((o) => !o.is_template);

  const copyLink = (token: string) => {
    const url = `${getPublicOrigin()}/oferta/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: url });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("hr_job_offers").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Excluída" });
      load();
    }
    setDeleteId(null);
  };

  const startBlank = () => {
    setNewDialogOpen(false);
    navigate("/rh/offers/new");
  };

  const startFromTemplate = (templateId: string) => {
    setNewDialogOpen(false);
    navigate(`/rh/offers/new?template=${templateId}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10">
            <Sparkles className="h-7 w-7 text-indigo-600" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cartas-Proposta</h1>
            <p className="text-sm text-muted-foreground">
              Crie ofertas lindas e personalizadas para enviar aos seus candidatos
            </p>
          </div>
        </div>
        <Button onClick={() => setNewDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Offer
        </Button>
      </div>

      {/* Modelos salvos */}
      {templates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Modelos salvos
            </h2>
            <span className="text-xs text-muted-foreground">({templates.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((t) => (
              <Card
                key={t.id}
                className="overflow-hidden border-amber-300/60 bg-gradient-to-br from-amber-50/60 to-transparent dark:from-amber-950/20 hover:shadow-md transition-all"
              >
                <div className="h-1.5" style={{ background: t.accent_color }} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <LayoutTemplate className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <h3 className="font-semibold truncate text-sm">
                          {t.template_name || t.position_title || "Modelo sem nome"}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {t.position_title}{t.department && ` • ${t.department}`}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-300 text-[10px] shrink-0">
                      Modelo
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 pt-2 border-t border-amber-200/40">
                    <Button size="sm" variant="default" onClick={() => startFromTemplate(t.id)} className="gap-1.5 flex-1 bg-amber-600 hover:bg-amber-700">
                      <FilePlus2 className="h-3.5 w-3.5" /> Usar modelo
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/rh/offers/${t.id}/edit`}><FileText className="h-3.5 w-3.5" /></Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteId(t.id)} className="text-rose-600 hover:text-rose-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : realOffers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Nenhuma offer ainda</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {templates.length > 0
                  ? "Use um modelo acima ou crie uma do zero."
                  : "Crie sua primeira carta-proposta em poucos minutos."}
              </p>
            </div>
            <Button onClick={() => setNewDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Criar nova Offer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Offers geradas
            </h2>
            <span className="text-xs text-muted-foreground">({realOffers.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {realOffers.map((o) => {
            const status = STATUS_MAP[o.status] || STATUS_MAP.draft;
            const StatusIcon = status.icon;
            return (
              <Card key={o.id} className="overflow-hidden hover:shadow-md transition-all group">
                <div className="h-1.5" style={{ background: o.accent_color }} />
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{o.candidate_name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{o.position_title}</p>
                      {o.department && (
                        <p className="text-xs text-muted-foreground mt-0.5">{o.department}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={status.cls}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>

                  {o.salary_amount && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Salário: </span>
                      <span className="font-medium">
                        {o.salary_currency} {Number(o.salary_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {o.view_count}</span>
                    {o.candidate_email && (
                      <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" /> {o.candidate_email}</span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Criada em {format(new Date(o.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </p>

                  <div className="flex items-center gap-1 pt-2 border-t">
                    <Button size="sm" variant="ghost" onClick={() => copyLink(o.public_token)} className="gap-1.5 flex-1">
                      <Copy className="h-3.5 w-3.5" /> Copiar link
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={`${getPublicOrigin()}/oferta/${o.public_token}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/rh/offers/${o.id}/edit`}><FileText className="h-3.5 w-3.5" /></Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteId(o.id)} className="text-rose-600 hover:text-rose-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        </div>
      )}

      {/* Diálogo de criação: do zero ou a partir de modelo */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Como você quer começar?</DialogTitle>
            <DialogDescription>
              Use um modelo pronto para acelerar, ou comece do zero se preferir.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {/* Do zero */}
            <button
              onClick={startBlank}
              className={cn(
                "group text-left p-5 rounded-xl border-2 border-dashed transition-all",
                "hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <FilePlus2 className="h-4 w-4 text-indigo-600" />
                </div>
                <span className="font-semibold">Do zero</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Comece com o wizard em branco e preencha tudo manualmente.
              </p>
            </button>

            {/* Bloco de modelos */}
            <div className="p-5 rounded-xl border bg-gradient-to-br from-amber-50/40 to-transparent dark:from-amber-950/10 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <LayoutTemplate className="h-4 w-4 text-amber-600" />
                </div>
                <span className="font-semibold">A partir de um modelo</span>
              </div>
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum modelo salvo. Crie uma offer e marque como modelo na etapa de revisão.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto -mx-1 px-1">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => startFromTemplate(t.id)}
                      className="w-full text-left px-3 py-2 rounded-lg border bg-background hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-all"
                    >
                      <div className="text-sm font-medium truncate">
                        {t.template_name || t.position_title || "Modelo"}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {t.position_title}{t.department && ` • ${t.department}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir?</AlertDialogTitle>
            <AlertDialogDescription>
              O link público deixará de funcionar. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
