// Auditoria de largura mobile (regressão de geometria). Somente leitura:
// bloqueia toda gravação no backend e percorre as rotas de
// src/lib/navigation/mobileWidthAudit.ts nas larguras 320/393/440 (+1440).
//
// Uso (bun, para importar o avaliador em TypeScript):
//   ROY_STORAGE_KEY=... ROY_SESSION_JSON=... AUDIT_IDS='{"/clients/:id":"/clients/<uuid>"}' \
//     bun scripts/qa/mobile-width-audit.mjs [baseUrl]
// AUDIT_ONLY="/rh,/settings" limita a rotas específicas (verificação pontual).
// Credenciais só por variável de ambiente; nada é gravado em arquivo.
// Cada rota é medida ANTES e DEPOIS do gesto lateral (com estabilização curta),
// incluindo scrollLeft do main e dos ancestrais. Sai com código 1 se houver
// falha, ou 2 se só houver limitações (gesto não executado). Rotas com `:id`
// sem ID informado são listadas como não exercitadas.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import {
  MOBILE_WIDTH_AUDIT_ROUTES,
  evaluateRouteAudit,
  resolveAuditRoutes,
} from "../../src/lib/navigation/mobileWidthAudit.ts";

const base = process.argv[2] || "http://localhost:8080";
const storageKey = process.env.ROY_STORAGE_KEY;
const sessionJson = process.env.ROY_SESSION_JSON;
if (!storageKey || !sessionJson) {
  console.error("FALHA: defina ROY_STORAGE_KEY e ROY_SESSION_JSON (sessão autenticada) antes de rodar.");
  process.exit(1);
}
const ids = JSON.parse(process.env.AUDIT_IDS || "{}");
const only = (process.env.AUDIT_ONLY || "").split(",").filter(Boolean);
const { routes, notExercised } = resolveAuditRoutes(only.length ? only : MOBILE_WIDTH_AUDIT_ROUTES, ids);
const measureSrc = readFileSync(new URL("./mobile-width-measure.js", import.meta.url), "utf8");
const widths = [320, 393, 440, 1440];

const toMetrics = (m) => ({
  viewportWidth: m.vw,
  documentScrollWidth: m.docSW,
  mainClientWidth: m.mainCW ?? null,
  mainScrollWidth: m.mainSW ?? null,
  mainScrollLeft: m.mainSL ?? 0,
  windowScrollX: m.scrollX,
  shiftedAncestors: [...m.ancestorsShift, ...m.shifted],
  offscreenElements: m.offenders.map((o) => o.el),
});
const snapshot = async (page) => {
  const m = await page.evaluate(`(${measureSrc})()`);
  const hasShell = await page.evaluate(() => !!document.getElementById("app-main-scroll"));
  return { metrics: toMetrics(m), hasShell, finalPath: new URL(page.url()).pathname + new URL(page.url()).search };
};

const browser = await chromium.launch();
let failures = 0;
let limitations = 0;
for (const width of widths) {
  const mobile = width < 1024;
  const context = await browser.newContext({ viewport: { width, height: mobile ? 852 : 900 }, hasTouch: mobile, isMobile: mobile });
  await context.route("**/*", async (route) => {
    const req = route.request();
    const url = req.url();
    const write = (url.includes("/rest/v1/") && !["GET", "HEAD", "OPTIONS"].includes(req.method()) && !/\/rpc\/(get_|can_|is_|my_)/.test(url))
      || url.includes("/functions/v1/");
    if (write) return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(base);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [storageKey, sessionJson]);
  for (const { template, path } of routes) {
    await page.goto(base + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    const before = await snapshot(page);
    let gesture = { status: "skipped" };
    let after = null;
    if (mobile && before.hasShell) {
      try {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(width * 0.8), y: 420, xDistance: -Math.round(width * 0.6), yDistance: 0, gestureSourceType: "touch" });
        await cdp.detach();
        gesture = { status: "ok" };
      } catch (err) {
        gesture = { status: "failed", error: String(err?.message || err).slice(0, 120) };
      }
      if (gesture.status === "ok") {
        await page.waitForTimeout(400);
        after = (await snapshot(page)).metrics;
      }
    }
    const result = evaluateRouteAudit({
      requestedPath: path,
      finalPath: before.finalPath,
      hasAuthenticatedShell: before.hasShell,
      before: before.metrics,
      after,
      gesture,
    });
    if (result.status === "falha") failures++;
    if (result.status === "limitacao") limitations++;
    const dest = before.finalPath !== path ? ` -> ${before.finalPath}` : "";
    console.log(`${width}\t${result.status.toUpperCase()}\t${template}${dest}\tgesto=${gesture.status}\t${result.problems.join(" | ")}`);
  }
  await context.close();
}
await browser.close();
for (const t of notExercised) console.log(`-\tNAO EXERCITADA\t${t}\tsem ID em AUDIT_IDS`);
console.log(`resumo: ${failures} falha(s), ${limitations} limitação(ões), ${notExercised.length} rota(s) não exercitada(s)`);
process.exit(failures ? 1 : limitations ? 2 : 0);
