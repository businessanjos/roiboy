import { describe, it, expect } from "vitest";
import {
  buildFunnelStageData,
  dedupeStagesByName,
  detectDuplicateStagesInPipeline,
  type FunnelStageRow,
  type FunnelDataPoint,
} from "./funnelData";

/**
 * Regression tests: the funnel must NEVER show duplicate entries for
 * stages that share the same name across multiple pipelines.
 *
 * Real-world example that broke production:
 *   pipeline A "TRAFEGO IMPULSE" -> "Reunião Agendada" (display_order 3)
 *   pipeline B "Closer"          -> "Reunião Agendada" (display_order 3)
 * The funnel was rendering "Reunião Agendada" twice in a row.
 */

describe("dedupeStagesByName", () => {
  it("collapses stages with the same name across pipelines into one entry", () => {
    const stages: FunnelStageRow[] = [
      { name: "Reunião Agendada", display_order: 3, color: "#aaa" },
      { name: "Reunião Agendada", display_order: 3, color: "#bbb" },
    ];
    const unique = dedupeStagesByName(stages);
    expect(unique).toHaveLength(1);
    expect(unique[0].name).toBe("Reunião Agendada");
  });

  it("keeps the smallest display_order when names collide", () => {
    const stages: FunnelStageRow[] = [
      { name: "Reunião Agendada", display_order: 5, color: null },
      { name: "Reunião Agendada", display_order: 2, color: null },
      { name: "Reunião Agendada", display_order: 7, color: null },
    ];
    const unique = dedupeStagesByName(stages);
    expect(unique).toHaveLength(1);
    expect(unique[0].display_order).toBe(2);
  });

  it("preserves the first non-empty color when names collide", () => {
    const stages: FunnelStageRow[] = [
      { name: "Reunião Agendada", display_order: 3, color: null },
      { name: "Reunião Agendada", display_order: 3, color: "#ff8800" },
    ];
    const unique = dedupeStagesByName(stages);
    expect(unique[0].color).toBe("#ff8800");
  });

  it("treats null display_order as 999", () => {
    const stages: FunnelStageRow[] = [
      { name: "Sem Ordem", display_order: null, color: null },
    ];
    const unique = dedupeStagesByName(stages);
    expect(unique[0].display_order).toBe(999);
  });

  it("returns an empty array when input is empty", () => {
    expect(dedupeStagesByName([])).toEqual([]);
  });
});

describe("buildFunnelStageData (regression: no duplicate stage names)", () => {
  it("does not duplicate 'Reunião Agendada' when present in two pipelines", () => {
    const stages: FunnelStageRow[] = [
      // Pipeline A
      { name: "Chegou Lead", display_order: 0, color: "#1" },
      { name: "Reunião Agendada", display_order: 3, color: "#2" },
      { name: "Ganhou", display_order: 5, color: "#3" },
      // Pipeline B
      { name: "Chegou Lead", display_order: 0, color: "#1" },
      { name: "Reunião Agendada", display_order: 3, color: "#2" },
    ];
    const aggregated: FunnelDataPoint[] = [
      { name: "Chegou Lead", value: 90, count: 90 },
      { name: "Reunião Agendada", value: 4, count: 4 },
    ];

    const out = buildFunnelStageData(aggregated, stages);

    const reunioes = out.filter((p) => p.name === "Reunião Agendada");
    expect(reunioes).toHaveLength(1);
    expect(reunioes[0].value).toBe(4);

    // No name appears more than once in the final list
    const names = out.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("does not introduce a 0-value duplicate when a stage is repeated across pipelines and missing in the aggregate", () => {
    const stages: FunnelStageRow[] = [
      { name: "Reunião Agendada", display_order: 3, color: "#aaa" },
      { name: "Reunião Agendada", display_order: 3, color: "#bbb" },
    ];
    const out = buildFunnelStageData([], stages);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      name: "Reunião Agendada",
      value: 0,
      count: 0,
    });
  });

  it("merges duplicate aggregated rows with the same name (sums values and counts)", () => {
    const stages: FunnelStageRow[] = [
      { name: "Reunião Agendada", display_order: 3, color: "#aaa" },
    ];
    const aggregated: FunnelDataPoint[] = [
      { name: "Reunião Agendada", value: 4, count: 4, color: "#aaa" },
      { name: "Reunião Agendada", value: 3, count: 3, color: "#bbb" },
    ];
    const out = buildFunnelStageData(aggregated, stages);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(7);
    expect(out[0].count).toBe(7);
    expect(out[0].color).toBe("#aaa");
  });

  it("includes pipeline stages with zero deals so the funnel shows the full path", () => {
    const stages: FunnelStageRow[] = [
      { name: "Chegou Lead", display_order: 0, color: null },
      { name: "Contato Realizado", display_order: 1, color: null },
      { name: "Reunião Agendada", display_order: 2, color: null },
    ];
    const aggregated: FunnelDataPoint[] = [
      { name: "Chegou Lead", value: 10, count: 10 },
    ];
    const out = buildFunnelStageData(aggregated, stages);
    expect(out.map((p) => p.name)).toEqual([
      "Chegou Lead",
      "Contato Realizado",
      "Reunião Agendada",
    ]);
    expect(out[1].value).toBe(0);
    expect(out[2].value).toBe(0);
  });

  it("orders the final result by pipeline display_order, not by aggregated input order", () => {
    const stages: FunnelStageRow[] = [
      { name: "C", display_order: 2, color: null },
      { name: "A", display_order: 0, color: null },
      { name: "B", display_order: 1, color: null },
    ];
    const aggregated: FunnelDataPoint[] = [
      { name: "C", value: 1, count: 1 },
      { name: "A", value: 5, count: 5 },
      { name: "B", value: 3, count: 3 },
    ];
    const out = buildFunnelStageData(aggregated, stages);
    expect(out.map((p) => p.name)).toEqual(["A", "B", "C"]);
  });

  it("falls back to a default color for stages added with zero value and no color", () => {
    const stages: FunnelStageRow[] = [
      { name: "Vazio", display_order: 0, color: null },
    ];
    const out = buildFunnelStageData([], stages);
    expect(out[0].color).toBe("#6366f1");
  });

  it("never produces duplicate names for the realistic TRAFEGO IMPULSE scenario", () => {
    // Two real Roy pipelines that both contain stages with identical names.
    const stages: FunnelStageRow[] = [
      // Pipeline TRAFEGO IMPULSE
      { name: "Chegou Lead", display_order: 0, color: "#888" },
      { name: "Contato Realizado", display_order: 1, color: "#888" },
      { name: "Em Qualificação", display_order: 2, color: "#f59e0b" },
      { name: "Reunião Agendada", display_order: 3, color: "#f59e0b" },
      { name: "No Show", display_order: 4, color: "#888" },
      { name: "Reunião Concluída", display_order: 5, color: "#f59e0b" },
      { name: "Proposta Enviada", display_order: 6, color: "#10b981" },
      { name: "Follow Up", display_order: 7, color: "#10b981" },
      // Pipeline Closer (has overlapping stage names)
      { name: "Chegou Lead", display_order: 0, color: "#888" },
      { name: "Contato Realizado", display_order: 1, color: "#888" },
      { name: "Em Qualificação", display_order: 2, color: "#f59e0b" },
      { name: "Reunião Agendada", display_order: 3, color: "#f59e0b" },
      { name: "No-Show", display_order: 7, color: "#888" },
    ];
    const aggregated: FunnelDataPoint[] = [
      { name: "Chegou Lead", value: 90, count: 90 },
      { name: "Contato Realizado", value: 68, count: 68 },
      { name: "Em Qualificação", value: 20, count: 20 },
      { name: "Reunião Agendada", value: 4, count: 4 },
      { name: "Reunião Concluída", value: 4, count: 4 },
      { name: "Proposta Enviada", value: 4, count: 4 },
      { name: "Follow Up", value: 4, count: 4 },
    ];

    const out = buildFunnelStageData(aggregated, stages);

    const names = out.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((n) => n === "Reunião Agendada")).toHaveLength(1);
  });
});
