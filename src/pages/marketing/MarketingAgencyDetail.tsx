import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus } from "lucide-react";
import { startOfMonth, endOfMonth, subDays } from "date-fns";
import { useTrafficAgency } from "@/hooks/useTrafficAgencies";
import { useAgencyMetrics } from "@/hooks/useAgencyMetrics";
import { AgencyKpiGrid } from "@/components/marketing/agencies/AgencyKpiGrid";
import { AgencyCampaignsTable } from "@/components/marketing/agencies/AgencyCampaignsTable";
import { AgencyFunnel } from "@/components/marketing/agencies/AgencyFunnel";
import { MaterialRequestsList } from "@/components/marketing/agencies/MaterialRequestsList";
import { MaterialRequestWizard } from "@/components/marketing/agencies/MaterialRequestWizard";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const RANGES = [
  { label: "Hoje", days: 0 },
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "Mês atual", month: true },
];

export default function MarketingAgencyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rangeKey, setRangeKey] = useState<string>("Mês atual");
  const [wizardOpen, setWizardOpen] = useState(false);

  const now = new Date();
  const range = (() => {
    const r = RANGES.find((x) => x.label === rangeKey)!;
    if (r.month) return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    return { startDate: subDays(now, r.days || 0), endDate: now };
  })();

  const { data: agency } = useTrafficAgency(id);
  const { data: metrics } = useAgencyMetrics(id, range);

  if (!agency) return <div className="p-6">Carregando...</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/marketing/agencias")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-full" style={{ background: agency.color }} />
              <h1 className="text-2xl font-bold">{agency.name}</h1>
            </div>
            {agency.contact_name && (
              <p className="text-sm text-muted-foreground">{agency.contact_name} · {agency.contact_email}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Button
              key={r.label}
              size="sm"
              variant={rangeKey === r.label ? "default" : "outline"}
              onClick={() => setRangeKey(r.label)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="funnel">Funil</TabsTrigger>
          <TabsTrigger value="requests">Solicitações</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {metrics && <AgencyKpiGrid metrics={metrics} />}
          {metrics && (
            <Card>
              <CardHeader><CardTitle className="text-base">Evolução no período</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.daily}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="leads" stroke="#3b82f6" name="Leads" />
                    <Line type="monotone" dataKey="mql" stroke="#a855f7" name="MQL" />
                    <Line type="monotone" dataKey="vendas" stroke="#10b981" name="Vendas" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          {metrics && <AgencyCampaignsTable campaigns={metrics.campaigns} />}
        </TabsContent>

        <TabsContent value="funnel" className="mt-4">
          {metrics && (
            <AgencyFunnel
              lead={metrics.funnel.lead}
              mql={metrics.funnel.mql}
              vendas={metrics.funnel.vendas}
              color={agency.color}
            />
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setWizardOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nova solicitação
            </Button>
          </div>
          <MaterialRequestsList agencyId={id} />
        </TabsContent>
      </Tabs>

      {id && <MaterialRequestWizard open={wizardOpen} onOpenChange={setWizardOpen} agencyId={id} />}
    </div>
  );
}
