import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  crossMatchWonDeals,
  fetchAllWonDeals,
  PAGE_SIZE,
  type PageQuery,
  type WonDealRow,
} from "../_shared/won-deal-matching.ts";
import { canonicalEmail } from "../_shared/email-normalize.ts";
import { phoneCoreKey } from "../_shared/phone-normalize.ts";

// ---------- Helpers ----------

function buildEmailSet(emails: string[]): Set<string> {
  return new Set(emails.map((e) => canonicalEmail(e) || "").filter(Boolean));
}
function buildPhoneSet(phones: string[]): Set<string> {
  const s = new Set<string>();
  for (const p of phones) {
    const k = phoneCoreKey(p);
    if (k) s.add(k);
  }
  return s;
}

/** Mock paginated query: serves rows in pages of `pageSize`. */
function mockPaginatedQuery(rows: WonDealRow[], pageSize: number = PAGE_SIZE): () => PageQuery {
  return () => ({
    range: (from: number, to: number) =>
      Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
  });
}

// ---------- Email case-insensitive ----------

Deno.test("crossMatchWonDeals: e-mail é case-insensitive", () => {
  const wonDeals: WonDealRow[] = [
    { id: "d1", contact_email: "JOAO@Example.COM", value: 100 },
    { id: "d2", contact_email: "  Maria@Example.com  ", value: 200 },
    { id: "d3", contact_email: "outro@dominio.com", value: 300 },
  ];
  const emailSet = buildEmailSet(["joao@example.com", "MARIA@EXAMPLE.COM"]);
  const phoneKeys = new Set<string>();

  const res = crossMatchWonDeals(wonDeals, emailSet, phoneKeys);
  assertEquals(res.matchedIds.size, 2);
  assert(res.matchedIds.has("d1"));
  assert(res.matchedIds.has("d2"));
  assertEquals(res.wonByEmail, 2);
  assertEquals(res.wonByPhone, 0);
  assertEquals(res.matchedValueById.get("d1"), 100);
  assertEquals(res.matchedValueById.get("d2"), 200);
});

Deno.test("crossMatchWonDeals: ignora deal já matchado previamente", () => {
  const wonDeals: WonDealRow[] = [
    { id: "d1", contact_email: "a@a.com", value: 50 },
  ];
  const emailSet = buildEmailSet(["a@a.com"]);
  const already = new Set<string>(["d1"]);
  const res = crossMatchWonDeals(wonDeals, emailSet, new Set(), already);
  assertEquals(res.wonByEmail, 0);
  // já estava no set, segue presente
  assert(res.matchedIds.has("d1"));
  // mas NÃO sobrescreve o valor (apenas novos contam)
  assertEquals(res.matchedValueById.has("d1"), false);
});

Deno.test("crossMatchWonDeals: telefone via phoneCoreKey (variantes BR 9º dígito)", () => {
  const wonDeals: WonDealRow[] = [
    { id: "d1", contact_phone: "+55 11 91234-5678", value: 10 },
    { id: "d2", contact_phone: "11912345678", value: 20 },
  ];
  // resposta veio sem o nono dígito (formato antigo) — phoneCoreKey deve casar
  const phoneKeys = buildPhoneSet(["1112345678"]);
  const res = crossMatchWonDeals(wonDeals, new Set(), phoneKeys);
  assertEquals(res.matchedIds.size, 2);
  assertEquals(res.wonByPhone, 2);
});

// ---------- Pagination > 1000 ----------

Deno.test("fetchAllWonDeals: pagina corretamente acima de 1000 resultados", async () => {
  const total = 2350;
  const rows: WonDealRow[] = Array.from({ length: total }, (_, i) => ({
    id: `deal-${i}`,
    contact_email: `user${i}@example.com`,
    value: 1,
  }));
  const all = await fetchAllWonDeals(mockPaginatedQuery(rows));
  assertEquals(all.length, total);
  assertEquals(all[0].id, "deal-0");
  assertEquals(all[total - 1].id, `deal-${total - 1}`);
});

Deno.test("fetchAllWonDeals: pageSize customizado completa todas as páginas", async () => {
  const rows: WonDealRow[] = Array.from({ length: 25 }, (_, i) => ({ id: `d${i}` }));
  const all = await fetchAllWonDeals(mockPaginatedQuery(rows, 10), 10);
  assertEquals(all.length, 25);
});

Deno.test("fetchAllWonDeals: para no erro retornado pela query", async () => {
  let calls = 0;
  const factory = () => ({
    range: (_from: number, _to: number) => {
      calls++;
      if (calls === 1) {
        return Promise.resolve({
          data: Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `a${i}` })),
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: "boom" } });
    },
  });
  const all = await fetchAllWonDeals(factory);
  assertEquals(all.length, PAGE_SIZE);
  assertEquals(calls, 2);
});

// ---------- Integração: paginação + match case-insensitive ----------

Deno.test("integração: cruza match em conta com >1000 deals (case-insensitive)", async () => {
  const total = 1500;
  const rows: WonDealRow[] = Array.from({ length: total }, (_, i) => ({
    id: `d${i}`,
    contact_email: `User${i}@Example.COM`,
    value: 10,
  }));
  const allWon = await fetchAllWonDeals(mockPaginatedQuery(rows));
  assertEquals(allWon.length, total);

  // resposta do typeform tem e-mail em lowercase
  const emailSet = buildEmailSet(["user1200@example.com", "user42@example.com"]);
  const res = crossMatchWonDeals(allWon, emailSet, new Set());
  assertEquals(res.matchedIds.size, 2);
  assertEquals(res.wonByEmail, 2);
  assert(res.matchedIds.has("d42"));
  assert(res.matchedIds.has("d1200"));
});
