import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * deals.deleted_by referencia auth.users (não users.id). A versão vigente da
 * RPC de auditoria precisa resolver o autor por users.auth_user_id e expor
 * users.id como actor — inclusive no filtro de escopo comercial. A RPC de
 * autores (filtro Pessoas) reutiliza a RPC principal, sem recompor descrições.
 */
const dir = join(process.cwd(), "supabase/migrations");
const latestWith = (marker: string) => {
  const f = readdirSync(dir)
    .filter((n) => readFileSync(join(dir, n), "utf8").includes(marker))
    .sort()
    .pop()!;
  return readFileSync(join(dir, f), "utf8");
};
const pageSql = latestWith("FUNCTION public.audit_unified_page(");
const authorsSql = latestWith("FUNCTION public.audit_unified_authors(");
const authorsFn = authorsSql.slice(authorsSql.indexOf("FUNCTION public.audit_unified_authors("));

describe("auditoria — autor de negócio excluído", () => {
  it("junta deleted_by em users.auth_user_id (mesma conta), nunca em users.id", () => {
    expect(pageSql).not.toMatch(/u_del\.id\s*=\s*d\.deleted_by/);
    expect(pageSql).toMatch(/u_del\.auth_user_id = d\.deleted_by AND u_del\.account_id = d\.account_id/);
  });
  it("actor e escopo comercial usam users.id", () => {
    expect(pageSql).toMatch(/COALESCE\(u_del\.id::text, d\.deleted_by::text\)/);
    expect(pageSql).not.toMatch(/d\.deleted_by IN \(SELECT su\.user_id/);
    expect(pageSql).toMatch(/u_del\.id IN \(SELECT su\.user_id FROM sales_users su\)/);
  });
});

describe("auditoria — filtro Pessoas usa o mesmo conjunto da lista", () => {
  it("chama audit_unified_page com p_user NULL e a mesma busca (descrição/nota/etapa/details)", () => {
    expect(authorsFn).toMatch(
      /audit_unified_page\(\s*p_account_id, p_from, p_to, p_scope, p_action, p_entity_type,\s*NULL, p_search, 0, NULL\s*\)/
    );
    // nenhuma recomposição própria de descrição/predicado
    expect(authorsFn).not.toMatch(/Criou task|ILIKE/);
  });
  it("uma opção por pessoa, com nome determinístico (registro mais recente)", () => {
    expect(authorsFn).toMatch(/DISTINCT ON \(p\.user_id\)/);
    expect(authorsFn).toMatch(/ORDER BY p\.user_id, p\.created_at DESC, p\.source, p\.id/);
    expect(authorsFn).not.toMatch(/SELECT DISTINCT a\.user_id, a\.user_name/);
  });
  it("continua SECURITY INVOKER e só para usuários logados", () => {
    expect(authorsFn).toMatch(/SECURITY INVOKER/);
    expect(authorsFn).toMatch(/FROM PUBLIC, anon/);
  });
});
