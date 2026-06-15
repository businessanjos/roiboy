import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Eye, EyeOff, RefreshCw, Trash2, KeyRound, Loader2, Shuffle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TechProject {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  metrics_endpoint: string | null;
  metrics_token_last4: string | null;
  metrics_token_rotated_at: string | null;
}

function generateToken(prefix: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `roy_${prefix}_${out}`;
}

export function TechProjectsTokensManager() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<TechProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tech_projects")
      .select("id, name, slug, color, metrics_endpoint, metrics_token_last4, metrics_token_rotated_at")
      .order("name");
    if (error) toast({ title: "Erro ao carregar projetos", description: error.message, variant: "destructive" });
    setProjects((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const reveal = async (p: TechProject) => {
    if (revealed[p.id]) {
      setRevealed((r) => {
        const c = { ...r };
        delete c[p.id];
        return c;
      });
      return;
    }
    setBusyId(p.id);
    const { data, error } = await supabase.rpc("tech_projects_reveal_token", { _project_id: p.id });
    setBusyId(null);
    if (error) {
      toast({ title: "Erro ao revelar", description: error.message, variant: "destructive" });
      return;
    }
    if (!data) {
      toast({ title: "Sem token", description: "Este projeto ainda não tem token. Gere um novo." });
      return;
    }
    setRevealed((r) => ({ ...r, [p.id]: data as string }));
  };

  const copy = async (p: TechProject) => {
    let token = revealed[p.id];
    if (!token) {
      const { data, error } = await supabase.rpc("tech_projects_reveal_token", { _project_id: p.id });
      if (error || !data) {
        toast({ title: "Sem token para copiar", variant: "destructive" });
        return;
      }
      token = data as string;
    }
    await navigator.clipboard.writeText(token);
    toast({ title: "Token copiado" });
  };

  const setToken = async (p: TechProject, token: string) => {
    setBusyId(p.id);
    const { error } = await supabase.rpc("tech_projects_set_token", {
      _project_id: p.id,
      _token: token,
    });
    setBusyId(null);
    if (error) {
      toast({ title: "Erro ao salvar token", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Token salvo e criptografado" });
    setRevealed((r) => ({ ...r, [p.id]: token }));
    load();
  };

  const generateAndSet = async (p: TechProject) => {
    const prefix = p.slug.split("-")[0].slice(0, 3) || "prj";
    const token = generateToken(prefix);
    await setToken(p, token);
  };

  const promptManual = async (p: TechProject) => {
    const t = window.prompt(`Colar token manualmente para ${p.name}:`);
    if (!t) return;
    if (t.trim().length < 12) {
      toast({ title: "Token muito curto", variant: "destructive" });
      return;
    }
    await setToken(p, t.trim());
  };

  const clearToken = async (p: TechProject) => {
    if (!window.confirm(`Remover o token de ${p.name}?`)) return;
    setBusyId(p.id);
    const { error } = await supabase.rpc("tech_projects_clear_token", { _project_id: p.id });
    setBusyId(null);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    setRevealed((r) => {
      const c = { ...r };
      delete c[p.id];
      return c;
    });
    toast({ title: "Token removido" });
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" /> Tokens Gestão Tech
        </CardTitle>
        <CardDescription>
          Token usado pelo ROY pra puxar métricas de cada projeto. Criptografado em repouso (AES via pgcrypto).
          Apenas administradores da conta podem ver, gerar ou rotacionar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum projeto cadastrado em /gestao-tech ainda.</p>
        ) : (
          projects.map((p) => {
            const hasToken = !!p.metrics_token_last4;
            const shown = revealed[p.id];
            const busy = busyId === p.id;
            return (
              <div
                key={p.id}
                className="rounded-lg border border-border p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: p.color || "#6366f1" }}
                    />
                    <div className="font-semibold">{p.name}</div>
                    {hasToken ? (
                      <Badge variant="secondary">configurado · …{p.metrics_token_last4}</Badge>
                    ) : (
                      <Badge variant="outline">sem token</Badge>
                    )}
                  </div>
                  {p.metrics_token_rotated_at && (
                    <span className="text-xs text-muted-foreground">
                      rotacionado em{" "}
                      {format(new Date(p.metrics_token_rotated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={shown || (hasToken ? "•".repeat(38) : "")}
                    placeholder="Nenhum token salvo"
                    className="font-mono text-xs"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={!hasToken || busy}
                    onClick={() => reveal(p)}
                    title={shown ? "Ocultar" : "Revelar"}
                  >
                    {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={!hasToken || busy}
                    onClick={() => copy(p)}
                    title="Copiar"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" onClick={() => generateAndSet(p)} disabled={busy}>
                    <Shuffle className="h-4 w-4 mr-1" />
                    {hasToken ? "Rotacionar (gerar novo)" : "Gerar token"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => promptManual(p)} disabled={busy}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Definir manualmente
                  </Button>
                  {hasToken && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => clearToken(p)}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remover
                    </Button>
                  )}
                  {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                {p.metrics_endpoint && (
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    endpoint: {p.metrics_endpoint}
                  </p>
                )}
              </div>
            );
          })
        )}
        <p className="text-xs text-muted-foreground pt-2 border-t border-border">
          Ao rotacionar, copie o novo token e atualize o secret <code>ROY_METRICS_TOKEN</code> no
          projeto correspondente. Tokens antigos param de funcionar imediatamente.
        </p>
      </CardContent>
    </Card>
  );
}
