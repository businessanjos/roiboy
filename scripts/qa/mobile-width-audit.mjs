// Auditoria de largura mobile (regressão de geometria). Somente leitura:
// bloqueia toda gravação no backend e percorre as rotas de
// src/lib/navigation/mobileWidthAudit.ts nas larguras 320/393/440 (+1440).
//
// Uso: ROY_STORAGE_KEY=... ROY_SESSION_JSON=... AUDIT_IDS='{"/clients/:id":"<uuid>"}' \
//      node scripts/qa/mobile-width-audit.mjs [baseUrl]
// Sai com código 1 se alguma rota tiver overflow horizontal não intencional.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] || "http://localhost:8080";
const src = readFileSync(new URL("../../src/lib/navigation/mobileWidthAudit.ts", import.meta.url), "utf8");
const block = src.slice(src.indexOf("MOBILE_WIDTH_AUDIT_ROUTES"), src.indexOf("MOBILE_WIDTH_AUDIT_EXCLUDED"));
const ids = JSON.parse(process.env.AUDIT_IDS || "{}");
const routes = [...block.matchAll(/"(\/[^"]*)"/g)].map((m) => m[1])
  .map((r) => ids[r] || r).filter((r) => !r.includes(":"));
const measure = readFileSync(new URL("./mobile-width-measure.js", import.meta.url), "utf8");
const widths = [320, 393, 440, 1440];

const browser = await chromium.launch();
let failures = 0;
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
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [process.env.ROY_STORAGE_KEY, process.env.ROY_SESSION_JSON]);
  for (const r of routes) {
    await page.goto(base + r, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    const m = await page.evaluate(`(${measure})()`);
    if (mobile) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(width * 0.8), y: 420, xDistance: -Math.round(width * 0.6), yDistance: 0, gestureSourceType: "touch" }).catch(() => {});
      await cdp.detach();
    }
    const scrollX = await page.evaluate(() => window.scrollX);
    const problems = [];
    if (m.docSW > m.vw + 1) problems.push(`documento ${m.docSW}px`);
    if (m.mainSW > m.mainCW + 1) problems.push(`main ${m.mainSW}/${m.mainCW}px`);
    if (scrollX) problems.push(`scrollX ${scrollX}`);
    problems.push(...m.ancestorsShift, ...m.offenders.map((o) => `fora da tela: ${o.el}`));
    if (problems.length) failures++;
    console.log(`${width}\t${problems.length ? "FALHA" : "ok"}\t${r}\t${problems.join(" | ")}`);
  }
  await context.close();
}
await browser.close();
process.exit(failures ? 1 : 0);
