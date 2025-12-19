import { useState, useEffect, memo } from "react";
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
import { StatusBar, StatCard } from "@/components/admin";
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
  Activity,
  Wallet,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Settings,
  FileText
} from "lucide-react";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";

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
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
          <p className="text-sm text-muted-foreground">Gerencie contas, planos e usuários da plataforma</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Package className="h-4 w-4" />
            Planos
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Building2 className="h-4 w-4" />
            Contas
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Wallet className="h-4 w-4" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <DashboardTab accounts={accounts} users={allUsers} plans={plans} />
        </TabsContent>

        <TabsContent value="plans" className="mt-0">
          <PlansTab plans={plans} isLoading={loadingPlans} />
        </TabsContent>

        <TabsContent value="accounts" className="mt-0">
          <AccountsTab accounts={accounts} plans={plans} isLoading={loadingAccounts} />
        </TabsContent>

        <TabsContent value="users" className="mt-0">
          <UsersTab users={allUsers} accounts={accounts} isLoading={loadingUsers} />
        </TabsContent>

        <TabsContent value="payments" className="mt-0">
          <PaymentsTab />
        </TabsContent>

        <TabsContent value="audit" className="mt-0">
          <AuditLogViewer />
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
    
    const monthlyPrice = plan.billing_period === 'annual' ? plan.price / 12 :
                         plan.billing_period === 'semiannual' ? plan.price / 6 :
                         plan.billing_period === 'quarterly' ? plan.price / 3 :
                         plan.price;
    return sum + monthlyPrice;
  }, 0);

  return (
    <div className="space-y-6">
      {/* MRR Highlight */}
      <Card className="border-0 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Receita Mensal Recorrente (MRR)</p>
              <p className="text-4xl font-semibold tracking-tight mt-1">
                R$ {mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Baseado em {activeAccounts} {activeAccounts === 1 ? 'conta ativa' : 'contas ativas'}
              </p>
            </div>
            <div className="p-4 rounded-full bg-primary/10">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Building2} label="Total de Contas" value={accounts.length} />
        <StatCard icon={UserCheck} label="Contas Ativas" value={activeAccounts} variant="success" />
        <StatCard icon={Activity} label="Em Trial" value={trialAccounts} variant="warning" />
        <StatCard icon={Users} label="Usuários" value={users.length} />
        <StatCard icon={Users} label="Clientes" value={totalClients} />
        <StatCard icon={Package} label="Planos Ativos" value={activePlans} />
      </div>

      {/* Distribution Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusBar label="Ativas" value={activeAccounts} total={accounts.length} color="bg-emerald-500" />
            <StatusBar label="Trial" value={trialAccounts} total={accounts.length} color="bg-amber-500" />
            <StatusBar label="Suspensas" value={suspendedAccounts} total={accounts.length} color="bg-red-500" />
            <StatusBar label="Canceladas" value={cancelledAccounts} total={accounts.length} color="bg-muted-foreground/50" />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">Planos</CardTitle>
          </CardHeader>
          <CardContent>
            {plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum plano cadastrado</p>
            ) : (
              <div className="space-y-3">
                {plans.filter(p => p.is_active).map(plan => {
                  const count = accounts.filter(a => a.plan_id === plan.id).length;
                  return (
                    <div key={plan.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm font-medium">{plan.name}</span>
                      <span className="text-sm text-muted-foreground">{count} {count === 1 ? 'conta' : 'contas'}</span>
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
    has_trial: true,
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
      has_trial: true,
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
    const hasTrial = (plan.trial_days || 0) > 0;
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price: plan.price,
      billing_period: plan.billing_period,
      has_trial: hasTrial,
      trial_days: plan.trial_days || 7,
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
        trial_days: formData.has_trial ? formData.trial_days : null,
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
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-base font-medium">Planos de Assinatura</CardTitle>
          <CardDescription className="text-sm">Gerencie os planos disponíveis</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
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
                <Label className="text-sm">Nome</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} 
                  placeholder="Ex: Plano Pro"
                  className="h-9"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm">Descrição</Label>
                <Textarea 
                  value={formData.description} 
                  onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} 
                  placeholder="Descrição do plano..."
                  className="resize-none"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-sm">Preço (R$)</Label>
                  <Input 
                    type="number" 
                    value={formData.price} 
                    onChange={e => setFormData(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} 
                    className="h-9"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">Período</Label>
                  <Select value={formData.billing_period} onValueChange={v => setFormData(f => ({ ...f, billing_period: v }))}>
                    <SelectTrigger className="h-9">
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
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Oferece Trial</Label>
                    <Switch 
                      checked={formData.has_trial} 
                      onCheckedChange={v => setFormData(f => ({ ...f, has_trial: v }))} 
                    />
                  </div>
                  {formData.has_trial && (
                    <Input 
                      type="number" 
                      value={formData.trial_days} 
                      onChange={e => setFormData(f => ({ ...f, trial_days: parseInt(e.target.value) || 0 }))} 
                      placeholder="Dias de trial"
                      className="h-9"
                    />
                  )}
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">Máx. Clientes</Label>
                  <Input 
                    type="number" 
                    value={formData.max_clients} 
                    onChange={e => setFormData(f => ({ ...f, max_clients: parseInt(e.target.value) || 0 }))} 
                    className="h-9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-sm">Máx. Usuários</Label>
                  <Input 
                    type="number" 
                    value={formData.max_users} 
                    onChange={e => setFormData(f => ({ ...f, max_users: parseInt(e.target.value) || 0 }))} 
                    className="h-9"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">Máx. Análises AI</Label>
                  <Input 
                    type="number" 
                    value={formData.max_ai_analyses} 
                    onChange={e => setFormData(f => ({ ...f, max_ai_analyses: parseInt(e.target.value) || 0 }))} 
                    className="h-9"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-sm">Features (uma por linha)</Label>
                <Textarea 
                  value={formData.features} 
                  onChange={e => setFormData(f => ({ ...f, features: e.target.value }))} 
                  placeholder="Acesso completo&#10;Suporte prioritário&#10;API integrada"
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.is_active} 
                  onCheckedChange={v => setFormData(f => ({ ...f, is_active: v }))} 
                />
                <Label className="text-sm">Plano ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setIsDialogOpen(false); resetForm(); }}>Cancelar</Button>
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
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum plano cadastrado</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map(plan => (
              <div 
                key={plan.id} 
                className={`group relative p-5 rounded-xl border bg-card hover:shadow-md transition-all ${!plan.is_active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{plan.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(plan)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('Excluir este plano?')) deleteMutation.mutate(plan.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-2xl font-semibold">R$ {plan.price.toLocaleString('pt-BR')}</span>
                  <span className="text-xs text-muted-foreground">/{billingPeriodLabels[plan.billing_period]?.toLowerCase() || plan.billing_period}</span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {!plan.is_active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                  {plan.trial_days && plan.trial_days > 0 && (
                    <Badge variant="outline" className="text-xs">{plan.trial_days}d trial</Badge>
                  )}
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  {plan.max_clients && <div>• Até {plan.max_clients} clientes</div>}
                  {plan.max_users && <div>• Até {plan.max_users} usuários</div>}
                  {plan.max_ai_analyses && <div>• {plan.max_ai_analyses} análises AI/mês</div>}
                </div>

                {plan.features && plan.features.length > 0 && (
                  <div className="border-t mt-3 pt-3 text-xs space-y-0.5">
                    {plan.features.slice(0, 3).map((f, i) => (
                      <div key={i} className="text-muted-foreground">✓ {f}</div>
                    ))}
                    {plan.features.length > 3 && (
                      <div className="text-muted-foreground/60">+{plan.features.length - 3} mais</div>
                    )}
                  </div>
                )}
              </div>
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
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium">Contas</CardTitle>
        <CardDescription className="text-sm">Todas as contas da plataforma</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-medium">Nome</TableHead>
                  <TableHead className="font-medium">Plano</TableHead>
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="font-medium text-center">Usuários</TableHead>
                  <TableHead className="font-medium text-center">Clientes</TableHead>
                  <TableHead className="font-medium">Criada em</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map(account => {
                  const plan = plans.find(p => p.id === account.plan_id);
                  const status = statusLabels[account.subscription_status || 'trial'] || statusLabels.trial;
                  return (
                    <TableRow key={account.id} className="group">
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell>
                        {plan ? (
                          <Badge variant="outline" className="text-xs">{plan.name}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">{account.user_count}</TableCell>
                      <TableCell className="text-center text-sm">{account.client_count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(account.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => openEdit(account)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Conta</DialogTitle>
              <DialogDescription>Atualize os dados da conta</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label className="text-sm">Nome</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} 
                  className="h-9"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm">Plano</Label>
                <Select value={formData.plan_id} onValueChange={v => setFormData(f => ({ ...f, plan_id: v }))}>
                  <SelectTrigger className="h-9">
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
                <Label className="text-sm">Status</Label>
                <Select value={formData.subscription_status} onValueChange={v => setFormData(f => ({ ...f, subscription_status: v }))}>
                  <SelectTrigger className="h-9">
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
              <Button variant="ghost" onClick={() => setEditingAccount(null)}>Cancelar</Button>
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
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-medium">Usuários</CardTitle>
            <CardDescription className="text-sm">Todos os usuários da plataforma</CardDescription>
          </div>
          <Input 
            placeholder="Buscar usuários..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-full sm:w-64"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-medium">Nome</TableHead>
                  <TableHead className="font-medium">Email</TableHead>
                  <TableHead className="font-medium">Conta</TableHead>
                  <TableHead className="font-medium">Role</TableHead>
                  <TableHead className="font-medium">Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{user.account_name}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{roleLabels[user.role] || user.role}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Payments Tab Component
function PaymentsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // Fetch all accounts with plan info
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['admin-payments-accounts'],
    queryFn: async () => {
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('id, name, subscription_status, plan_id')
        .order('name');
      
      if (accountsError) throw accountsError;

      // Get plan names
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('id, name, price');

      const planMap: Record<string, { name: string; price: number }> = {};
      plansData?.forEach((p: { id: string; name: string; price: number }) => {
        planMap[p.id] = { name: p.name, price: p.price };
      });

      return accountsData.map((acc: any) => ({
        ...acc,
        plan_name: acc.plan_id ? planMap[acc.plan_id]?.name : 'Sem plano',
        plan_price: acc.plan_id ? planMap[acc.plan_id]?.price : 0
      }));
    }
  });

  const filteredAccounts = accounts.filter((acc: any) => 
    acc.name.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const activeCount = accounts.filter((a: any) => a.subscription_status === 'active').length;
  const trialCount = accounts.filter((a: any) => a.subscription_status === 'trial').length;
  const overdueCount = accounts.filter((a: any) => a.subscription_status === 'overdue').length;
  
  // Calculate MRR
  const mrr = accounts.reduce((sum: number, acc: any) => {
    if (acc.subscription_status === 'active' && acc.plan_price) {
      return sum + acc.plan_price;
    }
    return sum;
  }, 0);

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    trial: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    overdue: "bg-red-500/10 text-red-500 border-red-500/20",
    cancelled: "bg-muted text-muted-foreground border-muted",
    pending: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    suspended: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  };

  const statusLabels: Record<string, string> = {
    active: "Ativa",
    trial: "Trial",
    overdue: "Inadimplente",
    cancelled: "Cancelada",
    pending: "Pendente",
    suspended: "Suspensa",
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-semibold">R$ {mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground">MRR</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xl font-semibold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Activity className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xl font-semibold">{trialCount}</p>
                <p className="text-xs text-muted-foreground">Em Trial</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xl font-semibold">{overdueCount}</p>
                <p className="text-xs text-muted-foreground">Inadimplentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-medium">Assinaturas por Conta</CardTitle>
              <CardDescription className="text-sm">Gerencie pagamentos e assinaturas de cada conta via Asaas</CardDescription>
            </div>
            <Input 
              placeholder="Buscar contas..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="h-9 w-full sm:w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loadingAccounts ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? 'Nenhuma conta encontrada' : 'Nenhuma conta cadastrada'}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-medium">Conta</TableHead>
                    <TableHead className="font-medium">Plano</TableHead>
                    <TableHead className="font-medium">Valor</TableHead>
                    <TableHead className="font-medium">Status</TableHead>
                    <TableHead className="font-medium text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account: any) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {account.plan_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {account.plan_price > 0 
                          ? `R$ ${account.plan_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${statusColors[account.subscription_status || 'trial']}`}
                        >
                          {statusLabels[account.subscription_status || 'trial']}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => toast.info("Painel Asaas em breve!")}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Asaas
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gateway Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Gateway Configurado</CardTitle>
          <CardDescription className="text-sm">
            Integração ativa para processamento de pagamentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🏦</div>
              <div>
                <h3 className="font-medium">Asaas</h3>
                <p className="text-xs text-muted-foreground">Boleto, PIX e Cartão de Crédito</p>
              </div>
            </div>
            <Badge className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Conectado
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
