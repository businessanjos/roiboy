import { describe, it, expect } from "vitest";
import {
  parseReceivedInput,
  formatReceivedDraft,
  toReceivedDraft,
  fromReceivedDraft,
} from "../receivedValueFormat";

describe("receivedValueFormat - trailing zeros & input formats", () => {
  describe("parseReceivedInput", () => {
    it("preserves a single 0", () => {
      expect(parseReceivedInput("0")).toBe("0");
    });
    it("preserves multiple zeros (0,00)", () => {
      expect(parseReceivedInput("0,00")).toBe("000");
      expect(parseReceivedInput("000")).toBe("000");
    });
    it("strips non-digits but keeps trailing zeros", () => {
      expect(parseReceivedInput("R$ 10,50")).toBe("1050");
      expect(parseReceivedInput("1.050,00")).toBe("105000");
      expect(parseReceivedInput("10.50")).toBe("1050");
    });
    it("handles empty/garbage", () => {
      expect(parseReceivedInput("")).toBe("");
      expect(parseReceivedInput("abc")).toBe("");
    });
  });

  describe("formatReceivedDraft", () => {
    it("formats 0 as 0,00 once a digit was typed", () => {
      expect(formatReceivedDraft("0")).toBe("0,00");
      expect(formatReceivedDraft("000")).toBe("0,00");
    });
    it("formats 1050 cents as 10,50 (preserves trailing zero)", () => {
      expect(formatReceivedDraft("1050")).toBe("10,50");
    });
    it("formats 100000 cents as 1.000,00", () => {
      expect(formatReceivedDraft("100000")).toBe("1.000,00");
    });
    it("returns empty string for empty draft", () => {
      expect(formatReceivedDraft("")).toBe("");
    });
  });

  describe("toReceivedDraft (DB -> draft)", () => {
    it("converts 0 to '0' (so the field is treated as filled with 0,00)", () => {
      expect(toReceivedDraft(0)).toBe("0");
    });
    it("converts 10.5 to '1050' preserving trailing zero", () => {
      expect(toReceivedDraft(10.5)).toBe("1050");
    });
    it("rounds floating point artifacts", () => {
      expect(toReceivedDraft(0.1 + 0.2)).toBe("30");
    });
    it("returns empty string for null/undefined", () => {
      expect(toReceivedDraft(null)).toBe("");
      expect(toReceivedDraft(undefined)).toBe("");
      expect(toReceivedDraft("")).toBe("");
    });
  });

  describe("fromReceivedDraft (draft -> DB number)", () => {
    it("converts '0' to 0 (NOT null)", () => {
      expect(fromReceivedDraft("0")).toBe(0);
      expect(fromReceivedDraft("000")).toBe(0);
    });
    it("converts '1050' to 10.5", () => {
      expect(fromReceivedDraft("1050")).toBe(10.5);
    });
    it("converts empty string to null", () => {
      expect(fromReceivedDraft("")).toBeNull();
    });
  });

  describe("round-trip integrity for problematic values", () => {
    const cases: Array<{ label: string; raw: string; cents: string; display: string; reais: number }> = [
      { label: "single 0", raw: "0", cents: "0", display: "0,00", reais: 0 },
      { label: "0,00 typed", raw: "0,00", cents: "000", display: "0,00", reais: 0 },
      { label: "10,50", raw: "10,50", cents: "1050", display: "10,50", reais: 10.5 },
      { label: "10.50 with dot", raw: "10.50", cents: "1050", display: "10,50", reais: 10.5 },
      { label: "1000,00", raw: "1000,00", cents: "100000", display: "1.000,00", reais: 1000 },
    ];
    cases.forEach(({ label, raw, cents, display, reais }) => {
      it(`${label} → cents="${cents}" display="${display}" reais=${reais}`, () => {
        const parsed = parseReceivedInput(raw);
        expect(parsed).toBe(cents);
        expect(formatReceivedDraft(parsed)).toBe(display);
        expect(fromReceivedDraft(parsed)).toBe(reais);
      });
    });
  });
});
