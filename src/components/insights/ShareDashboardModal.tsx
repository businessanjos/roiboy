import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Link2, Loader2, Shield, ShieldOff, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

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
}

export function ShareDashboardModal({ open, onOpenChange, dashboardId, dashboardName }: ShareDashboardModalProps) {
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
        .select("id, email, status, created_at")
        .eq("share_id", shareId)
        .order("created_at", { ascending: false });
      setRequests(data || []);
    } finally {
      setLoadingRequests(false);
    }
  }, [shareId]);

  useEffect(() => {
    if (open) fetchShare();
  }, [open, fetchShare]);

  useEffect(() => {
    if (shareId) fetchRequests();
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

  const copyLink = async () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/shared/insights/${shareToken}`;
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
      const { data: { session } } = await supabase.auth.getSession();
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

  const shareUrl = shareToken ? `${window.location.origin}/shared/insights/${shareToken}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Compartilhar Painel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-x-hidden">
          <p className="text-sm text-muted-foreground">
            Gere um link para compartilhar o painel <strong>"{dashboardName}"</strong> em modo somente leitura. O acesso requer sua aprovação.
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
              {/* Link display */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono truncate overflow-hidden min-w-0">
                  {shareUrl}
                </div>
                <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); copyLink(); }} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              {/* Status toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  {isActive ? (
                    <Badge variant="default" className="bg-green-600">Ativo</Badge>
                  ) : (
                    <Badge variant="secondary">Desativado</Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={toggleActive}>
                  {isActive ? (
                    <><ShieldOff className="h-4 w-4 mr-1" /> Desativar</>
                  ) : (
                    <><Shield className="h-4 w-4 mr-1" /> Reativar</>
                  )}
                </Button>
              </div>

              {/* Access requests */}
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
                          <p className="text-sm font-medium truncate">{req.email}</p>
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
                              {processingId === req.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
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
                          <Badge variant="outline" className="text-green-600 border-green-200">Liberado</Badge>
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
      </DialogContent>
    </Dialog>
  );
}
