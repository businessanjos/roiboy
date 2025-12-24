import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { 
  Book, 
  Save, 
  Loader2, 
  Eye, 
  EyeOff, 
  Link, 
  Copy, 
  Check,
  Building2,
  Phone,
  Mail,
  Package,
  Lock,
  Instagram
} from "lucide-react";

interface MembersBookSettings {
  id?: string;
  is_enabled: boolean;
  show_company: boolean;
  show_email: boolean;
  show_phone: boolean;
  show_instagram: boolean;
  show_products: boolean;
  custom_title: string;
  custom_description: string;
  access_password: string;
}

const defaultSettings: MembersBookSettings = {
  is_enabled: false,
  show_company: true,
  show_email: true,
  show_phone: true,
  show_instagram: true,
  show_products: true,
  custom_title: "Members Book",
  custom_description: "",
  access_password: "",
};

export function MembersBookSettings() {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const [settings, setSettings] = useState<MembersBookSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const accountId = currentUser?.account_id;

  useEffect(() => {
    if (accountId) {
      fetchSettings();
    }
  }, [accountId]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("members_book_settings")
        .select("*")
        .eq("account_id", accountId)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setSettings({
          id: data.id,
          is_enabled: data.is_enabled,
          show_company: data.show_company,
          show_email: data.show_email,
          show_phone: data.show_phone,
          show_instagram: data.show_instagram ?? true,
          show_products: data.show_products,
          custom_title: data.custom_title || "Members Book",
          custom_description: data.custom_description || "",
          access_password: data.access_password || "",
        });
      }
    } catch (error) {
      console.error("Error fetching members book settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!accountId) return;

    setSaving(true);
    try {
      const payload = {
        account_id: accountId,
        is_enabled: settings.is_enabled,
        show_company: settings.show_company,
        show_email: settings.show_email,
        show_phone: settings.show_phone,
        show_instagram: settings.show_instagram,
        show_products: settings.show_products,
        custom_title: settings.custom_title || "Members Book",
        custom_description: settings.custom_description || null,
        access_password: settings.access_password || null,
      };

      if (settings.id) {
        const { error } = await supabase
          .from("members_book_settings")
          .update(payload)
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("members_book_settings")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setSettings(prev => ({ ...prev, id: data.id }));
        }
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações do Members Book foram atualizadas.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const membersBookUrl = `${window.location.origin}/members?account=${accountId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(membersBookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Link copiado!",
      description: "O link do Members Book foi copiado para a área de transferência.",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Book className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Members Book</CardTitle>
              <CardDescription>
                Catálogo público de membros para networking
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.is_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, is_enabled: checked }))
              }
            />
            <Badge variant={settings.is_enabled ? "default" : "secondary"}>
              {settings.is_enabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Link público */}
        {settings.is_enabled && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Link className="h-4 w-4" />
              Link público do Members Book
            </div>
            <div className="flex gap-2">
              <Input 
                value={membersBookUrl} 
                readOnly 
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={handleCopyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Personalização */}
        <div className="space-y-4">
          <h4 className="font-medium">Personalização</h4>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="custom_title">Título</Label>
              <Input
                id="custom_title"
                value={settings.custom_title}
                onChange={(e) => 
                  setSettings(prev => ({ ...prev, custom_title: e.target.value }))
                }
                placeholder="Members Book"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="access_password" className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" />
                Senha de acesso (opcional)
              </Label>
              <div className="relative">
                <Input
                  id="access_password"
                  type={showPassword ? "text" : "password"}
                  value={settings.access_password}
                  onChange={(e) => 
                    setSettings(prev => ({ ...prev, access_password: e.target.value }))
                  }
                  placeholder="Deixe vazio para acesso livre"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom_description">Descrição</Label>
            <Textarea
              id="custom_description"
              value={settings.custom_description}
              onChange={(e) => 
                setSettings(prev => ({ ...prev, custom_description: e.target.value }))
              }
              placeholder="Uma breve descrição sobre o grupo de membros..."
              rows={2}
            />
          </div>
        </div>

        {/* Campos visíveis */}
        <div className="space-y-4">
          <h4 className="font-medium">Informações exibidas nos cards</h4>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Empresa</span>
              </div>
              <Switch
                checked={settings.show_company}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, show_company: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Telefone</span>
              </div>
              <Switch
                checked={settings.show_phone}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, show_phone: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">E-mail</span>
              </div>
              <Switch
                checked={settings.show_email}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, show_email: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Produtos/Áreas</span>
              </div>
              <Switch
                checked={settings.show_products}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, show_products: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Instagram</span>
              </div>
              <Switch
                checked={settings.show_instagram}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, show_instagram: checked }))
                }
              />
            </div>
          </div>
        </div>

        {/* Botão salvar */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
