import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { isCrItemLabel } from "./useVisualData";

describe("isCrItemLabel", () => {
  it("Clínica Ryka conta como CR", () => expect(isCrItemLabel("Clinica Ryka")).toBe(true));
  it("E-Pass conta como CR", () => expect(isCrItemLabel("E-Pass l Eternum Pass")).toBe(true));
  it("Eternum Mentoring não conta como CR", () => expect(isCrItemLabel("EM l Eternum Mentoring")).toBe(false));
});
