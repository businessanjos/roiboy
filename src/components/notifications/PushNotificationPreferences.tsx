import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { MessageSquare, ClipboardList, AtSign, AlertTriangle, Settings2, Building2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Preferences {
  notify_zapp_messages: boolean;
  notify_task_assigned: boolean;
  notify_mentions: boolean;
  notify_system_alerts: boolean;
  notify_sectors: string[];
}

const DEFAULT_PREFS: Preferences = {
  notify_zapp_messages: true,
  notify_task_assigned: true,
  notify_mentions: true,
  notify_system_alerts: true,
  notify_sectors: [],
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

const SECTOR_OPTIONS = [
  { id: "operacoes", label: "Operações" },
  { id: "vendas", label: "Vendas" },
  { id: "financeiro", label: "Finanças" },
  { id: "marketing", label: "Marketing" },
  
];

type ToggleKey = "notify_zapp_messages" | "notify_task_assigned" | "notify_mentions" | "notify_system_alerts";

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
        const rawSectors = (data as any).notify_sectors;
        setPreferences({
          notify_zapp_messages: (data as any).notify_zapp_messages,
          notify_task_assigned: (data as any).notify_task_assigned,
          notify_mentions: (data as any).notify_mentions,
          notify_system_alerts: (data as any).notify_system_alerts,
          notify_sectors: Array.isArray(rawSectors) ? rawSectors : [],
        });
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (newPrefs: Preferences) => {
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
            notify_zapp_messages: newPrefs.notify_zapp_messages,
            notify_task_assigned: newPrefs.notify_task_assigned,
            notify_mentions: newPrefs.notify_mentions,
            notify_system_alerts: newPrefs.notify_system_alerts,
            notify_sectors: newPrefs.notify_sectors.length > 0 ? newPrefs.notify_sectors : null,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "user_id" }
        );

      if (error) throw error;
      toast.success("Preferência atualizada");
    } catch (error) {
      console.error("Error saving preference:", error);
      toast.error("Erro ao salvar preferência");
      return false;
    } finally {
      setSaving(false);
    }
    return true;
  };

  const handleToggle = async (key: ToggleKey) => {
    const newValue = !preferences[key];
    const newPrefs = { ...preferences, [key]: newValue };
    setPreferences(newPrefs);

    const success = await savePreferences(newPrefs);
    if (!success) {
      setPreferences((prev) => ({ ...prev, [key]: !newValue }));
    }
  };

  const handleSectorToggle = async (sectorId: string) => {
    const currentSectors = preferences.notify_sectors;
    const newSectors = currentSectors.includes(sectorId)
      ? currentSectors.filter((s) => s !== sectorId)
      : [...currentSectors, sectorId];

    const newPrefs = { ...preferences, notify_sectors: newSectors };
    setPreferences(newPrefs);

    const success = await savePreferences(newPrefs);
    if (!success) {
      setPreferences((prev) => ({ ...prev, notify_sectors: currentSectors }));
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
        {/* Category toggles */}
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

        <Separator />

        {/* Sector filter */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Filtrar por setor</p>
              <p className="text-xs text-muted-foreground">
                Selecione os setores dos quais deseja receber notificações. Se nenhum for selecionado, você receberá de todos.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pl-8">
            {SECTOR_OPTIONS.map((sector) => (
              <div key={sector.id} className="flex items-center gap-2">
                <Checkbox
                  id={`sector-${sector.id}`}
                  checked={preferences.notify_sectors.includes(sector.id)}
                  onCheckedChange={() => handleSectorToggle(sector.id)}
                  disabled={saving}
                />
                <Label
                  htmlFor={`sector-${sector.id}`}
                  className="text-sm cursor-pointer"
                >
                  {sector.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
