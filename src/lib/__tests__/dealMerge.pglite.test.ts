// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE anon;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT ''${id(1)}''::uuid';
    CREATE FUNCTION get_current_user_id() RETURNS uuid LANGUAGE sql AS 'SELECT ''${id(1)}''::uuid';
    CREATE FUNCTION get_current_user_account_id() RETURNS uuid LANGUAGE sql AS 'SELECT ''${id(2)}''::uuid';
    CREATE FUNCTION can_view_deal_id(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT true';
    CREATE TABLE deals(id uuid PRIMARY KEY,account_id uuid,title text,value numeric,probability integer,expected_close_date date,source text,responsible_user_id uuid,notes text,tags jsonb,lead_id uuid,status text,deleted_at timestamptz,deleted_by uuid,updated_at timestamptz);
    CREATE TABLE deal_activities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid,deal_id uuid,type text,title text,content text,user_id uuid);
    CREATE TABLE internal_tasks(id uuid PRIMARY KEY,account_id uuid,deal_id uuid,title text);
    CREATE TABLE deal_field_values(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid,deal_id uuid,field_id uuid,value_text text,value_number numeric,value_boolean boolean,value_date date,value_json jsonb);
  `);
  await db.exec(readFileSync("drizzle/migrations/0041_reversible_deal_merge.sql", "utf8"));
  await db.query("INSERT INTO deals(id,account_id,title,lead_id,status,value,tags) VALUES($1,$3,'New',$4,'open',100,'[]'),($2,$3,'Old',$5,'lost',0,'[]')", [id(3),id(4),id(2),id(5),id(6)]);
  await db.query("INSERT INTO deal_activities(account_id,deal_id,type,title) VALUES($1,$2,'note','Original')", [id(2),id(4)]);
  await db.query("INSERT INTO internal_tasks VALUES($1,$2,$3,'Follow-up')",[id(7),id(2),id(4)]);
  await db.query("INSERT INTO deal_field_values(account_id,deal_id,field_id,value_text) VALUES($1,$2,$4,'Old field'),($1,$3,$4,'New field'),($1,$2,$5,'Extra')",[id(2),id(4),id(3),id(8),id(9)]);
  return db;
}
const payload = { title: "New", value: 100, probability: 0, expected_close_date: null, source: null, responsible_user_id: null, notes: null, tags: [] };
async function merge(db: PGlite) {
  const result = await db.query<{ action: string }>("SELECT merge_deals_reversible($1,$2,$3::jsonb) action",[id(4),id(3),JSON.stringify(payload)]);
  return result.rows[0].action;
}
it("merge preserves the selected new lead and undo restores both deals, tasks and colliding fields",async () => {
  const db=await fixture();
  try {
    const action=await merge(db);
    expect((await db.query("SELECT lead_id,status FROM deals WHERE id=$1",[id(3)])).rows[0]).toEqual({lead_id:id(5),status:"open"});
    expect((await db.query("SELECT deleted_at IS NOT NULL archived FROM deals WHERE id=$1",[id(4)])).rows[0]).toEqual({archived:true});
    expect((await db.query("SELECT deal_id FROM internal_tasks")).rows[0]).toEqual({deal_id:id(3)});
    await db.query("SELECT undo_deal_merge($1)",[action]);
    expect((await db.query("SELECT deleted_at,lead_id FROM deals WHERE id=$1",[id(4)])).rows[0]).toEqual({deleted_at:null,lead_id:id(6)});
    expect((await db.query("SELECT deal_id FROM internal_tasks")).rows[0]).toEqual({deal_id:id(4)});
    expect((await db.query("SELECT count(*)::int total FROM deal_field_values")).rows[0]).toEqual({total:3});
    await expect(db.query("SELECT undo_deal_merge($1)",[action])).rejects.toThrow("já foi desfeita");
  } finally { await db.close(); }
},20000);
it("undo refuses to overwrite later edits",async () => {
  const db=await fixture();
  try {
    const action=await merge(db);
    await db.query("UPDATE internal_tasks SET title='Later change'");
    await expect(db.query("SELECT undo_deal_merge($1)",[action])).rejects.toThrow("alterações após");
    expect((await db.query("SELECT title FROM internal_tasks")).rows[0]).toEqual({title:"Later change"});
  } finally { await db.close(); }
},20000);
it("failure rolls back the whole merge instead of deleting the source",async () => {
  const db=await fixture();
  try {
    await db.exec("CREATE FUNCTION fail_merge() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Simulated failure'; END $$; CREATE TRIGGER fail_merge BEFORE INSERT ON deal_merge_actions FOR EACH ROW EXECUTE FUNCTION fail_merge();");
    await expect(merge(db)).rejects.toThrow("Simulated failure");
    expect((await db.query("SELECT deal_id FROM internal_tasks")).rows[0]).toEqual({deal_id:id(4)});
    expect((await db.query("SELECT deleted_at FROM deals WHERE id=$1",[id(4)])).rows[0]).toEqual({deleted_at:null});
  } finally { await db.close(); }
},20000);
it("merge rejects a deal from another account",async () => {
  const db=await fixture();
  try {
    await db.query("UPDATE deals SET account_id=$1 WHERE id=$2",[id(20),id(4)]);
    await expect(merge(db)).rejects.toThrow("não tem acesso");
  } finally { await db.close(); }
},20000);