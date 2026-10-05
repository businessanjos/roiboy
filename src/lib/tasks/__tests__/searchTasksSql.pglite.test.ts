// @vitest-environment node
/**
 * Executa as funções SQL REAIS da migração (tasks_filtered, task_matches_tab,
 * search_tasks_page2, search_tasks_counts) num Postgres em memória (PGlite),
 * com fixtures — nenhum dado real é lido ou alterado.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  buildSearchTasksRpcParams,
  buildSearchTasksCountsParams,
  fetchSearchTasksPage,
  fetchAllSearchTaskIds,
  fetchSearchTasksCounts,
  type TaskFilterInput,
} from "../searchTasksRpcParams";

const ACC = "00000000-0000-0000-0000-0000000000a1";
const OTHER = "00000000-0000-0000-0000-0000000000a2";
const ST_PEND = "00000000-0000-0000-0000-00000000005a";
const ST_PROG = "00000000-0000-0000-0000-00000000005b";
const ST_DONE = "00000000-0000-0000-0000-00000000005c";
const AT_CALL = "00000000-0000-0000-0000-0000000000c1";
const AT_MAIL = "00000000-0000-0000-0000-0000000000c2";
const HIDDEN_CLIENT = "00000000-0000-0000-0000-0000000000d1";
const statuses = [
  { id: ST_PEND, name: "Pendente", is_default: true, is_completed_status: false },
  { id: ST_PROG, name: "Em andamento", is_default: false, is_completed_status: false },
  { id: ST_DONE, name: "Concluída", is_default: false, is_completed_status: true },
];
const tid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

const migrationSql = () => {
  const dir = join(process.cwd(), "supabase/migrations");
  const f = readdirSync(dir)
    .filter((n) => readFileSync(join(dir, n), "utf8").includes("FUNCTION public.search_tasks_page2("))
    .sort()
    .pop()!;
  // A versão mais recente de tasks_filtered (busca literal) pode vir depois.
  const tf = readdirSync(dir)
    .filter((n) => readFileSync(join(dir, n), "utf8").includes("FUNCTION public.tasks_filtered("))
    .sort()
    .pop()!;
  const base = readFileSync(join(dir, f), "utf8");
  return tf > f ? base + "\n" + readFileSync(join(dir, tf), "utf8") : base;
};

let db: PGlite;
const rpc = async (fn: string, params: Record<string, unknown>) => {
  const keys = Object.keys(params);
  const args = keys.map((k, i) => `${k} => $${i + 1}`).join(", ");
  try {
    const r = await db.query(`SELECT * FROM public.${fn}(${args})`, keys.map((k) => params[k]));
    return { data: r.rows, error: null };
  } catch (e) {
    return { data: null, error: { message: String(e) } };
  }
};

const filters = (over: Partial<TaskFilterInput> = {}): TaskFilterInput => ({
  accountId: ACC, search: "Follow", sectorId: null, sectorActivityTypeIds: null,
  isHistoricalUserFilter: false, filterUser: "all", currentUserId: null,
  activityType: "all", stage: "all", negotiation: "all", dateStart: "", dateEnd: "",
  today: "2026-10-05", statuses, ...over,
});
const page = (over: Partial<TaskFilterInput> = {}, extra: Partial<Parameters<typeof buildSearchTasksRpcParams>[0]> = {}) =>
  fetchSearchTasksPage(rpc, buildSearchTasksRpcParams({
    ...filters(over), tab: null, sortBy: "created_at", sortDirection: "desc", limit: 20, offset: 0, ...extra,
  }));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');
    CREATE TABLE public.users (id uuid PRIMARY KEY, name text);
    CREATE TABLE public.activity_types (id uuid PRIMARY KEY, sector_id text);
    CREATE TABLE public.deal_stages (id uuid PRIMARY KEY, name text);
    CREATE TABLE public.clients (id uuid PRIMARY KEY, full_name text);
    CREATE TABLE public.leads (id uuid PRIMARY KEY, full_name text);
    CREATE TABLE public.deals (id uuid PRIMARY KEY, title text, contact_name text, client_id uuid, lead_id uuid, stage_id uuid);
    CREATE TABLE public.internal_tasks (
      id uuid PRIMARY KEY, account_id uuid, title text, description text, priority public.task_priority,
      due_date date, completed_at timestamptz, custom_status_id uuid, activity_type_id uuid,
      assigned_to uuid, created_by uuid, client_id uuid, lead_id uuid, deal_id uuid, created_at timestamptz
    );
  `);
  await db.exec(migrationSql());
  await db.exec(`INSERT INTO public.activity_types VALUES ('${AT_CALL}', null), ('${AT_MAIL}', null);
    INSERT INTO public.clients VALUES ('${HIDDEN_CLIENT}', 'Cliente Secreto');`);
  // 45 tarefas "Follow": 44 concluídas (prazo 01/09), a 45ª pendente (04/10, tipo e-mail)
  // e a MAIS ANTIGA — na ordem padrão (criação desc) fica na última página.
  for (let n = 1; n <= 45; n++) {
    const last = n === 45;
    const prio = ["low", "medium", "high", "urgent"][n % 4];
    await db.query(
      `INSERT INTO public.internal_tasks VALUES ($1,$2,$3,null,$4,$5,$6,$7,$8,null,null,$9,null,null,$10)`,
      [tid(n), ACC, `Follow ${n}`, prio, last ? "2026-10-04" : "2026-09-01",
       last ? null : n % 2 ? "2026-09-02T12:00:00Z" : "2026-09-20T12:00:00Z",
       last ? null : n % 3 === 0 ? null : ST_DONE, last ? AT_MAIL : AT_CALL,
       n === 10 ? HIDDEN_CLIENT : null, new Date(Date.UTC(2026, 0, 1, 0, last ? 0 : n)).toISOString()]
    );
  }
  // Busca literal: "%", "_" e barra não são curingas.
  for (const [i, t] of ["Promo _1", "Promo x1", "Promo %2", "Promo 2", "Promo \\3", "Promo 3"].entries())
    await db.query(`INSERT INTO public.internal_tasks (id, account_id, title, created_at) VALUES ($1,$2,$3, now())`, [tid(500 + i), ACC, t]);
  // Outra conta: nunca aparece.
  await db.query(`INSERT INTO public.internal_tasks (id, account_id, title, created_at) VALUES ($1,$2,'Follow outra conta', now())`, [tid(999), OTHER]);
  // RLS: o cliente vinculado fica invisível para o papel autenticado.
  await db.exec(`
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
    ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
    CREATE POLICY none ON public.clients FOR SELECT TO authenticated USING (false);
    SET ROLE authenticated;
  `);
});

describe("search_tasks_page2 — filtros antes de contar/paginar", () => {
  it("sem filtro, a tarefa 45 NÃO está na primeira página (ordem padrão real)", async () => {
    const r = await page();
    expect(r.total).toBe(45);
    expect(r.ids).not.toContain(tid(45));
  });
  it("busca + prazo 04/10: a única correspondência (posição 45) aparece na página 1, total 1", async () => {
    const r = await page({ dateStart: "2026-10-04", dateEnd: "2026-10-04" });
    expect(r).toEqual({ ids: [tid(45)], total: 1 });
  });
  it("aba Pendentes (status padrão, tarefa sem status): total 1", async () => {
    expect(await page({}, { tab: ST_PEND })).toEqual({ ids: [tid(45)], total: 1 });
  });
  it("tipo de atividade: total 1", async () => {
    expect(await page({ activityType: AT_MAIL })).toEqual({ ids: [tid(45)], total: 1 });
  });
  it("Concluídas inclui completed_at sem status (fallback): 44", async () => {
    expect((await page({}, { tab: ST_DONE })).total).toBe(44);
    expect((await page({}, { tab: ST_PROG })).total).toBe(0);
  });
  it("Atrasadas usa o dia local: vencida em 05/10, não em 04/10 (limite)", async () => {
    expect((await page({ today: "2026-10-05" }, { tab: "__overdue__" })).ids).toEqual([tid(45)]);
    expect((await page({ today: "2026-10-04" }, { tab: "__overdue__" })).total).toBe(0);
  });
  it("conta isolada: tarefa de outra conta nunca entra", async () => {
    expect((await page()).total).toBe(45);
  });
  it("relação invisível por RLS: não casa pela busca, mas a tarefa continua listada pelo título", async () => {
    expect((await page({ search: "Secreto" })).total).toBe(0);
    expect((await page({ search: "Follow 10" })).ids).toContain(tid(10));
  });
});

describe("search_tasks_page2 — ordenação global", () => {
  for (const [sortBy, dir] of [["priority", "asc"], ["due_date", "desc"], ["created_at", "asc"]] as const) {
    it(`${sortBy}/${dir}: páginas 1–3 formam a mesma sequência da consulta completa`, async () => {
      const ex = { sortBy, sortDirection: dir } as const;
      const all = await page({}, { ...ex, limit: 100 });
      const pages = [];
      for (let p = 0; p < 3; p++) pages.push(...(await page({}, { ...ex, offset: p * 20 })).ids);
      expect(pages).toEqual(all.ids);
      expect(new Set(pages).size).toBe(45);
    });
  }
  it("prioridade asc começa por urgentes", async () => {
    const r = await page({}, { sortBy: "priority", sortDirection: "asc", limit: 11 });
    expect(r.ids.every((id) => Number(id.slice(-12)) % 4 === 3)).toBe(true);
  });
});

describe("busca literal nos campos", () => {
  it("'_' , '%' e barra casam só o texto literal", async () => {
    expect(await page({ search: "Promo _" })).toEqual({ ids: [tid(500)], total: 1 });
    expect(await page({ search: "Promo %" })).toEqual({ ids: [tid(502)], total: 1 });
    expect(await page({ search: "Promo \\" })).toEqual({ ids: [tid(504)], total: 1 });
    expect((await page({ search: "promo" })).total).toBe(6);
  });
});

describe("search_tasks_counts — mesmas regras das abas e indicadores", () => {
  it("contagens por aba, atrasadas e concluídas por completed_at no intervalo", async () => {
    const c = await fetchSearchTasksCounts(rpc, buildSearchTasksCountsParams(filters()));
    expect(c[ST_PEND]).toBe(1);
    expect(c[ST_DONE]).toBe(44);
    expect(c.overdue).toBe(1);
    expect(c.pending).toBe(1);
    expect(c.total).toBe(45);
    const ranged = await fetchSearchTasksCounts(rpc, buildSearchTasksCountsParams(filters({ dateStart: "2026-09-15", dateEnd: "2026-09-30" })));
    expect(ranged.done).toBe(22); // concluídas em 20/09, mesmo com prazo 01/09
  });
});

describe("Kanban e exportação", () => {
  it("Kanban (sem aba) alcança as 45 por continuação, mesmo com aba ativa na lista", async () => {
    const first = await page({}, { tab: null, limit: 20 });
    const more = await page({}, { tab: null, limit: 40 });
    const all = await page({}, { tab: null, limit: 60 });
    expect([first.ids.length, more.ids.length, all.ids.length, all.total]).toEqual([20, 40, 45, 45]);
  });
  it("exportação traz as 45 em lotes de 20 com o mesmo predicado", async () => {
    const params = buildSearchTasksRpcParams({ ...filters(), tab: null, sortBy: "created_at", sortDirection: "desc", limit: 20, offset: 0 });
    const ids = await fetchAllSearchTaskIds(rpc, params, 20);
    expect(ids.length).toBe(45);
    expect(new Set(ids).size).toBe(45);
  });
  it("erro no segundo lote aborta a exportação", async () => {
    let calls = 0;
    const failing = async (fn: string, p: Record<string, unknown>) =>
      ++calls === 2 ? { data: null, error: { message: "lote 2 falhou" } } : rpc(fn, p);
    const params = buildSearchTasksRpcParams({ ...filters(), tab: null, sortBy: "created_at", sortDirection: "desc", limit: 20, offset: 0 });
    await expect(fetchAllSearchTaskIds(failing, params, 20)).rejects.toMatchObject({ message: "lote 2 falhou" });
  });
});
