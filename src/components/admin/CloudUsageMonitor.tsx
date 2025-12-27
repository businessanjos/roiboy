import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Database, 
  HardDrive, 
  Zap, 
  Users, 
  MessageSquare, 
  FileImage,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Activity
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

interface UsageMetric {
  label: string;
  current: number;
  limit: number | null;
  unit: string;
  icon: React.ElementType;
  status: 'ok' | 'warning' | 'critical';
}

export function CloudUsageMonitor() {
  // Fetch database usage stats
  const { data: dbStats, isLoading: loadingDb } = useQuery({
    queryKey: ['admin-cloud-db-stats'],
    queryFn: async () => {
      // Get row counts from main tables
      const tables = [
        'accounts', 'users', 'clients', 'client_contracts', 
        'message_events', 'zapp_messages', 'attendance', 
        'events', 'tasks', 'notifications', 'audit_logs'
      ];
      
      const counts: Record<string, number> = {};
      
      for (const table of tables) {
        const { count } = await supabase
          .from(table as any)
          .select('*', { count: 'exact', head: true });
        counts[table] = count || 0;
      }
      
      return counts;
    },
    staleTime: 60000 // 1 minute
  });

  // Fetch edge function invocations (from ai_usage_logs as proxy)
  const { data: edgeFunctionStats, isLoading: loadingEdge } = useQuery({
    queryKey: ['admin-cloud-edge-stats'],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30);
      
      // Get AI usage as proxy for edge function usage
      const { data: aiLogs, count: aiCount } = await supabase
        .from('ai_usage_logs')
        .select('created_at', { count: 'exact' })
        .gte('created_at', thirtyDaysAgo.toISOString());
      
      // Get webhook activity from message_events
      const { count: messageCount } = await supabase
        .from('message_events')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());
      
      // Get reminder logs count (using audit_logs as proxy)
      const { count: reminderCount } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('entity_type', 'reminder')
        .gte('created_at', thirtyDaysAgo.toISOString());
      
      return {
        aiInvocations: aiCount || 0,
        webhookInvocations: messageCount || 0,
        reminderInvocations: reminderCount || 0,
        totalInvocations: (aiCount || 0) + (messageCount || 0) + (reminderCount || 0)
      };
    },
    staleTime: 60000
  });

  // Fetch storage usage (from clients with avatar/logo URLs)
  const { data: storageStats, isLoading: loadingStorage } = useQuery({
    queryKey: ['admin-cloud-storage-stats'],
    queryFn: async () => {
      // Count clients with avatars
      const { count: avatarCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .not('avatar_url', 'is', null);
      
      // Count clients with logos
      const { count: logoCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .not('logo_url', 'is', null);
      
      // Count users with avatars
      const { count: userAvatarCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .not('avatar_url', 'is', null);
      
      // Count contract files
      const { count: contractFileCount } = await supabase
        .from('client_contracts')
        .select('*', { count: 'exact', head: true })
        .not('file_url', 'is', null);
      
      // Count followup files
      const { count: followupFileCount } = await supabase
        .from('client_followups')
        .select('*', { count: 'exact', head: true })
        .not('file_url', 'is', null);
      
      return {
        clientAvatars: avatarCount || 0,
        clientLogos: logoCount || 0,
        userAvatars: userAvatarCount || 0,
        contractFiles: contractFileCount || 0,
        followupFiles: followupFileCount || 0,
        totalFiles: (avatarCount || 0) + (logoCount || 0) + (userAvatarCount || 0) + (contractFileCount || 0) + (followupFileCount || 0)
      };
    },
    staleTime: 60000
  });

  // Fetch daily activity for chart
  const { data: dailyActivity, isLoading: loadingDaily } = useQuery({
    queryKey: ['admin-cloud-daily-activity'],
    queryFn: async () => {
      const days = 14;
      const result = [];
      
      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        
        // Get message count for that day
        const { count: messages } = await supabase
          .from('message_events')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString());
        
        // Get AI analyses for that day
        const { count: aiAnalyses } = await supabase
          .from('ai_usage_logs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString());
        
        result.push({
          date: format(date, 'dd/MM', { locale: ptBR }),
          messages: messages || 0,
          ai: aiAnalyses || 0
        });
      }
      
      return result;
    },
    staleTime: 300000 // 5 minutes
  });

  // Fetch per-account usage
  const { data: accountUsage, isLoading: loadingAccountUsage } = useQuery({
    queryKey: ['admin-cloud-account-usage'],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30);
      
      // Get accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, name')
        .order('name');
      
      if (!accounts) return [];
      
      const usage = await Promise.all(accounts.map(async (account) => {
        // Get client count
        const { count: clientCount } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('account_id', account.id);
        
        // Get message count (last 30 days)
        const { count: messageCount } = await supabase
          .from('message_events')
          .select('*', { count: 'exact', head: true })
          .eq('account_id', account.id)
          .gte('created_at', thirtyDaysAgo.toISOString());
        
        // Get AI usage count (last 30 days)
        const { count: aiCount } = await supabase
          .from('ai_usage_logs')
          .select('*', { count: 'exact', head: true })
          .eq('account_id', account.id)
          .gte('created_at', thirtyDaysAgo.toISOString());
        
        return {
          id: account.id,
          name: account.name,
          clients: clientCount || 0,
          messages: messageCount || 0,
          aiAnalyses: aiCount || 0
        };
      }));
      
      // Sort by total activity
      return usage.sort((a, b) => (b.messages + b.aiAnalyses) - (a.messages + a.aiAnalyses));
    },
    staleTime: 300000
  });

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const isLoading = loadingDb || loadingEdge || loadingStorage;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Monitoramento Cloud</h2>
          <p className="text-sm text-muted-foreground">
            Visão geral do uso de recursos do backend
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Activity className="h-3 w-3" />
          Atualizado agora
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Database Rows */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Registros no Banco
              </CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingDb ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatNumber(Object.values(dbStats || {}).reduce((a, b) => a + b, 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Distribuídos em {Object.keys(dbStats || {}).length} tabelas
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Edge Function Invocations */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Invocações (30d)
              </CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingEdge ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatNumber(edgeFunctionStats?.totalInvocations || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Webhooks + AI + Lembretes
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Storage Files */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Arquivos no Storage
              </CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingStorage ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatNumber(storageStats?.totalFiles || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Avatares, logos, contratos
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Active Accounts */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contas Ativas
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingAccountUsage ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {accountUsage?.filter(a => a.messages > 0 || a.aiAnalyses > 0).length || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Com atividade nos últimos 30 dias
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Database Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              Distribuição por Tabela
            </CardTitle>
            <CardDescription>Principais tabelas do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDb ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(dbStats || {})
                  .sort(([,a], [,b]) => b - a)
                  .map(([table, count]) => {
                    const maxCount = Math.max(...Object.values(dbStats || { x: 1 }));
                    const percentage = (count / maxCount) * 100;
                    
                    return (
                      <div key={table} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{table}</span>
                          <span className="font-medium">{formatNumber(count)}</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edge Functions Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Detalhes de Invocações
            </CardTitle>
            <CardDescription>Últimos 30 dias por tipo</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingEdge ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">Webhooks WhatsApp</p>
                      <p className="text-xs text-muted-foreground">Mensagens processadas</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold">
                    {formatNumber(edgeFunctionStats?.webhookInvocations || 0)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="font-medium">Análises IA</p>
                      <p className="text-xs text-muted-foreground">Processamento automático</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold">
                    {formatNumber(edgeFunctionStats?.aiInvocations || 0)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Lembretes</p>
                      <p className="text-xs text-muted-foreground">Envios agendados</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold">
                    {formatNumber(edgeFunctionStats?.reminderInvocations || 0)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Atividade Diária
          </CardTitle>
          <CardDescription>Mensagens e análises IA nos últimos 14 dias</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDaily ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="messages" 
                  stackId="1"
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary)/0.3)"
                  name="Mensagens"
                />
                <Area 
                  type="monotone" 
                  dataKey="ai" 
                  stackId="1"
                  stroke="hsl(var(--chart-2))" 
                  fill="hsl(var(--chart-2)/0.3)"
                  name="Análises IA"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Accounts by Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Top Contas por Uso
          </CardTitle>
          <CardDescription>Contas com maior atividade nos últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAccountUsage ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {accountUsage?.slice(0, 10).map((account, index) => (
                <div 
                  key={account.id} 
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-6">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {account.clients} clientes
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <p className="font-medium">{formatNumber(account.messages)}</p>
                      <p className="text-xs text-muted-foreground">msgs</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatNumber(account.aiAnalyses)}</p>
                      <p className="text-xs text-muted-foreground">IA</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {(!accountUsage || accountUsage.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma atividade registrada
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storage Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            Detalhes do Storage
          </CardTitle>
          <CardDescription>Arquivos armazenados por categoria</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStorage ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[1,2,3,4,5].map(i => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <FileImage className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                <p className="text-xl font-bold">{storageStats?.clientAvatars || 0}</p>
                <p className="text-xs text-muted-foreground">Avatares Clientes</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <FileImage className="h-6 w-6 mx-auto text-purple-500 mb-2" />
                <p className="text-xl font-bold">{storageStats?.clientLogos || 0}</p>
                <p className="text-xs text-muted-foreground">Logos Clientes</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <FileImage className="h-6 w-6 mx-auto text-green-500 mb-2" />
                <p className="text-xl font-bold">{storageStats?.userAvatars || 0}</p>
                <p className="text-xs text-muted-foreground">Avatares Usuários</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <FileImage className="h-6 w-6 mx-auto text-orange-500 mb-2" />
                <p className="text-xl font-bold">{storageStats?.contractFiles || 0}</p>
                <p className="text-xs text-muted-foreground">Contratos</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <FileImage className="h-6 w-6 mx-auto text-red-500 mb-2" />
                <p className="text-xl font-bold">{storageStats?.followupFiles || 0}</p>
                <p className="text-xs text-muted-foreground">Arquivos Followup</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
