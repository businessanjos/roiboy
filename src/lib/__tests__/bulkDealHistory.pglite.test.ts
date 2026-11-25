// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
async function fixture(role = "gestor") {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE anon;CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE TABLE users(id uuid PRIMARY KEY,auth_user_id uuid,account_id uuid,name text,role text,is_also_admin boolean DEFAULT false);
    CREATE FUNCTION get_current_user_id() RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT id FROM users WHERE auth_user_id=auth.uid() $$;
    CREATE FUNCTION get_current_user_account_id() RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT account_id FROM users WHERE auth_user_id=auth.uid() $$;
    CREATE FUNCTION user_has_sector_access(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    CREATE TABLE pipelines(id uuid PRIMARY KEY,account_id uuid,name text,is_active boolean DEFAULT true);
    CREATE TABLE deal_stages(id uuid PRIMARY KEY,pipeline_id uuid,account_id uuid,name text,probability integer,display_order integer DEFAULT 0,is_active boolean DEFAULT true);
    CREATE TABLE deals(id uuid PRIMARY KEY,account_id uuid,title text,pipeline_id uuid,stage_id uuid,value numeric DEFAULT 0,probability integer DEFAULT 10,status text DEFAULT 'open',stage_changed_at timestamptz DEFAULT clock_timestamp(),deleted_at timestamptz,contact_phone text,won_at timestamptz,lost_at timestamptz,loss_reason text,responsible_user_id uuid,client_id uuid);
    CREATE TABLE custom_fields(id uuid PRIMARY KEY,account_id uuid,name text,field_type text,options jsonb DEFAULT '[]',required_stages jsonb,is_required boolean DEFAULT false,is_active boolean DEFAULT true,show_in_deals boolean DEFAULT true,display_order integer DEFAULT 0);
    CREATE TABLE deal_field_values(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid,deal_id uuid,field_id uuid,value_text text,value_number numeric,value_boolean boolean,value_date date,value_json jsonb,UNIQUE(deal_id,field_id));
    CREATE TABLE products(id uuid PRIMARY KEY,account_id uuid,is_active boolean DEFAULT true,name text);
    CREATE TABLE deal_activities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid,deal_id uuid,type text,title text,old_value text,new_value text,user_id uuid);
    CREATE FUNCTION can_view_deal_id(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1::text IS DISTINCT FROM nullif(current_setting('test.hidden',true),'') $$;
    ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
    CREATE POLICY scoped_deals ON deals TO authenticated USING(account_id=get_current_user_account_id() AND can_view_deal_id(id)) WITH CHECK(account_id=get_current_user_account_id());
    CREATE FUNCTION change_stage() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN NEW.stage_changed_at:=clock_timestamp();END IF;RETURN NEW;END $$;
    CREATE TRIGGER stage_changed BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION change_stage();
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT SELECT ON users,pipelines,deal_stages,custom_fields,products TO authenticated;
    GRANT SELECT,UPDATE ON deals TO authenticated;
    GRANT SELECT,INSERT,UPDATE ON deal_field_values TO authenticated;
    GRANT INSERT ON deal_activities TO authenticated;
  `);
  await db.exec(readFileSync("drizzle/migrations/0101_bulk_deal_history_and_undo.sql", "utf8"));
  await db.exec(readFileSync("drizzle/migrations/0102_bulk_deal_execution_guards.sql", "utf8"));
  await db.exec(readFileSync("drizzle/migrations/0103_bulk_deal_descriptions_and_concurrency.sql", "utf8"));
  await db.exec(readFileSync("drizzle/migrations/0111_bulk_move_preserve_deal_status.sql", "utf8"));
  await db.query("INSERT INTO users VALUES($1,$2,$3,'TESTE QA',$4,false),($5,$6,$7,'Outra conta','gestor',false)", [id(1),id(2),id(3),role,id(21),id(22),id(23)]);
  await db.query("INSERT INTO pipelines(id,account_id,name) VALUES($1,$3,'Funil Original'),($2,$3,'Funil Destino')", [id(4),id(5),id(3)]);
  await db.query("INSERT INTO deal_stages(id,pipeline_id,account_id,name,probability) VALUES($1,$3,$5,'Chegou Lead',10),($2,$4,$5,'Contato Realizado',30)", [id(6),id(7),id(4),id(5),id(3)]);
  await db.query("INSERT INTO deals(id,account_id,title,pipeline_id,stage_id) VALUES($1,$3,'TESTE QA A',$4,$5),($2,$3,'TESTE QA B',$4,$5)",[id(8),id(9),id(3),id(4),id(6)]);
  await db.exec(`SET ROLE authenticated;SELECT set_config('test.uid','${id(2)}',false);`);
  return db;
}
async function run(db: PGlite, action = { type: "move", pipelineId: id(5), stageId: id(7) }, dealIds = [id(8),id(9)]) {
  const start = await db.query<{ op: string }>("SELECT begin_bulk_deal_operation($1::jsonb,$2::uuid[]) op",[JSON.stringify(action),dealIds]);
  const op = start.rows[0].op;
  for (const deal of dealIds) {
    const result = await db.query<{ result: { success: boolean; error: string } }>("SELECT apply_bulk_deal_operation_item($1,$2) result",[op,deal]);
    expect(result.rows[0].result.success, result.rows[0].result.error).toBe(true);
  }
  await db.query("SELECT finish_bulk_deal_operation($1)",[op]);
  return op;
}
describe("Histórico e reversão reais com RLS", () => {
  for (const status of ["won", "lost", "open"]) it(`move e desfaz mantendo status ${status}, fechamento e demais dados`, async () => {
    const db = await fixture();
    try {
      const probability = status === "won" ? 100 : status === "lost" ? 0 : 10;
      await db.query("UPDATE deals SET status=$1,probability=$2,value=35000,won_at=$3,lost_at=$4,loss_reason=$5,responsible_user_id=$6,client_id=$7 WHERE id=$8", [
        status, probability, status === "won" ? "2026-11-25T12:00:00Z" : null,
        status === "lost" ? "2026-11-24T12:00:00Z" : null,
        status === "lost" ? "Sem interesse" : null, id(1), id(40), id(8),
      ]);
      const stableQuery = "SELECT to_jsonb(d) - ARRAY['pipeline_id','stage_id','stage_changed_at','probability'] AS state FROM deals d WHERE id=$1";
      const before = (await db.query(stableQuery, [id(8)])).rows[0];
      const op = await run(db, undefined, [id(8)]);
      expect((await db.query(stableQuery, [id(8)])).rows[0]).toEqual(before);
      expect((await db.query("SELECT status,pipeline_id,stage_id,probability FROM deals WHERE id=$1", [id(8)])).rows[0]).toEqual({
        status, pipeline_id: id(5), stage_id: id(7), probability: status === "open" ? 30 : probability,
      });
      expect((await db.query("SELECT before_state->'deal'->>'status' AS before,after_state->'deal'->>'status' AS after FROM bulk_deal_operation_items WHERE operation_id=$1", [op])).rows[0]).toEqual({ before: status, after: status });
      expect((await db.query("SELECT undo_last_bulk_deal_move($1) count", [op])).rows[0]).toEqual({ count: 1 });
      expect((await db.query(stableQuery, [id(8)])).rows[0]).toEqual(before);
      expect((await db.query("SELECT status,pipeline_id,stage_id,probability FROM deals WHERE id=$1", [id(8)])).rows[0]).toEqual({
        status, pipeline_id: id(4), stage_id: id(6), probability,
      });
    } finally { await db.close(); }
  }, 20000);
  it("não desfaz nenhum negócio se um ganho mudou de status depois", async () => {
    const db = await fixture();
    try {
      await db.query("UPDATE deals SET status='won',probability=100 WHERE id=ANY($1::uuid[])", [[id(8), id(9)]]);
      const op = await run(db);
      await db.query("UPDATE deals SET status='lost' WHERE id=$1", [id(9)]);
      await expect(db.query("SELECT undo_last_bulk_deal_move($1)", [op])).rejects.toThrow("Nada foi desfeito");
      expect((await db.query("SELECT id,status,pipeline_id,stage_id FROM deals ORDER BY id")).rows).toEqual([
        { id: id(8), status: "won", pipeline_id: id(5), stage_id: id(7) },
        { id: id(9), status: "lost", pipeline_id: id(5), stage_id: id(7) },
      ]);
    } finally { await db.close(); }
  }, 20000);
  it("ganho sem acesso não é movido nem reaberto", async () => {
    const db = await fixture();
    try {
      await db.query("UPDATE deals SET status='won',probability=100 WHERE id=$1", [id(8)]);
      await db.query("SELECT set_config('test.hidden',$1,false)", [id(8)]);
      const start = await db.query<{ op: string }>("SELECT begin_bulk_deal_operation($1,$2) op", [JSON.stringify({ type: "move", pipelineId: id(5), stageId: id(7) }), [id(8)]]);
      const op = start.rows[0]?.op;
      if (!op) throw new Error("Operação de teste não criada");
      await expect(db.query("SELECT apply_bulk_deal_operation_item($1,$2) result", [op, id(8)])).rejects.toThrow("row-level security");
      await db.query("SELECT set_config('test.hidden','',false)");
      expect((await db.query("SELECT status,pipeline_id,stage_id FROM deals WHERE id=$1", [id(8)])).rows[0]).toEqual({ status: "won", pipeline_id: id(4), stage_id: id(6) });
    } finally { await db.close(); }
  }, 20000);
  it("campo numérico usa só a coluna tipada, registra antes/depois e preserva zero",async () => {
    const db=await fixture();
    try {
      await db.exec('RESET ROLE');
      await db.query("INSERT INTO custom_fields(id,account_id,name,field_type) VALUES($1,$2,'Campo QA','number')",[id(30),id(3)]);
      await db.exec('SET ROLE authenticated');
      const start=await db.query<{ op:string }>("SELECT begin_bulk_deal_operation($1,$2) op",[JSON.stringify({type:'field',fieldId:id(30),fieldType:'number',columns:{value_number:0,value_text:'não gravar'}}),[id(8)]]);
      const op=start.rows[0].op;
      const result=await db.query<{ result:{success:boolean;error:string} }>("SELECT apply_bulk_deal_operation_item($1,$2) result",[op,id(8)]);
      expect(result.rows[0].result.success,result.rows[0].result.error).toBe(true);
      expect((await db.query("SELECT value_number,value_text FROM deal_field_values WHERE deal_id=$1",[id(8)])).rows[0]).toEqual({value_number:'0',value_text:null});
      expect((await db.query("SELECT before_state IS NOT NULL AND after_state IS NOT NULL captured FROM bulk_deal_operation_items WHERE operation_id=$1",[op])).rows[0]).toEqual({captured:true});
    } finally { await db.close(); }
  },20000);
  for (const role of ["admin","gestor"]) it(`${role} move e desfaz, sem sobrescrever valor editado depois`, async () => {
    const db=await fixture(role);
    try {
      const op=await run(db);
      expect((await db.query("SELECT actor_id,actor_name,status FROM bulk_deal_operations WHERE id=$1",[op])).rows[0]).toEqual({actor_id:id(2),actor_name:"TESTE QA",status:"completed"});
      await db.query("UPDATE deals SET value=1860 WHERE id=$1",[id(8)]);
      expect((await db.query("SELECT undo_last_bulk_deal_move($1) count",[op])).rows[0]).toEqual({count:2});
      expect((await db.query("SELECT pipeline_id,stage_id,value FROM deals WHERE id=$1",[id(8)])).rows[0]).toEqual({pipeline_id:id(4),stage_id:id(6),value:"1860"});
      expect((await db.query("SELECT undone_at IS NOT NULL undone FROM bulk_deal_operations WHERE id=$1",[op])).rows[0]).toEqual({undone:true});
      await expect(db.query("SELECT undo_last_bulk_deal_move($1)",[op])).rejects.toThrow("já desfeita");
    } finally { await db.close(); }
  },20000);
  for (const role of ["member","mentor","viewer"]) it(`${role} não inicia alteração em massa`,async () => {
    const db=await fixture(role);
    try { await expect(db.query("SELECT begin_bulk_deal_operation($1,$2)",[JSON.stringify({type:"value",value:0}),[id(8)]])).rejects.toThrow("administradores"); }
    finally { await db.close(); }
  },20000);
  it("rejeita autoria alternativa e escrita direta de snapshots",async () => {
    const db=await fixture();
    try {
      await expect(db.query("SELECT begin_bulk_deal_operation($1,$2)",[JSON.stringify({type:"value",value:0,actor_id:id(22)}),[id(8)]])).rejects.toThrow("Autoria");
      const op=await run(db);
      await expect(db.query("UPDATE bulk_deal_operations SET actor_id=$1 WHERE id=$2",[id(22),op])).rejects.toThrow("permission denied");
      await expect(db.query("UPDATE bulk_deal_operation_items SET before_state='{}' WHERE operation_id=$1",[op])).rejects.toThrow("permission denied");
    } finally { await db.close(); }
  },20000);
  it("reversão inteira bloqueada após outra movimentação de qualquer negócio",async () => {
    const db=await fixture();
    try {
      const op=await run(db);await db.query("UPDATE deals SET stage_id=$1 WHERE id=$2",[id(6),id(9)]);
      await expect(db.query("SELECT undo_last_bulk_deal_move($1)",[op])).rejects.toThrow("Nada foi desfeito");
      expect((await db.query("SELECT pipeline_id,stage_id FROM deals WHERE id=$1",[id(8)])).rows[0]).toEqual({pipeline_id:id(5),stage_id:id(7)});
    } finally { await db.close(); }
  },20000);
  it("perda de acesso de um negócio impede reversão parcial",async () => {
    const db=await fixture();
    try {
      const op=await run(db);await db.query("SELECT set_config('test.hidden',$1,false)",[id(9)]);
      await expect(db.query("SELECT undo_last_bulk_deal_move($1)",[op])).rejects.toThrow("Sem acesso a todos");
      expect((await db.query("SELECT pipeline_id FROM deals WHERE id=$1",[id(8)])).rows[0]).toEqual({pipeline_id:id(5)});
    } finally { await db.close(); }
  },20000);
  it("outra conta não lê histórico nem desfaz a operação",async () => {
    const db=await fixture();
    try {
      const op=await run(db);await db.query("SELECT set_config('test.uid',$1,false)",[id(22)]);
      expect((await db.query("SELECT * FROM bulk_deal_operations")).rows).toEqual([]);
      await expect(db.query("SELECT undo_last_bulk_deal_move($1)",[op])).rejects.toThrow("indisponível");
    } finally { await db.close(); }
  },20000);
});