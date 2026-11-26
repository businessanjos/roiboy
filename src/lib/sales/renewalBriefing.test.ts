import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { briefingExempt } from "./renewalBriefing";

describe("briefing para operação no ganho", () => {
  it("é dispensado quando o negócio é carteira", () => {
    expect(briefingExempt({ isRenewal: false, isPortfolio: true })).toBe(true);
  });
  it("é dispensado quando o negócio é renovação", () => {
    expect(briefingExempt({ isRenewal: true, isPortfolio: false })).toBe(true);
  });
  it("é dispensado no ganho retroativo", () => {
    expect(briefingExempt({ isRetroactive: true })).toBe(true);
  });
  it("continua exigido quando não é renovação nem carteira", () => {
    expect(briefingExempt({ isRenewal: false, isPortfolio: false })).toBe(false);
    expect(briefingExempt({})).toBe(false);
  });
});
