import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MOBILE_WIDTH_AUDIT_EXCLUDED,
  MOBILE_WIDTH_AUDIT_ROUTES,
  evaluateRouteAudit,
  findWidthViolations,
  resolveAuditRoutes,
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

describe("resolveAuditRoutes", () => {
  it("keeps detail routes without an ID as not exercised", () => {
    const r = resolveAuditRoutes(["/clients", "/clients/:id", "/events/:id"], { "/clients/:id": "/clients/abc" });
    expect(r.routes.map((x) => x.path)).toEqual(["/clients", "/clients/abc"]);
    expect(r.notExercised).toEqual(["/events/:id"]);
  });
});

describe("evaluateRouteAudit", () => {
  const base = { requestedPath: "/financial", finalPath: "/financial", hasAuthenticatedShell: true, before: clean };
  it("passes only when both states are aligned", () => {
    expect(evaluateRouteAudit({ ...base, after: clean, gesture: { status: "ok" } }).status).toBe("ok");
  });
  it("fails when the main scroller moved sideways after the gesture", () => {
    const r = evaluateRouteAudit({ ...base, after: { ...clean, mainScrollLeft: 8 }, gesture: { status: "ok" } });
    expect(r.status).toBe("falha");
    expect(r.problems[0]).toContain("scrollLeft=8");
  });
  it("fails when an ancestor shifts only after the gesture", () => {
    const r = evaluateRouteAudit({ ...base, after: { ...clean, shiftedAncestors: ["main 8"] }, gesture: { status: "ok" } });
    expect(r.status).toBe("falha");
  });
  it("fails a login page or redirect without the authenticated shell", () => {
    const r = evaluateRouteAudit({ ...base, finalPath: "/auth", hasAuthenticatedShell: false, after: clean, gesture: { status: "ok" } });
    expect(r.status).toBe("falha");
    expect(r.problems[0]).toContain("/auth");
  });
  it("reports a failed gesture as a limitation, never as ok", () => {
    const r = evaluateRouteAudit({ ...base, after: null, gesture: { status: "failed", error: "CDP indisponível" } });
    expect(r.status).toBe("limitacao");
  });
  it("still fails on overflow measured before a failed gesture", () => {
    const r = evaluateRouteAudit({ ...base, before: { ...clean, mainScrollWidth: 401 }, after: null, gesture: { status: "failed", error: "x" } });
    expect(r.status).toBe("falha");
  });
});
