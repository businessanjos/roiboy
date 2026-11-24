// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

const account = "00000000-0000-4000-8000-000000000001";
const otherAccount = "00000000-0000-4000-8000-000000000002";
const actor = "00000000-0000-4000-8000-000000000011";
const owner = "00000000-0000-4000-8000-000000000012";
const nextOwner = "00000000-0000-4000-8000-000000000013";
const task = "00000000-0000-4000-8000-000000000021";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE users(id uuid PRIMARY KEY,account_id uuid,auth_user_id uuid,name text,email text,is_active boolean DEFAULT true);
    CREATE TABLE marketing_tasks(id uuid PRIMARY KEY,account_id uuid,title text,assignee_id uuid,created_by uuid);
    CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid,user_id uuid,type text,title text,content text,link text,source_type text,source_id uuid,triggered_by_user_id uuid,sector_id text);
    GRANT SELECT,INSERT,UPDATE ON marketing_tasks TO authenticated;
    ALTER TABLE marketing_tasks ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tasks_access ON marketing_tasks TO authenticated USING(account_id=current_setting('app.account_id')::uuid) WITH CHECK(account_id=current_setting('app.account_id')::uuid);
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
  `);
  await db.exec(readFileSync("drizzle/migrations/0107_marketing_task_assignment_notifications.sql", "utf8"));
}, 20000);
beforeEach(async () => {
  await db.exec("RESET ROLE; DELETE FROM notifications; DELETE FROM marketing_tasks; DELETE FROM users;");
  for (const [id, name] of [[actor,"Jessica Campos"],[owner,"Lucas dos Santos"],[nextOwner,"Fernanda Ramos"]]) {
    await db.query("INSERT INTO users VALUES($1,$2,$1,$3,$4,true)", [id,account,name,`${id}@qa.invalid`]);
  }
  await db.query("SELECT set_config('app.user_id',$1,false),set_config('app.account_id',$2,false)",[actor,account]);
});
afterAll(async () => { await db.close(); });
const create = (assignee: string | null = owner, creator: string = actor) => db.query("INSERT INTO marketing_tasks VALUES($1,$2,'TESTE QA — Campanha',$3,$4)",[task,account,assignee,creator]);
const notices = async () => (await db.query<{user_id:string;type:string;triggered_by_user_id:string|null;source_id:string;link:string}>("SELECT * FROM notifications ORDER BY id")).rows;

it("uma tarefa nova avisa somente quem a recebeu", async () => {
  await create();
  const rows = await notices();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({user_id:owner,type:"task_assigned",triggered_by_user_id:actor,source_id:task,link:`/marketing/projetos?tab=tarefas&task=${task}`});
});
it("transferência avisa o novo responsável, não o anterior", async () => {
  await create(); await db.exec("DELETE FROM notifications");
  await db.query("UPDATE marketing_tasks SET assignee_id=$1 WHERE id=$2",[nextOwner,task]);
  expect((await notices()).map(row=>row.user_id)).toEqual([nextOwner]);
});
it("manter o responsável e editar outros dados não repete aviso", async () => {
  await create();
  await db.query("UPDATE marketing_tasks SET assignee_id=$1 WHERE id=$2",[owner,task]);
  await db.query("UPDATE marketing_tasks SET title='TESTE QA — Revisão' WHERE id=$1",[task]);
  expect(await notices()).toHaveLength(1);
});
it("autoatribuição não gera notificação para o autor", async () => {
  await create(actor);
  await db.query("UPDATE marketing_tasks SET assignee_id=$1 WHERE id=$2",[actor,task]);
  expect(await notices()).toEqual([]);
});
it("sem responsável não há aviso; primeira atribuição avisa", async () => {
  await create(null); expect(await notices()).toEqual([]);
  await db.query("UPDATE marketing_tasks SET assignee_id=$1 WHERE id=$2",[owner,task]);
  expect((await notices()).map(row=>row.user_id)).toEqual([owner]);
  await db.query("UPDATE marketing_tasks SET assignee_id=null WHERE id=$1",[task]);
  expect(await notices()).toHaveLength(1);
});
it("a pessoa pode receber novamente após outra transferência", async () => {
  await create();
  await db.query("UPDATE marketing_tasks SET assignee_id=$1 WHERE id=$2",[nextOwner,task]);
  await db.query("UPDATE marketing_tasks SET assignee_id=$1 WHERE id=$2",[owner,task]);
  expect((await notices()).filter(row=>row.user_id===owner)).toHaveLength(2);
});
it("destinatários de outra conta não recebem dados da tarefa", async () => {
  await db.query("UPDATE users SET account_id=$1 WHERE id=$2",[otherAccount,owner]);
  await create(); expect(await notices()).toEqual([]);
});
it("destinatários inativos não recebem aviso", async () => {
  await db.query("UPDATE users SET is_active=false WHERE id=$1",[owner]);
  await create(); expect(await notices()).toEqual([]);
});
it("conta técnica de TV nunca recebe aviso de tarefa", async () => {
  const tv = "4cd93864-3689-4835-bddf-91e2960e7860";
  await db.query("INSERT INTO users VALUES($1,$2,$1,'TV Escritório','tv-escritorio@iamroy.app',true)",[tv,account]);
  await create(tv); expect(await notices()).toEqual([]);
});
it("atribuição autenticada usa a identidade da sessão e não um criador forjado", async () => {
  await db.exec("SET ROLE authenticated");
  await create(owner,owner);
  await db.exec("RESET ROLE");
  expect((await notices())[0]?.triggered_by_user_id).toBe(actor);
});
it("RLS continua impedindo criar tarefas fora da conta", async () => {
  await db.exec("SET ROLE authenticated");
  await expect(db.query("INSERT INTO marketing_tasks VALUES($1,$2,'TESTE QA',$3,$4)",[task,otherAccount,owner,actor])).rejects.toThrow();
  await db.exec("RESET ROLE"); expect(await notices()).toEqual([]);
});
it("transferência em segundo plano não atribui autoria ao criador original", async () => {
  await create(); await db.exec("DELETE FROM notifications; SELECT set_config('app.user_id','',false)");
  await db.query("UPDATE marketing_tasks SET assignee_id=$1 WHERE id=$2",[nextOwner,task]);
  expect((await notices())[0]).toMatchObject({user_id:nextOwner,triggered_by_user_id:null});
});