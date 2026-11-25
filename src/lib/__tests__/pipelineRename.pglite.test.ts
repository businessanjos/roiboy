// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const filter = (values: string[]) => JSON.stringify({ filters: [
  { field: "status", source: "native", operator: "is_any", values: ["Closer"] },
  { field: "pipeline_name", source: "native", operator: "is_any", values },
] });

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE anon;CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE TABLE users(id uuid PRIMARY KEY,auth_user_id uuid,account_id uuid,name text);
    CREATE TABLE pipelines(id uuid PRIMARY KEY,account_id uuid,name text,is_active boolean DEFAULT true,display_order integer DEFAULT 0,created_at timestamptz DEFAULT now());
    CREATE TABLE insights_dashboards(id uuid PRIMARY KEY,account_id uuid);
    CREATE TABLE insights_visuals(id uuid PRIMARY KEY,dashboard_id uuid,config jsonb);
    INSERT INTO users VALUES('${id(1)}','${id(2)}','${id(3)}','TESTE QA'),('${id(11)}','${id(12)}','${id(13)}','Outra conta');
    INSERT INTO pipelines(id,account_id,name) VALUES('${id(4)}','${id(3)}','Closer'),('${id(5)}','${id(3)}','SDR'),('${id(14)}','${id(13)}','Closer');
    INSERT INTO insights_dashboards VALUES('${id(6)}','${id(3)}'),('${id(16)}','${id(13)}');
    INSERT INTO insights_visuals VALUES
      ('${id(7)}','${id(6)}','${filter(["closer", "SDR"])}'),
      ('${id(8)}','${id(6)}','${filter(["SDR"])}'),
      ('${id(17)}','${id(16)}','${filter(["Closer"])}');
  `);
  await db.exec(readFileSync("drizzle/migrations/0109_pipeline_rename_safety.sql", "utf8"));
  await db.exec(`
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT SELECT ON users TO authenticated;
    GRANT SELECT,INSERT,UPDATE ON pipelines TO authenticated;
    SET ROLE authenticated;SELECT set_config('test.uid','${id(2)}',false);
  `);
  return db;
}
const values = async (db: PGlite, visual: string) =>
  (await db.query<{ v: string[] }>("SELECT config->'filters'->1->'values' v FROM insights_visuals WHERE id=$1", [visual])).rows[0].v;

describe("Trocar o nome do funil não quebra nada", { timeout: 30_000 }, () => {
  it("migração dá o papel fixo e o nome não é mais a referência", async () => {
    const db = await fixture();
    const rows = (await db.query<{ name: string; system_role: string }>("SELECT name,system_role FROM pipelines WHERE account_id=$1 ORDER BY name", [id(3)])).rows;
    expect(rows).toEqual([{ name: "Closer", system_role: "closer" }, { name: "SDR", system_role: "sdr" }]);
    await db.close();
  });

  it("gráficos da conta acompanham o nome novo, o antigo vira apelido e fica o registro", async () => {
    const db = await fixture();
    await db.query("UPDATE pipelines SET name='Funil Mentoria' WHERE id=$1", [id(4)]);
    await db.exec("RESET ROLE");
    expect(await values(db, id(7))).toEqual(["Funil Mentoria", "SDR"]);
    expect(await values(db, id(8))).toEqual(["SDR"]);
    expect(await values(db, id(17))).toEqual(["Closer"]);
    const other = (await db.query<{ v: string[] }>("SELECT config->'filters'->0->'values' v FROM insights_visuals WHERE id=$1", [id(7)])).rows[0].v;
    expect(other).toEqual(["Closer"]);
    const pipe = (await db.query<{ previous_names: string[]; system_role: string }>("SELECT previous_names,system_role FROM pipelines WHERE id=$1", [id(4)])).rows[0];
    expect(pipe).toEqual({ previous_names: ["Closer"], system_role: "closer" });
    const history = (await db.query("SELECT old_name,new_name,changed_by,visuals_updated FROM pipeline_name_history")).rows;
    expect(history).toEqual([{ old_name: "Closer", new_name: "Funil Mentoria", changed_by: id(1), visuals_updated: 1 }]);
    await db.close();
  });

  it("voltar ao nome antigo e reaproveitar um nome mantêm os apelidos coerentes", async () => {
    const db = await fixture();
    await db.query("UPDATE pipelines SET name='Funil Mentoria' WHERE id=$1", [id(4)]);
    await db.query("UPDATE pipelines SET name='Closer' WHERE id=$1", [id(5)]);
    await db.exec("RESET ROLE");
    const rows = (await db.query<{ id: string; previous_names: string[] }>("SELECT id,previous_names FROM pipelines WHERE account_id=$1 ORDER BY id", [id(3)])).rows;
    expect(rows).toEqual([{ id: id(4), previous_names: [] }, { id: id(5), previous_names: ["SDR"] }]);
    await db.close();
  });

  it("a tela não consegue forjar papel nem apelidos", async () => {
    const db = await fixture();
    await db.query("UPDATE pipelines SET system_role='closer',previous_names=ARRAY['Funil Mentoria'] WHERE id=$1", [id(5)]);
    await db.query("INSERT INTO pipelines(id,account_id,name,system_role,previous_names) VALUES($1,$2,'Novo','low_ticket',ARRAY['E-Pass'])", [id(9), id(3)]);
    const rows = (await db.query<{ id: string; system_role: string | null; previous_names: string[] }>("SELECT id,system_role,previous_names FROM pipelines WHERE id IN ($1,$2) ORDER BY id", [id(5), id(9)])).rows;
    expect(rows).toEqual([{ id: id(5), system_role: "sdr", previous_names: [] }, { id: id(9), system_role: null, previous_names: [] }]);
    await db.close();
  });

  it("aviso conta só os gráficos da própria conta e nega outra conta", async () => {
    const db = await fixture();
    const impact = (await db.query<{ r: Record<string, unknown> }>("SELECT pipeline_rename_impact($1) r", [id(4)])).rows[0].r;
    expect(impact).toMatchObject({ charts: 1, dashboards: 1, system_role: "closer" });
    await expect(db.query("SELECT pipeline_rename_impact($1)", [id(14)])).rejects.toThrow("Funil não encontrado");
    await db.close();
  });
});
