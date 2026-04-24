import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Link2, Loader2, Shield, ShieldOff, CheckCircle, XCircle, UserPlus, Eye, EyeOff, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ShareDashboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
  dashboardName: string;
}

interface AccessRequest {
  id: string;
  email: string;
  status: string;
  created_at: string;
  request_count: number;
}

// ── External Access Tab ──
function ExternalAccessTab({ dashboardId }: { dashboardId: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const handleCreate = async () => {
    if (!email || !password) {
      toast.error("Preencha email e senha");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setCreating(true);
    try {
      const res = await supabase.functions.invoke("create-external-user", {
        body: { email, password, dashboard_id: dashboardId, name: name || undefined },
      });

      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);

      setCreated(true);
      toast.success("Acesso externo criado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar acesso externo");
    } finally {
      setCreating(false);
    }
  };

  if (created) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Acesso criado!</span>
          </div>
          <p className="text-sm text-green-600">
            Compartilhe as credenciais abaixo com a pessoa que vai acessar o painel:
          </p>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">URL: </span>
              <code className="bg-background px-1 rounded">https://iamroy.app/auth</code>
            </div>
            <div>
              <span className="text-muted-foreground">Email: </span>
              <code className="bg-background px-1 rounded">{email}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Senha: </span>
              <code className="bg-background px-1 rounded">{password}</code>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setCreated(false);
            setEmail("");
            setPassword("");
            setName("");
          }}
        >
          Criar outro acesso
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Crie uma conta com email e senha para dar acesso <strong>somente leitura</strong> a este painel. Os dados serão idênticos aos seus.
      </p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="ext-name">Nome (opcional)</Label>
          <Input
            id="ext-name"
            placeholder="Ex: Agência XYZ"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ext-email">Email</Label>
          <Input
            id="ext-email"
            type="email"
            placeholder="agencia@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ext-password">Senha</Label>
          <div className="relative">
            <Input
              id="ext-password"
              type={showPassword ? "text" : "password"}
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <Button onClick={handleCreate} disabled={creating} className="w-full">
        {creating ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</>
        ) : (
          <><UserPlus className="h-4 w-4 mr-2" /> Criar Acesso Externo</>
        )}
      </Button>
    </div>
  );
}

// ── Share Link Tab (existing functionality) ──
function ShareLinkTab({ dashboardId, dashboardName }: { dashboardId: string; dashboardName: string }) {
  const { currentUser } = useCurrentUser();
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchShare = useCallback(async () => {
    if (!currentUser || !dashboardId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("insights_dashboard_shares")
        .select("id, share_token, is_active")
        .eq("dashboard_id", dashboardId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setShareToken(data.share_token);
        setShareId(data.id);
        setIsActive(data.is_active);
      } else {
        setShareToken(null);
        setShareId(null);
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser, dashboardId]);

  const fetchRequests = useCallback(async () => {
    if (!shareId) return;
    setLoadingRequests(true);
    try {
      const { data } = await supabase
        .from("insights_share_access_requests")
        .select("id, email, status, created_at, request_count")
        .eq("share_id", shareId)
        .order("created_at", { ascending: false });
      setRequests(data || []);
    } finally {
      setLoadingRequests(false);
    }
  }, [shareId]);

  useEffect(() => { fetchShare(); }, [fetchShare]);
  useEffect(() => { if (shareId) fetchRequests(); }, [shareId, fetchRequests]);
  useEffect(() => {
    if (!shareId) return;
    const interval = setInterval(fetchRequests, 15000);
    return () => clearInterval(interval);
  }, [shareId, fetchRequests]);

  const createShareLink = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const token = crypto.randomUUID();
      const { data, error } = await supabase
        .from("insights_dashboard_shares")
        .insert({
          dashboard_id: dashboardId,
          account_id: currentUser.account_id,
          share_token: token,
          created_by: currentUser.id,
        })
        .select("id, share_token")
        .single();

      if (error) throw error;
      setShareToken(data.share_token);
      setShareId(data.id);
      setIsActive(true);
      toast.success("Link de compartilhamento criado!");
    } catch {
      toast.error("Erro ao criar link");
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async () => {
    if (!shareId) return;
    const newActive = !isActive;
    await supabase
      .from("insights_dashboard_shares")
      .update({ is_active: newActive })
      .eq("id", shareId);
    setIsActive(newActive);
    toast.success(newActive ? "Link reativado" : "Link desativado");
  };

  const regenerateLink = async () => {
    if (!shareId || !currentUser) return;
    setLoading(true);
    try {
      const newToken = crypto.randomUUID();
      const { error } = await supabase
        .from("insights_dashboard_shares")
        .update({ share_token: newToken, is_active: true })
        .eq("id", shareId);
      if (error) throw error;

      // Apaga solicitações antigas para que os e-mails antes recusados/aprovados possam solicitar acesso novamente
      await supabase
        .from("insights_share_access_requests")
        .delete()
        .eq("share_id", shareId);

      setShareToken(newToken);
      setIsActive(true);
      setRequests([]);
      toast.success("Novo link gerado! O link anterior foi invalidado.");
    } catch {
      toast.error("Erro ao gerar novo link");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!shareToken) return;
    const url = `https://iamroy.app/shared/insights/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copiado!");
  };

  const handleAction = async (requestId: string, action: "approve" | "reject") => {
    setProcessingId(requestId);
    try {
      const res = await supabase.functions.invoke("manage-share-access", {
        body: { request_id: requestId, action },
      });
      if (res.error) throw res.error;
      toast.success(action === "approve" ? "Acesso liberado!" : "Acesso recusado");
      fetchRequests();
    } catch {
      toast.error("Erro ao processar solicitação");
    } finally {
      setProcessingId(null);
    }
  };

  const shareUrl = shareToken ? `https://iamroy.app/shared/insights/${shareToken}` : "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Link público com aprovação de acesso. <strong>Atenção:</strong> os dados podem divergir do painel original.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !shareToken ? (
        <Button onClick={createShareLink} className="w-full">
          <Link2 className="h-4 w-4 mr-2" />
          Gerar Link de Compartilhamento
        </Button>
      ) : (
        <>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono truncate overflow-hidden min-w-0">
              {shareUrl}
            </div>
            <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); copyLink(); }} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              {isActive ? (
                <Badge variant="default" className="bg-green-600">Ativo</Badge>
              ) : (
                <Badge variant="secondary">Desativado</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={loading}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Gerar novo link
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Gerar novo link de compartilhamento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O link atual será <strong>invalidado imediatamente</strong> e qualquer pessoa que já o tenha não conseguirá mais acessar o painel. Todas as solicitações de acesso anteriores serão apagadas, permitindo que e-mails recusados solicitem acesso novamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={regenerateLink}>
                      Sim, gerar novo link
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="ghost" size="sm" onClick={toggleActive}>
                {isActive ? (
                  <><ShieldOff className="h-4 w-4 mr-1" /> Desativar</>
                ) : (
                  <><Shield className="h-4 w-4 mr-1" /> Reativar</>
                )}
              </Button>
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-medium mb-2">Solicitações de Acesso</h4>
            {loadingRequests ? (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhuma solicitação de acesso ainda.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {requests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {req.email}
                        {req.request_count > 1 && (
                          <span className="ml-1 text-xs text-muted-foreground font-normal">({req.request_count}x)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {req.status === "pending" && "Aguardando"}
                        {req.status === "approved" && "Liberado"}
                        {req.status === "rejected" && "Recusado"}
                      </p>
                    </div>
                    {req.status === "pending" && (
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handleAction(req.id, "approve")}
                          disabled={processingId === req.id}
                        >
                          {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-red-50"
                          onClick={() => handleAction(req.id, "reject")}
                          disabled={processingId === req.id}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {req.status === "approved" && (
                      <div className="flex items-center gap-1 ml-2">
                        <Badge variant="outline" className="text-green-600 border-green-200">Liberado</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-40 hover:opacity-100 text-destructive hover:text-destructive hover:bg-red-50"
                          onClick={() => handleAction(req.id, "reject")}
                          disabled={processingId === req.id}
                        >
                          {processingId === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                        </Button>
                      </div>
                    )}
                    {req.status === "rejected" && (
                      <Badge variant="outline" className="text-destructive border-red-200">Recusado</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Modal ──
export function ShareDashboardModal({ open, onOpenChange, dashboardId, dashboardName }: ShareDashboardModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Compartilhar "{dashboardName}"
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="external" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="external" className="flex-1">
              <UserPlus className="h-4 w-4 mr-1" /> Acesso Externo
            </TabsTrigger>
            <TabsTrigger value="link" className="flex-1">
              <Link2 className="h-4 w-4 mr-1" /> Link Público
            </TabsTrigger>
          </TabsList>

          <TabsContent value="external" className="mt-4">
            <ExternalAccessTab dashboardId={dashboardId} />
          </TabsContent>

          <TabsContent value="link" className="mt-4">
            <ShareLinkTab dashboardId={dashboardId} dashboardName={dashboardName} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
