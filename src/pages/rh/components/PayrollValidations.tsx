import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HRCollaborator } from "@/hooks/useHRCollaborators";
import { AlertTriangle, CheckCircle2, Calculator, Info, Wand2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  form: Partial<HRCollaborator>;
  setField: (key: string, value: any) => void;
}

const BRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const num = (v: any) => (typeof v === "number" && !isNaN(v) ? v : 0);

// tolerance: 1% ou R$ 1,00 — o que for maior
const isClose = (informed: number, expected: number) => {
  const tol = Math.max(1, Math.abs(expected) * 0.01);
  return Math.abs(informed - expected) <= tol;
};

interface Row {
  key: string;
  label: string;
  formula: string;
  expected: number;
  informed: number;
  fieldKey?: keyof HRCollaborator | string;
}

export default function PayrollValidations({ form, setField }: Props) {
  const base = num(form.base_salary);

  // Encargos esperados (com base no salário base)
  const expectedInssEmployer = base * 0.20;
  const expectedInssThird = base * 0.058;
  const expectedInssGilrat = base * 0.005;
  const expectedFgts = base * 0.08;
  const expectedVacation = base / 12;
  const expectedVacationThird = base / 36; // 1/3 sobre 1/12
  const expectedThirteenth = base / 12;

  const expectedTotalCharges =
    expectedInssEmployer +
    expectedInssThird +
    expectedInssGilrat +
    expectedFgts +
    expectedVacation +
    expectedVacationThird +
    expectedThirteenth;

  // Benefícios — soma dos componentes informados
  const expectedTotalBenefits =
    num(form.health_plan) +
    num(form.life_insurance) +
    num(form.meal_voucher) +
    num(form.transport_voucher) +
    num(form.home_office_allowance);

  // Custo total mensal = base + encargos informados + benefícios informados + outros custos
  const informedCharges = num(form.total_charges) || expectedTotalCharges;
  const informedBenefits = num(form.total_benefits) || expectedTotalBenefits;
  const expectedMonthlyCost =
    base + informedCharges + informedBenefits + num(form.other_costs);
  const expectedAnnualCost = num(form.monthly_total_cost)
    ? num(form.monthly_total_cost) * 12
    : expectedMonthlyCost * 12;

  const expectedCostPct = base > 0 ? (informedCharges / base) * 100 : 0;

  const rows: Row[] = [
    {
      key: "inss_employer",
      label: "INSS empresa (20%)",
      formula: "Salário base × 20%",
      expected: expectedInssEmployer,
      informed: num(form.inss_employer),
    },
    {
      key: "inss_third_parties",
      label: "INSS terceiros (5,8%)",
      formula: "Salário base × 5,8% (Sistema S)",
      expected: expectedInssThird,
      informed: num(form.inss_third_parties),
    },
    {
      key: "inss_gilrat",
      label: "INSS GILRAT (0,5%)",
      formula: "Salário base × 0,5% (RAT/FAP — pode variar 1–3%)",
      expected: expectedInssGilrat,
      informed: num(form.inss_gilrat),
    },
    {
      key: "fgts",
      label: "FGTS (8%)",
      formula: "Salário base × 8%",
      expected: expectedFgts,
      informed: num(form.fgts),
    },
    {
      key: "vacation_provision",
      label: "Férias 1/12",
      formula: "Salário base ÷ 12",
      expected: expectedVacation,
      informed: num(form.vacation_provision),
    },
    {
      key: "vacation_third",
      label: "1/3 de férias",
      formula: "(Salário base ÷ 12) ÷ 3",
      expected: expectedVacationThird,
      informed: num(form.vacation_third),
    },
    {
      key: "thirteenth_provision",
      label: "13º salário 1/12",
      formula: "Salário base ÷ 12",
      expected: expectedThirteenth,
      informed: num(form.thirteenth_provision),
    },
    {
      key: "total_charges",
      label: "Total de encargos",
      formula: "Soma de todos os encargos acima",
      expected: expectedTotalCharges,
      informed: num(form.total_charges),
    },
    {
      key: "total_benefits",
      label: "Total de benefícios",
      formula: "Plano + Vida + VA/VR + VT + Home office",
      expected: expectedTotalBenefits,
      informed: num(form.total_benefits),
    },
    {
      key: "cost_pct",
      label: "Custo % sobre salário",
      formula: "Total de encargos ÷ salário base × 100",
      expected: expectedCostPct,
      informed: num(form.cost_pct),
    },
    {
      key: "monthly_total_cost",
      label: "Custo total mensal",
      formula: "Salário base + Encargos + Benefícios + Outros custos",
      expected: expectedMonthlyCost,
      informed: num(form.monthly_total_cost),
    },
    {
      key: "annual_total_cost",
      label: "Custo anual",
      formula: "Custo mensal × 12",
      expected: expectedAnnualCost,
      informed: num(form.annual_total_cost),
    },
  ];

  const divergences = rows.filter((r) => !isClose(r.informed, r.expected));

  const applyAll = () => {
    rows.forEach((r) => {
      if (r.key === "cost_pct") {
        setField(r.key, Number(r.expected.toFixed(2)));
      } else {
        setField(r.key, Number(r.expected.toFixed(2)));
      }
    });
  };

  const fmt = (key: string, v: number) =>
    key === "cost_pct" ? `${v.toFixed(2)}%` : BRL(v);

  if (base <= 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Validações & Memória de cálculo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Informe o <strong>salário base</strong> para visualizar a memória de cálculo de INSS, FGTS,
            férias, 13º e divergências em relação à planilha.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Validações & Memória de cálculo
          </CardTitle>
          <div className="flex items-center gap-2">
            {divergences.length === 0 ? (
              <Badge variant="outline" className="border-emerald-500 text-emerald-600 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Tudo confere
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1">
                <AlertTriangle className="h-3 w-3" /> {divergences.length} divergência(s)
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={applyAll} className="gap-1">
              <Wand2 className="h-3 w-3" /> Aplicar valores calculados
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="grid grid-cols-12 px-2 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b">
            <div className="col-span-4">Item</div>
            <div className="col-span-3 text-right">Informado</div>
            <div className="col-span-3 text-right">Esperado</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          {rows.map((r) => {
            const ok = isClose(r.informed, r.expected);
            const diff = r.informed - r.expected;
            return (
              <div
                key={r.key}
                className={`grid grid-cols-12 items-center px-2 py-2 text-sm rounded ${
                  ok ? "" : "bg-amber-500/5"
                }`}
              >
                <div className="col-span-4 flex items-center gap-1.5">
                  <span>{r.label}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs">{r.formula}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="col-span-3 text-right tabular-nums">
                  {fmt(r.key, r.informed)}
                </div>
                <div className="col-span-3 text-right tabular-nums text-muted-foreground">
                  {fmt(r.key, r.expected)}
                </div>
                <div className="col-span-2 text-right">
                  {ok ? (
                    <span className="text-xs text-emerald-600 inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> OK
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setField(r.key, Number(r.expected.toFixed(2)))}
                      className="text-xs text-amber-600 hover:underline inline-flex items-center gap-1"
                      title="Clique para aplicar valor calculado"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {diff > 0 ? "+" : ""}
                      {fmt(r.key, diff)}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground pt-2 leading-relaxed">
            <strong>Tolerância:</strong> 1% ou R$ 1,00. <strong>RAT/GILRAT</strong> pode variar entre
            1% e 3% conforme o CNAE — ajuste o esperado se necessário. Provisões de férias e 13º não
            consideram FGTS adicional sobre as provisões (regime de competência simplificado).
          </p>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
