import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Loader2,
  LogOut,
  Phone,
  Save,
  XCircle,
} from "lucide-react";

type Role = "agent" | "manager";

interface Props {
  integration: { id: string; status: string; config: Record<string, unknown> | null } | null;
  isAdmin: boolean;
  onChanged: () => void;
}

export function ThreeCPlusConnectionCard({ integration, isAdmin, onChanged }: Props) {
  const connected = integration?.status === "connected";
  const [domain, setDomain] = useState("");
  const [connectToken, setConnectToken] = useState("");
  const [busy, setBusy] = useState(false);

  const [tokens, setTokens] = useState<Record<Role, string>>({ agent: "", manager: "" });
  const [configured, setConfigured] = useState<Record<Role, boolean>>({ agent: false, manager: false });
  const [savingRole, setSavingRole] = useState<Role | null>(null);
  const [legacyTokensInUse, setLegacyTokensInUse] = useState(false);

  useEffect(() => {
    setDomain(((integration?.config as any)?.domain as string) || "");
  }, [integration?.id, (integration?.config as any)?.domain]);

  const loadStatus = async () => {
    const [{ data: status }, { data: links }] = await Promise.all([
      supabase.functions.invoke("threecplus-auth", { body: { action: "status" } }),
      supabase.functions.invoke("threecplus-register-agent", { body: { action: "list_links" } }),
    ]);
    setConfigured({
      agent: Boolean(status?.agent_token_configured),
      manager: Boolean(status?.manager_token_configured),
    });
    setLegacyTokensInUse(!status?.agent_token_configured && Boolean(links?.links?.length));
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const saveDomain = async () => {
    if (!integration) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("integrations")
        .update({ config: { ...((integration.config as any) || {}), domain: domain.trim() || null } })
        .eq("id", integration.id);
      if (error) throw error;
      toast.success("Domínio atualizado.");
      onChanged();
    } catch (err: any) {
      toast.error("Erro ao salvar domínio", { description: err?.message });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!integration) return;
    const { error } = await supabase
      .from("integrations")
      .update({ status: "disconnected" as any, config: null })
      .eq("id", integration.id);
    if (error) toast.error("Não foi possível desconectar.");
    else {
      toast.success("3C Plus desconectada.");
      onChanged();
    }
  };

  const connect = async () => {
    if (!connectToken.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-auth", {
        body: { api_token: connectToken.trim(), domain: domain.trim() || null },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error("Não foi possível conectar", { description: data.error });
        return;
      }
      setConnectToken("");
      toast.success("3C Plus conectada.");
      onChanged();
    } catch (err: any) {
      toast.error("Falha ao conectar", { description: err?.message });
    } finally {
      setBusy(false);
    }
  };

  const saveServiceToken = async (role: Role) => {
    const value = tokens[role].trim();
    if (!value) return;
    setSavingRole(role);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-auth", {
        body: { action: "set_service_token", role, service_token: value, domain: domain.trim() || null },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error("Não foi possível validar o token", { description: data?.error });
        return;
      }
      setTokens((p) => ({ ...p, [role]: "" }));
      setConfigured((p) => ({ ...p, [role]: true }));
      if (data?.warning) toast.warning("Token salvo", { description: data.warning });
      else toast.success("Token de serviço salvo e validado.");
      onChanged();
    } catch (err: any) {
      toast.error("Erro ao salvar token", { description: err?.message });
    } finally {
      setSavingRole(null);
    }
  };

  const tokenRow = (role: Role, label: string) => (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex w-full items-center gap-2 sm:w-[260px]">
        <Label htmlFor={`svc-${role}`} className="text-sm">
          {label}
        </Label>
        {configured[role] ? (
          <Badge variant="default" className="text-[10px]">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Configurado
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            Não configurado
          </Badge>
        )}
      </div>
      <Input
        id={`svc-${role}`}
        type="password"
        className="font-mono text-sm"
        placeholder={configured[role] ? "Token salvo — cole um novo para substituir" : "3cs_..."}
        value={tokens[role]}
        onChange={(e) => setTokens((p) => ({ ...p, [role]: e.target.value }))}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => saveServiceToken(role)}
        disabled={savingRole === role || !tokens[role].trim()}
      >
        {savingRole === role ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        <span className="ml-1.5">Salvar</span>
      </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Phone className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="flex items-center gap-2 text-base">
            Conexão 3C Plus
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Cada pessoa disca pelo ROY com o ramal e a senha cadastrados abaixo. O painel flutuante da 3C
                  também abre com esse mesmo ramal.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
          {connected ? (
            <Badge variant="default">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Conectado
            </Badge>
          ) : (
            <Badge variant="secondary">
              <XCircle className="mr-1 h-3 w-3" /> Desconectado
            </Badge>
          )}
          <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
            {domain || "https://eternumentoringclub1.3c.plus"}
          </span>
          {connected && (
            <Button variant="outline" size="sm" onClick={disconnect}>
              <LogOut className="mr-2 h-4 w-4" /> Desconectar
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Label htmlFor="tc-domain" className="text-sm sm:w-[260px]">
            Domínio
          </Label>
          <Input
            id="tc-domain"
            className="font-mono text-sm"
            placeholder="https://suaempresa.3c.plus"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          {connected ? (
            <Button size="sm" variant="outline" onClick={saveDomain} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="ml-1.5">Salvar</span>
            </Button>
          ) : null}
        </div>

        {!connected && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Label htmlFor="tc-connect" className="text-sm sm:w-[260px]">
              Token da conta
            </Label>
            <Input
              id="tc-connect"
              type="password"
              className="font-mono text-sm"
              placeholder="Cole o token da 3C Plus"
              value={connectToken}
              onChange={(e) => setConnectToken(e.target.value)}
            />
            <Button size="sm" onClick={connect} disabled={busy || !connectToken.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              <span className="ml-1.5">Conectar</span>
            </Button>
          </div>
        )}

        {isAdmin && (
          <div className="space-y-3 border-t border-border pt-4">
            {tokenRow("agent", "Token de serviço — Agente")}
            {tokenRow("manager", "Token de serviço — Gestor")}
            <p className="text-xs text-muted-foreground">
              Gere em Config. &gt; Integração &gt; Tokens de serviço na 3C.
              {legacyTokensInUse && " Tokens individuais deixam de funcionar em 01/10/2026."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
