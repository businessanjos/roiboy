import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  Brain,
  Copy,
  ArrowRight,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { OnboardingClient, OnboardingStage, computeHealth, daysInStage } from "@/hooks/useOnboardingHub";
import { useOnboardingCoach, CoachInsight } from "@/hooks/useOnboardingCoach";

interface Props {
  client: OnboardingClient | null;
  stage: OnboardingStage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRIORITY_STYLES: Record<CoachInsight["priority"], { label: string; className: string }> = {
  urgent: { label: "URGENTE", className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" },
  high: { label: "ALTA", className: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30" },
  medium: { label: "MÉDIA", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  low: { label: "BAIXA", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
};

function HealthBadge({ client, stage }: { client: OnboardingClient; stage: OnboardingStage | null }) {
  const health = computeHealth(client.stage_changed_at, stage?.sla_hours ?? null);
  const days = daysInStage(client.stage_changed_at);
  const styles = {
    on_track: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    at_risk: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    overdue: "bg-red-500/15 text-red-600 dark:text-red-400",
    no_sla: "bg-muted text-muted-foreground",
  } as const;
  const label = {
    on_track: "No prazo",
    at_risk: "Em risco",
    overdue: "Atrasado",
    no_sla: "Sem SLA",
  }[health];
  return (
    <Badge variant="outline" className={`${styles[health]} border-0 gap-1`}>
      <Clock className="h-3 w-3" />
      {label} • {days}d na etapa
    </Badge>
  );
}

export function ClientOnboardingDrawer({ client, stage, open, onOpenChange }: Props) {
  const { insight, loading, ask, setInsight } = useOnboardingCoach();
  const [tab, setTab] = useState("coach");

  // Carrega insight ao abrir (usa cache da edge function)
  useEffect(() => {
    if (open && client?.id) {
      // Se já tem cache no client, hidrata sem chamar
      if (client.ai_next_step) {
        try {
          setInsight({ ...JSON.parse(client.ai_next_step), cached: true });
        } catch {
          ask(client.id, "next_step");
        }
      } else {
        ask(client.id, "next_step");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client?.id]);

  if (!client) return null;

  const productName = client.client_products?.[0]?.products?.name;
  const productColor = client.client_products?.[0]?.products?.color || "#6b7280";
  const initials = client.full_name?.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
  const photoUrl = client.logo_url || client.avatar_url || undefined;

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Mensagem copiada!");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto p-0">
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b sticky top-0 bg-background z-10">
          <div className="flex items-start gap-3">
            <Avatar className="h-14 w-14">
              <AvatarImage src={photoUrl} />
              <AvatarFallback className="text-base">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="truncate text-left">{client.full_name}</SheetTitle>
              {client.company_name && (
                <p className="text-xs text-muted-foreground truncate">{client.company_name}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {productName && (
                  <Badge style={{ backgroundColor: `${productColor}20`, color: productColor, borderColor: `${productColor}40` }} variant="outline">
                    {productName}
                  </Badge>
                )}
                <HealthBadge client={client} stage={stage} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link to={`/clients/${client.id}`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir cliente
              </Link>
            </Button>
            {client.phone_e164 && (
              <Button variant="outline" size="sm" asChild>
                <a href={`https://wa.me/${client.phone_e164.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
                </a>
              </Button>
            )}
          </div>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="px-6 pt-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="coach" className="gap-1.5">
              <Brain className="h-3.5 w-3.5" /> Coach IA
            </TabsTrigger>
            <TabsTrigger value="risks" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Riscos
            </TabsTrigger>
            <TabsTrigger value="message" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Mensagem
            </TabsTrigger>
          </TabsList>

          <TabsContent value="coach" className="mt-4 space-y-4">
            {loading && !insight ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : insight ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={PRIORITY_STYLES[insight.priority].className}>
                    Prioridade: {PRIORITY_STYLES[insight.priority].label}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => ask(client.id, "next_step", true)}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                </div>

                <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-primary uppercase tracking-wider">
                    <Sparkles className="h-3.5 w-3.5" /> Próximo passo
                  </div>
                  <p className="text-sm font-medium leading-relaxed">{insight.next_action}</p>
                </div>

                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Por quê</p>
                  <p className="text-sm leading-relaxed">{insight.why}</p>
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" />
                  Confiança {Math.round(insight.confidence * 100)}% • {insight.cached ? "cache 24h" : "gerado agora"}
                </div>
              </motion.div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem sugestão disponível.</p>
            )}
          </TabsContent>

          <TabsContent value="risks" className="mt-4 space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => ask(client.id, "risk_analysis", true)}
              disabled={loading}
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              Reanalisar riscos
            </Button>
            {insight?.risks?.length ? (
              <div className="space-y-2">
                {insight.risks.map((risk, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 p-3"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-sm leading-relaxed">{risk}</p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum risco crítico detectado. <CheckCircle2 className="inline h-4 w-4 text-emerald-500" />
              </p>
            )}
          </TabsContent>

          <TabsContent value="message" className="mt-4 space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => ask(client.id, "welcome_message", true)}
              disabled={loading}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Gerar nova mensagem
            </Button>
            {insight?.suggested_message ? (
              <div className="space-y-2">
                <div className="rounded-xl border bg-card p-4 whitespace-pre-wrap text-sm leading-relaxed">
                  {insight.suggested_message}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyMessage(insight.suggested_message)} className="flex-1">
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
                  </Button>
                  {client.phone_e164 && (
                    <Button size="sm" asChild className="flex-1">
                      <a
                        href={`https://wa.me/${client.phone_e164.replace(/\D/g, "")}?text=${encodeURIComponent(insight.suggested_message)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ArrowRight className="h-3.5 w-3.5 mr-1.5" /> Enviar
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Clique em "Gerar nova mensagem" para criar uma versão personalizada.
              </p>
            )}
          </TabsContent>
        </Tabs>

        {/* Etapa atual info */}
        {stage && (
          <div className="px-6 mt-6 mb-6">
            <div className="rounded-lg border p-3 space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Etapa atual</div>
              <div className="font-medium text-sm">{stage.name}</div>
              {stage.description && (
                <p className="text-xs text-muted-foreground">{stage.description}</p>
              )}
              {stage.sla_hours && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  SLA: {stage.sla_hours}h ({Math.round(stage.sla_hours / 24)}d)
                </p>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
