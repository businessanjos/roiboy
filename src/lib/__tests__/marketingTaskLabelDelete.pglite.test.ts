// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
const account = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const user = '00000000-0000-4000-8000-000000000011';
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('app.user',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE FUNCTION public.get_my_account_id() RETURNS uuid LANGUAGE sql AS $$SELECT current_setting('app.account')::uuid$$;
    CREATE TABLE marketing_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid, tags text[], custom_fields jsonb, updated_at timestamptz DEFAULT now(), title text, status text, assignee_id uuid, due_date date, allowed boolean DEFAULT true);
    GRANT SELECT, UPDATE ON marketing_tasks TO authenticated;
    ALTER TABLE marketing_tasks ENABLE ROW LEVEL SECURITY;
    CREATE POLICY r ON marketing_tasks FOR SELECT TO authenticated USING(account_id=current_setting('app.account')::uuid);
    CREATE POLICY w ON marketing_tasks FOR UPDATE TO authenticated USING(account_id=current_setting('app.account')::uuid AND allowed) WITH CHECK(account_id=current_setting('app.account')::uuid AND allowed);`);
  await db.exec(readFileSync('drizzle/migrations/0112_marketing_task_label_edit.sql', 'utf8'));
  await db.exec(readFileSync('drizzle/migrations/0117_marketing_task_label_delete.sql', 'utf8'));
}, 20000);
beforeEach(async () => {
  await db.exec('RESET ROLE; DELETE FROM marketing_tasks;');
  await db.query("SELECT set_config('app.user',$1,false),set_config('app.account',$2,false)", [user, account]);
  for (const [acc, status] of [[account, 'pending'], [account, 'done'], [other, 'pending']]) {
    await db.query("INSERT INTO marketing_tasks(account_id,tags,custom_fields,title,status,assignee_id,due_date) VALUES($1,ARRAY['Design',' TESTE   QA '],$2,'TESTE QA',$3,$4,'2026-11-25')", [acc, JSON.stringify({ cover: 'preservada', delivery_details: { due_time: '17:30', requester_id: 'solicitante', label_colors: { design: 'purple', 'teste qa': '#12ab34' } } }), status, user]);
  }
  await db.exec('SET ROLE authenticated');
});
afterAll(async () => { await db.close(); });
const remove = (acc = account, name = 'TESTE QA') => db.query('SELECT * FROM delete_marketing_task_label($1,$2)', [acc, name]);
it('exclui só a etiqueta de todas as tarefas, inclusive concluídas, mantendo tarefas e outros campos', async () => {
  expect((await remove()).rows).toHaveLength(2);
  const rows = (await db.query<{ tags: string[]; custom_fields: any; status: string; title: string; assignee_id: string; due_date: string }>('SELECT *, due_date::text AS due_date FROM marketing_tasks ORDER BY status')).rows;
  expect(rows.map(r => r.tags)).toEqual([['Design'], ['Design']]);
  expect(rows.map(r => r.custom_fields)).toEqual(Array(2).fill({ cover: 'preservada', delivery_details: { due_time: '17:30', requester_id: 'solicitante', label_colors: { design: 'purple' } } }));
  expect(rows.map(r => [r.title, r.status, r.assignee_id, r.due_date])).toEqual([['TESTE QA', 'done', user, '2026-11-25'], ['TESTE QA', 'pending', user, '2026-11-25']]);
});
it('não exclui a etiqueta de outra conta', async () => {
  await remove(); await db.exec('RESET ROLE');
  const row = (await db.query<{ tags: string[]; custom_fields: any }>('SELECT * FROM marketing_tasks WHERE account_id=$1', [other])).rows[0];
  expect(row?.tags).toEqual(['Design', ' TESTE   QA ']);
  expect(row?.custom_fields.delivery_details.label_colors['teste qa']).toBe('#12ab34');
});
it('permissão parcial rejeita tudo sem remover a etiqueta da tarefa liberada', async () => {
  await db.exec("RESET ROLE; UPDATE marketing_tasks SET allowed=false WHERE status='done'; SET ROLE authenticated;");
  await expect(remove()).rejects.toThrow('Sem permissão');
  expect((await db.query<{ tags: string[] }>('SELECT tags FROM marketing_tasks')).rows.map(r => r.tags)).toEqual([['Design', ' TESTE   QA '], ['Design', ' TESTE   QA ']]);
});
it('conta forjada e chamada sem identidade são bloqueadas', async () => {
  await expect(remove(other)).rejects.toThrow('Acesso negado');
  await db.query("SELECT set_config('app.user','',false)");
  await expect(remove()).rejects.toThrow('Acesso negado');
});
it('chamada anônima não recebe concessão de execução', async () => {
  await db.exec('RESET ROLE; SET ROLE anon');
  await expect(remove()).rejects.toThrow('permission denied');
});
it('repetir a exclusão ou remover etiqueta já ausente não altera tarefas', async () => {
  await remove(); const before = (await db.query('SELECT * FROM marketing_tasks ORDER BY id')).rows;
  expect((await remove()).rows).toEqual([]);
  expect((await db.query('SELECT * FROM marketing_tasks ORDER BY id')).rows).toEqual(before);
});
it('etiqueta sem metadados mantém os campos originais intactos', async () => {
  await db.exec("RESET ROLE; UPDATE marketing_tasks SET custom_fields='{}'; SET ROLE authenticated;");
  await remove(); expect((await db.query<{ custom_fields: any }>('SELECT custom_fields FROM marketing_tasks')).rows.map(r => r.custom_fields)).toEqual([{}, {}]);
});