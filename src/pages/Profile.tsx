import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { User, Mail, Building2, Save, Loader2 } from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  account_id: string;
}

interface Account {
  id: string;
  name: string;
}

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [editName, setEditName] = useState("");
  const [editAccountName, setEditAccountName] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .maybeSingle();

      if (userError) throw userError;

      if (userData) {
        setProfile(userData as UserProfile);
        setEditName(userData.name);

        // Fetch account
        const { data: accountData } = await supabase
          .from("accounts")
          .select("*")
          .eq("id", userData.account_id)
          .maybeSingle();

        if (accountData) {
          setAccount(accountData as Account);
          setEditAccountName(accountData.name);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    
    if (!editName.trim()) {
      toast.error("Nome não pode estar vazio");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ name: editName.trim() })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile({ ...profile, name: editName.trim() });
      toast.success("Perfil atualizado!");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.message || "Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!account) return;
    
    if (!editAccountName.trim()) {
      toast.error("Nome da conta não pode estar vazio");
      return;
    }

    setSaving(true);
    try {
      // Note: This will only work if the user has permission to update accounts
      // Currently RLS only allows SELECT on accounts
      const { error } = await supabase
        .from("accounts")
        .update({ name: editAccountName.trim() })
        .eq("id", account.id);

      if (error) throw error;

      setAccount({ ...account, name: editAccountName.trim() });
      toast.success("Conta atualizada!");
    } catch (error: any) {
      console.error("Error updating account:", error);
      toast.error("Você não tem permissão para editar a conta");
    } finally {
      setSaving(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Administrador",
      leader: "Líder",
      mentor: "Mentor",
      cx: "CX",
      cs: "CS",
      consultor: "Consultor",
      head: "Head",
      gestor: "Gestor",
    };
    return labels[role] || role;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 lg:p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">Perfil não encontrado</h2>
            <p className="text-muted-foreground">
              Faça logout e login novamente para criar seu perfil.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Meu Perfil</h1>
        <p className="text-muted-foreground">
          Gerencie suas informações pessoais e configurações
        </p>
      </div>

      {/* Profile Card */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{profile.name}</CardTitle>
              <CardDescription className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {profile.email}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Separator />
          
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <div className="flex gap-2">
                <Input
                  id="name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Seu nome completo"
                />
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={saving || editName === profile.name}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={profile.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                O e-mail não pode ser alterado
              </p>
            </div>

            <div className="space-y-2">
              <Label>Função</Label>
              <Input value={getRoleLabel(profile.role)} disabled className="bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Card */}
      {account && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Conta
            </CardTitle>
            <CardDescription>
              Informações da sua organização
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accountName">Nome da Conta</Label>
              <div className="flex gap-2">
                <Input
                  id="accountName"
                  value={editAccountName}
                  onChange={(e) => setEditAccountName(e.target.value)}
                  placeholder="Nome da organização"
                />
                <Button 
                  onClick={handleSaveAccount} 
                  disabled={saving || editAccountName === account.name}
                  variant="outline"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>ID da Conta</Label>
              <Input value={account.id} disabled className="bg-muted font-mono text-xs" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}