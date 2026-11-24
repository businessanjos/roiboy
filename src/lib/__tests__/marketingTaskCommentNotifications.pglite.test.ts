// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { writeTaskComment } from "@/lib/marketing/taskCommentContent";

const account = "00000000-0000-4000-8000-000000000001";
const otherAccount = "00000000-0000-4000-8000-000000000002";
const actor = "00000000-0000-4000-8000-000000000011";
const owner = "00000000-0000-4000-8000-000000000012";
const mentioned = "00000000-0000-4000-8000-000000000013";
const foreign = "00000000-0000-4000-8000-000000000014";
const task = "00000000-0000-4000-8000-000000000021";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE users(id uuid PRIMARY KEY,account_id uuid,auth_user_id uuid,name text,email text,is_active boolean DEFAULT true);
    CREATE TABLE user_sector_access(user_id uuid,account_id uuid,sector_id text,is_active boolean DEFAULT true);
    CREATE TABLE marketing_tasks(id uuid PRIMARY KEY,account_id uuid,title text,assignee_id uuid);
    CREATE TABLE marketing_task_comments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid,task_id uuid,user_id uuid,body text,author_name text,created_at timestamptz DEFAULT now());
    CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid,user_id uuid,type text,title text,content text,link text,source_type text,source_id uuid,triggered_by_user_id uuid,sector_id text);
    GRANT SELECT ON users,marketing_tasks TO authenticated;
    GRANT SELECT,INSERT ON marketing_task_comments TO authenticated;
    ALTER TABLE marketing_tasks ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tasks_read ON marketing_tasks FOR SELECT TO authenticated USING(account_id=current_setting('app.account_id')::uuid);
    ALTER TABLE marketing_task_comments ENABLE ROW LEVEL SECURITY;
    CREATE POLICY comments_create ON marketing_task_comments FOR INSERT TO authenticated WITH CHECK(account_id=current_setting('app.account_id')::uuid AND user_id=auth.uid());
    CREATE POLICY comments_read ON marketing_task_comments FOR SELECT TO authenticated USING(account_id=current_setting('app.account_id')::uuid);
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
  `);
  const identitySql = readFileSync("drizzle/migrations/0105_marketing_task_comment_author_snapshot.sql", "utf8");
  await db.exec(identitySql.slice(identitySql.indexOf("CREATE OR REPLACE FUNCTION")));
  await db.exec("CREATE TRIGGER identity_stamp BEFORE INSERT ON marketing_task_comments FOR EACH ROW EXECUTE FUNCTION marketing_task_comment_identity();");
  await db.exec(readFileSync("drizzle/migrations/0106_marketing_task_comment_notifications.sql", "utf8"));
}, 20000);
beforeEach(async () => {
  await db.exec("RESET ROLE; DELETE FROM notifications; DELETE FROM marketing_task_comments; DELETE FROM marketing_tasks; DELETE FROM user_sector_access; DELETE FROM users;");
  for (const [id, name, acc] of [[actor,"Jessica Campos",account],[owner,"Lucas dos Santos",account],[mentioned,"Fernanda Ramos",account],[foreign,"Fernanda Externa",otherAccount]]) {
    await db.query("INSERT INTO users VALUES($1,$2,$1,$3,$4,true)", [id,acc,name,`${id}@qa.invalid`]);
    await db.query("INSERT INTO user_sector_access VALUES($1,$2,'marketing',true)",[id,acc]);
  }
  await db.query("INSERT INTO marketing_tasks VALUES($1,$2,'TESTE QA — Campanha de novembro',$3)",[task,account,owner]);
  await db.query("SELECT set_config('app.user_id',$1,false),set_config('app.account_id',$2,false)",[actor,account]);
});
afterAll(async () => { await db.close(); });
const comment = async (body: string, user = actor) => db.query<{id:string}>("INSERT INTO marketing_task_comments(account_id,task_id,user_id,body) VALUES($1,$2,$3,$4) RETURNING id",[account,task,user,body]);
const notifications = async () => (await db.query<{user_id:string;type:string;source_id:string;triggered_by_user_id:string;link:string;content:string}>("SELECT * FROM notifications ORDER BY user_id")).rows;
const mentionBody = (ids: string[]) => writeTaskComment("@Fernanda pode revisar?", { type:"doc",content:[{type:"paragraph",content:ids.map(id=>({type:"mention",attrs:{id,label:"Fernanda"}}))}] });

it("novo comentário avisa o responsável, não o autor", async () => {
  const inserted = await comment("Revisar a arte");
  const rows = await notifications();
  expect(rows.map(row=>[row.user_id,row.type])).toEqual([[owner,"task_comment"]]);
  expect(rows[0]?.source_id).toBe(inserted.rows[0]?.id);
  expect(rows[0]?.triggered_by_user_id).toBe(actor);
  expect(rows[0]?.link).toBe(`/marketing/projetos?tab=tarefas&task=${task}&comment=${inserted.rows[0]?.id}`);
});
it("avisa a pessoa selecionada com @ e também o responsável", async () => {
  await comment(mentionBody([mentioned]));
  expect((await notifications()).map(row=>[row.user_id,row.type])).toEqual([[owner,"task_comment"],[mentioned,"mention"]]);
});
it("responsável mencionado recebe somente um aviso de menção", async () => {
  await comment(mentionBody([owner,owner]));
  expect((await notifications()).map(row=>[row.user_id,row.type])).toEqual([[owner,"mention"]]);
});
it("não avisa o próprio autor mesmo quando é responsável e se menciona", async () => {
  await db.query("UPDATE marketing_tasks SET assignee_id=$1",[actor]);
  await comment(mentionBody([actor]));
  expect(await notifications()).toEqual([]);
});
it("uma identidade mencionada de outra conta nunca recebe aviso", async () => {
  await comment(mentionBody([foreign]));
  expect((await notifications()).map(row=>row.user_id)).toEqual([owner]);
});
it("pessoa inativa ou sem acesso ao Marketing não recebe menção", async () => {
  await db.query("UPDATE users SET is_active=false WHERE id=$1",[mentioned]);
  await comment(mentionBody([mentioned]));
  expect((await notifications()).map(row=>row.user_id)).toEqual([owner]);
  await db.query("UPDATE users SET is_active=true WHERE id=$1",[mentioned]);
  await db.query("UPDATE user_sector_access SET is_active=false WHERE user_id=$1",[mentioned]);
  await comment(mentionBody([mentioned]));
  expect((await notifications()).map(row=>row.user_id)).toEqual([owner,owner]);
});
it("@fernanda digitado resolve o primeiro nome único da mesma conta", async () => {
  await comment("@fernanda pode revisar?");
  expect((await notifications()).map(row=>[row.user_id,row.type])).toEqual([[owner,"task_comment"],[mentioned,"mention"]]);
});
it("primeiro nome ambíguo não escolhe uma pessoa arbitrariamente", async () => {
  await db.query("UPDATE users SET account_id=$1 WHERE id=$2",[account,foreign]);
  await db.query("UPDATE user_sector_access SET account_id=$1 WHERE user_id=$2",[account,foreign]);
  await comment("@fernanda pode revisar?");
  expect((await notifications()).map(row=>row.user_id)).toEqual([owner]);
  await comment(mentionBody([mentioned]));
  expect((await notifications()).filter(row=>row.type==='mention').map(row=>row.user_id)).toEqual([mentioned]);
});
it("conta técnica não recebe avisos e texto com email não é uma menção", async () => {
  const tv = "4cd93864-3689-4835-bddf-91e2960e7860";
  await db.query("INSERT INTO users VALUES($1,$2,$1,'TV Escritório','tv-escritorio@iamroy.app',true)",[tv,account]);
  await db.query("INSERT INTO user_sector_access VALUES($1,$2,'marketing',true)",[tv,account]);
  await db.query("UPDATE marketing_tasks SET assignee_id=$1",[tv]);
  await comment(mentionBody([tv]));
  expect(await notifications()).toEqual([]);
  await comment("Escreva para contato@fernanda.com");
  expect(await notifications()).toEqual([]);
});
it("invocação autenticada preserva a identidade do autor e não exige INSERT direto em notificações", async () => {
  await db.exec("SET ROLE authenticated");
  await comment("Comentário real de Jessica", owner);
  await db.exec("RESET ROLE");
  expect((await notifications())[0]?.triggered_by_user_id).toBe(actor);
});
it("comentário em tarefa fora do alcance continua rejeitado por RLS", async () => {
  await db.query("UPDATE marketing_tasks SET account_id=$1",[otherAccount]);
  await db.exec("SET ROLE authenticated");
  await expect(comment("Sem acesso")).rejects.toThrow();
  await db.exec("RESET ROLE");
  expect(await notifications()).toEqual([]);
});