import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusIndicator, QuadrantIndicator, TrendIndicator } from "@/components/ui/status-indicator";
import { ScoreBadge } from "@/components/ui/score-badge";
import {
  Users,
  AlertTriangle,
  TrendingUp,
  Search,
  Plus,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface ClientWithScore {
  id: string;
  full_name: string;
  phone_e164: string;
  status: "active" | "paused" | "churn_risk" | "churned";
  roizometer: number;
  escore: number;
  quadrant: "highE_lowROI" | "lowE_highROI" | "lowE_lowROI" | "highE_highROI";
  trend: "up" | "flat" | "down";
  last_risk?: string;
  recommendation?: string;
}

export default function Dashboard() {
  const [clients, setClients] = useState<ClientWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [quadrantFilter, setQuadrantFilter] = useState<string>("all");

  const fetchClients = async () => {
    setLoading(true);
    try {
      // Fetch clients with their latest score snapshots
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (clientsError) throw clientsError;

      // Fetch latest scores for each client
      const clientsWithScores: ClientWithScore[] = await Promise.all(
        (clientsData || []).map(async (client) => {
          const { data: scoreData } = await supabase
            .from("score_snapshots")
            .select("*")
            .eq("client_id", client.id)
            .order("computed_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const { data: riskData } = await supabase
            .from("risk_events")
            .select("reason")
            .eq("client_id", client.id)
            .order("happened_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const { data: recData } = await supabase
            .from("recommendations")
            .select("action_text")
            .eq("client_id", client.id)
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: client.id,
            full_name: client.full_name,
            phone_e164: client.phone_e164,
            status: client.status as ClientWithScore["status"],
            roizometer: scoreData?.roizometer ?? 0,
            escore: scoreData?.escore ?? 0,
            quadrant: (scoreData?.quadrant as ClientWithScore["quadrant"]) ?? "lowE_lowROI",
            trend: (scoreData?.trend as ClientWithScore["trend"]) ?? "flat",
            last_risk: riskData?.reason,
            recommendation: recData?.action_text,
          };
        })
      );

      setClients(clientsWithScores);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone_e164.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || client.status === statusFilter;
    const matchesQuadrant = quadrantFilter === "all" || client.quadrant === quadrantFilter;
    return matchesSearch && matchesStatus && matchesQuadrant;
  });

  const totalClients = clients.length;
  const churnRiskCount = clients.filter((c) => c.status === "churn_risk" || c.status === "churned").length;
  const topRiskClients = [...clients]
    .filter((c) => c.status === "churn_risk" || c.status === "churned")
    .sort((a, b) => a.roizometer - b.roizometer)
    .slice(0, 5);

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral dos seus clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchClients} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button asChild>
            <Link to="/clients/new">
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Clientes</p>
                <p className="text-3xl font-bold text-foreground">{totalClients}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Em Risco</p>
                <p className="text-3xl font-bold text-danger">{churnRiskCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-danger/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-danger" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card col-span-1 sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Top 5 em Risco</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {topRiskClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cliente em risco</p>
            ) : (
              <div className="space-y-2">
                {topRiskClients.map((client) => (
                  <Link
                    key={client.id}
                    to={`/clients/${client.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">{client.full_name}</span>
                    <ScoreBadge score={client.roizometer} size="sm" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Saudável</SelectItem>
                <SelectItem value="churn_risk">Em Risco</SelectItem>
                <SelectItem value="churned">Crítico</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={quadrantFilter} onValueChange={setQuadrantFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Quadrante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="highE_highROI">Encantado</SelectItem>
                <SelectItem value="highE_lowROI">Risco de Cobrança</SelectItem>
                <SelectItem value="lowE_highROI">Risco Silencioso</SelectItem>
                <SelectItem value="lowE_lowROI">Churn Iminente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  ROIzômetro
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  E-Score
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tendência
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Quadrante
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Último Alerta
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Carregando...
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    {clients.length === 0
                      ? "Nenhum cliente cadastrado. Adicione seu primeiro cliente!"
                      : "Nenhum cliente encontrado com os filtros aplicados."}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{client.full_name}</p>
                        <p className="text-sm text-muted-foreground">{client.phone_e164}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={client.roizometer} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge score={client.escore} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <TrendIndicator trend={client.trend} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <QuadrantIndicator quadrant={client.quadrant} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-muted-foreground max-w-48 truncate">
                        {client.last_risk || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/clients/${client.id}`}>
                          Ver <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
