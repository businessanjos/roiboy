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
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, startOfDay, endOfDay } from "date-fns";
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
import { AdminPaymentsManager } from "@/components/admin/AdminPaymentsManager";
import { CouponsManager } from "@/components/admin/CouponsManager";
import { SupportTicketsManager } from "@/components/admin/SupportTicketsManager";
import { SupportWhatsAppConfig } from "@/components/admin/SupportWhatsAppConfig";
import { SupportKnowledgeBase } from "@/components/admin/SupportKnowledgeBase";
import { SystemStatusMonitor } from "@/components/admin/SystemStatusMonitor";
import { Tag, Headset, BookOpen, Activity as ActivityIcon } from "lucide-react";

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
  features: Record<string, boolean> | string[] | null;
  is_active: boolean;
  created_at: string;
  plan_type: string;
}

// Helper to get features as array
const getFeaturesArray = (features: Record<string, boolean> | string[] | null): string[] => {
  if (!features) return [];
  if (Array.isArray(features)) return features;
  if (typeof features === 'object') {
    return Object.entries(features)
      .filter(([_, v]) => v === true)
      .map(([k]) => k);
  }
  return [];
};

interface Account {
  id: string;
  name: string;
  created_at: string;
  plan_id: string | null;
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

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="status" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <ActivityIcon className="h-4 w-4" />
            Status
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
          <TabsTrigger value="costs" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Cpu className="h-4 w-4" />
            Custos IA
          </TabsTrigger>
          <TabsTrigger value="coupons" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Tag className="h-4 w-4" />
            Cupons
          </TabsTrigger>
          <TabsTrigger value="support" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Headset className="h-4 w-4" />
            Suporte
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <DashboardTab accounts={accounts} users={allUsers} plans={plans} />
        </TabsContent>

        <TabsContent value="status" className="mt-0">
          <SystemStatusMonitor />
        </TabsContent>

        <TabsContent value="plans" className="mt-0">
          <PlansTab plans={plans} isLoading={loadingPlans} />
        </TabsContent>

        <TabsContent value="accounts" className="mt-0">
          <AccountsTab accounts={accounts} plans={plans} allUsers={allUsers} isLoading={loadingAccounts} />
        </TabsContent>

        <TabsContent value="users" className="mt-0">
          <UsersTab users={allUsers} accounts={accounts} isLoading={loadingUsers} />
        </TabsContent>

        <TabsContent value="payments" className="mt-0">
          <AdminPaymentsManager />
        </TabsContent>

        <TabsContent value="audit" className="mt-0">
          <AuditLogViewer />
        </TabsContent>

        <TabsContent value="costs" className="mt-0">
          <AICostsTab accounts={accounts} />
        </TabsContent>

        <TabsContent value="coupons" className="mt-0">
          <CouponsManager />
        </TabsContent>

        <TabsContent value="support" className="mt-0 space-y-6">
          <Tabs defaultValue="tickets" className="space-y-4">
            <TabsList>
              <TabsTrigger value="tickets" className="gap-2">
                <Headset className="h-4 w-4" />
                Tickets
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Base de Conhecimento
              </TabsTrigger>
              <TabsTrigger value="config" className="gap-2">
                <Settings className="h-4 w-4" />
                Configuração
              </TabsTrigger>
            </TabsList>
            <TabsContent value="tickets">
              <SupportTicketsManager />
            </TabsContent>
            <TabsContent value="knowledge">
              <SupportKnowledgeBase />
            </TabsContent>
            <TabsContent value="config">
              <SupportWhatsAppConfig />
            </TabsContent>
          </Tabs>
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
  
  // Separate main plans from add-ons
  const mainPlans = plans.filter(p => p.plan_type === 'main');
  const addonPlans = plans.filter(p => p.plan_type === 'addon');
  const activeMainPlans = mainPlans.filter(p => p.is_active).length;
  const activeAddons = addonPlans.filter(p => p.is_active).length;

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

  // ========== MRR GROWTH (Compare to last month) ==========
  const { data: mrrGrowthData } = useQuery({
    queryKey: ['admin-mrr-growth'],
    queryFn: async () => {
      const lastMonth = subMonths(new Date(), 1);
      const lastMonthStart = startOfMonth(lastMonth);
      const lastMonthEnd = endOfMonth(lastMonth);
      
      // Get accounts created before last month end that had active status
      const accountsLastMonth = accounts.filter(a => {
        const createdAt = new Date(a.created_at);
        return createdAt <= lastMonthEnd;
      });
      
      // Estimate last month MRR (simplified - assumes same plans)
      const lastMonthMrr = accountsLastMonth.reduce((sum, account) => {
        const plan = plans.find(p => p.id === account.plan_id);
        if (!plan) return sum;
        
        const monthlyPrice = plan.billing_period === 'annual' ? plan.price / 12 :
                             plan.billing_period === 'semiannual' ? plan.price / 6 :
                             plan.billing_period === 'quarterly' ? plan.price / 3 :
                             plan.price;
        return sum + monthlyPrice;
      }, 0);
      
      return { lastMonthMrr };
    }
  });

  // ========== TRIAL CONVERSION METRICS ==========
  // Total accounts that ever had a trial (accounts created = went through trial)
  const totalTrialAccounts = accounts.length;
  
  // Accounts that converted from trial to active (have a plan and are active)
  const convertedFromTrial = accounts.filter(a => 
    a.subscription_status === 'active' && a.plan_id
  ).length;
  
  // Accounts still in trial
  const stillInTrial = trialAccounts;
  
  // Accounts that didn't convert (cancelled or expired trial without converting)
  // This includes cancelled accounts and accounts with expired trial that never converted
  const now = new Date();
  const expiredTrialNotConverted = accounts.filter(a => {
    if (a.subscription_status === 'cancelled') return true;
    if (a.subscription_status === 'trial' && a.trial_ends_at) {
      const trialEnd = new Date(a.trial_ends_at);
      return trialEnd < now; // Trial expired but still marked as trial (not converted)
    }
    return false;
  }).length;
  
  // Accounts that completed trial period (either converted or expired)
  const completedTrialAccounts = totalTrialAccounts - stillInTrial;
  
  // Trial conversion rate (only from accounts that finished trial)
  const trialConversionRate = completedTrialAccounts > 0 
    ? (convertedFromTrial / completedTrialAccounts) * 100 
    : 0;
  
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

  // MRR Growth calculation
  const mrrGrowth = mrrGrowthData?.lastMonthMrr 
    ? ((mrr - mrrGrowthData.lastMonthMrr) / mrrGrowthData.lastMonthMrr) * 100 
    : 0;

  // Calculate Churn Rate (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Accounts that were active 30 days ago
  const accountsActiveThirtyDaysAgo = accounts.filter(a => {
    const createdAt = new Date(a.created_at);
    return createdAt <= thirtyDaysAgo && a.subscription_status !== 'trial';
  }).length;
  
  // Accounts that cancelled in the last 30 days (simplified: currently cancelled accounts)
  const recentlyChurned = accounts.filter(a => a.subscription_status === 'cancelled').length;
  
  const churnRate = accountsActiveThirtyDaysAgo > 0 
    ? (recentlyChurned / accountsActiveThirtyDaysAgo) * 100 
    : 0;

  // Calculate LTV (Lifetime Value)
  // LTV = ARPU (Average Revenue Per User) / Churn Rate
  // Or simplified: Average monthly revenue * Average customer lifespan
  const arpu = activeAccounts > 0 ? mrr / activeAccounts : 0;
  
  // Calculate average account age in months
  const totalMonths = accounts.reduce((sum, account) => {
    const createdAt = new Date(account.created_at);
    const monthsActive = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return sum + Math.max(1, monthsActive);
  }, 0);
  const avgLifespanMonths = accounts.length > 0 ? totalMonths / accounts.length : 0;
  
  // LTV = ARPU * Average Lifespan (in months)
  const ltv = arpu * avgLifespanMonths;

  // ARR (Annual Recurring Revenue)
  const arr = mrr * 12;

  return (
    <div className="space-y-6">
      {/* Financial Metrics - Row 1 */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* MRR Card */}
        <Card className="border-0 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">MRR</p>
                <p className="text-3xl font-semibold tracking-tight mt-1">
                  R$ {mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {mrrGrowth > 0 ? (
                    <span className="text-xs text-emerald-600 flex items-center gap-0.5">
                      <TrendingUp className="h-3 w-3" />
                      +{mrrGrowth.toFixed(1)}% vs mês anterior
                    </span>
                  ) : mrrGrowth < 0 ? (
                    <span className="text-xs text-red-600 flex items-center gap-0.5">
                      <Activity className="h-3 w-3" />
                      {mrrGrowth.toFixed(1)}% vs mês anterior
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {activeAccounts} {activeAccounts === 1 ? 'conta ativa' : 'contas ativas'}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ARR Card */}
        <Card className="border-0 bg-gradient-to-br from-blue-500/5 via-blue-500/10 to-blue-500/5 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ARR</p>
                <p className="text-3xl font-semibold tracking-tight mt-1">
                  R$ {arr.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Receita recorrente anual
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <DollarSign className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LTV Card */}
        <Card className="border-0 bg-gradient-to-br from-emerald-500/5 via-emerald-500/10 to-emerald-500/5 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">LTV Médio</p>
                <p className="text-3xl font-semibold tracking-tight mt-1">
                  R$ {ltv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Tempo médio: {avgLifespanMonths.toFixed(1)} meses
                </p>
              </div>
              <div className="p-3 rounded-full bg-emerald-500/10">
                <Wallet className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Churn Card */}
        <Card className="border-0 bg-gradient-to-br from-amber-500/5 via-amber-500/10 to-amber-500/5 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxa de Churn</p>
                <p className="text-3xl font-semibold tracking-tight mt-1">
                  {churnRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {recentlyChurned} {recentlyChurned === 1 ? 'cancelamento' : 'cancelamentos'}
                </p>
              </div>
              <div className="p-3 rounded-full bg-amber-500/10">
                <Activity className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Usage Metrics */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Cpu className="h-5 w-5 text-emerald-500" />
            Uso de IA Agregado (Últimos 30 dias)
          </CardTitle>
          <CardDescription>Consumo e custos de inteligência artificial em toda a plataforma</CardDescription>
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
              <p className="text-3xl font-bold text-blue-600">
                {(aiStats?.totalAnalyses || 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Análises Totais</p>
            </div>
            
            <div className="p-4 rounded-lg bg-purple-500/10 text-center">
              <p className="text-3xl font-bold text-purple-600">
                {aiStats?.accountsUsingAI || 0}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Contas Usando IA</p>
            </div>
            
            <div className="p-4 rounded-lg bg-amber-500/10 text-center">
              <p className="text-3xl font-bold text-amber-600">
                R$ {(aiStats?.costPerAnalysis || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Custo por Análise</p>
            </div>
            
            <div className="p-4 rounded-lg bg-primary/10 text-center">
              <p className="text-3xl font-bold text-primary">
                {(aiStats?.todayAnalyses || 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Análises Hoje</p>
              <p className="text-xs text-muted-foreground">
                R$ {(aiStats?.todayCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          
          {/* Tokens breakdown */}
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

      {/* Trial Conversion Metrics */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-primary" />
            Conversão de Trial
          </CardTitle>
          <CardDescription>Eficiência do período de avaliação gratuita</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Total Trials */}
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-3xl font-bold">{totalTrialAccounts}</p>
              <p className="text-sm text-muted-foreground mt-1">Total de Trials</p>
            </div>
            
            {/* Still in Trial */}
            <div className="p-4 rounded-lg bg-blue-500/10 text-center">
              <p className="text-3xl font-bold text-blue-600">{stillInTrial}</p>
              <p className="text-sm text-muted-foreground mt-1">Em Trial Agora</p>
            </div>
            
            {/* Converted */}
            <div className="p-4 rounded-lg bg-emerald-500/10 text-center">
              <p className="text-3xl font-bold text-emerald-600">{convertedFromTrial}</p>
              <p className="text-sm text-muted-foreground mt-1">Converteram</p>
            </div>
            
            {/* Not Converted */}
            <div className="p-4 rounded-lg bg-red-500/10 text-center">
              <p className="text-3xl font-bold text-red-600">{expiredTrialNotConverted}</p>
              <p className="text-sm text-muted-foreground mt-1">Não Converteram</p>
            </div>
            
            {/* Conversion Rate */}
            <div className="p-4 rounded-lg bg-primary/10 text-center">
              <p className="text-3xl font-bold text-primary">{trialConversionRate.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Conversão</p>
            </div>
          </div>
          
          {/* Visual Bar */}
          {completedTrialAccounts > 0 && (
            <div className="mt-6">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Trials Finalizados: {completedTrialAccounts}</span>
                <span>Conversão: {trialConversionRate.toFixed(1)}%</span>
              </div>
              <div className="h-4 bg-muted rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${trialConversionRate}%` }}
                />
                <div 
                  className="h-full bg-red-400 transition-all duration-500"
                  style={{ width: `${100 - trialConversionRate}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span className="text-emerald-600">✓ Converteram ({convertedFromTrial})</span>
                <span className="text-red-600">✗ Não converteram ({expiredTrialNotConverted})</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Building2} label="Total de Contas" value={accounts.length} />
        <StatCard icon={UserCheck} label="Contas Ativas" value={activeAccounts} variant="success" />
        <StatCard icon={Activity} label="Em Trial" value={trialAccounts} variant="warning" />
        <StatCard icon={Users} label="Usuários" value={users.length} />
        <StatCard icon={Users} label="Clientes" value={totalClients} />
        <StatCard icon={Package} label="Planos Ativos" value={activeMainPlans} />
      </div>

      {/* Growth Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Crescimento de Assinaturas</CardTitle>
          <CardDescription className="text-sm">Evolução das contas nos últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <SubscriptionGrowthChart accounts={accounts} />
        </CardContent>
      </Card>

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
            <CardTitle className="text-base font-medium">Planos & Add-ons</CardTitle>
          </CardHeader>
          <CardContent>
            {plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum plano cadastrado</p>
            ) : (
              <div className="space-y-4">
                {/* Main Plans */}
                {mainPlans.filter(p => p.is_active).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Planos</p>
                    {mainPlans.filter(p => p.is_active).map(plan => {
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
                
                {/* Add-ons */}
                {addonPlans.filter(p => p.is_active).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add-ons</p>
                    {addonPlans.filter(p => p.is_active).map(plan => (
                      <div key={plan.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                        <span className="text-sm font-medium">{plan.name}</span>
                        <span className="text-sm text-muted-foreground">R$ {plan.price.toLocaleString('pt-BR')}/mês</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Subscription Growth Chart Component
function SubscriptionGrowthChart({ accounts }: { accounts: Account[] }) {
  // Generate last 6 months
  const now = new Date();
  const months = eachMonthOfInterval({
    start: subMonths(startOfMonth(now), 5),
    end: endOfMonth(now)
  });

  // Calculate cumulative accounts per month
  const chartData = months.map((month, index) => {
    const monthEnd = endOfMonth(month);
    
    // Count accounts created up to this month
    const totalAccounts = accounts.filter(a => new Date(a.created_at) <= monthEnd).length;
    
    // Count active accounts at end of this month
    const activeAccounts = accounts.filter(a => {
      const createdAt = new Date(a.created_at);
      return createdAt <= monthEnd && 
        (a.subscription_status === 'active' || a.subscription_status === 'trial');
    }).length;

    // New accounts in this specific month
    const newAccounts = accounts.filter(a => {
      const createdAt = new Date(a.created_at);
      return createdAt >= startOfMonth(month) && createdAt <= monthEnd;
    }).length;

    return {
      month: format(month, "MMM", { locale: ptBR }),
      fullMonth: format(month, "MMMM yyyy", { locale: ptBR }),
      total: totalAccounts,
      ativos: activeAccounts,
      novos: newAccounts
    };
  });

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorAtivos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="month" 
            axisLine={false} 
            tickLine={false}
            className="text-xs fill-muted-foreground"
          />
          <YAxis 
            axisLine={false} 
            tickLine={false}
            className="text-xs fill-muted-foreground"
            allowDecimals={false}
          />
          <Tooltip 
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-md">
                    <p className="text-sm font-medium capitalize mb-2">{data.fullMonth}</p>
                    <div className="space-y-1 text-xs">
                      <p className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Total acumulado:</span>
                        <span className="font-medium">{data.total}</span>
                      </p>
                      <p className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Ativos/Trial:</span>
                        <span className="font-medium text-emerald-500">{data.ativos}</span>
                      </p>
                      <p className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Novos no mês:</span>
                        <span className="font-medium text-primary">{data.novos}</span>
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area 
            type="monotone" 
            dataKey="total" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorTotal)" 
            name="Total"
          />
          <Area 
            type="monotone" 
            dataKey="ativos" 
            stroke="#22c55e" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorAtivos)" 
            name="Ativos"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Plan Card Component
function PlanCard({ 
  plan, 
  billingPeriodLabels, 
  onEdit, 
  onDelete,
  isAddon = false 
}: { 
  plan: SubscriptionPlan; 
  billingPeriodLabels: Record<string, string>;
  onEdit: (plan: SubscriptionPlan) => void;
  onDelete: (id: string) => void;
  isAddon?: boolean;
}) {
  return (
    <div 
      className={`group relative p-5 rounded-xl border bg-card hover:shadow-md transition-all ${!plan.is_active ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{plan.name}</h3>
            {isAddon && <Badge variant="secondary" className="text-xs">Add-on</Badge>}
          </div>
          {plan.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{plan.description}</p>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(plan)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(plan.id)}
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

      {(() => {
        const featuresArr = getFeaturesArray(plan.features);
        return featuresArr.length > 0 && (
          <div className="border-t mt-3 pt-3 text-xs space-y-0.5">
            {featuresArr.slice(0, 3).map((f, i) => (
              <div key={i} className="text-muted-foreground">✓ {f}</div>
            ))}
            {featuresArr.length > 3 && (
              <div className="text-muted-foreground/60">+{featuresArr.length - 3} mais</div>
            )}
          </div>
        );
      })()}
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
    is_active: true,
    plan_type: 'main'
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
      is_active: true,
      plan_type: 'main'
    });
    setEditingPlan(null);
  };

  const openEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    const hasTrial = (plan.trial_days || 0) > 0;
    
    // Handle features - could be array, object, or null
    let featuresText = '';
    if (plan.features) {
      if (Array.isArray(plan.features)) {
        featuresText = plan.features.join('\n');
      } else if (typeof plan.features === 'object') {
        // If it's an object, extract values or keys
        featuresText = Object.entries(plan.features)
          .filter(([_, v]) => v === true)
          .map(([k]) => k)
          .join('\n');
      }
    }
    
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
      features: featuresText,
      is_active: plan.is_active,
      plan_type: plan.plan_type || 'main'
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
        is_active: formData.is_active,
        plan_type: formData.plan_type
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-sm">Tipo</Label>
                  <Select value={formData.plan_type} onValueChange={v => setFormData(f => ({ ...f, plan_type: v }))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">Plano Principal</SelectItem>
                      <SelectItem value="addon">Complemento (Add-on)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch 
                    checked={formData.is_active} 
                    onCheckedChange={v => setFormData(f => ({ ...f, is_active: v }))} 
                  />
                  <Label className="text-sm">Plano ativo</Label>
                </div>
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
          <div className="space-y-8">
            {/* Planos Principais */}
            {plans.filter(p => p.plan_type !== 'addon').length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-4">Planos Principais</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {plans.filter(p => p.plan_type !== 'addon').map(plan => (
                    <PlanCard 
                      key={plan.id} 
                      plan={plan} 
                      billingPeriodLabels={billingPeriodLabels}
                      onEdit={openEdit}
                      onDelete={(id) => {
                        if (confirm('Excluir este plano?')) deleteMutation.mutate(id);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Complementos (Add-ons) */}
            {plans.filter(p => p.plan_type === 'addon').length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-4">Complementos (Add-ons)</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {plans.filter(p => p.plan_type === 'addon').map(plan => (
                    <PlanCard 
                      key={plan.id} 
                      plan={plan} 
                      billingPeriodLabels={billingPeriodLabels}
                      onEdit={openEdit}
                      onDelete={(id) => {
                        if (confirm('Excluir este plano?')) deleteMutation.mutate(id);
                      }}
                      isAddon
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Accounts Tab Component
function AccountsTab({ accounts, plans, allUsers, isLoading }: { accounts: Account[]; plans: SubscriptionPlan[]; allUsers: User[]; isLoading: boolean }) {
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
    plan_id: '',
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
    plan_id: '',
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
      plan_id: '',
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
      plan_id: account.plan_id || '',
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
          plan_id: createFormData.plan_id || null,
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
          plan_id: editFormData.plan_id || null,
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
                      <Label className="text-sm">Plano</Label>
                      <Select value={createFormData.plan_id || "none"} onValueChange={v => setCreateFormData(f => ({ ...f, plan_id: v === "none" ? "" : v }))}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione um plano" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem plano (Trial)</SelectItem>
                          {plans.filter(p => p.is_active).map(plan => (
                            <SelectItem key={plan.id} value={plan.id}>{plan.name} - R$ {plan.price.toLocaleString('pt-BR')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                  <TableHead className="font-medium">Plano</TableHead>
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="font-medium text-center">Usuários</TableHead>
                  <TableHead className="font-medium text-center">Clientes</TableHead>
                  <TableHead className="font-medium">Criada em</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map(account => {
                  const plan = plans.find(p => p.id === account.plan_id);
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
                    <Label className="text-sm">Plano</Label>
                    <Select value={editFormData.plan_id || "none"} onValueChange={v => setEditFormData(f => ({ ...f, plan_id: v === "none" ? "" : v }))}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione um plano" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem plano</SelectItem>
                        {plans.filter(p => p.is_active).map(plan => (
                          <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
