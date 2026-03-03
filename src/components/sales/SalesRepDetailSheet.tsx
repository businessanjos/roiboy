import { useState, useEffect, forwardRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Phone, 
  Target, 
  Trophy, 
  CheckCircle2,
  Clock,
  Play,
  FileText,
  TrendingUp,
  TrendingDown,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SalesRepMetrics } from "@/hooks/useSalesTeamMetrics";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/dateUtils";

interface SalesRepDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rep: SalesRepMetrics | null;
}

interface Call {
  id: string;
  phone_e164: string;
  contact_name: string | null;
  direction: string;
  status: string;
  duration_seconds: number;
  outcome: string | null;
  notes: string | null;
  recording_url: string | null;
  transcription_summary: string | null;
  created_at: string;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  status: string;
  stage?: { name: string; color: string } | null;
  client?: { full_name: string } | null;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  activity_type?: { name: string; color: string; icon: string } | null;
}

export const SalesRepDetailSheet = forwardRef<HTMLDivElement, SalesRepDetailSheetProps>(
  function SalesRepDetailSheet({ open, onOpenChange, rep }, ref) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("calls");

  useEffect(() => {
    if (open && rep) {
      fetchDetails();
    }
  }, [open, rep]);

  const fetchDetails = async () => {
    if (!rep) return;
    
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [callsRes, dealsRes, tasksRes] = await Promise.all([
        supabase
          .from("zapp_calls")
          .select("*")
          .eq("user_id", rep.user_id)
          .gte("created_at", thirtyDaysAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(50),
        
        supabase
          .from("deals")
          .select(`
            id, title, value, status, created_at,
            stage:deal_stages(name, color),
            client:clients(full_name)
          `)
          .eq("responsible_user_id", rep.user_id)
          .order("created_at", { ascending: false })
          .limit(50),
        
        supabase
          .from("internal_tasks")
          .select(`
            id, title, due_date, completed_at,
            activity_type:activity_types(name, color, icon)
          `)
          .eq("assigned_to", rep.user_id)
          .gte("created_at", thirtyDaysAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (callsRes.data) setCalls(callsRes.data);
      if (dealsRes.data) setDeals(dealsRes.data as Deal[]);
      if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    } catch (error) {
      console.error("Error fetching rep details:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0s";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  if (!rep) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={rep.user_avatar || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium text-lg">
                {getInitials(rep.user_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-xl">{rep.user_name}</SheetTitle>
              <p className="text-sm text-muted-foreground">{rep.user_email}</p>
            </div>
          </div>
        </SheetHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-2 py-4">
          <Card className="bg-blue-500/10 border-blue-500/20">
            <CardContent className="p-3 text-center">
              <Phone className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-blue-600">{rep.total_calls}</p>
              <p className="text-[10px] text-muted-foreground">Ligações</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-500/10 border-purple-500/20">
            <CardContent className="p-3 text-center">
              <Target className="h-4 w-4 text-purple-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-purple-600">{rep.open_deals}</p>
              <p className="text-[10px] text-muted-foreground">Negócios</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-500/10 border-emerald-500/20">
            <CardContent className="p-3 text-center">
              <Trophy className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-emerald-600">{rep.won_deals}</p>
              <p className="text-[10px] text-muted-foreground">Ganhos</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/10 border-amber-500/20">
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-4 w-4 text-amber-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-amber-600">{rep.completed_tasks}</p>
              <p className="text-[10px] text-muted-foreground">Tarefas</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="calls" className="gap-1.5">
              <Phone className="h-4 w-4" />
              Ligações
            </TabsTrigger>
            <TabsTrigger value="deals" className="gap-1.5">
              <Target className="h-4 w-4" />
              Negócios
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Tarefas
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <>
                <TabsContent value="calls" className="mt-0 space-y-2">
                  {calls.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma ligação no período</p>
                    </div>
                  ) : (
                    calls.map((call) => (
                      <Card key={call.id} className="overflow-hidden">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-full ${
                                call.direction === "outbound" 
                                  ? "bg-blue-500/10" 
                                  : "bg-emerald-500/10"
                              }`}>
                                <Phone className={`h-4 w-4 ${
                                  call.direction === "outbound" 
                                    ? "text-blue-500" 
                                    : "text-emerald-500"
                                }`} />
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {call.contact_name || call.phone_e164}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(call.created_at), "dd/MM HH:mm", { locale: ptBR })}
                                  {" • "}
                                  {formatDuration(call.duration_seconds)}
                                </p>
                                {call.outcome && (
                                  <Badge variant="outline" className="mt-1 text-[10px]">
                                    {call.outcome}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {call.recording_url && (
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <Play className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {call.transcription_summary && (
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <FileText className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                          {call.notes && (
                            <p className="text-xs text-muted-foreground mt-2 pl-11">
                              {call.notes}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="deals" className="mt-0 space-y-2">
                  {deals.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum negócio no período</p>
                    </div>
                  ) : (
                    deals.map((deal) => (
                      <Card key={deal.id} className="overflow-hidden">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{deal.title}</p>
                              {deal.client?.full_name && (
                                <p className="text-xs text-muted-foreground">
                                  {deal.client.full_name}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {deal.stage && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-[10px] px-1.5"
                                    style={{ 
                                      borderColor: deal.stage.color,
                                      color: deal.stage.color 
                                    }}
                                  >
                                    {deal.stage.name}
                                  </Badge>
                                )}
                                <Badge 
                                  variant={deal.status === "won" ? "default" : deal.status === "lost" ? "destructive" : "secondary"}
                                  className="text-[10px] px-1.5"
                                >
                                  {deal.status === "won" ? "Ganho" : deal.status === "lost" ? "Perdido" : "Aberto"}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-sm">{formatCurrency(deal.value || 0)}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {format(new Date(deal.created_at), "dd/MM/yy", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="tasks" className="mt-0 space-y-2">
                  {tasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma tarefa no período</p>
                    </div>
                  ) : (
                    tasks.map((task) => (
                      <Card key={task.id} className="overflow-hidden">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-full ${
                              task.completed_at ? "bg-emerald-500/10" : "bg-amber-500/10"
                            }`}>
                              {task.completed_at ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <Clock className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{task.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {task.activity_type && (
                                  <Badge 
                                    variant="outline" 
                                    className="text-[10px] px-1.5"
                                    style={{ 
                                      borderColor: task.activity_type.color,
                                      color: task.activity_type.color 
                                    }}
                                  >
                                    {task.activity_type.name}
                                  </Badge>
                                )}
                                {task.due_date && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(parseLocalDate(task.due_date) || new Date(), "dd/MM", { locale: ptBR })}
                                  </span>
                                )}
                              </div>
                            </div>
                            {task.completed_at && (
                              <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                                Concluída
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </>
            )}
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
});
