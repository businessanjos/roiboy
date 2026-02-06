import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Key, Copy, RefreshCw, Trash2, AlertTriangle, Check, Eye, EyeOff, Shield, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ApiKeyHistoryTable } from "./ApiKeyHistoryTable";

interface ApiKeyTabProps {
  userId: string;
  accountId: string;
}

// Generate a secure API key
const generateApiKey = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const randomPart = Array.from(
    crypto.getRandomValues(new Uint8Array(32))
  ).map(n => chars[n % chars.length]).join('');
  return `roy_sk_${randomPart}`;
};

// Hash the key using SHA-256
const hashKey = async (key: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

// Create preview from key
const createPreview = (key: string): string => {
  return `${key.slice(0, 10)}...${key.slice(-4)}`;
};

export function ApiKeyTab({ userId, accountId }: ApiKeyTabProps) {
  const queryClient = useQueryClient();
  const [newKeyDialog, setNewKeyDialog] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch existing API key
  const { data: apiKey, isLoading } = useQuery({
    queryKey: ["api-key", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Generate new key mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const newKey = generateApiKey();
      const keyHash = await hashKey(newKey);
      const keyPreview = createPreview(newKey);

      // Delete existing key if any
      await supabase
        .from("api_keys")
        .delete()
        .eq("user_id", userId);

      // Insert new key
      const { error } = await supabase
        .from("api_keys")
        .insert({
          user_id: userId,
          account_id: accountId,
          key_hash: keyHash,
          key_preview: keyPreview,
          name: "API Key Principal",
          is_active: true,
        });

      if (error) throw error;
      return newKey;
    },
    onSuccess: (newKey) => {
      setGeneratedKey(newKey);
      setNewKeyDialog(true);
      queryClient.invalidateQueries({ queryKey: ["api-key", userId] });
      toast.success("Nova chave de API gerada!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao gerar chave de API");
    },
  });

  // Revoke key mutation
  const revokeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("api_keys")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-key", userId] });
      queryClient.invalidateQueries({ queryKey: ["api-key-logs"] });
      toast.success("Chave de API revogada!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao revogar chave de API");
    },
  });

  const handleCopyKey = async () => {
    if (!generatedKey) return;
    
    try {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      toast.success("Chave copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar chave");
    }
  };

  const handleCloseNewKeyDialog = () => {
    setNewKeyDialog(false);
    setGeneratedKey(null);
    setCopied(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* API Key Management Card */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Chave de API</CardTitle>
          </div>
          <CardDescription>
            Use esta chave para autenticar integrações externas com permissões de Admin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKey ? (
            <div className="space-y-4">
              {/* Current Key Info */}
              <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Sua Chave Atual</span>
                  </div>
                  <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-200">
                    Ativa
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-sm bg-background px-3 py-2 rounded border flex items-center justify-between">
                    <span>{showPreview ? apiKey.key_preview : "••••••••••••••••"}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>
                    Criada em: {format(new Date(apiKey.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                  {apiKey.last_used_at && (
                    <span>
                      Último uso: {format(new Date(apiKey.last_used_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-2 p-3 rounded bg-amber-500/10 border border-amber-200 text-amber-700 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>A chave completa foi exibida apenas no momento da criação.</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Gerar Nova Chave
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Gerar nova chave?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso irá revogar sua chave atual. Qualquer integração usando a chave antiga
                        deixará de funcionar imediatamente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => generateMutation.mutate()}
                        disabled={generateMutation.isPending}
                      >
                        {generateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Gerar Nova Chave
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      Revogar Chave
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revogar chave de API?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Todas as integrações que usam esta chave
                        deixarão de funcionar imediatamente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => revokeMutation.mutate()}
                        disabled={revokeMutation.isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {revokeMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Revogar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Key className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium">Nenhuma chave ativa</h3>
                <p className="text-sm text-muted-foreground">
                  Gere uma chave para começar a usar a API
                </p>
              </div>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="gap-2"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Key className="h-4 w-4" />
                )}
                Gerar Chave de API
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Table */}
      {apiKey && <ApiKeyHistoryTable apiKeyId={apiKey.id} />}

      {/* New Key Generated Dialog */}
      <Dialog open={newKeyDialog} onOpenChange={handleCloseNewKeyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              Chave Gerada com Sucesso!
            </DialogTitle>
            <DialogDescription>
              Copie sua chave agora. Ela não será exibida novamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded bg-amber-500/10 border border-amber-200 text-amber-700 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>ATENÇÃO:</strong> Esta chave só será exibida UMA VEZ. 
                Após fechar este dialog, você não poderá visualizá-la novamente.
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={generatedKey || ""}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyKey}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="p-3 rounded bg-muted text-sm space-y-1">
              <p className="font-medium">Como usar:</p>
              <code className="text-xs block bg-background p-2 rounded border">
                Authorization: Bearer {generatedKey?.slice(0, 15)}...
              </code>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleCloseNewKeyDialog} className="w-full">
              Entendi e Copiei
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
