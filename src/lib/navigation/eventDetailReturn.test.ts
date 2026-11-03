import { describe, expect, it } from "vitest";
import {
  buildEventDetailReturnState,
  buildEventKpisEntryState,
  getEventDetailReturn,
  getEventKpisEntry,
  type EventKpisSnapshot,
} from "./eventDetailReturn";

const snapshot: EventKpisSnapshot = { year: 2026, modality: "presencial", type: "imersao", status: "completed", detail: "actual" };

describe("event detail return", () => {
  it("round-trips the KPIs snapshot through the detail entry", () => {
    const detailState = buildEventDetailReturnState(snapshot);
    const ret = getEventDetailReturn(detailState);
    expect(ret).toEqual({ url: "/events/kpis", label: "KPIs Anuais", kpis: snapshot });
    expect(getEventKpisEntry(buildEventKpisEntryState(ret!.kpis))).toEqual(snapshot);
  });

  it("keeps a list open only for the five known kinds", () => {
    expect(getEventKpisEntry(buildEventKpisEntryState({ ...snapshot, detail: "participants" })).detail).toBe("participants");
    expect(getEventKpisEntry(buildEventKpisEntryState({ ...snapshot, detail: "hacked" as never })).detail).toBeNull();
    expect(getEventKpisEntry(buildEventKpisEntryState({ ...snapshot, detail: null })).detail).toBeNull();
  });

  it("rejects foreign or broken state instead of offering a bad back target", () => {
    expect(getEventDetailReturn(null)).toBeNull();
    expect(getEventDetailReturn({})).toBeNull();
    expect(getEventDetailReturn({ eventDetailReturn: { url: "https://evil.test", label: "x", kpis: snapshot } })).toBeNull();
    expect(getEventDetailReturn({ eventDetailReturn: { url: "/events/kpis", label: "KPIs Anuais" } })).toBeNull();
    expect(getEventKpisEntry({ eventKpisEntry: { year: "2026" } })).toBeNull();
  });

  it("defaults missing filters to all", () => {
    const entry = getEventKpisEntry({ eventKpisEntry: { year: 2025.7 } });
    expect(entry).toEqual({ year: 2025, modality: "all", type: "all", status: "all", detail: null });
  });
});
