import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Building2, 
  Users, 
  CreditCard, 
  Plus, 
  Pencil, 
  Trash2, 
  Shield, 
  Loader2,
  ShieldAlert,
  Package,
  LayoutDashboard,
  TrendingUp,
  UserCheck,
  Activity
} from "lucide-react";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_period: string;
  trial_days: number | null;
  max_clients: number | null;
  max_users: number | null;
  max_ai_analyses: number | null;
  features: string[];
  is_active: boolean;
  created_at: string;
}

interface Account {
  id: string;
  name: string;
  created_at: string;
  plan_id: string | null;
  trial_ends_at: string | null;
  subscription_status: string | null;
  user_count?: number;
  client_count?: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  account_id: string;
  created_at: string;
  account_name?: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Check if current user is super admin
  useEffect(() => {
    const checkSuperAdmin = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc('is_super_admin', { _user_id: user.id });
      
      if (error) {
        console.error('Error checking super admin status:', error);
        setIsSuperAdmin(false);
      } else {
        setIsSuperAdmin(data === true);
      }
      setIsLoading(false);
    };

    checkSuperAdmin();
  }, [user]);

  // Fetch plans
  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price', { ascending: true });
      
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
    enabled: isSuperAdmin
  });

  // Fetch accounts with counts
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['admin-accounts'],
    queryFn: async () => {
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (accountsError) throw accountsError;

      // Get user counts per account
      const { data: userCounts } = await supabase
        .from('users')
        .select('account_id');

      // Get client counts per account
      const { data: clientCounts } = await supabase
        .from('clients')
        .select('account_id');

      const userCountMap: Record<string, number> = {};
      const clientCountMap: Record<string, number> = {};

      userCounts?.forEach((u: { account_id: string }) => {
        userCountMap[u.account_id] = (userCountMap[u.account_id] || 0) + 1;
      });

      clientCounts?.forEach((c: { account_id: string }) => {
        clientCountMap[c.account_id] = (clientCountMap[c.account_id] || 0) + 1;
      });

      return accountsData.map((acc: Account) => ({
        ...acc,
        user_count: userCountMap[acc.id] || 0,
        client_count: clientCountMap[acc.id] || 0
      })) as Account[];
    },
    enabled: isSuperAdmin
  });

  // Fetch all users
  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (usersError) throw usersError;

      const { data: accountsData } = await supabase
        .from('accounts')
        .select('id, name');

      const accountMap: Record<string, string> = {};
      accountsData?.forEach((acc: { id: string; name: string }) => {
        accountMap[acc.id] = acc.name;
      });

      return usersData.map((u: User) => ({
        ...u,
        account_name: accountMap[u.account_id] || 'N/A'
      })) as User[];
    },
    enabled: isSuperAdmin
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        <Button onClick={() => navigate('/dashboard')}>Voltar ao Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Administração</h1>
          <p className="text-muted-foreground">Gerencie contas, planos e usuários da plataforma</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2">
            <Package className="h-4 w-4" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-2">
            <Building2 className="h-4 w-4" />
            Contas
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab accounts={accounts} users={allUsers} plans={plans} />
        </TabsContent>

        <TabsContent value="plans">
          <PlansTab plans={plans} isLoading={loadingPlans} />
        </TabsContent>

        <TabsContent value="accounts">
          <AccountsTab accounts={accounts} plans={plans} isLoading={loadingAccounts} />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab users={allUsers} accounts={accounts} isLoading={loadingUsers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Dashboard Tab Component
function DashboardTab({ accounts, users, plans }: { accounts: Account[]; users: User[]; plans: SubscriptionPlan[] }) {
  const activeAccounts = accounts.filter(a => a.subscription_status === 'active').length;
  const trialAccounts = accounts.filter(a => a.subscription_status === 'trial').length;
  const suspendedAccounts = accounts.filter(a => a.subscription_status === 'suspended').length;
  const cancelledAccounts = accounts.filter(a => a.subscription_status === 'cancelled').length;
  
  const totalClients = accounts.reduce((sum, a) => sum + (a.client_count || 0), 0);
  const activePlans = plans.filter(p => p.is_active).length;
  
  // Calculate MRR (Monthly Recurring Revenue)
  const mrr = accounts.reduce((sum, account) => {
    const plan = plans.find(p => p.id === account.plan_id);
    if (!plan || account.subscription_status !== 'active') return sum;
    
    // Normalize to monthly
    const monthlyPrice = plan.billing_period === 'annual' ? plan.price / 12 :
                         plan.billing_period === 'semiannual' ? plan.price / 6 :
                         plan.billing_period === 'quarterly' ? plan.price / 3 :
                         plan.price;
    return sum + monthlyPrice;
  }, 0);

  const stats = [
    { label: 'Total de Contas', value: accounts.length, icon: Building2, color: 'text-blue-500' },
    { label: 'Contas Ativas', value: activeAccounts, icon: UserCheck, color: 'text-green-500' },
    { label: 'Em Trial', value: trialAccounts, icon: Activity, color: 'text-amber-500' },
    { label: 'Total de Usuários', value: users.length, icon: Users, color: 'text-purple-500' },
    { label: 'Total de Clientes', value: totalClients, icon: Users, color: 'text-indigo-500' },
    { label: 'Planos Ativos', value: activePlans, icon: Package, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`h-10 w-10 ${stat.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* MRR Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            MRR (Receita Mensal Recorrente)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-green-600">
            R$ {mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Baseado em {activeAccounts} contas ativas com plano
          </p>
        </CardContent>
      </Card>

      {/* Status Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Ativas</span>
                </div>
                <span className="font-semibold">{activeAccounts}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>Trial</span>
                </div>
                <span className="font-semibold">{trialAccounts}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Suspensas</span>
                </div>
                <span className="font-semibold">{suspendedAccounts}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <span>Canceladas</span>
                </div>
                <span className="font-semibold">{cancelledAccounts}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Planos Mais Usados</CardTitle>
          </CardHeader>
          <CardContent>
            {plans.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum plano cadastrado</p>
            ) : (
              <div className="space-y-3">
                {plans.filter(p => p.is_active).map(plan => {
                  const count = accounts.filter(a => a.plan_id === plan.id).length;
                  return (
                    <div key={plan.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{plan.name}</Badge>
                      </div>
                      <span className="font-semibold">{count} contas</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Plans Tab Component
function PlansTab({ plans, isLoading }: { plans: SubscriptionPlan[]; isLoading: boolean }) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    billing_period: 'monthly',
    trial_days: 7,
    max_clients: 100,
    max_users: 5,
    max_ai_analyses: 1000,
    features: '',
    is_active: true
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      billing_period: 'monthly',
      trial_days: 7,
      max_clients: 100,
      max_users: 5,
      max_ai_analyses: 1000,
      features: '',
      is_active: true
    });
    setEditingPlan(null);
  };

  const openEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price: plan.price,
      billing_period: plan.billing_period,
      trial_days: plan.trial_days || 0,
      max_clients: plan.max_clients || 0,
      max_users: plan.max_users || 0,
      max_ai_analyses: plan.max_ai_analyses || 0,
      features: (plan.features || []).join('\n'),
      is_active: plan.is_active
    });
    setIsDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        price: formData.price,
        billing_period: formData.billing_period,
        trial_days: formData.trial_days,
        max_clients: formData.max_clients || null,
        max_users: formData.max_users || null,
        max_ai_analyses: formData.max_ai_analyses || null,
        features: formData.features.split('\n').filter(f => f.trim()),
        is_active: formData.is_active
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(payload)
          .eq('id', editingPlan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast.success(editingPlan ? 'Plano atualizado!' : 'Plano criado!');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao salvar plano: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast.success('Plano excluído!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir plano: ' + error.message);
    }
  });

  const billingPeriodLabels: Record<string, string> = {
    monthly: 'Mensal',
    quarterly: 'Trimestral',
    semiannual: 'Semestral',
    annual: 'Anual',
    one_time: 'Único'
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Planos de Assinatura</CardTitle>
          <CardDescription>Gerencie os planos disponíveis na plataforma</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
              <DialogDescription>Configure os detalhes do plano de assinatura</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} 
                  placeholder="Ex: Plano Pro"
                />
              </div>
              <div className="grid gap-2">
                <Label>Descrição</Label>
                <Textarea 
                  value={formData.description} 
                  onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} 
                  placeholder="Descrição do plano..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Preço (R$)</Label>
                  <Input 
                    type="number" 
                    value={formData.price} 
                    onChange={e => setFormData(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Período</Label>
                  <Select value={formData.billing_period} onValueChange={v => setFormData(f => ({ ...f, billing_period: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="semiannual">Semestral</SelectItem>
                      <SelectItem value="annual">Anual</SelectItem>
                      <SelectItem value="one_time">Único</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Dias de Trial</Label>
                  <Input 
                    type="number" 
                    value={formData.trial_days} 
                    onChange={e => setFormData(f => ({ ...f, trial_days: parseInt(e.target.value) || 0 }))} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Máx. Clientes</Label>
                  <Input 
                    type="number" 
                    value={formData.max_clients} 
                    onChange={e => setFormData(f => ({ ...f, max_clients: parseInt(e.target.value) || 0 }))} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Máx. Usuários</Label>
                  <Input 
                    type="number" 
                    value={formData.max_users} 
                    onChange={e => setFormData(f => ({ ...f, max_users: parseInt(e.target.value) || 0 }))} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Máx. Análises AI</Label>
                  <Input 
                    type="number" 
                    value={formData.max_ai_analyses} 
                    onChange={e => setFormData(f => ({ ...f, max_ai_analyses: parseInt(e.target.value) || 0 }))} 
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Features (uma por linha)</Label>
                <Textarea 
                  value={formData.features} 
                  onChange={e => setFormData(f => ({ ...f, features: e.target.value }))} 
                  placeholder="Acesso completo&#10;Suporte prioritário&#10;API integrada"
                  rows={4}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.is_active} 
                  onCheckedChange={v => setFormData(f => ({ ...f, is_active: v }))} 
                />
                <Label>Plano ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum plano cadastrado
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map(plan => (
              <Card key={plan.id} className={!plan.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          if (confirm('Excluir este plano?')) deleteMutation.mutate(plan.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">R$ {plan.price.toLocaleString('pt-BR')}</span>
                    <span className="text-muted-foreground text-sm">/{billingPeriodLabels[plan.billing_period]?.toLowerCase() || plan.billing_period}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!plan.is_active && <Badge variant="secondary">Inativo</Badge>}
                    {plan.trial_days && plan.trial_days > 0 && (
                      <Badge variant="outline">{plan.trial_days} dias trial</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {plan.max_clients && <div>• Até {plan.max_clients} clientes</div>}
                    {plan.max_users && <div>• Até {plan.max_users} usuários</div>}
                    {plan.max_ai_analyses && <div>• {plan.max_ai_analyses} análises AI/mês</div>}
                  </div>
                  {plan.features && plan.features.length > 0 && (
                    <div className="border-t pt-3 text-sm space-y-1">
                      {plan.features.map((f, i) => (
                        <div key={i} className="text-muted-foreground">✓ {f}</div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Accounts Tab Component
function AccountsTab({ accounts, plans, isLoading }: { accounts: Account[]; plans: SubscriptionPlan[]; isLoading: boolean }) {
  const queryClient = useQueryClient();
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    plan_id: '',
    subscription_status: 'trial'
  });

  const openEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      plan_id: account.plan_id || '',
      subscription_status: account.subscription_status || 'trial'
    });
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingAccount) return;
      const { error } = await supabase
        .from('accounts')
        .update({
          name: formData.name,
          plan_id: formData.plan_id || null,
          subscription_status: formData.subscription_status
        })
        .eq('id', editingAccount.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
      toast.success('Conta atualizada!');
      setEditingAccount(null);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar conta: ' + error.message);
    }
  });

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    trial: { label: 'Trial', variant: 'outline' },
    active: { label: 'Ativo', variant: 'default' },
    suspended: { label: 'Suspenso', variant: 'destructive' },
    cancelled: { label: 'Cancelado', variant: 'secondary' }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contas</CardTitle>
        <CardDescription>Todas as contas da plataforma</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Usuários</TableHead>
                <TableHead className="text-center">Clientes</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(account => {
                const plan = plans.find(p => p.id === account.plan_id);
                const status = statusLabels[account.subscription_status || 'trial'] || statusLabels.trial;
                return (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>
                      {plan ? (
                        <Badge variant="outline">{plan.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sem plano</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{account.user_count}</TableCell>
                    <TableCell className="text-center">{account.client_count}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(account.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(account)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Conta</DialogTitle>
              <DialogDescription>Atualize os dados da conta</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} 
                />
              </div>
              <div className="grid gap-2">
                <Label>Plano</Label>
                <Select value={formData.plan_id} onValueChange={v => setFormData(f => ({ ...f, plan_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem plano</SelectItem>
                    {plans.filter(p => p.is_active).map(plan => (
                      <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={formData.subscription_status} onValueChange={v => setFormData(f => ({ ...f, subscription_status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingAccount(null)}>Cancelar</Button>
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// Users Tab Component
function UsersTab({ users, accounts, isLoading }: { users: User[]; accounts: Account[]; isLoading: boolean }) {
  const [search, setSearch] = useState('');
  
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.account_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    leader: 'Líder',
    mentor: 'Mentor',
    cx: 'CX',
    cs: 'CS',
    consultor: 'Consultor',
    head: 'Head',
    gestor: 'Gestor'
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Usuários</CardTitle>
            <CardDescription>Todos os usuários da plataforma</CardDescription>
          </div>
          <Input 
            placeholder="Buscar usuários..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="w-64"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.account_name}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{roleLabels[user.role] || user.role}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
