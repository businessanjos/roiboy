import { supabase } from "@/integrations/supabase/client";

const norm = (s: string) => s.toLowerCase().trim();

export function matchesBenefit(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

export interface BenchmarkRunLogInput {
  jobId: string;
  accountId: string;
  userId?: string | null;
  triggerSource: "manual" | "auto" | "job_created";
  offeredSalaryMin?: number | null;
  offeredSalaryMax?: number | null;
  market?: { p25?: number | null; p50?: number | null; p75?: number | null } | null;
  offeredBenefits: string[];
  typicalBenefits: string[];
  missingBenefits: string[];
  extraBenefits: string[];
  workModel?: string | null;
  city?: string | null;
  state?: string | null;
  score?: {
    total: number;
    tier: string;
    breakdown: { label: string; score: number; max: number; reason: string }[];
  } | null;
}

/**
 * Registra um recálculo de benchmark de uma vaga: quando rodou, quais benefícios
 * (inclusive os herdados do catálogo da empresa) entraram e o score resultante.
 */
export async function recordBenchmarkRun(input: BenchmarkRunLogInput) {
  try {
    const { data: catalog } = await supabase
      .from("hr_company_benefits")
      .select("name")
      .eq("account_id", input.accountId)
      .eq("is_active", true);

    const catalogNames = (catalog ?? []).map((c: any) => c.name as string).filter(Boolean);
    const catalogMatched = catalogNames.filter((c) =>
      input.offeredBenefits.some((o) => matchesBenefit(o, c)),
    );

    const covered = input.typicalBenefits.filter((t) =>
      input.offeredBenefits.some((o) => matchesBenefit(o, t)),
    );

    const findScore = (label: string) =>
      input.score?.breakdown.find((b) => b.label.toLowerCase().startsWith(label))?.score ?? null;

    await supabase.from("hr_job_benchmark_runs").insert({
      job_id: input.jobId,
      account_id: input.accountId,
      triggered_by: input.userId ?? null,
      trigger_source: input.triggerSource,
      offered_salary_min: input.offeredSalaryMin ?? null,
      offered_salary_max: input.offeredSalaryMax ?? null,
      market_p25: input.market?.p25 ?? null,
      market_p50: input.market?.p50 ?? null,
      market_p75: input.market?.p75 ?? null,
      offered_benefits: input.offeredBenefits,
      catalog_benefits: catalogNames,
      catalog_benefits_matched: catalogMatched.length,
      typical_benefits: input.typicalBenefits,
      covered_benefits: covered,
      missing_benefits: input.missingBenefits,
      extra_benefits: input.extraBenefits,
      work_model: input.workModel ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      score_total: input.score?.total ?? null,
      score_tier: input.score?.tier ?? null,
      score_salary: findScore("sal"),
      score_benefits: findScore("benef"),
      score_location: findScore("modelo"),
      breakdown: (input.score?.breakdown ?? []) as any,
    });
  } catch (e) {
    console.error("Failed to log benchmark run:", e);
  }
}
