import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MOBILE_WIDTH_AUDIT_EXCLUDED,
  MOBILE_WIDTH_AUDIT_ROUTES,
  findWidthViolations,
  type WidthMetrics,
} from "./mobileWidthAudit";

/** Rotas declaradas dentro do bloco autenticado (AppLayout) em App.tsx. */
function authenticatedRoutesFromApp(): string[] {
  const src = readFileSync(path.resolve(__dirname, "../../App.tsx"), "utf8");
  const start = src.indexOf('path="/setores"');
  const end = src.indexOf('path="*"');
  const block = src.slice(start, end);
  const routes: string[] = [];
  for (const match of block.matchAll(/path="([^"]+)"/g)) {
    const p = match[1];
    routes.push(p.startsWith("/") ? p : `/financial/${p}`);
  }
  return routes;
}

const clean: WidthMetrics = {
  viewportWidth: 393,
  documentScrollWidth: 393,
  mainClientWidth: 393,
  mainScrollWidth: 393,
  windowScrollX: 0,
  shiftedAncestors: [],
  offscreenElements: [],
};

describe("mobile width audit inventory", () => {
  it("covers every authenticated route or explains why it is excluded", () => {
    const declared = authenticatedRoutesFromApp();
    expect(declared.length).toBeGreaterThan(100);
    const missing = declared.filter(
      (r) => !MOBILE_WIDTH_AUDIT_ROUTES.includes(r) && !(r in MOBILE_WIDTH_AUDIT_EXCLUDED),
    );
    expect(missing).toEqual([]);
  });
});

describe("findWidthViolations", () => {
  it("accepts a screen aligned to the viewport", () => {
    expect(findWidthViolations(clean)).toEqual([]);
  });
  it("flags content wider than the main scroller (the sideways drift)", () => {
    expect(findWidthViolations({ ...clean, mainScrollWidth: 529 })).toHaveLength(1);
  });
  it("flags a document wider than the viewport", () => {
    expect(findWidthViolations({ ...clean, documentScrollWidth: 400 })).toHaveLength(1);
  });
  it("flags a page moved sideways after a lateral gesture", () => {
    expect(findWidthViolations({ ...clean, windowScrollX: 40 })).toHaveLength(1);
    expect(findWidthViolations({ ...clean, shiftedAncestors: ["div 12"] })).toHaveLength(1);
  });
  it("flags actions left off-screen", () => {
    expect(findWidthViolations({ ...clean, offscreenElements: ['button "Salvar"'] })).toHaveLength(1);
  });
  it("tolerates subpixel rounding of one pixel", () => {
    expect(findWidthViolations({ ...clean, mainScrollWidth: 394 })).toEqual([]);
  });
});
