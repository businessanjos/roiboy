import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Loader2, Save, User, Phone, Eye, EyeOff } from "lucide-react";

export function ThreeCPlusAgentConfig() {
  const { currentUser } = useCurrentUser();
  const [extension, setExtension] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.id) loadConfig();
  }, [currentUser?.id]);

  const loadConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_integrations")
      .select("id, metadata")
      .eq("user_id", currentUser!.id)
      .eq("provider", "3cplus")
      .maybeSingle();

    if (data) {
      setExistingId(data.id);
      const meta = data.metadata as Record<string, unknown> | null;
      setExtension((meta?.extension as string) || "");
      setPassword((meta?.extension_password as string) || "");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!currentUser?.id) return;
    const trimmedExt = extension.trim();
    const trimmedPass = password.trim();

    if (!trimmedExt) {
      toast.error("Informe o número do ramal.");
      return;
    }

    setSaving(true);
    try {
      const metadata = {
        extension: trimmedExt,
        extension_password: trimmedPass || null,
      };

      if (existingId) {
        const { error } = await supabase
          .from("user_integrations")
          .update({ metadata } as any)
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("user_integrations")
          .insert({
            user_id: currentUser.id,
            provider: "3cplus",
            metadata,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        setExistingId(data.id);
      }

      toast.success("Ramal salvo com sucesso!", {
        description: `Ramal ${trimmedExt} configurado para ligações diretas.`,
      });
    } catch (err: any) {
      console.error("[ThreeCPlusAgentConfig] Save error:", err);
      toast.error("Erro ao salvar ramal", {
        description: err.message || "Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <User className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-base">Meu Ramal — Click-to-Call</CardTitle>
            <CardDescription>
              Configure seu ramal e senha para fazer ligações diretas sem campanha
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="agent-extension">
              <Phone className="h-3.5 w-3.5 inline mr-1.5" />
              Número do Ramal
            </Label>
            <Input
              id="agent-extension"
              placeholder="Ex: 1001"
              value={extension}
              onChange={(e) => setExtension(e.target.value)}
              maxLength={20}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-password">Senha do Ramal</Label>
            <div className="relative">
              <Input
                id="agent-password"
                type={showPassword ? "text" : "password"}
                placeholder="Senha do seu ramal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={50}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground max-w-md">
            Esses dados são usados pelo botão de ligação no RoyZapp e no pipeline para discar direto, sem precisar de campanha ativa.
          </p>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Salvar Ramal</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
