// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
const account = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const actor = "00000000-0000-4000-8000-000000000011";
const authId = "00000000-0000-4000-8000-000000000012";
const root = "00000000-0000-4000-8000-000000000021";
const column = "00000000-0000-4000-8000-000000000031";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.user',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('app.role',true) $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
    CREATE FUNCTION public.get_my_account_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.account',true),'')::uuid $$;
    CREATE TABLE users(id uuid PRIMARY KEY,account_id uuid,auth_user_id uuid,is_active boolean DEFAULT true);
    CREATE TABLE marketing_task_columns(id uuid PRIMARY KEY,account_id uuid,is_done boolean,display_order integer);
    CREATE TABLE marketing_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid,section_id uuid,column_id uuid,title text,description text,assignee_id uuid,due_date date,priority text DEFAULT 'medium',status text DEFAULT 'pending',tags text[],custom_fields jsonb,media_attachments jsonb,display_order integer DEFAULT 0,is_completed boolean DEFAULT false,completed_at timestamptz,created_by uuid);
    CREATE TABLE marketing_task_subtasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid REFERENCES marketing_tasks(id) ON DELETE CASCADE,account_id uuid,title text,assignee_id uuid,due_date date,display_order integer,is_completed boolean,completed_at timestamptz);
    GRANT SELECT ON users,marketing_task_columns TO authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON marketing_tasks,marketing_task_subtasks TO authenticated;
    GRANT ALL ON users,marketing_task_columns,marketing_tasks,marketing_task_subtasks TO service_role;
    ALTER TABLE marketing_tasks ENABLE ROW LEVEL SECURITY;
    CREATE POLICY task_access ON marketing_tasks TO authenticated USING(account_id=public.get_my_account_id()) WITH CHECK(account_id=public.get_my_account_id());`);
  await db.exec(readFileSync("drizzle/migrations/0114_marketing_task_recurrence.sql", "utf8"));
  await db.exec(readFileSync("drizzle/migrations/0115_marketing_task_recurrence_atomic_counts.sql", "utf8"));
  await db.exec(`CREATE FUNCTION qa_fail_recurrence_child() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF current_setting('app.fail_child',true)='yes' AND NEW.task_id<>'${root}'::uuid AND NEW.due_date>='2026-12-15' THEN RAISE EXCEPTION 'QA child failure'; END IF;
    RETURN NEW;
  END; $$;
  CREATE TRIGGER qa_fail_child BEFORE INSERT ON marketing_task_subtasks FOR EACH ROW EXECUTE FUNCTION qa_fail_recurrence_child();`);
}, 20000);
beforeEach(async () => {
  await db.exec("RESET ROLE; DELETE FROM marketing_task_subtasks; DELETE FROM marketing_tasks; DELETE FROM users; DELETE FROM marketing_task_columns;");
  await db.query("SELECT set_config('app.user',$1,false),set_config('app.account',$2,false),set_config('app.role','authenticated',false),set_config('app.fail_child','',false)", [authId, account]);
  await db.query("INSERT INTO users(id,account_id,auth_user_id) VALUES($1,$2,$3)", [actor, account, authId]);
  await db.query("INSERT INTO marketing_task_columns VALUES($1,$2,false,0)", [column, account]);
  await db.exec("SET ROLE authenticated");
});
afterAll(async () => { await db.close(); });
async function insert(rule: unknown = { frequency: "weekly", weekday: 1 }, acc = account) {
  return db.query("INSERT INTO marketing_tasks(id,account_id,title,assignee_id,created_by,due_date,recurrence_rule,tags,custom_fields,description,media_attachments,is_completed,status) VALUES($1,$2,'TESTE QA — Report',$3,$3,'2026-11-30',$4,ARRAY['Report'],$5,'Descrição preservada','[]',true,'done') RETURNING *", [root, acc, actor, JSON.stringify(rule), JSON.stringify({ delivery_details: { due_time: "09:00", requester_id: actor, label_colors: { report: "blue" } } })]);
}
async function service() { await db.exec("RESET ROLE; SET ROLE service_role;"); await db.query("SELECT set_config('app.role','service_role',false),set_config('app.user','',false)"); }
async function prepare() { await insert(); await service(); await db.query("UPDATE marketing_tasks SET recurrence_next_date='2026-12-07' WHERE id=$1", [root]); }
async function run(day = "2026-12-07") { return (await db.query<{ result: { created: number; failures: number } }>("SELECT process_marketing_task_recurrences($1::date) AS result", [day])).rows[0]?.result; }
async function occurrences() { return (await db.query<any>("SELECT t.*,t.due_date::text AS due_date FROM marketing_tasks t WHERE recurrence_source_id=$1 ORDER BY t.due_date", [root])).rows; }

it("report cria uma nova tarefa por segunda-feira, mesmo que a original esteja concluída", async () => {
  await prepare(); expect(await run("2026-12-14")).toEqual({ created: 2, failures: 0 });
  const rows = await occurrences();
  expect(rows.map(r => r.due_date)).toEqual(["2026-12-07", "2026-12-14"]);
  expect(rows.map(r => [r.title,r.status,r.is_completed,r.completed_at,r.assignee_id,r.created_by,r.column_id,r.custom_fields.delivery_details.due_time])).toEqual(Array(2).fill(["TESTE QA — Report","pending",false,null,actor,actor,column,"09:00"]));
  const original = (await db.query<any>("SELECT *,recurrence_next_date::text AS recurrence_next_date FROM marketing_tasks WHERE id=$1", [root])).rows[0];
  expect(original.is_completed).toBe(true); expect(original.status).toBe("done"); expect(original.recurrence_next_date).toBe("2026-12-21");
});
it("reexecutar a rotina não duplica ocorrências", async () => {
  await prepare(); await run(); expect(await run()).toEqual({ created: 0, failures: 0 }); expect(await occurrences()).toHaveLength(1);
});
it("falha em uma subtarefa reverte tarefas e cursor juntos; uma nova execução recupera sem duplicação", async () => {
  await prepare();
  await db.query("INSERT INTO marketing_task_subtasks(task_id,account_id,title,due_date) VALUES($1,$2,'TESTE QA — Falha simulada','2026-12-01')",[root,account]);
  await db.query("SELECT set_config('app.fail_child','yes',false)");
  expect(await run("2026-12-14")).toEqual({created:0,failures:1});
  expect(await occurrences()).toHaveLength(0);
  expect((await db.query<any>("SELECT recurrence_next_date::text AS next FROM marketing_tasks WHERE id=$1",[root])).rows[0]?.next).toBe("2026-12-07");
  await db.query("SELECT set_config('app.fail_child','',false)");
  expect(await run("2026-12-14")).toEqual({created:2,failures:0});
  expect(await occurrences()).toHaveLength(2);
});
it("copia subtarefas pendentes, metadados e dias relativos sem copiar a conclusão", async () => {
  await prepare(); await db.query("INSERT INTO marketing_task_subtasks(task_id,account_id,title,assignee_id,due_date,display_order,is_completed,completed_at) VALUES($1,$2,'TESTE QA — Checklist',$3,'2026-12-01',2,true,now())", [root,account,actor]);
  await run(); const [child] = (await db.query<any>("SELECT *,due_date::text AS due_date FROM marketing_task_subtasks WHERE task_id<>$1", [root])).rows;
  expect([child?.due_date,child?.is_completed,child?.completed_at,child?.assignee_id,child?.display_order]).toEqual(["2026-12-08",false,null,actor,2]);
  const [task] = await occurrences(); expect(task?.tags).toEqual(["Report"]); expect(task?.description).toBe("Descrição preservada"); expect(task?.custom_fields.delivery_details.requester_id).toBe(actor);
});
it("parar a repetição mantém o histórico e não cria novas tarefas", async () => {
  await prepare(); await run(); await db.exec("RESET ROLE; SET ROLE authenticated;"); await db.query("SELECT set_config('app.role','authenticated',false),set_config('app.user',$1,false)",[authId]);
  await db.query("UPDATE marketing_tasks SET recurrence_rule=NULL WHERE id=$1",[root]); await service();
  expect(await run("2026-12-21")).toEqual({ created: 0, failures: 0 }); expect(await occurrences()).toHaveLength(1);
});
it("excluir a original não exclui ocorrências e interrompe o agendamento", async () => {
  await prepare(); await run(); await db.query("DELETE FROM marketing_tasks WHERE id=$1",[root]); expect(await run("2026-12-21")).toEqual({ created: 0, failures: 0 }); expect(await occurrences()).toHaveLength(1);
});
it("autoria é registrada pelo servidor, e datas de execução forjadas são ignoradas", async () => {
  const row = (await insert()).rows[0] as any;
  expect(row.recurrence_author_auth_id).toBe(authId); expect(row.recurrence_creator_id).toBe(actor);
  await db.query("UPDATE marketing_tasks SET recurrence_next_date='2000-01-01',recurrence_author_auth_id=$1 WHERE id=$2",[actor,root]);
  const saved = (await db.query<any>("SELECT * FROM marketing_tasks WHERE id=$1",[root])).rows[0];
  expect(saved?.recurrence_next_date).toEqual(row.recurrence_next_date); expect(saved?.recurrence_author_auth_id).toBe(authId);
});
it("conta diferente, execução pelo usuário e criação manual de ocorrência são bloqueadas", async () => {
  await expect(insert({frequency:"weekly",weekday:1},other)).rejects.toThrow();
  await expect(run()).rejects.toThrow();
  await expect(db.query("INSERT INTO marketing_tasks(account_id,recurrence_source_id) VALUES($1,$2)",[account,root])).rejects.toThrow("automaticamente");
});
it("responsável inativo e autor removido não geram tarefas", async () => {
  await prepare(); await db.query("UPDATE users SET is_active=false WHERE id=$1",[actor]); expect(await run()).toEqual({created:0,failures:0}); expect(await occurrences()).toHaveLength(0);
  await db.query("UPDATE users SET is_active=true,auth_user_id=NULL WHERE id=$1",[actor]); expect(await run()).toEqual({created:0,failures:0});
});
it("uma edição na ocorrência não muda a regra nem a data da original", async () => {
  await prepare(); await run(); const [occurrence]=await occurrences();
  await db.exec("RESET ROLE; SET ROLE authenticated"); await db.query("SELECT set_config('app.role','authenticated',false),set_config('app.user',$1,false)",[authId]);
  await db.query("UPDATE marketing_tasks SET title='TESTE QA — Só esta semana',due_date='2026-12-09' WHERE id=$1",[occurrence.id]);
  await expect(db.query("UPDATE marketing_tasks SET recurrence_rule=$1 WHERE id=$2",[JSON.stringify({frequency:"daily"}),occurrence.id])).rejects.toThrow("original");
  const saved=(await db.query<any>("SELECT title,due_date::text,recurrence_rule,recurrence_next_date::text FROM marketing_tasks WHERE id=$1",[root])).rows[0];
  expect(saved).toEqual({title:"TESTE QA — Report",due_date:"2026-11-30",recurrence_rule:{frequency:"weekly",weekday:1},recurrence_next_date:"2026-12-14"});
});
it("alterar o dia da série afeta somente datas futuras e mantém ocorrências existentes", async () => {
  await prepare(); await run();
  await db.exec("RESET ROLE; SET ROLE authenticated"); await db.query("SELECT set_config('app.role','authenticated',false),set_config('app.user',$1,false)",[authId]);
  await db.query("UPDATE marketing_tasks SET recurrence_rule=$1,due_date='2026-12-01' WHERE id=$2",[JSON.stringify({frequency:"weekly",weekday:2}),root]);
  await service(); expect(await run("2026-12-08")).toEqual({created:1,failures:0});
  expect((await occurrences()).map(r=>r.due_date)).toEqual(["2026-12-07","2026-12-08"]);
});
it.each([{}, {frequency:"weekly",weekday:7}, {frequency:"monthly",month_day:0}, {frequency:"yearly"}])("rejeita repetição inválida %j", async (rule) => { await expect(insert(rule)).rejects.toThrow(); });
it("mensal retorna ao dia 31 após fevereiro e diária avança um dia", async () => {
  const rows=(await db.query<any>("SELECT marketing_task_recurrence_date($1,'2027-01-31')::text AS feb,marketing_task_recurrence_date($1,'2027-02-28')::text AS mar,marketing_task_recurrence_date($2,'2026-11-30')::text AS daily",[JSON.stringify({frequency:"monthly",month_day:31}),JSON.stringify({frequency:"daily"})])).rows;
  expect(rows[0]).toEqual({feb:"2027-02-28",mar:"2027-03-31",daily:"2026-12-01"});
});