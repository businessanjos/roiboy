import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, MessageSquare, TrendingUp, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface GroupStats {
  group_name: string;
  message_count: number;
  unique_clients: number;
}

interface ClientGroupEngagement {
  client_id: string;
  client_name: string;
  client_avatar: string | null;
  total_messages: number;
  groups: string[];
}

export function GroupEngagementReport() {
  const [loading, setLoading] = useState(true);
  const [totalGroupMessages, setTotalGroupMessages] = useState(0);
  const [groupStats, setGroupStats] = useState<GroupStats[]>([]);
  const [clientEngagement, setClientEngagement] = useState<ClientGroupEngagement[]>([]);

  useEffect(() => {
    fetchGroupEngagement();
  }, []);

  const fetchGroupEngagement = async () => {
    setLoading(true);
    try {
      // Fetch all group messages with client info
      const { data: messages, error } = await supabase
        .from("message_events")
        .select(`
          id,
          group_name,
          client_id,
          clients!inner(id, full_name, avatar_url)
        `)
        .eq("is_group", true)
        .not("group_name", "is", null);

      if (error) {
        console.error("Error fetching group messages:", error);
        return;
      }

      if (!messages || messages.length === 0) {
        setLoading(false);
        return;
      }

      setTotalGroupMessages(messages.length);

      // Aggregate by group
      const groupMap = new Map<string, { count: number; clients: Set<string> }>();
      messages.forEach((msg: any) => {
        const groupName = msg.group_name || "Grupo Desconhecido";
        if (!groupMap.has(groupName)) {
          groupMap.set(groupName, { count: 0, clients: new Set() });
        }
        const group = groupMap.get(groupName)!;
        group.count++;
        group.clients.add(msg.client_id);
      });

      const groupStatsArray: GroupStats[] = Array.from(groupMap.entries())
        .map(([name, data]) => ({
          group_name: name,
          message_count: data.count,
          unique_clients: data.clients.size,
        }))
        .sort((a, b) => b.message_count - a.message_count);

      setGroupStats(groupStatsArray);

      // Aggregate by client
      const clientMap = new Map<string, { 
        name: string; 
        avatar: string | null; 
        messages: number; 
        groups: Set<string> 
      }>();
      
      messages.forEach((msg: any) => {
        const clientId = msg.client_id;
        const client = msg.clients as any;
        if (!clientMap.has(clientId)) {
          clientMap.set(clientId, {
            name: client.full_name,
            avatar: client.avatar_url,
            messages: 0,
            groups: new Set(),
          });
        }
        const clientData = clientMap.get(clientId)!;
        clientData.messages++;
        if (msg.group_name) {
          clientData.groups.add(msg.group_name);
        }
      });

      const clientEngagementArray: ClientGroupEngagement[] = Array.from(clientMap.entries())
        .map(([id, data]) => ({
          client_id: id,
          client_name: data.name,
          client_avatar: data.avatar,
          total_messages: data.messages,
          groups: Array.from(data.groups),
        }))
        .sort((a, b) => b.total_messages - a.total_messages)
        .slice(0, 10); // Top 10 clients

      setClientEngagement(clientEngagementArray);
    } catch (error) {
      console.error("Error in fetchGroupEngagement:", error);
    } finally {
      setLoading(false);
    }
  };

  const maxClientMessages = clientEngagement.length > 0 
    ? Math.max(...clientEngagement.map(c => c.total_messages)) 
    : 1;

  const maxGroupMessages = groupStats.length > 0 
    ? Math.max(...groupStats.map(g => g.message_count)) 
    : 1;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (totalGroupMessages === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma mensagem de grupo encontrada</p>
            <p className="text-sm mt-1">
              Mensagens de grupos do WhatsApp aparecerão aqui quando capturadas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <MessageSquare className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalGroupMessages.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Mensagens em grupos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Hash className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{groupStats.length}</p>
                <p className="text-sm text-muted-foreground">Grupos ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Users className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clientEngagement.length}</p>
                <p className="text-sm text-muted-foreground">Clientes participantes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Top Clientes em Grupos
            </CardTitle>
            <CardDescription>
              Clientes com mais participação em grupos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clientEngagement.map((client, index) => (
                <div key={client.client_id} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      index === 0 ? "bg-amber-500 text-white" :
                      index === 1 ? "bg-slate-400 text-white" :
                      index === 2 ? "bg-amber-700 text-white" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {index + 1}
                    </span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={client.client_avatar || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {client.client_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{client.client_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.total_messages} mensagens · {client.groups.length} grupo{client.groups.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <Progress 
                    value={(client.total_messages / maxClientMessages) * 100} 
                    className="h-1.5"
                  />
                  <div className="flex flex-wrap gap-1">
                    {client.groups.slice(0, 3).map((group) => (
                      <Badge key={group} variant="secondary" className="text-xs">
                        {group}
                      </Badge>
                    ))}
                    {client.groups.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{client.groups.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Groups Ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              Grupos Mais Ativos
            </CardTitle>
            <CardDescription>
              Grupos com mais mensagens de clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {groupStats.slice(0, 10).map((group, index) => (
                <div key={group.group_name} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      index === 0 ? "bg-indigo-500 text-white" :
                      index === 1 ? "bg-indigo-400 text-white" :
                      index === 2 ? "bg-indigo-300 text-white" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {index + 1}
                    </span>
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                      <Users className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{group.group_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.message_count} mensagens · {group.unique_clients} cliente{group.unique_clients !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <Progress 
                    value={(group.message_count / maxGroupMessages) * 100} 
                    className="h-1.5"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
