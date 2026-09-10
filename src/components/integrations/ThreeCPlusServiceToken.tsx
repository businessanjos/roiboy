import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Save, ShieldCheck, Trash2 } from "lucide-react";

interface Props {
  domain?: string | null;
  onChanged?: () => void;
}

type Role = "agent" | "manager";

export function ThreeCPlusServiceToken({ domain, onChanged }: Props) {
  const [agentToken, setAgentToken] = useState("");
  const [managerToken, setManagerToken] = useState("");
  const [agentConfigured, setAgentConfigured] = useState(false);
  const [managerConfigured, setManagerConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<Role | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("threecplus-auth", { body: { action: "status" } });
      setAgentConfigured(Boolean(data?.agent_token_configured));
      setManagerConfigured(Boolean(data?.manager_token_configured));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSave = async (role: Role) => {
    const value = (role === "agent" ? agentToken : managerToken).trim();
    if (!value) {
      toast.error("Cole o token de serviço da 3C Plus.");
      return;
    }
    setSavingRole(role);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-auth", {
        body: { action: "set_service_token", role, service_token: value, domain: domain || null },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error("Não foi possível validar o token", { description: data?.error });
        return;
      }
      if (role === "agent") {
        setAgentToken("");
        setAgentConfigured(true);
      } else {
        setManagerToken("");
        setManagerConfigured(true);
      }
      if (data?.warning) toast.warning("Token salvo", { description: data.warning });
      else toast.success("Token de serviço salvo e validado na 3C Plus.");
      onChanged?.();
    } catch (err: any) {
      toast.error("Erro ao salvar token de serviço", { description: err?.message });
    } finally {
      setSavingRole(null);
    }
  };

  const handleClear = async (role: Role) => {
    setSavingRole(role);
    try {
      await supabase.functions.invoke("threecplus-auth", { body: { action: "clear_service_token", role } });
      if (role === "agent") setAgentConfigured(false);
      else setManagerConfigured(false);
      toast.success("Token removido.");
      onChanged?.();
    } finally {
      setSavingRole(null);
    }
  };

  const field = (role: Role) => {
    const configured = role === "agent" ? agentConfigured : managerConfigured;
    const value = role === "agent" ? agentToken : managerToken;
    const setValue = role === "agent" ? setAgentToken : setManagerToken;

    return (
      <div className="space-y-2 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`service-token-${role}`} className="text-sm font-medium">
            {role === "agent" ? "Token de serviço — Agente" : "Token de serviço — Gestor"}
          </Label>
          {configured ? (
            <Badge variant="default">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Configurado
            </Badge>
          ) : (
            <Badge variant="secondary">
              <AlertTriangle className="mr-1 h-3 w-3" /> Não configurado
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {role === "agent"
            ? "Usado para discar, atender e encerrar ligações em nome de cada pessoa da equipe."
            : "Usado para listar os agentes da 3C e trazer o relatório completo de ligações."}
        </p>
        <Input
          id={`service-token-${role}`}
          type="password"
          className="font-mono text-sm"
          placeholder={configured ? "Token salvo — cole um novo para substituir" : "3cs_..."}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => handleSave(role)} disabled={savingRole === role || !value.trim()}>
            {savingRole === role ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
          {configured && (
            <Button size="sm" variant="outline" onClick={() => handleClear(role)} disabled={savingRole === role}>
              <Trash2 className="mr-2 h-4 w-4" /> Remover
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Tokens de serviço (conta)</CardTitle>
              <CardDescription>
                Gere em Config. &gt; Integração &gt; Tokens de serviço, no painel da 3C Plus. Os tokens ficam guardados
                com segurança e nunca aparecem nesta tela. Tokens individuais serão descontinuados em 01/10/2026.
              </CardDescription>
            </div>
          </div>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : agentConfigured && managerConfigured ? (
            <Badge variant="default">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Tokens de serviço ativos
            </Badge>
          ) : (
            <Badge variant="secondary">
              <AlertTriangle className="mr-1 h-3 w-3" /> Configuração incompleta
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {field("agent")}
        {field("manager")}
      </CardContent>
    </Card>
  );
}
