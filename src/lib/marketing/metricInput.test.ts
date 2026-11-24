import { describe, it, expect } from "vitest";
import { formatMetricInput, parseMetricInput } from "./metricInput";
describe("metric input", () => {
  it("formats 1860 as 1.860", () => expect(formatMetricInput("1860")).toBe("1.860"));
  it("parses 1.860 as 1860, not 1", () => expect(parseMetricInput("1.860")).toBe(1860));
  it("parses 1.234.567", () => expect(parseMetricInput("1.234.567")).toBe(1234567));
});
