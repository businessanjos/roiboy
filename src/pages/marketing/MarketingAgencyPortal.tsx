import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { startOfMonth, endOfMonth, subDays } from "date-fns";
import { useCurrentAgency } from "@/hooks/useCurrentAgency";
import { useAgencyMetrics } from "@/hooks/useAgencyMetrics";
import { AgencyKpiGrid } from "@/components/marketing/agencies/AgencyKpiGrid";
import { AgencyCampaignsTable } from "@/components/marketing/agencies/AgencyCampaignsTable";
import { MaterialRequestsList } from "@/components/marketing/agencies/MaterialRequestsList";
import { MaterialRequestWizard } from "@/components/marketing/agencies/MaterialRequestWizard";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const RANGES = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "Mês atual", month: true },
];

export default function MarketingAgencyPortal() {
  const { agency, isLoading, isAgencyUser } = useCurrentAgency();
  const [rangeKey, setRangeKey] = useState("Mês atual");
  const [wizardOpen, setWizardOpen] = useState(false);

  const now = new Date();
  const range = (() => {
    const r = RANGES.find((x) => x.label === rangeKey)!;
    if (r.month) return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    return { startDate: subDays(now, r.days || 0), endDate: now };
  })();

  const { data: metrics } = useAgencyMetrics(agency?.id, range);

  if (isLoading) return <div className="p-6">Carregando...</div>;
  if (!isAgencyUser) return <Navigate to="/marketing/dashboard" replace />;
  if (!agency) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Você ainda não foi vinculado a uma agência. Peça ao time interno do ROY para te vincular.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full" style={{ background: agency.color }} />
            <h1 className="text-2xl font-bold">{agency.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground">Portal da agência</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {RANGES.map((r) => (
            <Button key={r.label} size="sm" variant={rangeKey === r.label ? "default" : "outline"} onClick={() => setRangeKey(r.label)}>
              {r.label}
            </Button>
          ))}
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Solicitar material
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dash">
        <TabsList>
          <TabsTrigger value="dash">Dashboard</TabsTrigger>
          <TabsTrigger value="campaigns">Minhas campanhas</TabsTrigger>
          <TabsTrigger value="requests">Solicitações</TabsTrigger>
        </TabsList>

        <TabsContent value="dash" className="space-y-4 mt-4">
          {metrics && <AgencyKpiGrid metrics={metrics} />}
          {metrics && (
            <Card>
              <CardHeader><CardTitle className="text-base">Evolução</CardTitle></CardHeader>
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

        <TabsContent value="requests" className="mt-4">
          <MaterialRequestsList agencyId={agency.id} agencyView />
        </TabsContent>
      </Tabs>

      <MaterialRequestWizard open={wizardOpen} onOpenChange={setWizardOpen} agencyId={agency.id} />
    </div>
  );
}
