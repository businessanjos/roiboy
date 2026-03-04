import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageSquare, ClipboardList, AtSign, AlertTriangle, Settings2 } from "lucide-react";

interface Preferences {
  notify_zapp_messages: boolean;
  notify_task_assigned: boolean;
  notify_mentions: boolean;
  notify_system_alerts: boolean;
}

const DEFAULT_PREFS: Preferences = {
  notify_zapp_messages: true,
  notify_task_assigned: true,
  notify_mentions: true,
  notify_system_alerts: true,
};

const CATEGORIES = [
  {
    key: "notify_zapp_messages" as const,
    label: "Novas mensagens (zAPP)",
    description: "Receber notificação quando chegar uma nova mensagem no ROY zAPP",
    icon: MessageSquare,
  },
  {
    key: "notify_task_assigned" as const,
    label: "Tarefas atribuídas",
    description: "Receber notificação quando uma tarefa for atribuída a você",
    icon: ClipboardList,
  },
  {
    key: "notify_mentions" as const,
    label: "Menções",
    description: "Receber notificação quando alguém mencionar você",
    icon: AtSign,
  },
  {
    key: "notify_system_alerts" as const,
    label: "Alertas do sistema",
    description: "Alertas de risco, vencimentos, lembretes e outros avisos",
    icon: AlertTriangle,
  },
];

export function PushNotificationPreferences() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("id, account_id")
        .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .maybeSingle();

      if (!userData) return;

      const { data } = await supabase
        .from("push_notification_preferences" as any)
        .select("*")
        .eq("user_id", userData.id)
        .maybeSingle();

      if (data) {
        setPreferences({
          notify_zapp_messages: (data as any).notify_zapp_messages,
          notify_task_assigned: (data as any).notify_task_assigned,
          notify_mentions: (data as any).notify_mentions,
          notify_system_alerts: (data as any).notify_system_alerts,
        });
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof Preferences) => {
    const newValue = !preferences[key];
    const newPrefs = { ...preferences, [key]: newValue };
    setPreferences(newPrefs);
    setSaving(true);

    try {
      const { data: userData } = await supabase
        .from("users")
        .select("id, account_id")
        .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();

      if (!userData) throw new Error("User not found");

      const { error } = await supabase
        .from("push_notification_preferences" as any)
        .upsert(
          {
            user_id: userData.id,
            account_id: userData.account_id,
            ...newPrefs,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "user_id" }
        );

      if (error) throw error;
      toast.success("Preferência atualizada");
    } catch (error) {
      console.error("Error saving preference:", error);
      setPreferences((prev) => ({ ...prev, [key]: !newValue }));
      toast.error("Erro ao salvar preferência");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Preferências de notificação push</CardTitle>
        </div>
        <CardDescription>
          Escolha quais tipos de notificação você quer receber no celular
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {CATEGORIES.map((cat) => (
          <div
            key={cat.key}
            className="flex items-center justify-between gap-4 py-2"
          >
            <div className="flex items-start gap-3">
              <cat.icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="space-y-0.5">
                <Label htmlFor={cat.key} className="text-sm font-medium cursor-pointer">
                  {cat.label}
                </Label>
                <p className="text-xs text-muted-foreground">{cat.description}</p>
              </div>
            </div>
            <Switch
              id={cat.key}
              checked={preferences[cat.key]}
              onCheckedChange={() => handleToggle(cat.key)}
              disabled={saving}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
