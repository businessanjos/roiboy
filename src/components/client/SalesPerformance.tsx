import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MentionInput } from "@/components/ui/mention-input";
import { 
  Target, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Calendar,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Camera,
  Paperclip,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface SalesGoal {
  id: string;
  period_start: string;
  period_end: string;
  goal_amount: number;
  currency: string;
}

interface SalesRecord {
  id: string;
  sale_date: string;
  amount: number;
  description: string | null;
  currency: string;
}

interface SalesPerformanceProps {
  clientId: string;
}

export function SalesPerformance({ clientId }: SalesPerformanceProps) {
  const [goals, setGoals] = useState<SalesGoal[]>([]);
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Quick comment state
  const [quickComment, setQuickComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatar_url: string | null; account_id: string } | null>(null);
  
  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCurrentUser = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, name, avatar_url, account_id")
      .single();
    if (data) setCurrentUser(data);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const [goalsResult, salesResult] = await Promise.all([
        supabase
          .from("sales_goals")
          .select("*")
          .eq("client_id", clientId)
          .order("period_start", { ascending: false }),
        supabase
          .from("sales_records")
          .select("*")
          .eq("client_id", clientId)
          .order("sale_date", { ascending: false }),
      ]);

      setGoals((goalsResult.data || []) as SalesGoal[]);
      setSales((salesResult.data || []) as SalesRecord[]);
      setLoading(false);
    };

    fetchData();
    fetchCurrentUser();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`sales-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_goals', filter: `client_id=eq.${clientId}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_records', filter: `client_id=eq.${clientId}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Calculate performance for each goal
  const getGoalPerformance = (goal: SalesGoal) => {
    const goalSales = sales.filter((s) => {
      const saleDate = new Date(s.sale_date);
      return saleDate >= new Date(goal.period_start) && saleDate <= new Date(goal.period_end);
    });
    
    const totalSales = goalSales.reduce((sum, s) => sum + Number(s.amount), 0);
    const percentage = goal.goal_amount > 0 ? (totalSales / goal.goal_amount) * 100 : 0;
    const isCurrentPeriod = new Date() >= new Date(goal.period_start) && new Date() <= new Date(goal.period_end);
    const isPastPeriod = new Date() > new Date(goal.period_end);
    
    return {
      totalSales,
      percentage: Math.min(percentage, 100),
      actualPercentage: percentage,
      salesCount: goalSales.length,
      isCurrentPeriod,
      isPastPeriod,
      goalMet: totalSales >= goal.goal_amount,
    };
  };

  // Calculate totals
  const totalGoals = goals.reduce((sum, g) => sum + Number(g.goal_amount), 0);
  const totalSalesAmount = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  const overallPercentage = totalGoals > 0 ? (totalSalesAmount / totalGoals) * 100 : 0;

  const handleQuickComment = async () => {
    if (!quickComment.trim() || !currentUser) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from("client_followups").insert({
        account_id: currentUser.account_id,
        client_id: clientId,
        user_id: currentUser.id,
        type: "sales_note",
        title: null,
        content: quickComment.trim(),
      });

      if (error) throw error;
      toast.success("Nota de vendas adicionada!");
      setQuickComment("");
    } catch (error: any) {
      console.error("Error adding note:", error);
      toast.error(error.message || "Erro ao adicionar nota");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuickComment();
    }
  };

  const handleQuickFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${clientId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("client-followups")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("client-followups")
        .getPublicUrl(fileName);

      const { error } = await supabase.from("client_followups").insert({
        account_id: currentUser.account_id,
        client_id: clientId,
        user_id: currentUser.id,
        type: type,
        title: file.name,
        content: null,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
      });

      if (error) throw error;
      toast.success(type === "image" ? "Imagem enviada!" : "Arquivo enviado!");
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {goals.length === 0 && sales.length === 0 ? (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            Nenhuma meta ou venda registrada para este cliente.
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Os dados serão sincronizados automaticamente do Clínica Ryka.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Meta Total</p>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(totalGoals)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Vendido</p>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(totalSalesAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`bg-gradient-to-br ${overallPercentage >= 100 ? 'from-emerald-500/5 to-emerald-500/10 border-emerald-500/20' : overallPercentage >= 70 ? 'from-amber-500/5 to-amber-500/10 border-amber-500/20' : 'from-destructive/5 to-destructive/10 border-destructive/20'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${overallPercentage >= 100 ? 'bg-emerald-500/10' : overallPercentage >= 70 ? 'bg-amber-500/10' : 'bg-destructive/10'}`}>
                    {overallPercentage >= 100 ? (
                      <TrendingUp className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <TrendingDown className={`h-5 w-5 ${overallPercentage >= 70 ? 'text-amber-500' : 'text-destructive'}`} />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Desempenho</p>
                    <p className={`text-lg font-bold ${overallPercentage >= 100 ? 'text-emerald-500' : overallPercentage >= 70 ? 'text-amber-500' : 'text-destructive'}`}>
                      {overallPercentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Goals with Progress */}
          {goals.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground">Metas por Período</h3>
              <div className="space-y-3">
                {goals.map((goal) => {
                  const perf = getGoalPerformance(goal);
                  return (
                    <div
                      key={goal.id}
                      className={`p-4 rounded-lg border ${
                        perf.isCurrentPeriod 
                          ? 'bg-primary/5 border-primary/30' 
                          : perf.isPastPeriod && perf.goalMet 
                            ? 'bg-emerald-500/5 border-emerald-500/20' 
                            : perf.isPastPeriod 
                              ? 'bg-muted/30 border-border' 
                              : 'bg-card border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {format(new Date(goal.period_start), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(goal.period_end), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          {perf.isCurrentPeriod && (
                            <Badge variant="default" className="text-xs">Atual</Badge>
                          )}
                          {perf.isPastPeriod && perf.goalMet && (
                            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Atingida
                            </Badge>
                          )}
                          {perf.isPastPeriod && !perf.goalMet && (
                            <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Não atingida
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {perf.salesCount} venda{perf.salesCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {formatCurrency(perf.totalSales)} de {formatCurrency(goal.goal_amount)}
                          </span>
                          <span className={`font-medium ${
                            perf.actualPercentage >= 100 
                              ? 'text-emerald-500' 
                              : perf.actualPercentage >= 70 
                                ? 'text-amber-500' 
                                : 'text-muted-foreground'
                          }`}>
                            {perf.actualPercentage.toFixed(1)}%
                          </span>
                        </div>
                        <Progress 
                          value={perf.percentage} 
                          className={`h-2 ${
                            perf.actualPercentage >= 100 
                              ? '[&>div]:bg-emerald-500' 
                              : perf.actualPercentage >= 70 
                                ? '[&>div]:bg-amber-500' 
                                : ''
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Sales */}
          {sales.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground">Vendas Recentes</h3>
              <div className="space-y-2">
                {sales.slice(0, 10).map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-emerald-500/10 rounded">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {formatCurrency(sale.amount)}
                        </p>
                        {sale.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {sale.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(sale.sale_date), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick Comment Input - Bottom position */}
      {currentUser && (
        <div className="flex gap-3 pt-4 border-t">
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage src={currentUser.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {currentUser.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 relative">
            <MentionInput
              placeholder="Escreva uma nota sobre vendas... Use @ para mencionar"
              value={quickComment}
              onChange={setQuickComment}
              onKeyDown={handleQuickKeyDown}
              className="pr-24"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleQuickFileSelect(e, "image")}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleQuickFileSelect(e, "file")}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading || saving}
                className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                title="Enviar imagem"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || saving}
                className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                title="Enviar arquivo"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
