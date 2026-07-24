import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ZAPP_VIEWS,
  ZAPP_VIEW_SET,
  ROY_ZAPP_SUBROUTES,
  buildRoyZappUrl,
  isZappView,
  sanitizeZappView,
} from "../royZappRoutes";

const SRC_ROOT = resolve(__dirname, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

describe("royZappRoutes helpers", () => {
  it("buildRoyZappUrl builds inbox base", () => {
    expect(buildRoyZappUrl()).toBe("/roy-zapp");
    expect(buildRoyZappUrl({ view: "inbox" })).toBe("/roy-zapp");
  });

  it("buildRoyZappUrl serializes view + sector + integrationId", () => {
    const url = buildRoyZappUrl({ view: "whatsapp-admin", sector: "vendas" });
    expect(url).toBe("/roy-zapp?view=whatsapp-admin&sector=vendas");
  });

  it("buildRoyZappUrl skips null/empty extras", () => {
    const url = buildRoyZappUrl({
      sector: "vendas",
      extra: { leadId: null, clientId: undefined, newName: "" },
    });
    expect(url).toBe("/roy-zapp?sector=vendas");
  });

  it("buildRoyZappUrl only ever emits views from ZAPP_VIEWS", () => {
    for (const v of ZAPP_VIEWS) {
      const url = buildRoyZappUrl({ view: v });
      const match = url.match(/[?&]view=([^&]+)/);
      if (match) expect(ZAPP_VIEW_SET.has(match[1] as any)).toBe(true);
    }
  });

  it("isZappView / sanitizeZappView", () => {
    expect(isZappView("inbox")).toBe(true);
    expect(isZappView("nope")).toBe(false);
    expect(sanitizeZappView("nope")).toBe("inbox");
    expect(sanitizeZappView("settings")).toBe("settings");
  });
});

describe("RoyZapp route integrity across the codebase", () => {
  const files = walk(SRC_ROOT).filter((f) => !f.includes("/__tests__/"));

  it("every '/roy-zapp?...view=X' literal targets a valid ZappView", () => {
    const offenders: string[] = [];
    const viewLiteral = /view=([a-zA-Z0-9_-]+)/g;

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      // Only consider lines that mention /roy-zapp to avoid false positives
      // from unrelated modules that also use `view=` (e.g., insights).
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        if (!line.includes("/roy-zapp")) return;
        for (const m of line.matchAll(viewLiteral)) {
          const value = m[1];
          // Ignore template expressions like `view=${x}` handled at runtime.
          if (value.startsWith("$")) continue;
          if (!ZAPP_VIEW_SET.has(value as any)) {
            offenders.push(`${file}:${i + 1} -> view=${value}`);
          }
        }
      });
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("every literal '/roy-zapp/<subroute>' matches a declared subroute", () => {
    const offenders: string[] = [];
    // Matches "/roy-zapp/xxx" or `/roy-zapp/xxx` where xxx is a bare segment.
    const subrouteLiteral = /["'`]\/roy-zapp\/([a-zA-Z0-9_-]+)/g;
    const allowed = new Set<string>(ROY_ZAPP_SUBROUTES.filter(Boolean));

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const m of content.matchAll(subrouteLiteral)) {
        const seg = m[1];
        if (!allowed.has(seg)) offenders.push(`${file} -> /roy-zapp/${seg}`);
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
