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
  CreditCard
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { SubscriptionManager } from "@/components/settings/SubscriptionManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function Profile() {
  const { updateUser } = useCurrentUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [hasAccountChanges, setHasAccountChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [editName, setEditName] = useState("");

  // Account form data
  const [accountForm, setAccountForm] = useState({
    name: "",
    email: "",
    phone: "",
    document_type: "cpf",
    document: "",
    contact_name: "",
    street: "",
    street_number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
  });

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
          setAccountForm({
            name: accountData.name || "",
            email: accountData.email || "",
            phone: accountData.phone || "",
            document_type: accountData.document_type || "cpf",
            document: accountData.document || "",
            contact_name: accountData.contact_name || "",
            street: accountData.street || "",
            street_number: accountData.street_number || "",
            complement: accountData.complement || "",
            neighborhood: accountData.neighborhood || "",
            city: accountData.city || "",
            state: accountData.state || "",
            zip_code: accountData.zip_code || "",
          });

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

  const handleAccountChange = (field: string, value: string) => {
    setAccountForm((prev) => ({ ...prev, [field]: value }));
    setHasAccountChanges(true);
  };

  const handleSaveAccount = async () => {
    if (!account || !accountForm.name.trim()) {
      toast.error("O nome da conta é obrigatório");
      return;
    }

    setSavingAccount(true);
    try {
      const { error } = await supabase
        .from("accounts")
        .update({
          name: accountForm.name,
          email: accountForm.email || null,
          phone: accountForm.phone || null,
          document_type: accountForm.document_type,
          document: accountForm.document || null,
          contact_name: accountForm.contact_name || null,
          street: accountForm.street || null,
          street_number: accountForm.street_number || null,
          complement: accountForm.complement || null,
          neighborhood: accountForm.neighborhood || null,
          city: accountForm.city || null,
          state: accountForm.state || null,
          zip_code: accountForm.zip_code || null,
        })
        .eq("id", account.id);

      if (error) throw error;

      setAccount({ ...account, ...accountForm });
      setHasAccountChanges(false);
      toast.success("Conta atualizada!");
    } catch (error: any) {
      console.error("Error saving account:", error);
      toast.error(error.message || "Erro ao salvar conta");
    } finally {
      setSavingAccount(false);
    }
  };

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setAccountForm((prev) => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
        setHasAccountChanges(true);
      }
    } catch (error) {
      console.error("Error fetching address:", error);
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
              {/* Identification Card */}
              <Card className="shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Identificação
                      </CardTitle>
                      <CardDescription>
                        Dados principais da conta
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={handleSaveAccount} 
                      disabled={!hasAccountChanges || savingAccount}
                    >
                      {savingAccount ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="account-name">Nome / Razão Social *</Label>
                      <Input
                        id="account-name"
                        value={accountForm.name}
                        onChange={(e) => handleAccountChange("name", e.target.value)}
                        placeholder="Nome da empresa ou pessoa"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact_name">Nome do Responsável</Label>
                      <Input
                        id="contact_name"
                        value={accountForm.contact_name}
                        onChange={(e) => handleAccountChange("contact_name", e.target.value)}
                        placeholder="Nome do contato principal"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="document_type">Tipo de Documento</Label>
                      <Select
                        value={accountForm.document_type}
                        onValueChange={(value) => handleAccountChange("document_type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cpf">CPF</SelectItem>
                          <SelectItem value="cnpj">CNPJ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="document">
                        {accountForm.document_type === "cnpj" ? "CNPJ" : "CPF"}
                      </Label>
                      <Input
                        id="document"
                        value={accountForm.document}
                        onChange={(e) => handleAccountChange("document", e.target.value)}
                        placeholder={accountForm.document_type === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00"}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Card */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Contato
                  </CardTitle>
                  <CardDescription>
                    Informações de contato da conta
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="account-email">E-mail</Label>
                      <Input
                        id="account-email"
                        type="email"
                        value={accountForm.email}
                        onChange={(e) => handleAccountChange("email", e.target.value)}
                        placeholder="contato@empresa.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account-phone">Telefone</Label>
                      <Input
                        id="account-phone"
                        value={accountForm.phone}
                        onChange={(e) => handleAccountChange("phone", e.target.value)}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Address Card */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Endereço
                  </CardTitle>
                  <CardDescription>
                    Digite o CEP para preenchimento automático
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="zip_code">CEP</Label>
                      <Input
                        id="zip_code"
                        value={accountForm.zip_code}
                        onChange={(e) => handleAccountChange("zip_code", e.target.value)}
                        onBlur={(e) => fetchAddressByCep(e.target.value)}
                        placeholder="00000-000"
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="street">Logradouro</Label>
                      <Input
                        id="street"
                        value={accountForm.street}
                        onChange={(e) => handleAccountChange("street", e.target.value)}
                        placeholder="Rua, Avenida, etc."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="street_number">Número</Label>
                      <Input
                        id="street_number"
                        value={accountForm.street_number}
                        onChange={(e) => handleAccountChange("street_number", e.target.value)}
                        placeholder="123"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="complement">Complemento</Label>
                      <Input
                        id="complement"
                        value={accountForm.complement}
                        onChange={(e) => handleAccountChange("complement", e.target.value)}
                        placeholder="Sala, Apto, etc."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input
                        id="neighborhood"
                        value={accountForm.neighborhood}
                        onChange={(e) => handleAccountChange("neighborhood", e.target.value)}
                        placeholder="Bairro"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        value={accountForm.city}
                        onChange={(e) => handleAccountChange("city", e.target.value)}
                        placeholder="Cidade"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state">Estado</Label>
                      <Select
                        value={accountForm.state}
                        onValueChange={(value) => handleAccountChange("state", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
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
