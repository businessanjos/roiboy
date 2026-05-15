import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export function ZappPreferencesCard() {
  const { currentUser } = useCurrentUser();
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("zapp_signature_enabled")
        .eq("id", currentUser.id)
        .single();
      if (active) {
        setEnabled((data as any)?.zapp_signature_enabled !== false);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [currentUser?.id]);

  const handleToggle = async (value: boolean) => {
    if (!currentUser?.id) return;
    setEnabled(value);
    setSaving(true);
    const { error } = await supabase
      .from("users")
      .update({ zapp_signature_enabled: value } as any)
      .eq("id", currentUser.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar preferência");
      setEnabled(!value);
    } else {
      toast.success(value ? "Assinatura ligada" : "Assinatura desligada");
    }
  };

  const sampleName = currentUser?.name || "Seu Nome";

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" /> Preferências do RoyZapp
        </CardTitle>
        <CardDescription>Como o cliente vê suas mensagens no WhatsApp</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="signature-toggle" className="text-base font-medium cursor-pointer">
              Assinatura no topo das mensagens
            </Label>
            <p className="text-sm text-muted-foreground">
              Adiciona seu nome no início de cada mensagem enviada para que o cliente saiba com quem está falando.
            </p>
          </div>
          <Switch
            id="signature-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={loading || saving}
          />
        </div>
        <div className="rounded-lg bg-muted/40 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Como o cliente verá:</p>
          <div className="rounded-md bg-background border p-3 text-sm whitespace-pre-line font-mono">
            {enabled ? `*${sampleName} | Eternum*\nOlá! Como posso te ajudar hoje?` : "Olá! Como posso te ajudar hoje?"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
