import { describe, it, expect } from "vitest";
import {
  applyFilterToDeals,
  RECOMMENDED_FILTERS,
  type ActiveFilter,
} from "@/hooks/usePipelineFilters";
import type { Deal } from "@/hooks/useDeals";

// Small factory to reduce boilerplate — only fields the filter reads matter.
function makeDeal(id: string, extra: Partial<Deal> = {}): Deal {
  return {
    id,
    account_id: "acc-1",
    title: `Deal ${id}`,
    status: "open",
    value: 1000,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...extra,
  } as unknown as Deal;
}

const neverContactedFilter = RECOMMENDED_FILTERS.find(
  (f) => f.id === "never_contacted",
)! as unknown as ActiveFilter;
const noNextStepFilter = RECOMMENDED_FILTERS.find(
  (f) => f.id === "no_next_activity",
)! as unknown as ActiveFilter;

// Ensure the two filters we're testing are wired to the expected fields.
describe("RECOMMENDED_FILTERS wiring", () => {
  it("never_contacted maps to total_tasks === 0", () => {
    expect(neverContactedFilter.conditions?.[0]).toMatchObject({
      field: "total_tasks",
      operator: "equals",
      value: 0,
    });
  });

  it("no_next_activity maps to next_activity_date is_empty", () => {
    expect(noNextStepFilter.conditions?.[0]).toMatchObject({
      field: "next_activity_date",
      operator: "is_empty",
    });
  });
});

describe("applyFilterToDeals — 🔴 Nunca contatado", () => {
  const deals = [
    makeDeal("d-virgin"), // zero everything
    makeDeal("d-only-completed-task"), // has 1 completed task (totalActivities=1)
    makeDeal("d-has-pending"), // 1 pending task
    makeDeal("d-has-manual-activity"), // no tasks, but 1 manual deal_activity
  ];
  const dealTaskCountMap = {
    "d-virgin": 0,
    "d-only-completed-task": 1,
    "d-has-pending": 1,
    "d-has-manual-activity": 1, // manual activity counts in totalActivities
  };
  const dealPendingCountMap = {
    "d-virgin": 0,
    "d-only-completed-task": 0,
    "d-has-pending": 1,
    "d-has-manual-activity": 0,
  };
  const dealNextActivityMap = {
    "d-virgin": null,
    "d-only-completed-task": null,
    "d-has-pending": "2026-02-01",
    "d-has-manual-activity": null,
  };

  it("returns ONLY deals with zero tasks and zero manual activities", () => {
    const result = applyFilterToDeals(
      deals,
      neverContactedFilter,
      undefined,
      undefined,
      undefined,
      dealNextActivityMap,
      undefined,
      dealTaskCountMap,
      dealPendingCountMap,
    );
    expect(result.map((d) => d.id)).toEqual(["d-virgin"]);
  });

  it("excludes deals with completed-only history", () => {
    const result = applyFilterToDeals(
      deals,
      neverContactedFilter,
      undefined,
      undefined,
      undefined,
      dealNextActivityMap,
      undefined,
      dealTaskCountMap,
      dealPendingCountMap,
    );
    expect(result.some((d) => d.id === "d-only-completed-task")).toBe(false);
  });

  it("excludes deals with manual deal_activities even if no tasks exist", () => {
    const result = applyFilterToDeals(
      deals,
      neverContactedFilter,
      undefined,
      undefined,
      undefined,
      dealNextActivityMap,
      undefined,
      dealTaskCountMap,
      dealPendingCountMap,
    );
    expect(result.some((d) => d.id === "d-has-manual-activity")).toBe(false);
  });

  it("treats missing entries in dealTaskCountMap as 0 (matches never_contacted)", () => {
    const result = applyFilterToDeals(
      deals,
      neverContactedFilter,
      undefined,
      undefined,
      undefined,
      dealNextActivityMap,
      undefined,
      {}, // empty map — every deal reads as 0
      dealPendingCountMap,
    );
    expect(result.map((d) => d.id).sort()).toEqual(deals.map((d) => d.id).sort());
  });
});

describe("applyFilterToDeals — 🟡 Sem próximo passo agendado", () => {
  const deals = [
    makeDeal("d-virgin"),
    makeDeal("d-only-completed-task"),
    makeDeal("d-has-pending"),
    makeDeal("d-has-manual-activity"),
  ];
  const dealTaskCountMap = {
    "d-virgin": 0,
    "d-only-completed-task": 1,
    "d-has-pending": 1,
    "d-has-manual-activity": 1,
  };
  const dealPendingCountMap = {
    "d-virgin": 0,
    "d-only-completed-task": 0,
    "d-has-pending": 1,
    "d-has-manual-activity": 0,
  };
  const dealNextActivityMap = {
    "d-virgin": null,
    "d-only-completed-task": null,
    "d-has-pending": "2026-02-01",
    "d-has-manual-activity": null,
  };

  it("returns every deal with pendingCount === 0 (histórico ou não)", () => {
    const result = applyFilterToDeals(
      deals,
      noNextStepFilter,
      undefined,
      undefined,
      undefined,
      dealNextActivityMap,
      undefined,
      dealTaskCountMap,
      dealPendingCountMap,
    );
    expect(result.map((d) => d.id).sort()).toEqual([
      "d-has-manual-activity",
      "d-only-completed-task",
      "d-virgin",
    ]);
  });

  it("excludes deals with at least one pending task", () => {
    const result = applyFilterToDeals(
      deals,
      noNextStepFilter,
      undefined,
      undefined,
      undefined,
      dealNextActivityMap,
      undefined,
      dealTaskCountMap,
      dealPendingCountMap,
    );
    expect(result.some((d) => d.id === "d-has-pending")).toBe(false);
  });

  it("treats missing entries in dealPendingCountMap as 0 (matches filter)", () => {
    const result = applyFilterToDeals(
      deals,
      noNextStepFilter,
      undefined,
      undefined,
      undefined,
      {},
      undefined,
      dealTaskCountMap,
      {}, // empty map
    );
    expect(result.map((d) => d.id).sort()).toEqual(deals.map((d) => d.id).sort());
  });
});

describe("applyFilterToDeals — invariante entre os dois filtros", () => {
  // Cenário realista misturando diferentes históricos.
  const deals = [
    makeDeal("virgin"),
    makeDeal("only-completed-task"),
    makeDeal("only-manual-activity"),
    makeDeal("completed-plus-pending"),
    makeDeal("just-pending"),
    makeDeal("mixed-heavy-history"),
  ];
  const dealTaskCountMap: Record<string, number> = {
    virgin: 0,
    "only-completed-task": 2,
    "only-manual-activity": 3, // 3 manual activities, 0 tasks
    "completed-plus-pending": 5,
    "just-pending": 1,
    "mixed-heavy-history": 20,
  };
  const dealPendingCountMap: Record<string, number> = {
    virgin: 0,
    "only-completed-task": 0,
    "only-manual-activity": 0,
    "completed-plus-pending": 2,
    "just-pending": 1,
    "mixed-heavy-history": 0,
  };
  const dealNextActivityMap: Record<string, string | null> = {
    virgin: null,
    "only-completed-task": null,
    "only-manual-activity": null,
    "completed-plus-pending": "2026-03-01",
    "just-pending": "2026-03-15",
    "mixed-heavy-history": null,
  };

  const neverContacted = applyFilterToDeals(
    deals,
    neverContactedFilter,
    undefined,
    undefined,
    undefined,
    dealNextActivityMap,
    undefined,
    dealTaskCountMap,
    dealPendingCountMap,
  );
  const noNextStep = applyFilterToDeals(
    deals,
    noNextStepFilter,
    undefined,
    undefined,
    undefined,
    dealNextActivityMap,
    undefined,
    dealTaskCountMap,
    dealPendingCountMap,
  );

  it("never_contacted é subconjunto de no_next_step (nunca contatado ⇒ sem próximo passo)", () => {
    const noNextStepIds = new Set(noNextStep.map((d) => d.id));
    for (const d of neverContacted) {
      expect(noNextStepIds.has(d.id)).toBe(true);
    }
  });

  it("no_next_step inclui leads com histórico mas sem próximo passo", () => {
    const ids = noNextStep.map((d) => d.id).sort();
    expect(ids).toEqual([
      "mixed-heavy-history",
      "only-completed-task",
      "only-manual-activity",
      "virgin",
    ]);
  });

  it("never_contacted apenas leads virgens (zero tasks e zero manual activities)", () => {
    expect(neverContacted.map((d) => d.id)).toEqual(["virgin"]);
  });

  it("ordenação de entrada é preservada em ambos os filtros", () => {
    // Filtro não reordena — só filtra. Garante que a UI mantém a ordem do Kanban.
    const shuffled = [...deals].reverse();
    const out = applyFilterToDeals(
      shuffled,
      noNextStepFilter,
      undefined,
      undefined,
      undefined,
      dealNextActivityMap,
      undefined,
      dealTaskCountMap,
      dealPendingCountMap,
    );
    const expectedOrder = shuffled
      .filter((d) => (dealPendingCountMap[d.id] ?? 0) === 0)
      .map((d) => d.id);
    expect(out.map((d) => d.id)).toEqual(expectedOrder);
  });
});
