import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from "recharts";
import { GraduationCap, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildEducationOptions, educationMatches } from "@/lib/dashboard/clientEducation";

interface Props {
  /** Clientes já filtrados pelo dashboard (produto/formação). */
  clients: Array<{ id: string; full_name: string; hasActiveContract?: boolean }>;
  educationById: Map<string, string | null>;
}

const chartConfig = { count: { label: "Clientes", color: "hsl(var(--primary))" } };

export function ClientsByEducationChart({ clients, educationById }: Props) {
  const [selected, setSelected] = useState<{ value: string; label: string } | null>(null);
  const [search, setSearch] = useState("");

  // Mesma régua de "Clientes por Produto": só clientes com contrato ativo.
  const active = useMemo(() => clients.filter((c) => c.hasActiveContract === true), [clients]);

  const data = useMemo(
    () => buildEducationOptions(active.map((c) => educationById.get(c.id) ?? null)),
    [active, educationById],
  );

  const people = useMemo(() => {
    if (!selected) return [];
    const q = search.trim().toLowerCase();
    return active
      .filter((c) => educationMatches(educationById.get(c.id) ?? null, selected.value))
      .filter((c) => !q || c.full_name?.toLowerCase().includes(q))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR"));
  }, [selected, search, active, educationById]);

  const open = (entry: any) => {
    const p = entry?.payload ?? entry;
    if (!p?.value) return;
    setSearch("");
    setSelected({ value: p.value, label: p.label });
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          Clientes por Formação
        </CardTitle>
        <CardDescription>Clientes com contrato ativo. Clique numa barra para ver quem são.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente ativo.</p>
        ) : (
          <div className="overflow-x-auto">
            <ChartContainer
              config={chartConfig}
              className="h-[300px]"
              style={{ minWidth: Math.max(data.length * 72, 480) }}
            >
              <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
                />
                <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[4, 4, 0, 0]}
                  className="cursor-pointer"
                  onClick={open}
                >
                  <LabelList dataKey="count" position="top" className="fill-foreground" fontSize={11} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.label}</DialogTitle>
            <DialogDescription>{people.length} cliente(s) com contrato ativo</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y rounded-md border">
            {people.map((c) => (
              <Link
                key={c.id}
                to={`/clients/${c.id}`}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50"
              >
                <span className="font-medium">{c.full_name}</span>
                <span className="text-xs text-muted-foreground">{educationById.get(c.id) || "Sem formação"}</span>
              </Link>
            ))}
            {people.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">Nenhum cliente encontrado.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
