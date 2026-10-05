import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * deals.deleted_by referencia auth.users (não users.id). A versão vigente das
 * RPCs de auditoria precisa resolver o autor por users.auth_user_id e expor
 * users.id como actor — inclusive no filtro de escopo comercial.
 */
const dir = join(process.cwd(), "supabase/migrations");
const latest = readdirSync(dir)
  .filter((f) => readFileSync(join(dir, f), "utf8").includes("FUNCTION public.audit_unified_authors"))
  .sort()
  .pop()!;
const sql = readFileSync(join(dir, latest), "utf8");

describe("auditoria — autor de negócio excluído", () => {
  it("junta deleted_by em users.auth_user_id (mesma conta), nunca em users.id", () => {
    expect(sql).not.toMatch(/u_del\.id\s*=\s*d\.deleted_by/);
    expect(sql.match(/u_del\.auth_user_id = d\.deleted_by AND u_del\.account_id = d\.account_id/g)?.length).toBe(2);
  });
  it("actor e escopo comercial usam users.id", () => {
    expect(sql.match(/COALESCE\(u_del\.id::text, d\.deleted_by::text\)/g)?.length).toBe(2);
    expect(sql).not.toMatch(/d\.deleted_by IN \(SELECT su\.user_id/);
    expect(sql.match(/u_del\.id IN \(SELECT su\.user_id FROM sales_users su\)/g)?.length).toBe(2);
  });
});
