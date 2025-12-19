import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  User, 
  Mail, 
  Building2, 
  Save, 
  Loader2, 
  Camera, 
  Phone, 
  MapPin, 
  FileText,
  CreditCard,
  ExternalLink
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { SubscriptionManager } from "@/components/settings/SubscriptionManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  account_id: string;
  avatar_url: string | null;
  auth_user_id: string | null;
}

interface Account {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document_type: string | null;
  document: string | null;
  contact_name: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  subscription_status: string | null;
  plan_id: string | null;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  billing_period: string;
}

export default function Profile() {
  const { updateUser } = useCurrentUser();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [editName, setEditName] = useState("");

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

        // Fetch account with all details
        const { data: accountData } = await supabase
          .from("accounts")
          .select("*")
          .eq("id", userData.account_id)
          .maybeSingle();

        if (accountData) {
          setAccount(accountData as Account);

          // Fetch plan if exists
          if (accountData.plan_id) {
            const { data: planData } = await supabase
              .from("subscription_plans")
              .select("id, name, price, billing_period")
              .eq("id", accountData.plan_id)
              .maybeSingle();
            
            if (planData) {
              setPlan(planData);
            }
          }
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
      updateUser({ name: editName.trim() });
      toast.success("Perfil atualizado!");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.message || "Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile?.auth_user_id) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB");
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile.auth_user_id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: avatarUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: avatarUrl });
      updateUser({ avatar_url: avatarUrl });
      toast.success("Foto atualizada!");
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast.error(error.message || "Erro ao enviar foto");
    } finally {
      setUploadingAvatar(false);
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

  const getStatusBadge = (status: string | null) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      trial: { label: "Teste", variant: "secondary" },
      active: { label: "Ativa", variant: "default" },
      cancelled: { label: "Cancelada", variant: "destructive" },
      past_due: { label: "Pendente", variant: "destructive" },
    };
    const c = config[status || "trial"] || { label: status || "Teste", variant: "outline" as const };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const formatAddress = () => {
    if (!account) return null;
    const parts = [
      account.street,
      account.street_number,
      account.complement,
      account.neighborhood,
      account.city,
      account.state,
      account.zip_code,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const formatDocument = () => {
    if (!account?.document) return null;
    const type = account.document_type === "cnpj" ? "CNPJ" : "CPF";
    return `${type}: ${account.document}`;
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
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Meu Perfil</h1>
        <p className="text-muted-foreground">
          Suas informações pessoais e da conta
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <Building2 className="h-4 w-4" />
            Conta
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Assinatura
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profile.avatar_url || undefined} alt={profile.name} />
                    <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                      {getInitials(profile.name)}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div>
                  <CardTitle>{profile.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {profile.email}
                  </CardDescription>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">{getRoleLabel(profile.role)}</Badge>
                  </div>
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          {account && (
            <>
              <Card className="shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {account.name}
                      </CardTitle>
                      <CardDescription>
                        Dados cadastrais da conta
                      </CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate("/account-settings")}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Editar Conta
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Contact Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {account.contact_name && (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Responsável</p>
                          <p className="font-medium">{account.contact_name}</p>
                        </div>
                      </div>
                    )}

                    {account.email && (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">E-mail</p>
                          <p className="font-medium">{account.email}</p>
                        </div>
                      </div>
                    )}

                    {account.phone && (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Phone className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Telefone</p>
                          <p className="font-medium">{account.phone}</p>
                        </div>
                      </div>
                    )}

                    {formatDocument() && (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Documento</p>
                          <p className="font-medium">{formatDocument()}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Address */}
                  {formatAddress() && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Endereço</p>
                          <p className="font-medium">{formatAddress()}</p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Empty State */}
                  {!account.email && !account.phone && !formatDocument() && !formatAddress() && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p>Nenhum dado cadastral preenchido</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-3"
                        onClick={() => navigate("/account-settings")}
                      >
                        Completar cadastro
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Plan Summary Card */}
              <Card className="shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Plano Atual
                      </CardTitle>
                      <CardDescription>
                        Resumo da sua assinatura
                      </CardDescription>
                    </div>
                    {getStatusBadge(account.subscription_status)}
                  </div>
                </CardHeader>
                <CardContent>
                  {plan ? (
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-semibold text-lg">{plan.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(plan.price)}
                          {plan.billing_period === "monthly" && "/mês"}
                          {plan.billing_period === "annual" && "/ano"}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const tabsList = document.querySelector('[role="tablist"]');
                          const subscriptionTab = tabsList?.querySelector('[value="subscription"]') as HTMLButtonElement;
                          subscriptionTab?.click();
                        }}
                      >
                        Gerenciar
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <p>Período de teste</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => {
                          const tabsList = document.querySelector('[role="tablist"]');
                          const subscriptionTab = tabsList?.querySelector('[value="subscription"]') as HTMLButtonElement;
                          subscriptionTab?.click();
                        }}
                      >
                        Ver planos
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <SubscriptionManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}