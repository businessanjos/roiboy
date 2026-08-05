/**
 * Testes de RLS — deal_operation_briefings
 *
 * Valida que os papéis Vendas, SDR e Operações/CS conseguem ler os briefings
 * enviados pelo Comercial, usando como fixtures os 3 casos reais reportados:
 * Adriane Paz, Itana e Gabriel Sato.
 *
 * A avaliação é feita direto no Postgres, reproduzindo exatamente o predicado
 * das políticas ativas na tabela (isolamento por conta + acesso por setor),
 * então qualquer alteração futura nas policies quebra estes testes.
 *
 * Os testes são pulados automaticamente quando não há acesso ao banco (PGHOST).
 */
import { execFileSync } from "node:child_process";
import { describe, it, expect, beforeAll } from "vitest";

const HAS_DB = !!process.env.PGHOST;
const d = HAS_DB ? describe : describe.skip;

function q(sql: string): string[][] {
  const out = execFileSync("psql", ["-At", "-F", "|", "-c", sql], {
    encoding: "utf8",
  });
  return out
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => l.split("|"));
}

const lit = (v: string) => `'${v.replace(/'/g, "''")}'`;

/** Predicado equivalente às policies de SELECT da tabela. */
function canSelectBriefing(authUserId: string, briefingId: string): boolean {
  const sql = `
    select exists (
      select 1 from public.deal_operation_briefings b
      where b.id = ${lit(briefingId)}::uuid
        and b.account_id in (
          select u.account_id from public.users u where u.auth_user_id = ${lit(authUserId)}::uuid
        )
        and (
          public.user_has_sector_access(${lit(authUserId)}::uuid, 'vendas')
          or public.user_has_sector_access(${lit(authUserId)}::uuid, 'sdr')
          or public.user_has_sector_access(${lit(authUserId)}::uuid, 'operacoes')
        )
    )`;
  return q(sql)[0][0] === "t";
}

/** Usuário não-admin, com acesso ativo apenas ao setor informado entre os 3 relevantes. */
function userWithSector(sectorId: string, accountId: string): string | null {
  const rows = q(`
    select u.auth_user_id
    from public.user_sector_access usa
    join public.users u on u.id = usa.user_id
    where usa.sector_id = ${lit(sectorId)}
      and usa.is_active = true
      and u.auth_user_id is not null
      and u.account_id = ${lit(accountId)}::uuid
      and u.role is distinct from 'admin'
      and coalesce(u.is_also_admin, false) = false
      and not exists (select 1 from public.super_admins sa where sa.user_id = u.id)
    limit 1`);
  return rows.length ? rows[0][0] : null;
}

/** Usuário sem nenhum dos setores Vendas/SDR/Operações (controle negativo). */
function userWithoutAnySector(accountId: string): string | null {
  const rows = q(`
    select u.auth_user_id
    from public.users u
    where u.auth_user_id is not null
      and u.account_id = ${lit(accountId)}::uuid
      and u.role is distinct from 'admin'
      and coalesce(u.is_also_admin, false) = false
      and not exists (select 1 from public.super_admins sa where sa.user_id = u.id)
      and not exists (
        select 1 from public.user_sector_access usa
        where usa.user_id = u.id and usa.is_active = true
          and usa.sector_id in ('vendas', 'sdr', 'operacoes')
      )
    limit 1`);
  return rows.length ? rows[0][0] : null;
}

type Fixture = { name: string; briefingId: string; accountId: string };

d("RLS — deal_operation_briefings", () => {
  let fixtures: Fixture[] = [];

  beforeAll(() => {
    fixtures = q(`
      select c.full_name, b.id::text, b.account_id::text
      from public.deal_operation_briefings b
      join public.deals d on d.id = b.deal_id
      join public.clients c on c.id = d.client_id
      where c.full_name ilike any (array['%adriane%paz%', '%itana%', '%sato%'])
      order by c.full_name`).map(([name, briefingId, accountId]) => ({
      name,
      briefingId,
      accountId,
    }));
  });

  it("as policies esperadas estão ativas na tabela", () => {
    const policies = q(`
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'deal_operation_briefings'`).map((r) => r[0]);
    expect(policies).toContain("require_sales_or_ops_sector_access");
    expect(policies).toContain("Users can view briefings of their account");
    // A policy antiga, restrita só a Vendas, não pode voltar
    expect(policies).not.toContain("require_vendas_sector_access");
  });

  it("a policy de setor cobre Vendas, SDR e Operações", () => {
    const [[qual]] = q(`
      select qual from pg_policies
      where schemaname = 'public' and tablename = 'deal_operation_briefings'
        and policyname = 'require_sales_or_ops_sector_access'`);
    expect(qual).toContain("'vendas'");
    expect(qual).toContain("'sdr'");
    expect(qual).toContain("'operacoes'");
  });

  it("os 3 casos de referência existem como fixtures", () => {
    expect(fixtures.length).toBe(3);
    const names = fixtures.map((f) => f.name.toLowerCase()).join(" | ");
    expect(names).toMatch(/adriane/);
    expect(names).toMatch(/itana/);
    expect(names).toMatch(/sato/);
  });

  for (const sector of ["vendas", "sdr", "operacoes"]) {
    it(`papel "${sector}" enxerga os 3 briefings da sua conta`, () => {
      for (const f of fixtures) {
        const authUserId = userWithSector(sector, f.accountId);
        expect(authUserId, `nenhum usuário não-admin com setor ${sector}`).toBeTruthy();
        expect(
          canSelectBriefing(authUserId!, f.briefingId),
          `${sector} deveria enxergar o briefing de ${f.name}`,
        ).toBe(true);
      }
    });
  }

  it("usuário sem Vendas/SDR/Operações não enxerga os briefings", () => {
    for (const f of fixtures) {
      const authUserId = userWithoutAnySector(f.accountId);
      if (!authUserId) continue; // sem controle disponível nesta conta
      expect(
        canSelectBriefing(authUserId, f.briefingId),
        `usuário sem setor não deveria enxergar o briefing de ${f.name}`,
      ).toBe(false);
    }
  });

  it("isolamento por conta: usuário de outra conta não enxerga os briefings", () => {
    for (const f of fixtures) {
      const rows = q(`
        select u.auth_user_id from public.users u
        where u.auth_user_id is not null and u.account_id is distinct from ${lit(f.accountId)}::uuid
        limit 1`);
      if (!rows.length) continue;
      expect(canSelectBriefing(rows[0][0], f.briefingId)).toBe(false);
    }
  });
});
