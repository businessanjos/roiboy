import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Copy,
  Link2,
  Plus,
  Loader2,
  Trash2,
  RefreshCw,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function generateToken() {
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 28);
}

export function ShareIncentivePlanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();

  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [creating, setCreating] = useState(false);

  const linksQuery = useQuery({
    queryKey: ["incentive-share-links", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incentive_plan_share_links")
        .select("*")
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!accountId && open,
  });

  const createLink = async () => {
    if (!accountId) return;
    setCreating(true);
    try {
      const token = generateToken();
      const expires_at =
        expiresInDays > 0
          ? new Date(Date.now() + expiresInDays * 24 * 3600 * 1000).toISOString()
          : null;
      const { error } = await supabase.from("incentive_plan_share_links").insert({
        account_id: accountId,
        token,
        label: label.trim() || null,
        expires_at,
        created_by: currentUser?.id ?? null,
        is_active: true,
      });
      if (error) throw error;
      setLabel("");
      toast.success("Link público criado");
      queryClient.invalidateQueries({ queryKey: ["incentive-share-links", accountId] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao criar link");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    const { error } = await supabase
      .from("incentive_plan_share_links")
      .update({ is_active: false })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Link revogado");
      queryClient.invalidateQueries({ queryKey: ["incentive-share-links", accountId] });
    }
  };

  const reactivate = async (id: string) => {
    const { error } = await supabase
      .from("incentive_plan_share_links")
      .update({ is_active: true })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Link reativado");
      queryClient.invalidateQueries({ queryKey: ["incentive-share-links", accountId] });
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase
      .from("incentive_plan_share_links")
      .delete()
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Link removido");
      queryClient.invalidateQueries({ queryKey: ["incentive-share-links", accountId] });
    }
  };

  const PUBLIC_BASE_URL = "https://iamroy.app";
  const buildUrl = (token: string) =>
    `${PUBLIC_BASE_URL}/external/incentive-plan/${token}`;

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(buildUrl(token));
    toast.success("Link copiado");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Compartilhar Plano de Incentivo externamente
          </DialogTitle>
          <DialogDescription>
            Gere um link público para alguém de fora ver a apresentação e simular ganhos —
            sem precisar de login. Você pode revogar a qualquer momento.
          </DialogDescription>
        </DialogHeader>

        <Card className="p-4 space-y-3 bg-muted/30">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Identificação (opcional)</Label>
              <Input
                placeholder="Ex: João da consultoria"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expira em (dias)</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value || 0))}
              />
              <p className="text-[10px] text-muted-foreground">
                0 = sem expiração
              </p>
            </div>
          </div>
          <Button onClick={createLink} disabled={creating} className="w-full gap-1.5">
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Gerar novo link
          </Button>
        </Card>

        <div className="space-y-2 max-h-[360px] overflow-y-auto">
          {linksQuery.isLoading ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
              Carregando…
            </div>
          ) : linksQuery.data && linksQuery.data.length > 0 ? (
            linksQuery.data.map((l: any) => {
              const expired = l.expires_at && new Date(l.expires_at) < new Date();
              return (
                <Card
                  key={l.id}
                  className="p-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {l.label || "Sem identificação"}
                      </span>
                      {!l.is_active ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Revogado
                        </Badge>
                      ) : expired ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Expirado
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Ativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate font-mono">
                      {buildUrl(l.token)}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {l.view_count} acesso(s)
                      </span>
                      {l.expires_at && (
                        <span>
                          Expira{" "}
                          {format(new Date(l.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                      <span>
                        Criado{" "}
                        {format(new Date(l.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copy(l.token)}
                      title="Copiar link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {l.is_active ? (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-amber-600"
                        onClick={() => revoke(l.id)}
                        title="Revogar"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-emerald-600"
                        onClick={() => reactivate(l.id)}
                        title="Reativar"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => remove(l.id)}
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Nenhum link criado ainda.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
