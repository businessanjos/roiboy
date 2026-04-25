import { useState, useEffect, memo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StatusBar, StatCard } from "@/components/admin";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingScreen } from "@/components/ui/loading-screen";
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
  FileText,
  Ban,
  PlayCircle,
  Eye,
  DollarSign,
  Cpu
} from "lucide-react";
import { useImpersonation } from "@/hooks/useImpersonation";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { SystemStatusMonitor } from "@/components/admin/SystemStatusMonitor";
import { AdminPermissionsTab } from "@/components/admin/AdminPermissionsTab";
import { Briefcase, TrendingUp as TrendingUpIcon, Users as UsersIcon, Calendar, DollarSign as DollarSignIcon, Lightbulb, FileText as FileTextIcon, Receipt, RefreshCcw, CreditCard as CreditCardIcon, PieChart, Target, Bell, Building2 as Building2Icon, BarChart3 } from "lucide-react";

interface Account {
  id: string;
  name: string;
  created_at: string;
  trial_ends_at: string | null;
  subscription_status: string | null;
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
  auth_user_id?: string | null;
}

export default function Admin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // Get initial tab from URL query param
  const initialTab = searchParams.get('tab') || 'dashboard';
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
    return <LoadingScreen message="Carregando painel admin..." fullScreen={false} />;
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

  const activeTab = searchParams.get('tab') || 'dashboard';

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab accounts={accounts} users={allUsers} />;
      case 'status':
        return <SystemStatusMonitor />;
      case 'accounts':
        return <AccountsTab accounts={accounts} allUsers={allUsers} isLoading={loadingAccounts} />;
      case 'users':
        return <UsersTab users={allUsers} accounts={accounts} isLoading={loadingUsers} />;
      case 'permissions':
        return <AdminPermissionsTab accounts={accounts} />;
      case 'audit':
        return <AuditLogViewer />;
      case 'costs':
        return <AICostsTab accounts={accounts} />;
      default:
        return <DashboardTab accounts={accounts} users={allUsers} />;
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {renderContent()}
    </div>
  );
}

// Dashboard Tab Component
function DashboardTab({ accounts, users }: { accounts: Account[]; users: User[] }) {
  const activeAccounts = accounts.filter(a => a.subscription_status === 'active').length;
  const trialAccounts = accounts.filter(a => a.subscription_status === 'trial').length;
  const suspendedAccounts = accounts.filter(a => a.subscription_status === 'suspended').length;
  const cancelledAccounts = accounts.filter(a => a.subscription_status === 'cancelled').length;
  
  const totalClients = accounts.reduce((sum, a) => sum + (a.client_count || 0), 0);

  // ========== AI USAGE METRICS (Last 30 days) ==========
  const { data: aiStats } = useQuery({
    queryKey: ['admin-ai-stats-dashboard'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('account_id, input_tokens, output_tokens, model, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString());
      
      if (error) throw error;
      
      // Calculate costs
      const modelCosts: Record<string, { input: number; output: number }> = {
        'google/gemini-2.5-flash': { input: 0.075, output: 0.30 },
        'google/gemini-2.5-flash-lite': { input: 0.02, output: 0.08 },
        'google/gemini-2.5-pro': { input: 1.25, output: 5.0 },
        'google/gemini-3-pro-preview': { input: 1.25, output: 5.0 },
        'openai/gpt-5': { input: 5.0, output: 15.0 },
        'openai/gpt-5-mini': { input: 0.15, output: 0.60 },
        'openai/gpt-5-nano': { input: 0.05, output: 0.20 },
      };
      const usdToBrl = 5.5;
      
      let totalCost = 0;
      let totalAnalyses = data?.length || 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      const accountsUsingAI = new Set<string>();
      
      data?.forEach(log => {
        accountsUsingAI.add(log.account_id);
        totalInputTokens += log.input_tokens;
        totalOutputTokens += log.output_tokens;
        
        const costs = modelCosts[log.model] || { input: 0.5, output: 1.5 };
        totalCost += ((log.input_tokens / 1_000_000) * costs.input * usdToBrl) +
                     ((log.output_tokens / 1_000_000) * costs.output * usdToBrl);
      });
      
      // Calculate today's stats
      const todayStart = startOfDay(new Date());
      const todayLogs = data?.filter(l => new Date(l.created_at) >= todayStart) || [];
      const todayAnalyses = todayLogs.length;
      const todayCost = todayLogs.reduce((sum, log) => {
        const costs = modelCosts[log.model] || { input: 0.5, output: 1.5 };
        return sum + ((log.input_tokens / 1_000_000) * costs.input * usdToBrl) +
               ((log.output_tokens / 1_000_000) * costs.output * usdToBrl);
      }, 0);
      
      return {
        totalAnalyses,
        totalCost,
        totalInputTokens,
        totalOutputTokens,
        accountsUsingAI: accountsUsingAI.size,
        todayAnalyses,
        todayCost,
        avgPerAccount: accountsUsingAI.size > 0 ? totalAnalyses / accountsUsingAI.size : 0,
        costPerAnalysis: totalAnalyses > 0 ? totalCost / totalAnalyses : 0,
      };
    }
  });

  return (
    <div className="space-y-6">
      {/* AI Usage Metrics */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Cpu className="h-5 w-5 text-emerald-500" />
            Uso de IA Agregado (Últimos 30 dias)
          </CardTitle>
          <CardDescription>Consumo e custos de inteligência artificial</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="p-4 rounded-lg bg-emerald-500/10 text-center">
              <p className="text-3xl font-bold text-emerald-600">
                R$ {(aiStats?.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Custo Total (30d)</p>
            </div>
            <div className="p-4 rounded-lg bg-blue-500/10 text-center">
              <p className="text-3xl font-bold text-blue-600">{(aiStats?.totalAnalyses || 0).toLocaleString('pt-BR')}</p>
              <p className="text-sm text-muted-foreground mt-1">Análises Totais</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/10 text-center">
              <p className="text-3xl font-bold text-purple-600">{aiStats?.accountsUsingAI || 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Contas Usando IA</p>
            </div>
            <div className="p-4 rounded-lg bg-amber-500/10 text-center">
              <p className="text-3xl font-bold text-amber-600">
                R$ {(aiStats?.costPerAnalysis || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Custo por Análise</p>
            </div>
            <div className="p-4 rounded-lg bg-primary/10 text-center">
              <p className="text-3xl font-bold text-primary">{(aiStats?.todayAnalyses || 0).toLocaleString('pt-BR')}</p>
              <p className="text-sm text-muted-foreground mt-1">Análises Hoje</p>
              <p className="text-xs text-muted-foreground">R$ {(aiStats?.todayCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <p className="text-muted-foreground">Tokens de Entrada</p>
                <p className="font-semibold">{((aiStats?.totalInputTokens || 0) / 1_000_000).toFixed(2)}M</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tokens de Saída</p>
                <p className="font-semibold">{((aiStats?.totalOutputTokens || 0) / 1_000_000).toFixed(2)}M</p>
              </div>
              <div>
                <p className="text-muted-foreground">Média por Conta</p>
                <p className="font-semibold">{(aiStats?.avgPerAccount || 0).toFixed(1)} análises</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Total de Contas" value={accounts.length} />
        <StatCard icon={UserCheck} label="Contas Ativas" value={activeAccounts} variant="success" />
        <StatCard icon={Users} label="Usuários" value={users.length} />
        <StatCard icon={Users} label="Clientes" value={totalClients} />
      </div>

      {/* Distribution */}
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
    </div>
  );
}

// Accounts Tab Component
function AccountsTab({ accounts, allUsers, isLoading }: { accounts: Account[]; allUsers: User[]; isLoading: boolean }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { startImpersonation } = useImpersonation();
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [isImpersonating, setIsImpersonating] = useState(false);

  const handleImpersonate = async (accountId: string) => {
    // Find the first user of this account
    const accountUser = allUsers.find(u => u.account_id === accountId);
    if (!accountUser) {
      toast.error('Nenhum usuário encontrado nesta conta');
      return;
    }
    
    setIsImpersonating(true);
    try {
      await startImpersonation(accountUser.id);
      navigate('/dashboard');
      toast.success(`Visualizando como ${accountUser.name}`);
    } catch (error) {
      toast.error('Erro ao iniciar impersonação');
    } finally {
      setIsImpersonating(false);
    }
  };
  
  // Separate form states for create and edit to avoid conflicts
  const [createFormData, setCreateFormData] = useState({
    name: '',
    email: '',
    phone: '',
    document_type: 'cpf',
    document: '',
    contact_name: '',
    street: '',
    street_number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zip_code: '',
    subscription_status: 'trial',
    trial_ends_at: ''
  });
  
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    document_type: 'cpf',
    document: '',
    contact_name: '',
    street: '',
    street_number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zip_code: '',
    subscription_status: 'trial',
    trial_ends_at: ''
  });

  const resetCreateForm = () => {
    setCreateFormData({
      name: '',
      email: '',
      phone: '',
      document_type: 'cpf',
      document: '',
      contact_name: '',
      street: '',
      street_number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zip_code: '',
        subscription_status: 'trial',
      trial_ends_at: ''
    });
  };

  const openEdit = (account: Account) => {
    const newFormData = {
      name: account.name,
      email: account.email || '',
      phone: account.phone || '',
      document_type: account.document_type || 'cpf',
      document: account.document || '',
      contact_name: account.contact_name || '',
      street: account.street || '',
      street_number: account.street_number || '',
      complement: account.complement || '',
      neighborhood: account.neighborhood || '',
      city: account.city || '',
      state: account.state || '',
      zip_code: account.zip_code || '',
      subscription_status: account.subscription_status || 'trial',
      trial_ends_at: account.trial_ends_at ? account.trial_ends_at.split('T')[0] : ''
    };
    setEditFormData(newFormData);
    setEditingAccount(account);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create account
      const { data: newAccount, error: accountError } = await supabase
        .from('accounts')
        .insert({
          name: createFormData.name,
          email: createFormData.email || null,
          phone: createFormData.phone || null,
          document_type: createFormData.document_type,
          document: createFormData.document || null,
          contact_name: createFormData.contact_name || null,
          street: createFormData.street || null,
          street_number: createFormData.street_number || null,
          complement: createFormData.complement || null,
          neighborhood: createFormData.neighborhood || null,
          city: createFormData.city || null,
          state: createFormData.state || null,
          zip_code: createFormData.zip_code || null,
          subscription_status: createFormData.subscription_status,
          trial_ends_at: createFormData.trial_ends_at ? new Date(createFormData.trial_ends_at).toISOString() : null
        })
        .select()
        .single();
      
      if (accountError) throw accountError;

      // Create account settings
      const { error: settingsError } = await supabase
        .from('account_settings')
        .insert({ account_id: newAccount.id });
      
      if (settingsError) throw settingsError;

      return newAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
      toast.success('Conta criada com sucesso!');
      setIsCreateDialogOpen(false);
      resetCreateForm();
    },
    onError: (error) => {
      toast.error('Erro ao criar conta: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingAccount) return;
      const { error } = await supabase
        .from('accounts')
        .update({
          name: editFormData.name,
          email: editFormData.email || null,
          phone: editFormData.phone || null,
          document_type: editFormData.document_type,
          document: editFormData.document || null,
          contact_name: editFormData.contact_name || null,
          street: editFormData.street || null,
          street_number: editFormData.street_number || null,
          complement: editFormData.complement || null,
          neighborhood: editFormData.neighborhood || null,
          city: editFormData.city || null,
          state: editFormData.state || null,
          zip_code: editFormData.zip_code || null,
          subscription_status: editFormData.subscription_status,
          trial_ends_at: editFormData.trial_ends_at ? new Date(editFormData.trial_ends_at).toISOString() : null
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First delete all related data in order
      await supabase.from('users').delete().eq('account_id', id);
      await supabase.from('account_settings').delete().eq('account_id', id);
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Conta excluída!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir conta: ' + error.message);
    }
  });

  // Bulk actions mutations
  const bulkSuspendMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('accounts')
        .update({ subscription_status: 'suspended' })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
      toast.success(`${selectedAccounts.size} conta(s) suspensa(s)!`);
      setSelectedAccounts(new Set());
    },
    onError: (error) => {
      toast.error('Erro ao suspender contas: ' + error.message);
    }
  });

  const bulkActivateMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('accounts')
        .update({ subscription_status: 'active' })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
      toast.success(`${selectedAccounts.size} conta(s) reativada(s)!`);
      setSelectedAccounts(new Set());
    },
    onError: (error) => {
      toast.error('Erro ao reativar contas: ' + error.message);
    }
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAccounts(new Set(filteredAccounts.map(a => a.id)));
    } else {
      setSelectedAccounts(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedAccounts);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedAccounts(newSet);
  };

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    trial: { label: 'Trial', variant: 'outline' },
    active: { label: 'Ativo', variant: 'default' },
    suspended: { label: 'Suspenso', variant: 'destructive' },
    cancelled: { label: 'Cancelado', variant: 'secondary' },
    overdue: { label: 'Inadimplente', variant: 'destructive' }
  };

  const filteredAccounts = accounts.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-base font-medium">Contas</CardTitle>
          <CardDescription className="text-sm">Todas as contas da plataforma</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Input 
            placeholder="Buscar contas..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-48"
          />
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) resetCreateForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Conta</DialogTitle>
                <DialogDescription>Crie uma nova conta na plataforma</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Dados Básicos */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Dados Básicos</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label className="text-sm">Nome da Conta *</Label>
                      <Input 
                        value={createFormData.name} 
                        onChange={e => setCreateFormData(f => ({ ...f, name: e.target.value }))} 
                        placeholder="Nome da empresa/conta"
                        className="h-9"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-sm">Nome do Contato</Label>
                      <Input 
                        value={createFormData.contact_name} 
                        onChange={e => setCreateFormData(f => ({ ...f, contact_name: e.target.value }))} 
                        placeholder="Pessoa responsável"
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label className="text-sm">E-mail</Label>
                      <Input 
                        type="email"
                        value={createFormData.email} 
                        onChange={e => setCreateFormData(f => ({ ...f, email: e.target.value }))} 
                        placeholder="email@empresa.com"
                        className="h-9"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-sm">Telefone</Label>
                      <Input 
                        value={createFormData.phone} 
                        onChange={e => setCreateFormData(f => ({ ...f, phone: e.target.value }))} 
                        placeholder="+55 11 99999-9999"
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label className="text-sm">Tipo de Documento</Label>
                      <Select value={createFormData.document_type} onValueChange={v => setCreateFormData(f => ({ ...f, document_type: v }))}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cpf">CPF (Pessoa Física)</SelectItem>
                          <SelectItem value="cnpj">CNPJ (Pessoa Jurídica)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-sm">{createFormData.document_type === 'cnpj' ? 'CNPJ' : 'CPF'}</Label>
                      <Input 
                        value={createFormData.document} 
                        onChange={e => setCreateFormData(f => ({ ...f, document: e.target.value }))} 
                        placeholder={createFormData.document_type === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>

                {/* Endereço */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Endereço</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-2">
                      <Label className="text-sm">CEP</Label>
                      <Input 
                        value={createFormData.zip_code} 
                        onChange={e => setCreateFormData(f => ({ ...f, zip_code: e.target.value }))} 
                        placeholder="00000-000"
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-2 grid gap-2">
                      <Label className="text-sm">Rua</Label>
                      <Input 
                        value={createFormData.street} 
                        onChange={e => setCreateFormData(f => ({ ...f, street: e.target.value }))} 
                        placeholder="Nome da rua"
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="grid gap-2">
                      <Label className="text-sm">Número</Label>
                      <Input 
                        value={createFormData.street_number} 
                        onChange={e => setCreateFormData(f => ({ ...f, street_number: e.target.value }))} 
                        placeholder="123"
                        className="h-9"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-sm">Complemento</Label>
                      <Input 
                        value={createFormData.complement} 
                        onChange={e => setCreateFormData(f => ({ ...f, complement: e.target.value }))} 
                        placeholder="Apto 101"
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-2 grid gap-2">
                      <Label className="text-sm">Bairro</Label>
                      <Input 
                        value={createFormData.neighborhood} 
                        onChange={e => setCreateFormData(f => ({ ...f, neighborhood: e.target.value }))} 
                        placeholder="Centro"
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 grid gap-2">
                      <Label className="text-sm">Cidade</Label>
                      <Input 
                        value={createFormData.city} 
                        onChange={e => setCreateFormData(f => ({ ...f, city: e.target.value }))} 
                        placeholder="São Paulo"
                        className="h-9"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-sm">Estado</Label>
                      <Input 
                        value={createFormData.state} 
                        onChange={e => setCreateFormData(f => ({ ...f, state: e.target.value }))} 
                        placeholder="SP"
                        className="h-9"
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Assinatura */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Assinatura</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label className="text-sm">Status</Label>
                      <Select value={createFormData.subscription_status} onValueChange={v => setCreateFormData(f => ({ ...f, subscription_status: v }))}>
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
                  <div className="grid gap-2">
                    <Label className="text-sm">Término do Trial</Label>
                    <Input 
                      type="date"
                      value={createFormData.trial_ends_at} 
                      onChange={e => setCreateFormData(f => ({ ...f, trial_ends_at: e.target.value }))} 
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => { setIsCreateDialogOpen(false); resetCreateForm(); }}>Cancelar</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !createFormData.name}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Conta
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Bulk Actions Bar */}
        {selectedAccounts.size > 0 && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedAccounts.size} {selectedAccounts.size === 1 ? 'conta selecionada' : 'contas selecionadas'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  if (confirm(`Suspender ${selectedAccounts.size} conta(s)?`)) {
                    bulkSuspendMutation.mutate(Array.from(selectedAccounts));
                  }
                }}
                disabled={bulkSuspendMutation.isPending}
              >
                {bulkSuspendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                Suspender
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  if (confirm(`Reativar ${selectedAccounts.size} conta(s)?`)) {
                    bulkActivateMutation.mutate(Array.from(selectedAccounts));
                  }
                }}
                disabled={bulkActivateMutation.isPending}
              >
                {bulkActivateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Reativar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAccounts(new Set())}
              >
                Limpar seleção
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
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
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredAccounts.length > 0 && selectedAccounts.size === filteredAccounts.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="font-medium">Nome</TableHead>
                  
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="font-medium text-center">Usuários</TableHead>
                  <TableHead className="font-medium text-center">Clientes</TableHead>
                  <TableHead className="font-medium">Criada em</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map(account => {
                                    const status = statusLabels[account.subscription_status || 'trial'] || statusLabels.trial;
                  const isSelected = selectedAccounts.has(account.id);
                  return (
                    <TableRow key={account.id} className={`group ${isSelected ? 'bg-muted/30' : ''}`}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectOne(account.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">{account.user_count}</TableCell>
                      <TableCell className="text-center text-sm">{account.client_count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(account.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-amber-600 hover:text-amber-700"
                            onClick={() => handleImpersonate(account.id)}
                            disabled={isImpersonating || account.user_count === 0}
                            title="Visualizar como usuário desta conta"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => openEdit(account)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Excluir a conta "${account.name}"? Esta ação irá remover todos os usuários e dados associados.`)) {
                                deleteMutation.mutate(account.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Conta</DialogTitle>
              <DialogDescription>Atualize os dados da conta</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Dados Básicos */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Dados Básicos</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label className="text-sm">Nome da Conta *</Label>
                    <Input 
                      value={editFormData.name} 
                      onChange={e => setEditFormData(f => ({ ...f, name: e.target.value }))} 
                      className="h-9"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm">Nome do Contato</Label>
                    <Input 
                      value={editFormData.contact_name} 
                      onChange={e => setEditFormData(f => ({ ...f, contact_name: e.target.value }))} 
                      placeholder="Pessoa responsável"
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label className="text-sm">E-mail</Label>
                    <Input 
                      type="email"
                      value={editFormData.email} 
                      onChange={e => setEditFormData(f => ({ ...f, email: e.target.value }))} 
                      placeholder="email@empresa.com"
                      className="h-9"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm">Telefone</Label>
                    <Input 
                      value={editFormData.phone} 
                      onChange={e => setEditFormData(f => ({ ...f, phone: e.target.value }))} 
                      placeholder="+55 11 99999-9999"
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label className="text-sm">Tipo de Documento</Label>
                    <Select value={editFormData.document_type} onValueChange={v => setEditFormData(f => ({ ...f, document_type: v }))}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpf">CPF (Pessoa Física)</SelectItem>
                        <SelectItem value="cnpj">CNPJ (Pessoa Jurídica)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm">{editFormData.document_type === 'cnpj' ? 'CNPJ' : 'CPF'}</Label>
                    <Input 
                      value={editFormData.document} 
                      onChange={e => setEditFormData(f => ({ ...f, document: e.target.value }))} 
                      placeholder={editFormData.document_type === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Endereço</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label className="text-sm">CEP</Label>
                    <Input 
                      value={editFormData.zip_code} 
                      onChange={e => setEditFormData(f => ({ ...f, zip_code: e.target.value }))} 
                      placeholder="00000-000"
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-2 grid gap-2">
                    <Label className="text-sm">Rua</Label>
                    <Input 
                      value={editFormData.street} 
                      onChange={e => setEditFormData(f => ({ ...f, street: e.target.value }))} 
                      placeholder="Nome da rua"
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="grid gap-2">
                    <Label className="text-sm">Número</Label>
                    <Input 
                      value={editFormData.street_number} 
                      onChange={e => setEditFormData(f => ({ ...f, street_number: e.target.value }))} 
                      placeholder="123"
                      className="h-9"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm">Complemento</Label>
                    <Input 
                      value={editFormData.complement} 
                      onChange={e => setEditFormData(f => ({ ...f, complement: e.target.value }))} 
                      placeholder="Apto 101"
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-2 grid gap-2">
                    <Label className="text-sm">Bairro</Label>
                    <Input 
                      value={editFormData.neighborhood} 
                      onChange={e => setEditFormData(f => ({ ...f, neighborhood: e.target.value }))} 
                      placeholder="Centro"
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 grid gap-2">
                    <Label className="text-sm">Cidade</Label>
                    <Input 
                      value={editFormData.city} 
                      onChange={e => setEditFormData(f => ({ ...f, city: e.target.value }))} 
                      placeholder="São Paulo"
                      className="h-9"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm">Estado</Label>
                    <Input 
                      value={editFormData.state} 
                      onChange={e => setEditFormData(f => ({ ...f, state: e.target.value }))} 
                      placeholder="SP"
                      className="h-9"
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>

              {/* Assinatura */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Assinatura</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label className="text-sm">Status</Label>
                    <Select value={editFormData.subscription_status} onValueChange={v => setEditFormData(f => ({ ...f, subscription_status: v }))}>
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
                <div className="grid gap-2">
                  <Label className="text-sm">Término do Trial</Label>
                  <Input 
                    type="date"
                    value={editFormData.trial_ends_at} 
                    onChange={e => setEditFormData(f => ({ ...f, trial_ends_at: e.target.value }))} 
                    className="h-9"
                  />
                  <p className="text-xs text-muted-foreground">Deixe vazio para trial sem prazo</p>
                </div>
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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'mentor',
    account_id: ''
  });

  // Fetch super admins list
  const { data: superAdmins = [] } = useQuery({
    queryKey: ['admin-super-admins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('super_admins')
        .select('user_id');
      if (error) throw error;
      return data.map((sa: { user_id: string }) => sa.user_id);
    }
  });
  
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

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      account_id: user.account_id
    });
  };

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      const { error } = await supabase
        .from('users')
        .update({
          name: formData.name,
          email: formData.email,
          role: formData.role as "admin" | "consultor" | "cs" | "cx" | "gestor" | "head" | "leader" | "mentor",
          account_id: formData.account_id
        })
        .eq('id', editingUser.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário atualizado!');
      setEditingUser(null);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar usuário: ' + error.message);
    }
  });

  const toggleSuperAdminMutation = useMutation({
    mutationFn: async ({ userId, authUserId, isSuperAdmin }: { userId: string; authUserId: string | null; isSuperAdmin: boolean }) => {
      if (!authUserId) {
        throw new Error('Usuário não tem auth_user_id vinculado');
      }
      
      if (isSuperAdmin) {
        // Remove super admin
        const { error } = await supabase
          .from('super_admins')
          .delete()
          .eq('user_id', authUserId);
        if (error) throw error;
      } else {
        // Add super admin
        const { error } = await supabase
          .from('super_admins')
          .insert({ user_id: authUserId });
        if (error) throw error;
      }
    },
    onSuccess: (_, { isSuperAdmin }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-super-admins'] });
      toast.success(isSuperAdmin ? 'Super admin removido!' : 'Super admin adicionado!');
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário excluído!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir usuário: ' + error.message);
    }
  });

  // Get auth_user_id for a user (need to fetch from users table)
  const getUserAuthId = (user: User) => {
    // The user object from query includes auth_user_id
    return (user as any).auth_user_id;
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
                  <TableHead className="font-medium">Super Admin</TableHead>
                  <TableHead className="font-medium">Criado em</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(user => {
                  const authUserId = getUserAuthId(user);
                  const isSuperAdmin = authUserId ? superAdmins.includes(authUserId) : false;
                  
                  return (
                    <TableRow key={user.id} className="group">
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{user.account_name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{roleLabels[user.role] || user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={isSuperAdmin}
                          onCheckedChange={() => toggleSuperAdminMutation.mutate({ 
                            userId: user.id, 
                            authUserId, 
                            isSuperAdmin 
                          })}
                          disabled={toggleSuperAdminMutation.isPending || !authUserId}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => openEdit(user)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm('Excluir este usuário? Esta ação não pode ser desfeita.')) {
                                deleteUserMutation.mutate(user.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>Atualize os dados do usuário</DialogDescription>
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
                <Label className="text-sm">Email</Label>
                <Input 
                  type="email"
                  value={formData.email} 
                  onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} 
                  className="h-9"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm">Conta</Label>
                <Select value={formData.account_id} onValueChange={v => setFormData(f => ({ ...f, account_id: v }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-sm">Role</Label>
                <Select value={formData.role} onValueChange={v => setFormData(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="leader">Líder</SelectItem>
                    <SelectItem value="mentor">Mentor</SelectItem>
                    <SelectItem value="head">Head</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="consultor">Consultor</SelectItem>
                    <SelectItem value="cx">CX</SelectItem>
                    <SelectItem value="cs">CS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditingUser(null)}>Cancelar</Button>
              <Button onClick={() => updateUserMutation.mutate()} disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}


// AI Costs Tab Component
function AICostsTab({ accounts }: { accounts: Account[] }) {
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  
  const getDateRange = () => {
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      return {
        start: startOfDay(customStartDate),
        end: endOfDay(customEndDate)
      };
    }
    
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - parseInt(selectedPeriod === 'custom' ? '30' : selectedPeriod));
    return { start, end };
  };

  const { data: aiUsageLogs = [], isLoading } = useQuery({
    queryKey: ['admin-ai-usage', selectedPeriod, customStartDate?.toISOString(), customEndDate?.toISOString()],
    queryFn: async () => {
      const { start, end } = getDateRange();
      
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const handlePeriodChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomOpen(true);
    } else {
      setSelectedPeriod(value);
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
    }
  };

  const applyCustomPeriod = () => {
    if (customStartDate && customEndDate) {
      setSelectedPeriod('custom');
      setIsCustomOpen(false);
    } else {
      toast.error('Selecione as datas de início e fim');
    }
  };

  const getPeriodLabel = () => {
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      return `${format(customStartDate, 'dd/MM/yyyy')} - ${format(customEndDate, 'dd/MM/yyyy')}`;
    }
    if (selectedPeriod === '1') return 'Hoje';
    return `Últimos ${selectedPeriod} dias`;
  };

  // Calculate costs per model (approximate pricing in USD per 1M tokens, converted to BRL)
  const modelCosts: Record<string, { input: number; output: number }> = {
    'google/gemini-2.5-flash': { input: 0.075, output: 0.30 },
    'google/gemini-2.5-flash-lite': { input: 0.02, output: 0.08 },
    'google/gemini-2.5-pro': { input: 1.25, output: 5.0 },
    'google/gemini-3-pro-preview': { input: 1.25, output: 5.0 },
    'openai/gpt-5': { input: 5.0, output: 15.0 },
    'openai/gpt-5-mini': { input: 0.15, output: 0.60 },
    'openai/gpt-5-nano': { input: 0.05, output: 0.20 },
  };

  const usdToBrl = 5.5; // Approximate exchange rate

  // Calculate total costs
  const calculateCost = (log: any) => {
    const costs = modelCosts[log.model] || { input: 0.5, output: 1.5 };
    const inputCost = (log.input_tokens / 1_000_000) * costs.input * usdToBrl;
    const outputCost = (log.output_tokens / 1_000_000) * costs.output * usdToBrl;
    return inputCost + outputCost;
  };

  const totalCost = aiUsageLogs.reduce((sum, log) => sum + calculateCost(log), 0);
  const totalInputTokens = aiUsageLogs.reduce((sum, log) => sum + log.input_tokens, 0);
  const totalOutputTokens = aiUsageLogs.reduce((sum, log) => sum + log.output_tokens, 0);
  const totalAnalyses = aiUsageLogs.length;

  // Group by model
  const costsByModel = aiUsageLogs.reduce((acc, log) => {
    const model = log.model || 'unknown';
    if (!acc[model]) {
      acc[model] = { count: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
    }
    acc[model].count++;
    acc[model].inputTokens += log.input_tokens;
    acc[model].outputTokens += log.output_tokens;
    acc[model].cost += calculateCost(log);
    return acc;
  }, {} as Record<string, { count: number; inputTokens: number; outputTokens: number; cost: number }>);

  // Group by account
  const costsByAccount = aiUsageLogs.reduce((acc, log) => {
    const accountId = log.account_id;
    if (!acc[accountId]) {
      acc[accountId] = { count: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
    }
    acc[accountId].count++;
    acc[accountId].inputTokens += log.input_tokens;
    acc[accountId].outputTokens += log.output_tokens;
    acc[accountId].cost += calculateCost(log);
    return acc;
  }, {} as Record<string, { count: number; inputTokens: number; outputTokens: number; cost: number }>);

  // Group by day for chart
  const costsByDay = aiUsageLogs.reduce((acc, log) => {
    const date = format(new Date(log.created_at), 'dd/MM', { locale: ptBR });
    if (!acc[date]) {
      acc[date] = { date, cost: 0, analyses: 0 };
    }
    acc[date].cost += calculateCost(log);
    acc[date].analyses++;
    return acc;
  }, {} as Record<string, { date: string; cost: number; analyses: number }>);

  const chartData = Object.values(costsByDay).reverse().slice(-30);

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Custos de IA</h3>
          <p className="text-sm text-muted-foreground">Monitoramento de uso e custos com modelos de IA</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Período">
                {getPeriodLabel()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="custom">Período personalizado</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Custom Period Dialog */}
          <Dialog open={isCustomOpen} onOpenChange={setIsCustomOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Período Personalizado</DialogTitle>
                <DialogDescription>Selecione o intervalo de datas para análise</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Data Inicial</Label>
                  <Input
                    type="date"
                    value={customStartDate ? format(customStartDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => setCustomStartDate(e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined)}
                    max={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Data Final</Label>
                  <Input
                    type="date"
                    value={customEndDate ? format(customEndDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => setCustomEndDate(e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined)}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    min={customStartDate ? format(customStartDate, 'yyyy-MM-dd') : undefined}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCustomOpen(false)}>Cancelar</Button>
                <Button onClick={applyCustomPeriod}>Aplicar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Custo Total</p>
                <p className="text-2xl font-semibold">R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-muted">
                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total de Análises</p>
                <p className="text-2xl font-semibold">{totalAnalyses.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground">Chamadas à IA</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-blue-500/10">
                <Cpu className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tokens de Entrada</p>
                <p className="text-2xl font-semibold">{(totalInputTokens / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}K</p>
                <p className="text-xs text-muted-foreground">Input tokens</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-purple-500/10">
                <Cpu className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tokens de Saída</p>
                <p className="text-2xl font-semibold">{(totalOutputTokens / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}K</p>
                <p className="text-xs text-muted-foreground">Output tokens</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Custos Diários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis 
                    tickFormatter={(v) => `R$${v.toFixed(2)}`}
                    className="text-xs"
                  />
                  <Tooltip 
                    formatter={(value: number) => [`R$ ${value.toFixed(4)}`, 'Custo']}
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="cost" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary) / 0.2)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Costs by Model */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Custos por Modelo</CardTitle>
          <CardDescription className="text-sm">Breakdown de uso por modelo de IA</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(costsByModel).length === 0 ? (
            <div className="text-center py-8">
              <Cpu className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum uso de IA registrado no período</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-medium">Modelo</TableHead>
                    <TableHead className="font-medium text-center">Análises</TableHead>
                    <TableHead className="font-medium text-right">Input Tokens</TableHead>
                    <TableHead className="font-medium text-right">Output Tokens</TableHead>
                    <TableHead className="font-medium text-right">Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(costsByModel)
                    .sort((a, b) => b[1].cost - a[1].cost)
                    .map(([model, data]) => (
                      <TableRow key={model}>
                        <TableCell className="font-medium">
                          <Badge variant="outline" className="text-xs font-mono">
                            {model.split('/').pop()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">{data.count.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-right text-sm">
                          {(data.inputTokens / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}K
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {(data.outputTokens / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}K
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {data.cost.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Costs by Account */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Custos por Conta</CardTitle>
          <CardDescription className="text-sm">Top contas por consumo de IA</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(costsByAccount).length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum uso registrado</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-medium">Conta</TableHead>
                    <TableHead className="font-medium text-center">Análises</TableHead>
                    <TableHead className="font-medium text-right">Tokens Totais</TableHead>
                    <TableHead className="font-medium text-right">Custo</TableHead>
                    <TableHead className="font-medium text-right">% do Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(costsByAccount)
                    .sort((a, b) => b[1].cost - a[1].cost)
                    .slice(0, 15)
                    .map(([accountId, data]) => {
                      const account = accounts.find(a => a.id === accountId);
                      const percentage = totalCost > 0 ? (data.cost / totalCost) * 100 : 0;
                      return (
                        <TableRow key={accountId}>
                          <TableCell className="font-medium">{account?.name || accountId.slice(0, 8)}</TableCell>
                          <TableCell className="text-center text-sm">{data.count.toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-right text-sm">
                            {((data.inputTokens + data.outputTokens) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}K
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            R$ {data.cost.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {percentage.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
