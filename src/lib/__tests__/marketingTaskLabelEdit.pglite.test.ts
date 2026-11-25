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
  await db.exec(readFileSync('drizzle/migrations/0112_marketing_task_label_edit.sql','utf8'));
  await db.exec(readFileSync('drizzle/migrations/0113_marketing_task_label_complete_access.sql','utf8'));
  await db.exec(readFileSync('drizzle/migrations/0116_marketing_task_label_custom_colors.sql','utf8'));
}, 20000);
beforeEach(async () => {
  await db.exec('RESET ROLE; DELETE FROM marketing_tasks;');
  await db.query("SELECT set_config('app.user',$1,false),set_config('app.account',$2,false)",[user,account]);
  for (const [acc,status] of [[account,'pending'],[account,'done'],[other,'pending']]) {
    await db.query("INSERT INTO marketing_tasks(account_id,tags,custom_fields,title,status,assignee_id,due_date) VALUES($1,ARRAY['Design','Instagram Eternum'], $2,'TESTE QA',$3,$4,'2026-11-25')",[acc,JSON.stringify({cover:'preservada',delivery_details:{due_time:'17:30',requester_id:'solicitante',label_colors:{design:'purple','instagram eternum':'yellow'}}}),status,user]);
  }
  await db.exec('SET ROLE authenticated');
});
afterAll(async () => { await db.close(); });
const edit = (name='Instagram ROY',color='green',acc=account) => db.query('SELECT * FROM edit_marketing_task_label($1,$2,$3,$4)',[acc,'Instagram Eternum',name,color]);
it('nome e cor atualizam todas as tarefas que usam a etiqueta, inclusive concluídas', async () => {
  expect((await edit()).rows).toHaveLength(2);
  const rows=(await db.query<{tags:string[];custom_fields:any;status:string;title:string;assignee_id:string;due_date:string}>('SELECT * FROM marketing_tasks ORDER BY status')).rows;
  expect(rows.map(r=>r.tags)).toEqual([['Design','Instagram ROY'],['Design','Instagram ROY']]);
  expect(rows.map(r=>r.custom_fields.delivery_details.label_colors)).toEqual([{design:'purple','instagram roy':'green'},{design:'purple','instagram roy':'green'}]);
  expect(rows.map(r=>[r.title,r.status,r.assignee_id,r.custom_fields.cover,r.custom_fields.delivery_details.due_time,r.custom_fields.delivery_details.requester_id])).toEqual([['TESTE QA','done',user,'preservada','17:30','solicitante'],['TESTE QA','pending',user,'preservada','17:30','solicitante']]);
});
it('a mesma etiqueta de outra conta permanece intacta', async () => {
  await edit(); await db.exec('RESET ROLE');
  const row=(await db.query<{tags:string[];custom_fields:any}>('SELECT * FROM marketing_tasks WHERE account_id=$1',[other])).rows[0];
  expect(row?.tags).toEqual(['Design','Instagram Eternum']);
  expect(row?.custom_fields.delivery_details.label_colors['instagram eternum']).toBe('yellow');
});
it('cor pode mudar sem renomear ou duplicar a etiqueta', async () => {
  await edit('Instagram Eternum','red');
  const rows=(await db.query<{tags:string[];custom_fields:any}>('SELECT * FROM marketing_tasks')).rows;
  expect(rows.map(r=>r.tags)).toEqual([['Design','Instagram Eternum'],['Design','Instagram Eternum']]);
  expect(rows.map(r=>r.custom_fields.delivery_details.label_colors['instagram eternum'])).toEqual(['red','red']);
});
it('HEX personalizado atualiza todas as tarefas com normalização sem afetar outro campo', async () => {
  expect((await edit('Instagram Eternum',' #12AB34 ')).rows).toHaveLength(2);
  const rows=(await db.query<{tags:string[];custom_fields:any}>('SELECT * FROM marketing_tasks')).rows;
  expect(rows.map(r=>r.tags)).toEqual([['Design','Instagram Eternum'],['Design','Instagram Eternum']]);
  expect(rows.map(r=>r.custom_fields.delivery_details.label_colors)).toEqual([{design:'purple','instagram eternum':'#12ab34'},{design:'purple','instagram eternum':'#12ab34'}]);
  expect(rows.map(r=>r.custom_fields.delivery_details.due_time)).toEqual(['17:30','17:30']);
});
it('novas cores da paleta seguem a mesma atualização compartilhada', async () => {
  await edit('Instagram Eternum','#ea580c');
  expect((await db.query<{custom_fields:any}>('SELECT custom_fields FROM marketing_tasks')).rows.map(r=>r.custom_fields.delivery_details.label_colors['instagram eternum'])).toEqual(['#ea580c','#ea580c']);
});
it('código personalizado inválido é rejeitado sem alterar a cor existente', async () => {
  for (const color of ['#12', '#xyzxyz', '#12345678', 'url(https://example.test)', 'var(--primary)', '']) await expect(edit('Instagram Eternum',color)).rejects.toThrow('Informe');
  expect((await db.query<{custom_fields:any}>('SELECT custom_fields FROM marketing_tasks')).rows.map(r=>r.custom_fields.delivery_details.label_colors['instagram eternum'])).toEqual(['yellow','yellow']);
});
it('cor personalizada não permite contornar edição parcial negada', async () => {
  await db.exec("RESET ROLE; UPDATE marketing_tasks SET allowed=false WHERE status='done'; SET ROLE authenticated;");
  await expect(edit('Instagram Eternum','#12ab34')).rejects.toThrow('Sem permissão');
  expect((await db.query<{custom_fields:any}>('SELECT custom_fields FROM marketing_tasks')).rows.map(r=>r.custom_fields.delivery_details.label_colors['instagram eternum'])).toEqual(['yellow','yellow']);
});
it('um nome já existente não mescla nem altera tarefas', async () => {
  await expect(edit(' DESIGN ')).rejects.toThrow('Já existe');
  expect((await db.query<{tags:string[]}>('SELECT tags FROM marketing_tasks')).rows.map(r=>r.tags)).toEqual([['Design','Instagram Eternum'],['Design','Instagram Eternum']]);
});
it('permissão parcial rejeita tudo em vez de salvar somente parte das tarefas', async () => {
  await db.exec("RESET ROLE; UPDATE marketing_tasks SET allowed=false WHERE status='done'; SET ROLE authenticated;");
  await expect(edit()).rejects.toThrow();
  const rows=(await db.query<{tags:string[]}>('SELECT tags FROM marketing_tasks')).rows;
  expect(rows.map(r=>r.tags)).toEqual([['Design','Instagram Eternum'],['Design','Instagram Eternum']]);
});
it('conta forjada e chamada anônima são rejeitadas', async () => {
  await expect(edit('Instagram ROY','green',other)).rejects.toThrow('Acesso negado');
  await db.query("SELECT set_config('app.user','',false)");
  await expect(edit()).rejects.toThrow('Acesso negado');
});
it('rótulo removido e valores inválidos falham sem alterações', async () => {
  await expect(edit('','green')).rejects.toThrow('Informe');
  await expect(edit('Instagram ROY','orange')).rejects.toThrow('Informe');
  await expect(db.query('SELECT * FROM edit_marketing_task_label($1,$2,$3,$4)',[account,'Ausente','Novo','blue'])).rejects.toThrow('não está mais disponível');
});